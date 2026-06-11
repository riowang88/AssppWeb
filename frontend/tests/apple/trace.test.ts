import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyBody,
  createTrace,
  safeBodyPreview,
  safePath,
  traceLog,
} from '../../src/apple/trace';

describe('apple/trace', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('classifies response bodies without parsing them', () => {
    expect(classifyBody('')).toBe('empty');
    expect(classifyBody('<?xml version="1.0"?><plist></plist>')).toBe('plist');
    expect(classifyBody('<html><title>503</title>')).toBe('html');
    expect(classifyBody('{"error":true}')).toBe('json');
    expect(classifyBody('Service Unavailable')).toBe('other');
  });

  it('redacts sensitive body preview content', () => {
    const preview = safeBodyPreview(
      'email test@example.com token abcdefghijklmnopqrstuvwxyz012345',
    );

    expect(preview).not.toContain('test@example.com');
    expect(preview).not.toContain('abcdefghijklmnopqrstuvwxyz012345');
    expect(preview).toContain('[email]');
    expect(preview).toContain('[secret]');
  });

  it('strips query parameter values from logged paths', () => {
    expect(safePath('/auth?guid=aabbccddeeff&foo=bar')).toBe(
      '/auth?guid=%5Bvalue%5D&foo=%5Bvalue%5D',
    );
  });

  it('only logs when explicitly enabled and redacts sensitive fields', () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    traceLog(createTrace('disabled'), 'event', { email: 'test@example.com' });

    expect(consoleSpy).not.toHaveBeenCalled();

    window.localStorage.setItem('asspp:trace', '1');
    traceLog(createTrace('enabled'), 'event', {
      email: 'test@example.com',
      passwordToken: 'secret-token',
      setCookieCount: 2,
      hasPasswordToken: true,
      status: 503,
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const payload = consoleSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.email).toBe('[redacted]');
    expect(payload.passwordToken).toBe('[redacted]');
    expect(payload.setCookieCount).toBe(2);
    expect(payload.hasPasswordToken).toBe(true);
    expect(payload.status).toBe(503);
  });
});
