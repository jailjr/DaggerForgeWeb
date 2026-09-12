const classes = require('../src/content/daggerforge/srd/classes.json');
const ancestries = require('../src/content/daggerforge/srd/ancestries.json');
const communities = require('../src/content/daggerforge/srd/communities.json');
const domains = require('../src/content/daggerforge/srd/domains.json');
const equipment = require('../src/content/daggerforge/srd/equipment.json');

const traits = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];
const emptyTraits = () => Object.fromEntries(traits.map(name => [name, { value: '', marked: false }]));
const cardFor = (name, list) => list.find(item => item.name === name);

function buildCharacterFromChoices(body, id) {
  const selectedClass = cardFor(body.className, classes);
  const level = Number.isInteger(Number(body.level)) ? Math.min(10, Math.max(1, Number(body.level))) : 1;
  const classTraits = selectedClass?.stats?.suggestedTraits?.split(',').map(x => x.trim()) || [];
  const armor = cardFor(body.armorName || selectedClass?.stats?.suggestedArmor, equipment.armor || []);
  const primary = cardFor(body.primaryWeaponName || selectedClass?.stats?.suggestedPrimary, equipment.weapons || []);
  const secondary = cardFor(body.secondaryWeaponName || selectedClass?.stats?.suggestedSecondary, equipment.weapons || []);
  const experienceNames = Array.isArray(body.experiences) ? body.experiences : [];
  const domainNames = Array.isArray(body.domainCardNames) ? body.domainCardNames : [];
  const ancestry = cardFor(body.ancestry, ancestries);
  const community = cardFor(body.community, communities);
  const domainCards = domainNames.map(name => cardFor(name, domains)).filter(Boolean).map(card => ({ ...card, inVault: false }));
  const armorScore = armor?.score ?? 0;
  const maxHp = selectedClass?.stats?.hp ?? (Number.isFinite(Number(body.hpMax)) ? Number(body.hpMax) : 6);
  return {
    id, name: String(body.name || 'New Character').slice(0, 120), className: selectedClass?.name || String(body.className || ''), subclassName: String(body.subclassName || ''), ancestry: ancestry?.name || String(body.ancestry || ''), community: community?.name || String(body.community || ''), color: String(body.color || '#a88be3'), initials: String(body.initials || body.name || 'PC').split(/\s+/).map(x => x[0]).join('').slice(0, 4), level, hp: 0, hpMax: maxHp, hope: 2, stress: 0, armor: armorScore, armorSlots: [], hopeMax: 6, stressMax: 6, evasion: selectedClass?.stats?.evasion ?? null, armorScore, majorThreshold: armor ? armor.minor + level : null, severeThreshold: armor ? armor.major + level : null,
    traits: Object.fromEntries(traits.map((name, index) => [name, { value: classTraits[index] || '', marked: false }])), experiences: experienceNames.slice(0, 5).map(text => ({ text: String(text).slice(0, 120), modifier: '+2' })), domainCards, ancestryCard: ancestry || null, communityCard: community || null,
    primaryWeapon: primary ? { name: primary.name, traitRange: `${primary.trait} - ${primary.range}`, damageDice: `${primary.damage} ${primary.damageType === 'Magical' ? 'mag' : 'phy'}`, feature: primary.feature || '' } : null, secondaryWeapon: secondary ? { name: secondary.name, traitRange: `${secondary.trait} - ${secondary.range}`, damageDice: `${secondary.damage} ${secondary.damageType === 'Magical' ? 'mag' : 'phy'}`, feature: secondary.feature || '' } : null,
    complete: false, ownerId: null, inventory: ["Torch, 50 feet of rope, basic supplies, a Minor Health Potion or Minor Stamina Potion"], privateNotes: '', version: 1
  };
}

function validateCharacterModel(character, changes) {
  const allowedArrays = ['traits', 'experiences', 'domainCards', 'inventory', 'armorSlots'];
  for (const key of allowedArrays) if (key in changes && !Array.isArray(changes[key]) && key !== 'traits') return `${key} must be an array.`;
  if ('traits' in changes && (!changes.traits || typeof changes.traits !== 'object' || traits.some(name => !changes.traits[name] || typeof changes.traits[name].value !== 'string'))) return 'Traits must contain all six Daggerheart traits.';
  if ('experiences' in changes && changes.experiences.length > 20) return 'A character may have at most 20 experience rows.';
  if ('domainCards' in changes && changes.domainCards.length > 50) return 'A character may have at most 50 domain cards.';
  if ('level' in changes && (!Number.isInteger(Number(changes.level)) || Number(changes.level) < 1 || Number(changes.level) > 10)) return 'Level must be between 1 and 10.';
  return null;
}

module.exports = { buildCharacterFromChoices, validateCharacterModel };
