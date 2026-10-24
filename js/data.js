// All tunable content lives here: heroes, enemies, worlds, gear and balance numbers.
'use strict';

const GAME_VERSION = '2.0.0';
const GAME_TITLE = 'Banner Road';
const SAVE_KEY = 'bannerroad-save';
const CLASSIC_SAVE_KEY = 'lanternhall-save'; // Lantern Hall v1 lives on at /classic/ and keeps this save; never touch it
const CLASSIC_URL = 'classic/';
const OFFLINE_CAP_SECONDS = 24 * 3600;
const PARTY_SIZE = 5;
const BAG_CAP = 40;

const RESOURCES = {
  gold: { name: 'Gold', icon: '🪙' },
  seals: { name: 'Summon Seals', icon: '🔮' },
};

// ---------- heroes ----------

const CLASSES = {
  melee: { name: 'Melee', icon: '🛡️', color: '#d9694a', hp: 130, atk: 7, aspd: 0.8, range: 8, def: 15,
    blurb: 'Frontline tank. Holds the line so the others can work.' },
  ranged: { name: 'Ranged', icon: '🏹', color: '#6fbf5a', hp: 70, atk: 8, aspd: 1.5, range: 60, def: 0,
    blurb: 'Fast shots. Drops enemies before they reach the front.' },
  mage: { name: 'Mage', icon: '🔮', color: '#8a7cf0', hp: 65, atk: 11, aspd: 0.7, range: 50, def: 0,
    blurb: 'Spells, heals, buffs and summons.' },
};

const RARITIES = [
  { id: 'common', name: 'Common', color: '#b9b4ad', mult: 1 },
  { id: 'uncommon', name: 'Uncommon', color: '#6fd48f', mult: 1.35 },
  { id: 'rare', name: 'Rare', color: '#5aa8ff', mult: 1.8 },
  { id: 'epic', name: 'Epic', color: '#c77dff', mult: 2.4 },
  { id: 'legendary', name: 'Legendary', color: '#ffb547', mult: 3.2 },
];
const HERO_RARITY_STAT = [1, 1.12, 1.25, 1.42, 1.6];
const RECRUIT_WEIGHTS = [52, 27, 14, 5.5, 1.5]; // by hero rarity
const RECRUIT_COST = 1; // seals per summon
const FREE_SUMMON_SECONDS = 30 * 60;
const MAX_STARS = 5;
const STAR_BONUS = 0.25; // +25% hp/atk per star above 1
const DUPE_AT_MAX_GOLD = 200; // gold per duplicate once a hero is 5 stars (scaled by stage)

// Ultimate kinds are implemented in battle.js (ULT_EFFECTS).
const HEROES = [
  { id: 'brannoc', name: 'Brannoc Stoneward', cls: 'melee', rarity: 0, ult: { kind: 'slam', name: 'Bulwark Slam', desc: 'Smashes the ground: 2× damage to nearby foes and freezes them for 1.5s.' } },
  { id: 'kessa', name: 'Kessa Ironvein', cls: 'melee', rarity: 1, ult: { kind: 'bloodthirst', name: 'Bloodthirst', desc: 'For 6s: +40% attack and 60% lifesteal.' } },
  { id: 'harl', name: 'Old Harl the Unbent', cls: 'melee', rarity: 2, ult: { kind: 'rally', name: 'Rally Banner', desc: 'Shields every hero for 35% of Harl’s max HP.' } },
  { id: 'vexa', name: 'Vexa Dreadhelm', cls: 'melee', rarity: 3, ult: { kind: 'roar', name: 'Dread Roar', desc: 'Fears all foes for 3s (they flee and stop attacking) and deals 1.5× damage.' } },
  { id: 'pip', name: 'Pip Quickstring', cls: 'ranged', rarity: 0, ult: { kind: 'volley', name: 'Volley', desc: 'Looses 6 arrows at random foes for 1.3× damage each.' } },
  { id: 'sorrel', name: 'Sorrel Venomfletch', cls: 'ranged', rarity: 1, ult: { kind: 'viper', name: 'Viper Shot', desc: 'Poisons the 3 nearest foes for 5× damage over 6s.' } },
  { id: 'tamsin', name: 'Tamsin Farsight', cls: 'ranged', rarity: 2, ult: { kind: 'pin', name: 'Pinning Shot', desc: 'Hits the toughest foe for 7× damage and freezes it for 2s.' } },
  { id: 'rook', name: 'Rook Hallowbolt', cls: 'ranged', rarity: 4, ult: { kind: 'embers', name: 'Rain of Embers', desc: 'Hits every foe for 1.5× and sets them burning for 3× over 5s.' } },
  { id: 'wren', name: 'Wren Mossmantle', cls: 'mage', rarity: 0, ult: { kind: 'mend', name: 'Mending Rain', desc: 'Heals every hero for 35% of their max HP.' } },
  { id: 'ilsabet', name: 'Ilsabet Frostweave', cls: 'mage', rarity: 2, ult: { kind: 'frost', name: 'Glacial Bloom', desc: 'Freezes every foe for 2.5s and deals 1.2× damage.' } },
  { id: 'corvin', name: 'Corvin Ashtongue', cls: 'mage', rarity: 3, ult: { kind: 'nova', name: 'Cinder Nova', desc: '2.5× damage to every foe, plus a 2× burn over 4s.' } },
  { id: 'yew', name: 'Mother Yew', cls: 'mage', rarity: 4, ult: { kind: 'grove', name: 'Call of the Grove', desc: 'Summons 2 thorn-stags for 12s and heals the party 20%.' } },
];
const HERO_BY_ID = Object.fromEntries(HEROES.map((h) => [h.id, h]));
const STARTERS = ['brannoc', 'pip', 'wren'];
const ULT_CHARGE_PER_SEC = 4;  // passive, out of 100
const ULT_CHARGE_PER_HIT = 6;  // dealing an attack
const ULT_CHARGE_PER_HURT = 3; // taking a hit
const REVIVE_SECONDS = 10;

// Hero growth and training
const LEVEL_GROWTH = 1.11;           // hp/atk per level
const TRAIN_BASE = 12, TRAIN_GROWTH = 1.2; // gold cost of the next level
const XP_BASE = 35, XP_GROWTH = 1.24;      // xp needed for the next level from fighting

// ---------- worlds & enemies ----------

const ENEMIES = {
  wolf: { name: 'Mangy Wolf', icon: '🐺', hp: 1, atk: 1, speed: 14, aspd: 1, range: 6 },
  spider: { name: 'Thicket Spider', icon: '🕷️', hp: 0.7, atk: 0.8, speed: 20, aspd: 1.4, range: 6 },
  boar: { name: 'Tusked Boar', icon: '🐗', hp: 1.8, atk: 1.1, speed: 10, aspd: 0.7, range: 6 },
  goblin: { name: 'Bramble Slinger', icon: '👺', hp: 0.8, atk: 0.9, speed: 12, aspd: 0.9, range: 32 },
  bones: { name: 'Rattlebones', icon: '💀', hp: 1, atk: 1, speed: 12, aspd: 1, range: 6 },
  ghoul: { name: 'Grave Shambler', icon: '🧟', hp: 1.9, atk: 1.1, speed: 8, aspd: 0.7, range: 6 },
  shade: { name: 'Wailing Shade', icon: '👻', hp: 0.8, atk: 1, speed: 13, aspd: 0.8, range: 34 },
  scorp: { name: 'Ash Scorpion', icon: '🦂', hp: 0.9, atk: 1, speed: 18, aspd: 1.3, range: 6 },
  // sub-bosses and bosses
  bear: { name: 'Gnarlback', icon: '🐻', hp: 9, atk: 2.2, speed: 9, aspd: 0.7, range: 8, size: 1.5 },
  troll: { name: 'Moss Troll', icon: '🧌', hp: 24, atk: 3.2, speed: 7, aspd: 0.6, range: 9, size: 2 },
  ogre: { name: 'Mother Thornhide', icon: '👹', hp: 26, atk: 3.4, speed: 7, aspd: 0.6, range: 9, size: 2 },
  mummy: { name: 'Bound Warden', icon: '🧛', hp: 9, atk: 2.2, speed: 9, aspd: 0.8, range: 8, size: 1.5 },
  lich: { name: 'The Hollow King', icon: '☠️', hp: 26, atk: 3.4, speed: 6, aspd: 0.7, range: 30, size: 2 },
  wyrm: { name: 'Vharrok the Ash Wyrm', icon: '🐉', hp: 30, atk: 3.6, speed: 6, aspd: 0.6, range: 12, size: 2.2 },
};

const WORLDS = [
  { id: 'bramble', name: 'Bramblewood', sky: ['#22324a', '#3f5a4a'], ground: '#2f4a2a', groundLine: '#47693c',
    mobs: ['wolf', 'spider', 'boar', 'goblin'], sub: 'bear',
    stages: [{ name: 'Mossy Trail', boss: 'troll' }, { name: 'Wolfsong Hollow', boss: 'bear' }, { name: 'Thornheart Glade', boss: 'troll' }, { name: 'The Bramble Throne', boss: 'ogre' }] },
  { id: 'crypt', name: 'Ashen Barrows', sky: ['#2a1d2e', '#5a3a3a'], ground: '#3a2e2a', groundLine: '#5a4636',
    mobs: ['bones', 'ghoul', 'shade', 'scorp'], sub: 'mummy',
    stages: [{ name: 'Cinder Gate', boss: 'lich' }, { name: 'Ossuary Steps', boss: 'mummy' }, { name: 'The Sunken Choir', boss: 'lich' }, { name: 'Wyrm’s Rest', boss: 'wyrm' }] },
];
const STAGES_PER_WORLD = 4;
const WAVES_PER_STAGE = 10;
const SUBBOSS_EVERY = 5; // wave 5 is a sub-boss, the last wave is the stage boss

// Enemy power: each stage is a clear step up, waves inside a stage ramp gently.
const ENEMY_HP = 46, ENEMY_ATK = 4.6;
const STAGE_GROWTH = 2.1, WAVE_GROWTH = 0.05;
const GOLD_PER_KILL = 3, GOLD_STAGE_GROWTH = 1.5;
const XP_PER_KILL = 2, XP_STAGE_GROWTH = 1.45;
const SUBBOSS_SEALS = 1, BOSS_SEALS = 2;

// ---------- gear ----------

const STATS = {
  atk: { name: 'Attack', pct: false },
  hp: { name: 'Health', pct: false },
  spd: { name: 'Attack speed', pct: true },
  crit: { name: 'Crit chance', pct: true },
  def: { name: 'Armour', pct: true },
  ls: { name: 'Lifesteal', pct: true },
  ult: { name: 'Ultimate charge', pct: true },
};
const SLOTS = {
  weapon: { name: 'Weapon', icon: '🗡️', main: 'atk', bases: ['Sword', 'Axe', 'Longbow', 'Wand', 'Mace', 'Spear'] },
  armour: { name: 'Armour', icon: '🥋', main: 'hp', bases: ['Jerkin', 'Hauberk', 'Robe', 'Brigandine', 'Cuirass'] },
  shield: { name: 'Shield', icon: '🛡️', main: 'def', bases: ['Buckler', 'Kite Shield', 'Ward', 'Tower Shield'] },
  ring: { name: 'Ring', icon: '💍', main: 'crit', bases: ['Band', 'Signet', 'Loop', 'Seal Ring'] },
  charm: { name: 'Accessory', icon: '📿', main: 'ult', bases: ['Amulet', 'Totem', 'Talisman', 'Locket', 'Charm'] },
};
const SLOT_IDS = Object.keys(SLOTS);
// Flat stats scale with item level; percentages scale with rarity only (and lightly with level).
const ITEM_FLAT = { atk: 3, hp: 26 }, ITEM_FLAT_GROWTH = 1.45;
const ITEM_PCT = { spd: 4, crit: 4, def: 4, ls: 3, ult: 7 };
const STAT_CAPS = { def: 60, crit: 60, ls: 50, spd: 150, ult: 200 };
const ITEM_DROP_CHANCE = 0.07; // per normal kill
const LOOT_RARITY_WEIGHTS = [60, 26, 10, 3.4, 0.6];
const BOSS_LOOT_WEIGHTS = [10, 35, 35, 16, 4];
const MATERIALS = ['Rusty', 'Iron', 'Steel', 'Runed', 'Moonsilver', 'Starforged', 'Dawnmetal', 'Voidglass'];
const SUFFIXES = { atk: 'of the Boar', hp: 'of the Oak', spd: 'of the Hare', crit: 'of the Hawk', def: 'of the Turtle', ls: 'of the Leech', ult: 'of Embers' };
const SALVAGE_BASE = 4; // gold

// Offline: how much of a live session's earnings you keep while away.
const OFFLINE_EFFICIENCY = 0.6;
const OFFLINE_LOOT_EVERY = 240; // seconds per offline loot roll
