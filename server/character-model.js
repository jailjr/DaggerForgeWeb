const classes = require('../src/content/daggerforge/srd/classes.json');
const ancestries = require('../src/content/daggerforge/srd/ancestries.json');
const communities = require('../src/content/daggerforge/srd/communities.json');
const domains = require('../src/content/daggerforge/srd/domains.json');
const equipment = require('../src/content/daggerforge/srd/equipment.json');

const traits = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];
const emptyTraits = () => Object.fromEntries(traits.map(name => [name, { value: '', marked: false }]));
const cardFor = (name, list) => list.find(item => item.name === name);
const classNames = new Set(classes.map(item => item.name));
const ancestryNames = new Set(ancestries.map(item => item.name));
const communityNames = new Set(communities.map(item => item.name));
const domainNames = new Set(domains.map(item => item.name));
const equipmentNames = new Set([...(equipment.weapons || []), ...(equipment.armor || [])].map(item => item.name));
const subclassFor = (className, subclassName) => {
  const selectedClass = cardFor(className, classes);
  return selectedClass?.subclasses?.[subclassName] || null;
};
const classDomains = className => String(cardFor(className, classes)?.stats?.domains || '').split('&').map(value => value.trim()).filter(Boolean);
const validDomainCard = (card, className, level) => { const name = typeof card === 'string' ? card : card?.name; const source = cardFor(name, domains); return Boolean(source && classDomains(className).includes(source.domain) && Number(source.level) <= Number(level || 1)); };
const armorModifiers = armor => {
  const feature = String(armor?.feature || '');
  return { evasion: feature.includes('Very Heavy') ? -2 : feature.includes('Heavy') ? -1 : feature.includes('Flexible') ? 1 : feature.includes('Difficult') ? -1 : 0, allTraits: feature.includes('Difficult') ? -1 : 0, agility: feature.includes('Very Heavy') ? -1 : 0 };
};

function buildCharacterFromChoices(body, id) {
  const selectedClass = cardFor(body.className, classes);
  const level = Number.isInteger(Number(body.level)) ? Math.min(10, Math.max(1, Number(body.level))) : 1;
  const classTraits = selectedClass?.stats?.suggestedTraits?.split(',').map(x => x.trim()) || [];
  const armor = cardFor(body.armorName || selectedClass?.stats?.suggestedArmor, equipment.armor || []);
  const primary = cardFor(body.primaryWeaponName || body.primaryWeapon || selectedClass?.stats?.suggestedPrimary, equipment.weapons || []);
  const secondary = cardFor(body.secondaryWeaponName || body.secondaryWeapon || selectedClass?.stats?.suggestedSecondary, equipment.weapons || []);
  const experienceNames = Array.isArray(body.experiences) ? body.experiences : [];
  const domainCardNames = Array.isArray(body.domainCardNames) ? body.domainCardNames : [];
  const ancestry = cardFor(body.ancestry, ancestries); const community = cardFor(body.community, communities);
  const domainCards = domainCardNames.map(name => { const card = cardFor(name, domains); return card ? { ...card, inVault: false } : { name: String(name) }; });
  const armorScore = armor?.score ?? 0; const armorAdjustment = armorModifiers(armor); const maxHp = selectedClass?.stats?.hp ?? (Number.isFinite(Number(body.hpMax)) ? Number(body.hpMax) : 6);
  const submittedTraits = body.traits && typeof body.traits === 'object' ? Object.fromEntries(traits.map(name => [name, { value: String((body.traits[name]?.value ?? body.traits[name] ?? classTraits[traits.indexOf(name)] ?? '')), marked: Boolean(body.traits[name]?.marked) }])) : Object.fromEntries(traits.map((name, index) => [name, { value: classTraits[index] || '', marked: false }]));
  const submittedExperiences = experienceNames.slice(0, 2).map(item => typeof item === 'object' ? { text: String(item.text || '').slice(0, 120), modifier: String(item.modifier || '+2') } : { text: String(item).slice(0, 120), modifier: '+2' });
  const submittedInventory = Array.isArray(body.inventory) ? body.inventory.slice(0, 50).map(item => String(item).slice(0, 160)) : [];
  return { id, name: String(body.name || 'New Character').slice(0, 120), className: selectedClass?.name || String(body.className || ''), subclassName: String(body.subclassName || ''), ancestry: ancestry?.name || String(body.ancestry || ''), community: community?.name || String(body.community || ''), color: String(body.color || '#a88be3'), initials: String(body.initials || body.name || 'PC').split(/\s+/).map(x => x[0]).join('').slice(0, 4), level, hp: Number.isInteger(Number(body.hp)) ? Number(body.hp) : 0, hpMax: maxHp, hope: Number.isInteger(Number(body.hope)) ? Number(body.hope) : 2, stress: Number.isInteger(Number(body.stress)) ? Number(body.stress) : 0, armor: armorScore, armorName: armor?.name || '', armorFeature: armor?.feature || '', armorSlots: [], hopeMax: 6, stressMax: 6, evasion: selectedClass?.stats?.evasion == null ? null : selectedClass.stats.evasion + armorAdjustment.evasion, armorScore, majorThreshold: armor ? armor.minor + level : null, severeThreshold: armor ? armor.major + level : null, traits: submittedTraits, experiences: submittedExperiences, domainCards, ancestryCard: ancestry || null, communityCard: community || null, primaryWeapon: primary ? weaponRecord(primary, 'Primary') : null, secondaryWeapon: secondary ? weaponRecord(secondary, 'Secondary') : null, complete: body.complete === true, ownerId: null, inventory: submittedInventory, privateNotes: String(body.privateNotes || '').slice(0, 5000), version: 1, lastFieldVersions: {} };
}

function weaponRecord(source, slot) { return { sourceId: source.id, name: source.name, traitRange: `${source.trait} - ${source.range}`, damageDice: `${source.damage} ${source.damageType === 'Magical' ? 'mag' : 'phy'}`, burden: source.burden || '', feature: source.feature || '', slot }; }

function validateCharacterModel(character, changes) {
  const merged = { ...character, ...changes }; const requiredText = [['name', 120], ['className', 80], ['ancestry', 80]];
  for (const [key, max] of requiredText) if (key in changes && (typeof changes[key] !== 'string' || !changes[key].trim() || changes[key].length > max)) return `${key} is required and must be ${max} characters or fewer.`;
  if ('className' in changes && !classNames.has(changes.className)) return 'Choose a class from the Daggerheart content set.';
  if ('ancestry' in changes && !ancestryNames.has(changes.ancestry)) return 'Choose an ancestry from the Daggerheart content set.';
  if ('community' in changes && changes.community && !communityNames.has(changes.community)) return 'Choose a community from the Daggerheart content set.';
  if (merged.subclassName && !subclassFor(merged.className, merged.subclassName)) return 'Choose a subclass that belongs to the selected class.';
  if ('armorName' in changes && changes.armorName && !cardFor(changes.armorName, equipment.armor || [])) return 'Choose armor from the Daggerheart equipment set.';
  const numeric = [['hp', 0, Number(merged.hpMax || 0)], ['hpMax', 1, 24], ['hope', 0, 6], ['stress', 0, 6], ['armor', 0, 12], ['level', 1, 10], ['evasion', 0, 30], ['armorScore', 0, 30], ['majorThreshold', 0, 60], ['severeThreshold', 0, 60]];
  for (const [key, min, max] of numeric) if (key in changes && changes[key] !== null && (!Number.isInteger(Number(changes[key])) || Number(changes[key]) < min || Number(changes[key]) > max)) return `${key} must be an integer between ${min} and ${max}.`;
  if (Number(merged.hp) > Number(merged.hpMax)) return 'HP cannot exceed HP maximum.';
  if ('hpMax' in changes && Number(changes.hpMax) < Number(character.hp || 0)) return 'HP maximum cannot be lower than current HP.';
  if ('traits' in changes && (!changes.traits || typeof changes.traits !== 'object' || Array.isArray(changes.traits) || traits.some(name => !changes.traits[name] || typeof changes.traits[name].value !== 'string' || !/^[-+]?\d+$/.test(changes.traits[name].value) || Number(changes.traits[name].value) < -3 || Number(changes.traits[name].value) > 3))) return 'Traits must contain all six modifiers from -3 to +3.';
  if ('experiences' in changes && (!Array.isArray(changes.experiences) || changes.experiences.length > 2 || changes.experiences.some(item => !item || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 120 || typeof item.modifier !== 'string' || !/^[-+]?\d+$/.test(item.modifier)))) return 'Characters may have up to two experiences with text and numeric modifiers.';
  if ('domainCards' in changes && (!Array.isArray(changes.domainCards) || changes.domainCards.length > 50 || changes.domainCards.some(item => !item || !domainNames.has(typeof item === 'string' ? item : item.name) || !validDomainCard(item, merged.className, merged.level)))) return 'Choose cards from your class domains at or below your character level.';
  for (const key of ['primaryWeapon', 'secondaryWeapon']) if (key in changes && changes[key] && (!changes[key].name || (changes[key].sourceId && !equipmentNames.has(changes[key].name)))) return `${key} must reference a known equipment entry.`;
  if ('inventory' in changes && (!Array.isArray(changes.inventory) || changes.inventory.length > 50 || changes.inventory.some(item => typeof item !== 'string' || !item.trim() || item.length > 160))) return 'Inventory must contain at most 50 named items.';
  if (merged.complete === true && (!merged.name?.trim() || !classNames.has(merged.className) || !ancestryNames.has(merged.ancestry) || !communityNames.has(merged.community) || !subclassFor(merged.className, merged.subclassName) || !cardFor(merged.armorName, equipment.armor || []) || !merged.traits || traits.some(name => !merged.traits[name] || !/^[-+]?\d+$/.test(String(merged.traits[name].value))) || (Array.isArray(merged.domainCards) && merged.domainCards.some(item => !validDomainCard(item, merged.className, merged.level))))) return 'A complete character needs identity, heritage, class, subclass, armor, valid domain cards, and all six traits.';
  return null;
}

function applyDerivedValues(character, changes) {
  const merged = { ...character, ...changes }; const selectedClass = cardFor(merged.className, classes); const armor = cardFor(merged.armorName, equipment.armor || []); const modifiers = armorModifiers(armor); const next = { ...changes };
  if ('className' in changes && !('hpMax' in changes) && selectedClass?.stats?.hp !== undefined) next.hpMax = selectedClass.stats.hp;
  if (('className' in changes || 'armorName' in changes || 'level' in changes) && !('evasion' in changes) && selectedClass?.stats?.evasion !== undefined) next.evasion = selectedClass.stats.evasion + modifiers.evasion;
  if ('armorName' in changes && armor) { next.armor = armor.score; next.armorScore = armor.score; next.armorFeature = armor.feature || ''; next.majorThreshold = armor.minor + Number(merged.level || 1); next.severeThreshold = armor.major + Number(merged.level || 1); }
  if ('level' in changes && armor) { next.majorThreshold = armor.minor + Number(changes.level); next.severeThreshold = armor.major + Number(changes.level); }
  if ('armor' in changes && !('armorScore' in changes) && !('armorName' in changes)) next.armorScore = Number(changes.armor);
  return next;
}

module.exports = { buildCharacterFromChoices, validateCharacterModel, applyDerivedValues, emptyTraits };
