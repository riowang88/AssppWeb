export interface TraceContext {
  traceId: string;
  action: string;
  enabled: boolean;
}

type TraceValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | TraceValue[]
  | { [key: string]: TraceValue };

const traceStorageKey = 'asspp:trace';
const sensitiveKeyPattern =
  /password|token|cookie|dsid|directoryservicesidentifier|appleid|email/i;
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const longSecretPattern = /\b[A-Za-z0-9+/=_-]{16,}\b/g;

export function createTrace(action: string): TraceContext {
  return {
    traceId: generateTraceId(),
    action,
    enabled: isTraceEnabled(),
  };
}

export function childTrace(
  trace: TraceContext | undefined,
  action: string,
): TraceContext | undefined {
  if (!trace) return undefined;
  return { ...trace, action };
}

export function traceLog(
  trace: TraceContext | undefined,
  event: string,
  data: Record<string, TraceValue> = {},
): void {
  if (!trace?.enabled) return;

  console.info('[AssppTrace]', {
    traceId: trace.traceId,
    action: trace.action,
    event,
    ...redactObject(data),
  });
}

export function classifyBody(body: string): string {
  const trimmed = body.trimStart();
  if (!trimmed) return 'empty';
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<plist')) {
    return trimmed.includes('<plist') ? 'plist' : 'xml';
  }
  if (trimmed.startsWith('<html') || trimmed.startsWith('<!DOCTYPE html')) {
    return 'html';
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }
  return 'other';
}

export function safeBodyPreview(body: string, limit = 120): string {
  return redactString(body.slice(0, limit).replace(/\s+/g, ' ').trim());
}

export function safePath(path: string): string {
  const [pathname, query] = path.split('?', 2);
  if (!query) return pathname;

  const params = new URLSearchParams(query);
  for (const key of Array.from(params.keys())) {
    params.set(key, '[value]');
  }
  return `${pathname}?${params.toString()}`;
}

function isTraceEnabled(): boolean {
  try {
    return (
      window.localStorage.getItem(traceStorageKey) === '1' ||
      window.sessionStorage.getItem(traceStorageKey) === '1'
    );
  } catch {
    return false;
  }
}

function generateTraceId(): string {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(16).slice(2, 10);
  return `asspp-${Date.now().toString(36)}-${suffix}`;
}

function redactObject(data: Record<string, TraceValue>): Record<string, TraceValue> {
  const result: Record<string, TraceValue> = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = redactValue(key, value);
  }
  return result;
}

function redactValue(key: string, value: TraceValue): TraceValue {
  if (value === null || value === undefined) return value;
  if (sensitiveKeyPattern.test(key)) return '[redacted]';
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(key, item));
  }
  if (typeof value === 'object') {
    const result: Record<string, TraceValue> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      result[childKey] = redactValue(childKey, childValue);
    }
    return result;
  }
  return value;
}

function redactString(value: string): string {
  return value
    .replace(emailPattern, '[email]')
    .replace(longSecretPattern, '[secret]');
}
