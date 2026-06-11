import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appleRequest } from '../../src/apple/request';
import type { TraceContext } from '../../src/apple/trace';

const mocks = vi.hoisted(() => ({
  initLibcurl: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('../../src/apple/libcurl-init', () => ({
  initLibcurl: mocks.initLibcurl,
  libcurl: {
    fetch: mocks.fetch,
  },
}));

describe('apple/request', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    mocks.initLibcurl.mockResolvedValue(undefined);
    mocks.fetch.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      raw_headers: [
        ['content-type', 'text/xml; charset=UTF-8'],
        ['set-cookie', 'session=value'],
      ],
      text: vi.fn().mockResolvedValue('<?xml version="1.0"?><plist></plist>'),
    });
  });

  it('logs safe request metadata without header values or request body', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    window.localStorage.setItem('asspp:trace', '1');
    const trace: TraceContext = {
      traceId: 'trace-1',
      action: 'authenticate',
      enabled: true,
    };

    await appleRequest({
      method: 'POST',
      host: 'buy.itunes.apple.com',
      path: '/WebObjects/MZFinance.woa/wa/authenticate?guid=AABBCCDDEEFF',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Token': 'sample-token-marker',
      },
      body: '<?xml version="1.0"?><plist><dict><key>sampleBodyMarker</key></dict></plist>',
      cookies: [
        {
          name: 'session',
          value: 'sample-cookie-marker',
          path: '/',
          domain: 'itunes.apple.com',
          secure: true,
        },
      ],
      trace,
      stage: 'authenticate',
    });

    const startPayload = consoleSpy.mock.calls.find(
      (call) => (call[1] as Record<string, unknown>).event === 'apple-request-start',
    )?.[1] as Record<string, unknown>;
    expect(startPayload).toMatchObject({
      requestBodyLength: expect.any(Number),
      requestBodyKind: 'plist',
      hasCookieHeader: true,
      inputCookieCount: 1,
      matchedCookiePairCount: 1,
      hasGuidQuery: true,
      guidQueryUppercase: true,
    });
    expect(startPayload.requestHeaderNames).toEqual([
      'accept',
      'content-type',
      'user-agent',
      'x-token',
    ]);

    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).not.toContain('sample-token-marker');
    expect(logged).not.toContain('sample-cookie-marker');
    expect(logged).not.toContain('<key>sampleBodyMarker</key>');
  });
});
