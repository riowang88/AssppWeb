import { appleRequest } from './request';
import { buildPlist, parsePlist, PlistParseError } from './plist';
import { extractAndMergeCookies } from './cookies';
import { fetchBag, defaultAuthURL } from './bag';
import { safePath, traceLog } from './trace';
import i18n from '../i18n';
import type { Account, Cookie } from '../types';
import type { TraceContext } from './trace';

export class AuthenticationError extends Error {
  constructor(
    message: string,
    public readonly codeRequired: boolean = false,
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

class TransientAuthResponseError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "TransientAuthResponseError";
  }
}

export async function authenticate(
  email: string,
  password: string,
  code?: string,
  existingCookies?: Cookie[],
  deviceId: string = '',
  trace?: TraceContext,
): Promise<Account> {
  const initialCookies: Cookie[] = existingCookies ? [...existingCookies] : [];
  let cookies: Cookie[] = [...initialCookies];
  let storeFront = "";
  let lastError: Error | null = null;

  const authEndpoints: URL[] = [];
  const bag = await fetchBag(deviceId);
  authEndpoints.push(withGuid(bag.authURL, deviceId));
  const fallbackEndpoint = withGuid(defaultAuthURL, deviceId);
  if (!sameEndpoint(authEndpoints[0], fallbackEndpoint)) {
    authEndpoints.push(fallbackEndpoint);
  }

  traceLog(trace, 'auth-endpoints', {
    endpointCount: authEndpoints.length,
    primaryHost: authEndpoints[0].hostname,
    primaryPath: authEndpoints[0].pathname,
    hasFallback: authEndpoints.length > 1,
  });

  const maxAttempts = 3;

  for (let endpointIndex = 0; endpointIndex < authEndpoints.length; endpointIndex++) {
    const authEndpoint = authEndpoints[endpointIndex];
    let requestHost = authEndpoint.hostname;
    let requestPath = `${authEndpoint.pathname}${authEndpoint.search}`;
    let currentAttempt = 0;
    let redirectAttempt = 0;
    let exhaustedTransientResponse = false;

    if (endpointIndex > 0) {
      cookies = [...initialCookies];
      traceLog(trace, 'auth-fallback-endpoint', {
        endpointIndex,
        host: authEndpoint.hostname,
        path: authEndpoint.pathname,
      });
    }

    while (currentAttempt < maxAttempts && redirectAttempt <= 3) {
      currentAttempt++;
      traceLog(trace, 'auth-attempt', {
        endpointIndex,
        attempt: currentAttempt,
        redirectAttempt,
        host: requestHost,
        path: safePath(requestPath),
        hasCode: Boolean(code),
      });

      try {
        const body: Record<string, string> = {
          appleId: email,
          attempt: code ? "2" : "4",
          createSession: "true",
          guid: deviceId,
          password: code ? `${password}${code}` : password,
          rmp: "0",
          why: "signIn",
        };

        const plistBody = buildPlist(body);

        const headers: Record<string, string> = {
          "Content-Type": "application/x-www-form-urlencoded",
        };

        const response = await appleRequest({
          method: "POST",
          host: requestHost,
          path: requestPath,
          headers,
          body: plistBody,
          cookies,
          trace,
          stage: 'authenticate',
        });

        cookies = extractAndMergeCookies(response.rawHeaders, cookies);

        // Read store front
        const storeHeader = response.headers["x-set-apple-store-front"];
        if (storeHeader) {
          const parts = storeHeader.split("-");
          if (parts[0]) {
            storeFront = parts[0];
          }
        }

        // Read pod
        const podHeader = response.headers["pod"];
        const pod = podHeader || undefined;

        // Handle redirect
        if (isRedirectStatus(response.status)) {
          const location = response.headers["location"];
          if (!location) {
            traceLog(trace, 'auth-redirect-missing-location', {
              endpointIndex,
              attempt: currentAttempt,
              redirectAttempt,
              host: requestHost,
              path: safePath(requestPath),
              status: response.status,
            });
            throw new TransientAuthResponseError(
              i18n.t("errors.auth.redirectLocation"),
            );
          }
          const url = new URL(location, `https://${requestHost}`);
          requestHost = url.hostname;
          requestPath = url.pathname + url.search;
          currentAttempt--;
          redirectAttempt++;
          traceLog(trace, 'auth-redirect-follow', {
            endpointIndex,
            redirectAttempt,
            host: requestHost,
            path: safePath(requestPath),
          });
          continue;
        }

        // Handle non-plist responses (e.g. 403 with empty body)
        if (!response.body.trim()) {
          throw new TransientAuthResponseError(
            i18n.t("errors.auth.emptyBody", { status: response.status }),
            response.status,
          );
        }

        const dict = parsePlist(response.body) as Record<string, any>;

        // Check for 2FA requirement
        if (
          dict.failureType === "" &&
          !code &&
          dict.customerMessage === "MZFinance.BadLogin.Configurator_message"
        ) {
          traceLog(trace, 'auth-requires-verification', { endpointIndex });
          throw new AuthenticationError(
            i18n.t("errors.auth.requiresVerification"),
            true,
          );
        }

        const failureMessage =
          (dict.dialog as Record<string, any>)?.explanation ??
          dict.customerMessage;

        const accountInfo = dict.accountInfo as Record<string, any>;
        if (!accountInfo) {
          throw new Error(
            failureMessage ?? i18n.t("errors.auth.missingAccountInfo"),
          );
        }

        const address = accountInfo.address as Record<string, any>;
        if (!address) {
          throw new Error(failureMessage ?? i18n.t("errors.auth.missingAddress"));
        }

        const account: Account = {
          email,
          password,
          appleId: (accountInfo.appleId as string) ?? "",
          store: storeFront,
          firstName: (address.firstName as string) ?? "",
          lastName: (address.lastName as string) ?? "",
          passwordToken: (dict.passwordToken as string) ?? "",
          directoryServicesIdentifier: String(dict.dsPersonId ?? ""),
          cookies,
          deviceIdentifier: deviceId,
          pod,
        };

        traceLog(trace, 'auth-success', {
          endpointIndex,
          storeFront: Boolean(storeFront),
          hasPasswordToken: Boolean(account.passwordToken),
          hasDsid: Boolean(account.directoryServicesIdentifier),
          hasPod: Boolean(pod),
          cookieCount: cookies.length,
        });

        return account;
      } catch (e) {
        if (e instanceof AuthenticationError) throw e;
        const error = e instanceof Error ? e : new Error(String(e));
        if (isTransientAuthResponseError(error)) {
          exhaustedTransientResponse = true;
          lastError = isForbiddenEmptyAuthResponse(error)
            ? new Error(i18n.t("errors.auth.interactiveRequired"))
            : new Error(i18n.t("errors.auth.unexpectedResponse"));
          traceLog(trace, 'auth-transient-error', {
            endpointIndex,
            attempt: currentAttempt,
            errorName: error.name,
            errorMessage: error.message,
            willRetry: currentAttempt < maxAttempts,
          });
          if (currentAttempt < maxAttempts) {
            await wait(250 * currentAttempt);
            continue;
          }
          break;
        }
        lastError = error;
        traceLog(trace, 'auth-hard-error', {
          endpointIndex,
          attempt: currentAttempt,
          errorName: error.name,
          errorMessage: error.message,
        });
        throw error;
      }
    }

    if (!exhaustedTransientResponse) {
      break;
    }
  }

  throw lastError ?? new Error(i18n.t("errors.auth.unknownReason"));
}

function isTransientAuthResponseError(error: Error): boolean {
  return (
    error instanceof TransientAuthResponseError ||
    (error instanceof PlistParseError &&
      (error.kind === "empty" ||
        error.kind === "non-plist" ||
        error.kind === "invalid-xml"))
  );
}

function isForbiddenEmptyAuthResponse(error: Error): boolean {
  return error instanceof TransientAuthResponseError && error.status === 403;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function withGuid(rawURL: string, deviceId: string): URL {
  const url = new URL(rawURL);
  url.searchParams.set("guid", deviceId);
  return url;
}

function sameEndpoint(a: URL, b: URL): boolean {
  return a.origin === b.origin && a.pathname === b.pathname;
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}
