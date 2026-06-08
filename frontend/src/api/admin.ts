import { authHeaders } from './client';

const ADMIN_SESSION_KEY = 'admin-token';

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_SESSION_KEY);
}

export function setAdminToken(token: string): void {
  sessionStorage.setItem(ADMIN_SESSION_KEY, token);
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

function adminHeaders(): Record<string, string> {
  const token = getAdminToken();
  return {
    ...authHeaders(),
    ...(token ? { 'X-Admin-Token': token } : {}),
  };
}

export async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: adminHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function adminPost<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function adminDelete(path: string): Promise<void> {
  const res = await fetch(path, {
    method: 'DELETE',
    headers: adminHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
}
