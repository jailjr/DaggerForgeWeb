export type CampaignMode = 'PREPARATION' | 'PLAY';
export type Role = 'GM' | 'PLAYER';
export type CharacterPermission = 'configuration' | 'runtime';

/** Server-side rule table to share with the API implementation. */
export function canEditCharacter(role: Role, mode: CampaignMode, ownsCharacter: boolean, area: CharacterPermission) {
  if (role === 'GM') return true;
  if (!ownsCharacter) return false;
  return mode === 'PREPARATION' || area === 'runtime';
}

export function claimCharacter(currentOwner: string | undefined, participantId: string) {
  if (currentOwner && currentOwner !== participantId) return { ok: false as const, reason: 'This character is already assigned.' };
  return { ok: true as const, owner: participantId };
}
