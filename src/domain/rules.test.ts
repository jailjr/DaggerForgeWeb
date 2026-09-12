import { describe, expect, it } from 'vitest';
import { canEditCharacter, claimCharacter } from './rules';

describe('character authority', () => {
  it('locks player configuration in play mode', () => {
    expect(canEditCharacter('PLAYER', 'PLAY', true, 'configuration')).toBe(false);
    expect(canEditCharacter('PLAYER', 'PLAY', true, 'runtime')).toBe(true);
    expect(canEditCharacter('GM', 'PLAY', false, 'configuration')).toBe(true);
  });
  it('claims atomically at the domain boundary', () => {
    expect(claimCharacter(undefined, 'p1').ok).toBe(true);
    expect(claimCharacter('p1', 'p2')).toEqual({ ok: false, reason: 'This character is already assigned.' });
  });
});
