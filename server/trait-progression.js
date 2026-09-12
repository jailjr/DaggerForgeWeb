const traitNames = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];
const traitLabels = { agility: 'Agility', strength: 'Strength', finesse: 'Finesse', instinct: 'Instinct', presence: 'Presence', knowledge: 'Knowledge' };
const MAX_TRAIT_VALUE = 5;
const MAX_TRAIT_ADVANCEMENT_USES = 3;

function tierForLevel(level) {
  const value = Math.max(1, Math.min(10, Number(level) || 1));
  return value >= 8 ? 4 : value >= 5 ? 3 : value >= 2 ? 2 : 1;
}

function traitValue(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function formatTraitValue(value) {
  const number = traitValue(value);
  return number === null ? String(value ?? '') : number > 0 ? `+${number}` : String(number);
}

function normalizeTraitProgression(character) {
  const tier = tierForLevel(character.level);
  const current = character.traitProgression && typeof character.traitProgression === 'object' ? character.traitProgression : {};
  const sameTier = Number(current.tier) === tier;
  return {
    tier,
    increasedTraits: sameTier && Array.isArray(current.increasedTraits) ? [...new Set(current.increasedTraits.filter(name => traitNames.includes(name)))] : [],
    traitAdvancementUses: sameTier ? Math.max(0, Math.min(MAX_TRAIT_ADVANCEMENT_USES, Number(current.traitAdvancementUses) || 0)) : 0,
    hpAdvancements: Math.max(0, Math.min(12, Number(current.hpAdvancements) || 0)),
    stressAdvancements: Math.max(0, Math.min(12, Number(current.stressAdvancements) || 0)),
    history: Array.isArray(current.history) ? current.history : [],
    advancements: Array.isArray(current.advancements) ? current.advancements : [],
  };
}

function normalizeCharacterTraits(character) {
  const traits = character.traits && typeof character.traits === 'object' ? character.traits : {};
  const normalized = {};
  traitNames.forEach(name => {
    const raw = traits[name];
    const value = raw && typeof raw === 'object' ? raw.value : raw;
    normalized[name] = { value: formatTraitValue(value), marked: false };
  });
  return normalized;
}

function normalizeCharacterProgression(character) {
  const normalized = { ...character, traits: normalizeCharacterTraits(character) };
  normalized.traitProgression = normalizeTraitProgression(normalized);
  return normalized;
}

module.exports = { traitNames, traitLabels, MAX_TRAIT_VALUE, MAX_TRAIT_ADVANCEMENT_USES, tierForLevel, traitValue, formatTraitValue, normalizeTraitProgression, normalizeCharacterTraits, normalizeCharacterProgression };
