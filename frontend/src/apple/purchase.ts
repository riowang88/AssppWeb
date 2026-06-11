import { appleRequest } from './request';
import { buildPlist, parsePlist } from './plist';
import { extractAndMergeCookies } from './cookies';
import { purchaseAPIHost } from './config';
import { traceLog } from './trace';
import i18n from '../i18n';
import type { Account, Software } from '../types';
import type { TraceContext } from './trace';

export class PurchaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly reauthenticationRequired: boolean = false,
  ) {
    super(message);
    this.name = "PurchaseError";
  }
}

export function isPurchaseReauthenticationRequired(error: unknown): boolean {
  return error instanceof PurchaseError && error.reauthenticationRequired;
}

export async function purchaseApp(
  account: Account,
  app: Software,
  trace?: TraceContext,
): Promise<{ updatedCookies: typeof account.cookies }> {
  if ((app.price ?? 0) > 0) {
    throw new PurchaseError(i18n.t("errors.purchase.paidNotSupported"));
  }

  try {
    return await purchaseWithParams(account, app, "STDQ", trace);
  } catch (e) {
    // Rely on error code instead of translated message string to prevent matching issues
    if (e instanceof PurchaseError && e.code === "2059") {
      traceLog(trace, 'purchase-retry-game-params', { code: e.code });
      return await purchaseWithParams(account, app, "GAME", trace);
    }
    throw e;
  }
}

async function purchaseWithParams(
  account: Account,
  app: Software,
  pricingParameters: string,
  trace?: TraceContext,
): Promise<{ updatedCookies: typeof account.cookies }> {
  const deviceId = account.deviceIdentifier;
  const host = purchaseAPIHost(account.pod);
  const path = "/WebObjects/MZFinance.woa/wa/buyProduct";

  const payload: Record<string, any> = {
    appExtVrsId: "0",
    hasAskedToFulfillPreorder: "true",
    buyWithoutAuthorization: "true",
    hasDoneAgeCheck: "true",
    guid: deviceId,
    needDiv: "0",
    origPage: `Software-${app.id}`,
    origPageLocation: "Buy",
    price: "0",
    pricingParameters,
    productType: "C",
    salableAdamId: app.id,
  };

  const plistBody = buildPlist(payload);

  const headers: Record<string, string> = {
    "Content-Type": "application/x-apple-plist",
    "iCloud-DSID": account.directoryServicesIdentifier,
    "X-Dsid": account.directoryServicesIdentifier,
    "X-Apple-Store-Front": `${account.store}-1`,
    "X-Token": account.passwordToken,
  };

  const response = await appleRequest({
    method: "POST",
    host,
    path,
    headers,
    body: plistBody,
    cookies: account.cookies,
    trace,
    stage: `purchase:${pricingParameters}`,
  });

  const updatedCookies = extractAndMergeCookies(
    response.rawHeaders,
    account.cookies,
  );

  if (!response.body.trim()) {
    traceLog(trace, 'purchase-empty-body', {
      pricingParameters,
      host,
      status: response.status,
    });
    throw new PurchaseError(
      `Purchase failed: HTTP ${response.status} with empty body`,
      String(response.status),
    );
  }

  const dict = parsePlist(response.body) as Record<string, any>;

  if (dict.failureType) {
    const failureType = String(dict.failureType);
    const customerMessage = dict.customerMessage as string | undefined;
    traceLog(trace, 'purchase-failure', {
      pricingParameters,
      host,
      failureType,
      customerMessage,
      reauthenticationRequired:
        failureType === "2034" ||
        failureType === "2042" ||
        customerMessage === "Your password has changed.",
    });
    switch (failureType) {
      case "2059":
        throw new PurchaseError(i18n.t("errors.purchase.unavailable"), "2059");
      case "2034":
      case "2042":
        throw new PurchaseError(
          i18n.t("errors.purchase.passwordExpired"),
          failureType,
          true,
        );
      default: {
        if (customerMessage === "Your password has changed.") {
          throw new PurchaseError(
            i18n.t("errors.purchase.passwordExpired"),
            failureType,
            true,
          );
        }
        if (customerMessage === "Subscription Required") {
          throw new PurchaseError(
            i18n.t("errors.purchase.subscriptionRequired"),
            failureType,
          );
        }
        // Check for terms page action
        const action = dict.action as Record<string, any> | undefined;
        if (action) {
          const actionUrl = (action.url || action.URL) as string | undefined;
          if (actionUrl && actionUrl.endsWith("termsPage")) {
            throw new PurchaseError(
              i18n.t("errors.purchase.termsRequired", { url: actionUrl }),
              failureType,
            );
          }
        }

        throw new PurchaseError(
          customerMessage
            ? `${customerMessage} (code: ${failureType})`
            : i18n.t("errors.purchase.failed", { failureType }),
          failureType,
        );
      }
    }
  }

  const jingleDocType = dict.jingleDocType as string | undefined;
  const status = dict.status as number | undefined;

  if (jingleDocType !== "purchaseSuccess" || status !== 0) {
    traceLog(trace, 'purchase-unexpected-success-shape', {
      pricingParameters,
      host,
      jingleDocType,
      status,
    });
    throw new PurchaseError(i18n.t("errors.purchase.failedGeneral"));
  }

  traceLog(trace, 'purchase-success', {
    pricingParameters,
    host,
    updatedCookieCount: updatedCookies.length,
  });

  return { updatedCookies };
}
