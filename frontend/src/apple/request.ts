import { libcurl, initLibcurl } from './libcurl-init';
import { buildCookieHeader } from './cookies';
import { classifyBody, safeBodyPreview, safePath, traceLog } from './trace';
import { userAgent } from './config';
import type { Cookie } from '../types';
import type { TraceContext } from './trace';

export interface AppleRequestOptions {
  host: string;
  path: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  cookies?: Cookie[];
  trace?: TraceContext;
  stage?: string;
}

export interface AppleResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  rawHeaders: [string, string][];
  body: string;
}

export async function appleRequest(
  opts: AppleRequestOptions,
): Promise<AppleResponse> {
  await initLibcurl();

  const url = `https://${opts.host}${opts.path}`;
  const headers: Record<string, string> = {
    "User-Agent": userAgent,
    ...opts.headers,
  };
  let cookieHeader = "";

  if (opts.cookies?.length) {
    cookieHeader = buildCookieHeader(opts.cookies, url);
    if (cookieHeader) {
      headers["Cookie"] = cookieHeader;
    }
  }

  traceLog(opts.trace, 'apple-request-start', {
    stage: opts.stage,
    method: opts.method,
    host: opts.host,
    path: safePath(opts.path),
    requestBodyLength: opts.body?.length ?? 0,
    requestBodyKind: opts.body ? classifyBody(opts.body) : 'empty',
    requestHeaderNames: safeHeaderNames(headers),
    hasCookieHeader: Boolean(cookieHeader),
    inputCookieCount: opts.cookies?.length ?? 0,
    matchedCookiePairCount: countCookiePairs(cookieHeader),
    hasGuidQuery: hasQueryParam(opts.path, 'guid'),
    guidQueryUppercase: isQueryParamUppercase(opts.path, 'guid'),
  });

  const startedAt = performance.now();
  const resp = await libcurl.fetch(url, {
    method: opts.method,
    headers,
    body: opts.body,
    redirect: 'manual',
    _libcurl_http_version: 1.1,
  });

  const responseHeaders: Record<string, string> = {};
  for (const [key, value] of resp.raw_headers) {
    responseHeaders[key.toLowerCase()] = value;
  }

  const body = await resp.text();
  const durationMs = Math.round(performance.now() - startedAt);
  const headerNames = Array.from(
    new Set(resp.raw_headers.map(([key]) => key.toLowerCase())),
  ).filter((key) => key !== 'set-cookie');
  const setCookieCount = resp.raw_headers.filter(
    ([key]) => key.toLowerCase() === 'set-cookie',
  ).length;

  traceLog(opts.trace, 'apple-request', {
    stage: opts.stage,
    method: opts.method,
    host: opts.host,
    path: safePath(opts.path),
    status: resp.status,
    statusText: resp.statusText,
    contentType: responseHeaders['content-type'],
    bodyLength: body.length,
    bodyKind: classifyBody(body),
    bodyPreview: safeBodyPreview(body),
    durationMs,
    isRedirect: resp.status >= 300 && resp.status < 400,
    hasLocation: Boolean(responseHeaders.location),
    headerNames,
    setCookieCount,
    hasPod: Boolean(responseHeaders.pod),
    hasStoreFront: Boolean(responseHeaders['x-set-apple-store-front']),
  });

  return {
    status: resp.status,
    statusText: resp.statusText,
    headers: responseHeaders,
    rawHeaders: resp.raw_headers,
    body,
  };
}

function safeHeaderNames(headers: Record<string, string>): string[] {
  return Object.keys(headers)
    .map((key) => key.toLowerCase())
    .filter((key) => key !== 'cookie')
    .sort();
}

function countCookiePairs(cookieHeader: string): number {
  if (!cookieHeader) return 0;
  return cookieHeader.split(';').filter((item) => item.trim()).length;
}

function hasQueryParam(path: string, key: string): boolean {
  return queryParams(path)?.has(key) ?? false;
}

function isQueryParamUppercase(path: string, key: string): boolean | undefined {
  const value = queryParams(path)?.get(key);
  if (!value) return undefined;
  return value === value.toUpperCase();
}

function queryParams(path: string): URLSearchParams | undefined {
  const query = path.split('?', 2)[1];
  if (!query) return undefined;
  return new URLSearchParams(query);
}
