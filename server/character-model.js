const classes = require('../src/content/daggerforge/srd/classes.json');
const ancestries = require('../src/content/daggerforge/srd/ancestries.json');
const communities = require('../src/content/daggerforge/srd/communities.json');
const domains = require('../src/content/daggerforge/srd/domains.json');
const equipment = require('../src/content/daggerforge/srd/equipment.json');
const beastforms = require('../src/content/daggerforge/srd/beastforms.json');

const traits = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];
const traitPool = ['+2', '+1', '+1', '0', '0', '-1'];
const allEquipment = [...(equipment.weapons || []), ...(equipment.armor || [])];
const cardFor = (value, list = []) => list.find(item => item.name === value || item.id === value);
const classNames = new Set(classes.map(item => item.name));
const ancestryNames = new Set(ancestries.map(item => item.name));
const communityNames = new Set(communities.map(item => item.name));
const domainNames = new Set(domains.map(item => item.name));
const equipmentNames = new Set(allEquipment.map(item => item.name));
const emptyTraits = () => Object.fromEntries(traits.map(name => [name, { value: '', marked: false }]));
function canonicalTraitValue(value) { const numeric = Number(value); return Number.isInteger(numeric) ? (numeric > 0 ? `+${numeric}` : String(numeric)) : String(value ?? ''); }

function featureText(features = []) {
  return features.map(feature => typeof feature === 'string' ? feature : `${feature.name || ''}: ${feature.description || ''}`).join(' ');
}

function subclassFor(className, subclassName) {
  const selectedClass = cardFor(className, classes);
  return selectedClass?.subclasses?.[subclassName] || null;
}

function classDomains(className) {
  return String(cardFor(className, classes)?.stats?.domains || '').split('&').map(value => value.trim()).filter(Boolean);
}

function unlockedSubclassFeatures(subclass, level) {
  return [...(subclass?.foundation || []), ...(Number(level) >= 5 ? subclass?.specialization || [] : []), ...(Number(level) >= 8 ? subclass?.mastery || [] : [])];
}

function featureBonuses(features = []) {
  const text = featureText(features);
  return {
    hitPoints: (text.match(/additional Hit Point slot/gi) || []).length,
    stress: (text.match(/additional Stress slot/gi) || []).length,
    allThresholds: Number(text.match(/permanent \+(\d+) bonus to all damage thresholds/i)?.[1] || 0),
    severeThresholds: Number(text.match(/permanent \+(\d+) bonus to (?:your )?Severe damage threshold/i)?.[1] || 0),
  };
}

function armorModifiers(armor) {
  const feature = String(armor?.feature || '');
  return {
    evasion: feature.includes('Very Heavy') ? -2 : feature.includes('Heavy') ? -1 : feature.includes('Flexible') ? 1 : feature.includes('Difficult') ? -1 : 0,
    allTraits: feature.includes('Difficult') ? -1 : 0,
    agility: feature.includes('Very Heavy') ? -1 : 0,
  };
}

function derivedValuesFor(character) {
  const selectedClass = cardFor(character.className, classes);
  const ancestry = cardFor(character.ancestry, ancestries);
  const armor = cardFor(character.armorId || character.armorName, equipment.armor || []);
  const subclass = subclassFor(character.className, character.subclassName);
  const subclassBonuses = featureBonuses(unlockedSubclassFeatures(subclass, character.level));
  const ancestryBonuses = featureBonuses(ancestry?.features || []);
  const evasion = selectedClass?.stats?.evasion == null ? null : Number(selectedClass.stats.evasion) + armorModifiers(armor).evasion;
  const hpMax = selectedClass?.stats?.hp == null ? null : Number(selectedClass.stats.hp) + ancestryBonuses.hitPoints + subclassBonuses.hitPoints;
  const stressMax = 6 + ancestryBonuses.stress + subclassBonuses.stress;
  const allThresholdBonus = ancestryBonuses.allThresholds + subclassBonuses.allThresholds;
  const severeThresholdBonus = ancestryBonuses.severeThresholds + subclassBonuses.severeThresholds;
  return {
    hpMax,
    stressMax,
    evasion,
    armorScore: armor?.score ?? 0,
    armorId: armor?.id || '',
    armorName: armor?.name || '',
    armorFeature: armor?.feature || '',
    majorThreshold: armor ? Number(armor.minor) + Number(character.level || 1) + allThresholdBonus : null,
    severeThreshold: armor ? Number(armor.major) + Number(character.level || 1) + allThresholdBonus + severeThresholdBonus : null,
  };
}

function validTraitDistribution(values) {
  const normalized = Object.fromEntries(traits.map(name => [name, canonicalTraitValue(values?.[name]?.value ?? values?.[name] ?? '')]));
  return traits.every(name => /^[-+]?\d+$/.test(String(values?.[name]?.value ?? values?.[name] ?? ''))) && traitPool.every(value => Object.values(normalized).filter(item => item === value).length === traitPool.filter(item => item === value).length);
}

function validDomainCard(card, className, level) {
  const source = cardFor(typeof card === 'string' ? card : card?.id || card?.name, domains);
  return Boolean(source && classDomains(className).includes(source.domain) && Number(source.level) <= Number(level || 1));
}

function validBeastform(name) { return beastforms.find(item => item.name === name); }

function specializedFor(body, className) {
  const result = {};
  if (className === 'Druid') { result.beastformName = String(body.beastformName || ''); result.beastformStress = Number.isInteger(Number(body.beastformStress)) ? Number(body.beastformStress) : 0; }
  if (className === 'Druid' && body.subclassName === 'Warden of the Elements') result.channelElement = String(body.channelElement || '');
  if (className === 'Ranger' && body.subclassName === 'Beastbound') result.companion = { name: String(body.companion?.name || body.companionName || ''), evasion: 10, stress: Number(body.companion?.stress || 0), stressMax: 6, experiences: Array.isArray(body.companion?.experiences) ? body.companion.experiences.slice(0, 2) : [] };
  if (className === 'Sorcerer' && body.subclassName === 'Elemental Origin') result.element = String(body.element || '');
  if (className === 'Seraph' && body.subclassName === 'Divine Wielder') result.prayerDice = Array.isArray(body.prayerDice) ? body.prayerDice.filter(value => Number.isInteger(Number(value))).map(Number).slice(0, 12) : [];
  if (className === 'Warrior' && body.subclassName === 'Call of the Slayer') result.slayerDice = Array.isArray(body.slayerDice) ? body.slayerDice.filter(value => Number.isInteger(Number(value))).map(Number).slice(0, 12) : [];
  return result;
}

function weaponRecord(source, slot) {
  if (!source) return null;
  return { sourceId: source.id, name: source.name, trait: source.trait || '', range: source.range || '', damage: source.damage || '', damageType: source.damageType || '', traitRange: `${source.trait || ''} - ${source.range || ''}`, damageDice: `${source.damage || ''} ${source.damageType === 'Magical' ? 'mag' : 'phy'}`, burden: source.burden || '', feature: source.feature || '', slot };
}

function buildCharacterFromChoices(body, id) {
  const selectedClass = cardFor(body.className, classes);
  const level = Number.isInteger(Number(body.level)) ? Math.min(10, Math.max(1, Number(body.level))) : 1;
  const classTraits = selectedClass?.stats?.suggestedTraits?.split(',').map(value => value.trim()) || [];
  const armor = cardFor(body.armorId || body.armorName || selectedClass?.stats?.suggestedArmor, equipment.armor || []);
  const primary = cardFor(body.primaryWeaponId || body.primaryWeaponName || body.primaryWeapon || selectedClass?.stats?.suggestedPrimary, equipment.weapons || []);
  const secondary = cardFor(body.secondaryWeaponId || body.secondaryWeaponName || body.secondaryWeapon || selectedClass?.stats?.suggestedSecondary, equipment.weapons || []);
  const ancestry = cardFor(body.ancestry, ancestries); const community = cardFor(body.community, communities); const selectedSubclass = subclassFor(body.className, body.subclassName); const subclassFeatures = unlockedSubclassFeatures(selectedSubclass, level);
  const derived = derivedValuesFor({ className: selectedClass?.name || body.className, ancestry: ancestry?.name || body.ancestry, subclassName: body.subclassName, level, armorId: armor?.id });
  const domainCardNames = Array.isArray(body.domainCardNames) ? body.domainCardNames : [];
  const domainCards = domainCardNames.slice(0, 11).map((value, index) => { const card = cardFor(value?.id || value?.name || value, domains); return card ? { ...card, inVault: index >= 5 } : { name: String(value), inVault: index >= 5 }; });
  const submittedTraits = body.traits && typeof body.traits === 'object' ? Object.fromEntries(traits.map(name => [name, { value: canonicalTraitValue(body.traits[name]?.value ?? body.traits[name] ?? classTraits[traits.indexOf(name)] ?? ''), marked: Boolean(body.traits[name]?.marked) }])) : Object.fromEntries(traits.map((name, index) => [name, { value: canonicalTraitValue(classTraits[index] || ''), marked: false }]));
  const submittedExperiences = (Array.isArray(body.experiences) ? body.experiences : []).slice(0, 2).map(item => typeof item === 'object' ? { text: String(item.text || '').slice(0, 120), modifier: String(item.modifier || '+2') } : { text: String(item).slice(0, 120), modifier: '+2' });
  const classStarter = String(selectedClass?.items || '').trim(); const starterInventory = [armor?.name, primary?.name, secondary?.name, classStarter].filter(Boolean);
  const submittedInventory = Array.from(new Set([...starterInventory, ...(Array.isArray(body.inventory) ? body.inventory : [])])).slice(0, 50).map(item => String(item).slice(0, 160));
  const normalizeAnswers = value => Array.isArray(value) ? value.slice(0, 3).map(item => typeof item === 'object' ? { question: String(item.question || '').slice(0, 500), answer: String(item.answer || '').slice(0, 2000) } : { question: '', answer: String(item || '').slice(0, 2000) }) : [];
  return { id, name: String(body.name || 'New Character').slice(0, 120), className: selectedClass?.name || String(body.className || ''), subclassName: String(body.subclassName || ''), ancestry: ancestry?.name || String(body.ancestry || ''), community: community?.name || String(body.community || ''), color: String(body.color || '#a88be3'), initials: String(body.initials || body.name || 'PC').split(/\s+/).map(x => x[0]).join('').slice(0, 4), level, hp: Number.isInteger(Number(body.hp)) ? Number(body.hp) : derived.hpMax, hpMax: derived.hpMax, hope: Number.isInteger(Number(body.hope)) ? Number(body.hope) : 2, hopeMax: 6, stress: Number.isInteger(Number(body.stress)) ? Number(body.stress) : 0, stressMax: derived.stressMax, armor: derived.armorScore, armorScore: derived.armorScore, armorId: derived.armorId, armorName: derived.armorName, armorFeature: derived.armorFeature, armorSlots: Array.from({ length: derived.armorScore }, (_, index) => ({ id: index + 1, marked: false })), evasion: derived.evasion, majorThreshold: derived.majorThreshold, severeThreshold: derived.severeThreshold, traits: submittedTraits, experiences: submittedExperiences, domainCards, ancestryCard: ancestry || null, communityCard: community || null, primaryWeapon: weaponRecord(primary, 'Primary'), secondaryWeapon: weaponRecord(secondary, 'Secondary'), complete: body.complete === true, ancestryFeatures: ancestry?.features || [], communityFeatures: community?.features || [], classFeatures: [...(selectedClass?.classFeatures || []), ...subclassFeatures], classBackgroundQuestions: selectedClass?.backgroundQuestions || [], classConnectionQuestions: selectedClass?.connectionQuestions || [], backgroundAnswers: normalizeAnswers(body.backgroundAnswers), connectionAnswers: normalizeAnswers(body.connectionAnswers), ownerId: null, inventory: submittedInventory, privateNotes: String(body.privateNotes || '').slice(0, 5000), ...specializedFor(body, selectedClass?.name || String(body.className || '')), version: 1, lastFieldVersions: {} };
}

function validateCharacterModel(character, changes) {
  const merged = { ...character, ...changes }; const requiredText = [['name', 120], ['className', 80], ['ancestry', 80]];
  for (const [key, max] of requiredText) if (key in changes && (typeof changes[key] !== 'string' || !changes[key].trim() || changes[key].length > max)) return `${key} is required and must be ${max} characters or fewer.`;
  if ('className' in changes && !classNames.has(changes.className)) return 'Choose a class from the Daggerheart content set.';
  if ('ancestry' in changes && !ancestryNames.has(changes.ancestry)) return 'Choose an ancestry from the Daggerheart content set.';
  if ('community' in changes && changes.community && !communityNames.has(changes.community)) return 'Choose a community from the Daggerheart content set.';
  if (merged.subclassName && !subclassFor(merged.className, merged.subclassName)) return 'Choose a subclass that belongs to the selected class.';
  if (('armorName' in changes || 'armorId' in changes) && merged.armorName && !cardFor(merged.armorId || merged.armorName, equipment.armor || [])) return 'Choose armor from the Daggerheart equipment set.';
  const numeric = [['hp', 0, Number(merged.hpMax || 0)], ['hpMax', 1, 24], ['hope', 0, Number(merged.hopeMax || 6)], ['hopeMax', 1, 12], ['stress', 0, Number(merged.stressMax || 6)], ['stressMax', 1, 24], ['armor', 0, 30], ['level', 1, 10], ['evasion', 0, 30], ['armorScore', 0, 30], ['majorThreshold', 0, 60], ['severeThreshold', 0, 60], ['beastformStress', 0, 6]];
  for (const [key, min, max] of numeric) if (key in changes && changes[key] !== null && (!Number.isInteger(Number(changes[key])) || Number(changes[key]) < min || Number(changes[key]) > max)) return `${key} must be an integer between ${min} and ${max}.`;
  if (Number(merged.hp) > Number(merged.hpMax)) return 'HP cannot exceed HP maximum.';
  if ('hpMax' in changes && Number(changes.hpMax) < Number(character.hp || 0)) return 'HP maximum cannot be lower than current HP.';
  const derived = derivedValuesFor(merged); for (const key of ['hpMax', 'stressMax', 'evasion', 'armorScore', 'majorThreshold', 'severeThreshold']) if (key in changes && derived[key] !== null && Number(changes[key]) !== Number(derived[key])) return `${key} is derived from the selected character options and cannot be overridden.`;
  if ('traits' in changes && (!changes.traits || typeof changes.traits !== 'object' || Array.isArray(changes.traits) || traits.some(name => !changes.traits[name] || typeof changes.traits[name].value !== 'string' || !/^[-+]?\d+$/.test(changes.traits[name].value) || Number(changes.traits[name].value) < -3 || Number(changes.traits[name].value) > 3))) return 'Traits must contain all six modifiers from -3 to +3.';
  if ('experiences' in changes && (!Array.isArray(changes.experiences) || changes.experiences.length > 2 || changes.experiences.some(item => !item || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 120 || typeof item.modifier !== 'string' || !/^[-+]?\d+$/.test(item.modifier)))) return 'Characters may have up to two experiences with text and numeric modifiers.';
  if ('domainCards' in changes && (!Array.isArray(changes.domainCards) || changes.domainCards.length > 50 || changes.domainCards.filter(item => typeof item === 'object' && item && !item.inVault).length > 5 || changes.domainCards.some(item => !item || !domainNames.has(typeof item === 'string' ? item : item.name) || !validDomainCard(item, merged.className, merged.level)))) return 'Choose cards from your class domains at or below your character level.';
  for (const key of ['primaryWeapon', 'secondaryWeapon']) if (key in changes && changes[key] && (!changes[key].name || (changes[key].sourceId && !equipmentNames.has(changes[key].name)))) return `${key} must reference a known equipment entry.`;
  if ('armorSlots' in changes && (!Array.isArray(changes.armorSlots) || changes.armorSlots.length !== Number(merged.armorScore || 0) || changes.armorSlots.some(slot => !slot || !Number.isInteger(Number(slot.id)) || typeof slot.marked !== 'boolean'))) return 'Armor slots must match the currently equipped armor.';
  if ('inventory' in changes && (!Array.isArray(changes.inventory) || changes.inventory.length > 50 || changes.inventory.some(item => typeof item !== 'string' || !item.trim() || item.length > 160))) return 'Inventory must contain at most 50 named items.';
  if ('beastformName' in changes && changes.beastformName && !validBeastform(changes.beastformName)) return 'Choose a valid Beastform.';
  if (merged.className === 'Druid' && merged.beastformName && !validBeastform(merged.beastformName)) return 'Choose a valid Beastform.';
  if (merged.className === 'Druid' && merged.subclassName === 'Warden of the Elements' && merged.channelElement && !['air', 'earth', 'fire', 'water'].includes(String(merged.channelElement).toLowerCase())) return 'Choose air, earth, fire, or water as your element.';
  if ('prayerDice' in changes && (!Array.isArray(changes.prayerDice) || changes.prayerDice.length > 12 || changes.prayerDice.some(value => !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 4))) return 'Prayer Dice must contain up to twelve d4 values.';
  if ('slayerDice' in changes && (!Array.isArray(changes.slayerDice) || changes.slayerDice.length > 12 || changes.slayerDice.some(value => !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 6))) return 'Slayer Dice must contain up to twelve d6 values.';
  if (merged.className === 'Ranger' && merged.subclassName === 'Beastbound' && merged.companion && (!String(merged.companion.name || '').trim() || !Array.isArray(merged.companion.experiences) || merged.companion.experiences.length > 2 || Number(merged.companion.stress) < 0 || Number(merged.companion.stress) > Number(merged.companion.stressMax || 6))) return 'Beastbound characters need a named companion with valid Stress and up to two Experiences.';
  if (merged.className === 'Sorcerer' && merged.subclassName === 'Elemental Origin' && merged.element && !['air', 'earth', 'fire', 'lightning', 'water'].includes(String(merged.element).toLowerCase())) return 'Choose a valid elemental origin.';
  if ('backgroundAnswers' in changes && (!Array.isArray(changes.backgroundAnswers) || changes.backgroundAnswers.length > 3 || changes.backgroundAnswers.some(item => !item || typeof item.answer !== 'string' || item.answer.length > 2000))) return 'Background answers must be up to three text responses.';
  if ('connectionAnswers' in changes && (!Array.isArray(changes.connectionAnswers) || changes.connectionAnswers.length > 3 || changes.connectionAnswers.some(item => !item || typeof item.answer !== 'string' || item.answer.length > 2000))) return 'Connection answers must be up to three text responses.';
  if (merged.complete === true && (!merged.name?.trim() || !classNames.has(merged.className) || !ancestryNames.has(merged.ancestry) || !communityNames.has(merged.community) || !subclassFor(merged.className, merged.subclassName) || !cardFor(merged.armorId || merged.armorName, equipment.armor || []) || !validTraitDistribution(merged.traits) || !Array.isArray(merged.experiences) || merged.experiences.length !== 2 || merged.experiences.some(item => !item || !String(item.text || '').trim()) || !Array.isArray(merged.domainCards) || merged.domainCards.length < 2 || merged.domainCards.length > Math.min(11, Number(merged.level || 1) + 1) || merged.domainCards.filter(item => typeof item === 'object' && item && !item.inVault).length > 5 || merged.domainCards.some(item => !validDomainCard(item, merged.className, merged.level)) || (merged.className === 'Druid' && !merged.beastformName) || (merged.className === 'Ranger' && merged.subclassName === 'Beastbound' && !merged.companion?.name) || (merged.className === 'Sorcerer' && merged.subclassName === 'Elemental Origin' && !merged.element))) return 'A complete character needs identity, heritage, class, subclass, armor, valid domain cards, all six traits, and any required class-specific configuration.';
  return null;
}

function applyDerivedValues(character, changes) {
  const merged = { ...character, ...changes }; const selectedClass = cardFor(merged.className, classes); const subclass = subclassFor(merged.className, merged.subclassName); const ancestry = cardFor(merged.ancestry, ancestries); const armorLookup = Object.prototype.hasOwnProperty.call(changes, 'armorId') ? changes.armorId : Object.prototype.hasOwnProperty.call(changes, 'armorName') ? changes.armorName : (merged.armorId || merged.armorName); const armor = cardFor(armorLookup, equipment.armor || []); const primary = cardFor(merged.primaryWeapon?.sourceId || merged.primaryWeapon?.name || merged.primaryWeapon, equipment.weapons || []); const secondary = cardFor(merged.secondaryWeapon?.sourceId || merged.secondaryWeapon?.name || merged.secondaryWeapon, equipment.weapons || []); const configChanged = ['className', 'subclassName', 'ancestry', 'community', 'armorName', 'armorId', 'level'].some(key => Object.prototype.hasOwnProperty.call(changes, key)); const derived = configChanged ? derivedValuesFor({ ...merged, armorId: armor?.id || '' }) : {}; const next = { ...changes, ...derived };
  if ('traits' in changes && changes.traits && typeof changes.traits === 'object') next.traits = Object.fromEntries(traits.map(name => [name, { value: canonicalTraitValue(changes.traits[name]?.value ?? changes.traits[name]), marked: Boolean(changes.traits[name]?.marked) }]));
  if (selectedClass) { next.ancestryCard = ancestry || null; next.communityCard = cardFor(merged.community, communities) || null; next.ancestryFeatures = ancestry?.features || []; next.communityFeatures = next.communityCard?.features || []; next.classFeatures = [...(selectedClass.classFeatures || []), ...unlockedSubclassFeatures(subclass, merged.level)]; next.classBackgroundQuestions = selectedClass.backgroundQuestions || []; next.classConnectionQuestions = selectedClass.connectionQuestions || []; Object.assign(next, specializedFor(merged, merged.className)); }
  if (armor) next.armorSlots = Array.from({ length: Number(armor.score || 0) }, (_, index) => ({ id: index + 1, marked: Boolean(character.armorSlots?.[index]?.marked) })); else if ('armorName' in changes || 'armorId' in changes) next.armorSlots = [];
  if ('armorName' in changes || 'armorId' in changes || 'primaryWeapon' in changes || 'secondaryWeapon' in changes) next.inventory = Array.from(new Set([...(character.inventory || []), armor?.name, primary?.name, secondary?.name].filter(Boolean))).slice(0, 50);
  if (Number.isFinite(Number(next.hpMax)) && Number(merged.hp) > Number(next.hpMax)) next.hp = Number(next.hpMax);
  return next;
}

module.exports = { buildCharacterFromChoices, validateCharacterModel, applyDerivedValues, emptyTraits, derivedValuesFor };
