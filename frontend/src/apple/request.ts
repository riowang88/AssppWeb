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

  if (opts.cookies?.length) {
    const cookieHeader = buildCookieHeader(opts.cookies, url);
    if (cookieHeader) {
      headers["Cookie"] = cookieHeader;
    }
  }

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
  });

  return {
    status: resp.status,
    statusText: resp.statusText,
    headers: responseHeaders,
    rawHeaders: resp.raw_headers,
    body,
  };
}
