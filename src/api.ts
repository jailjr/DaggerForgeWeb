export type ApiSession = { campaignId: string; token: string; role: 'GM' | 'PLAYER' };

const sessionKey = 'df-api-session';
// The production image serves the client and API from the same origin. Local
// Vite development keeps the API on its separate port unless explicitly
// overridden with VITE_API_URL.
export function apiBase() {
  if (import.meta.env.VITE_API_URL) return String(import.meta.env.VITE_API_URL).replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location.port === '5173') return 'http://127.0.0.1:8787';
  return '';
}
export function getApiSession(): ApiSession | null {
  try { const value = localStorage.getItem(sessionKey); return value ? JSON.parse(value) : null; } catch { return null; }
}
export function setApiSession(session: ApiSession | null) { if (session) localStorage.setItem(sessionKey, JSON.stringify(session)); else localStorage.removeItem(sessionKey); }
export async function establishApiSession(campaignId: string, accessToken: string) { const response = await fetch(`${apiBase()}/api/session`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ campaignId, accessToken }) }); if (!response.ok) throw new Error('Unable to establish secure session.'); return response.json(); }
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = apiBase();
  const session = getApiSession(); const headers = new Headers(init.headers); headers.set('content-type', 'application/json'); if (session) headers.set('authorization', `Bearer ${session.token}`);
  const response = await fetch(`${base}${path}`, { ...init, headers, credentials: 'include' }); if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || `API request failed (${response.status})`); return response.json();
}

export type RealtimeEvent = { id?: string; type?: string; operation?: string; entityType?: string; entityId?: string; createdAt?: string; [key: string]: unknown };
export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';
export function startCampaignRealtime(campaignId: string, handlers: { onStatus?: (status: RealtimeStatus) => void; onEvent: (event: RealtimeEvent) => void; onPresence?: (presence: unknown) => void }) {
  let source: EventSource | null = null; let stopped = false; let delay = 1000; let heartbeat: number | undefined; const seen = new Set<string>();
  const recover = async () => { try { const data = await apiRequest<{ events: RealtimeEvent[] }>(`/api/campaigns/${campaignId}/events?limit=100&offset=0`); (data.events || []).slice().reverse().forEach(event => { if (!event.id || !seen.has(event.id)) { if (event.id) seen.add(event.id); handlers.onEvent(event); } }); } catch {} };
  const connect = async () => { if (stopped) return; handlers.onStatus?.(delay === 1000 ? 'connecting' : 'reconnecting'); await recover(); if (stopped) return; source = new EventSource(`${apiBase()}/api/campaigns/${campaignId}/stream`, { withCredentials: true }); source.onopen = () => { delay = 1000; handlers.onStatus?.('connected'); }; source.onmessage = event => { try { const value = JSON.parse(event.data) as RealtimeEvent; if (value.id && seen.has(value.id)) return; if (value.id) seen.add(value.id); if (value.type !== 'connected') handlers.onEvent(value); } catch {} }; source.onerror = () => { source?.close(); source = null; if (!stopped) { handlers.onStatus?.('reconnecting'); window.setTimeout(connect, delay); delay = Math.min(delay * 2, 30000); } }; };
  heartbeat = window.setInterval(() => { apiRequest<{ presence: unknown }>(`/api/campaigns/${campaignId}/presence`, { method: 'POST', body: '{}' }).then(data => handlers.onPresence?.(data.presence)).catch(() => {}); }, 20000);
  apiRequest<{ presence: unknown }>(`/api/campaigns/${campaignId}/presence`, { method: 'POST', body: '{}' }).then(data => handlers.onPresence?.(data.presence)).catch(() => {}); connect();
  return () => { stopped = true; if (heartbeat) window.clearInterval(heartbeat); source?.close(); handlers.onStatus?.('offline'); };
}
