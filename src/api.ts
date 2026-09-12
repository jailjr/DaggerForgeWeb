export type ApiSession = { campaignId: string; token: string; role: 'GM' | 'PLAYER' };

const sessionKey = 'df-api-session';
export function getApiSession(): ApiSession | null {
  try { const value = localStorage.getItem(sessionKey); return value ? JSON.parse(value) : null; } catch { return null; }
}
export function setApiSession(session: ApiSession | null) { if (session) localStorage.setItem(sessionKey, JSON.stringify(session)); else localStorage.removeItem(sessionKey); }
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8787';
  const session = getApiSession(); const headers = new Headers(init.headers); headers.set('content-type', 'application/json'); if (session) headers.set('authorization', `Bearer ${session.token}`);
  const response = await fetch(`${base}${path}`, { ...init, headers }); if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || `API request failed (${response.status})`); return response.json();
}
