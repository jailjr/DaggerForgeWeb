export type AccessContext = {
  campaignId: string;
  name: string;
  role: 'GM' | 'PLAYER';
  token: string;
  participantId?: string;
};

const contextsKey = 'df-access-contexts';

export function getAccessContexts(): AccessContext[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(contextsKey) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function rememberAccessContext(context: AccessContext) {
  const contexts = getAccessContexts().filter(item => item.campaignId !== context.campaignId || item.role !== context.role);
  sessionStorage.setItem(contextsKey, JSON.stringify([context, ...contexts].slice(0, 20)));
}

export function forgetAccessContext(campaignId: string, role?: AccessContext['role']) {
  const contexts = getAccessContexts().filter(item => item.campaignId !== campaignId || (role && item.role !== role));
  sessionStorage.setItem(contextsKey, JSON.stringify(contexts));
}
