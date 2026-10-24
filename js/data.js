// All tunable content lives here: heroes, enemies, worlds, gear and balance numbers.
'use strict';

const GAME_VERSION = '2.1.0';
const GAME_TITLE = 'Banner Road';
const SAVE_KEY = 'bannerroad-save';
const CLASSIC_SAVE_KEY = 'lanternhall-save'; // Lantern Hall v1 lives on at /classic/ and keeps this save; never touch it
const CLASSIC_URL = 'classic/';
const OFFLINE_CAP_SECONDS = 24 * 3600;
const PARTY_SIZE = 6; // formation: slots 0-2 front row, 3-5 back row
const FRONT_SLOTS = 3;
const BAG_CAP = 40;

const RESOURCES = {
  gold: { name: 'Gold', icon: '🪙' },
  seals: { name: 'Summon Seals', icon: '🔮' },
};

// ---------- heroes ----------

// row: where the class wants to stand. Front row takes the hits; the back row is safe while anyone in front stands.
const CLASSES = {
  guardian: { name: 'Guardian', icon: '🛡️', color: '#4f8fe0', row: 'front', hp: 165, atk: 5, aspd: 0.7, range: 8, def: 25, crit: 0,
    role: 'Tank', blurb: 'Huge health and armour. Put Guardians in the front row to soak hits.' },
  warrior: { name: 'Warrior', icon: '⚔️', color: '#e0563f', row: 'front', hp: 120, atk: 8.5, aspd: 0.9, range: 8, def: 12, crit: 0,
    role: 'Bruiser', blurb: 'Sturdy front-liners with heavy swings.' },
  rogue: { name: 'Rogue', icon: '🗡️', color: '#9b59d0', row: 'front', hp: 85, atk: 8.5, aspd: 1.3, range: 8, def: 5, crit: 20,
    role: 'Assassin', blurb: 'Fast blades and big crits. Fragile, so keep a Guardian nearby.' },
  ranger: { name: 'Ranger', icon: '🏹', color: '#4fb04a', row: 'back', hp: 70, atk: 8, aspd: 1.5, range: 60, def: 0, crit: 5,
    role: 'Marksman', blurb: 'Rapid arrows from the back row.' },
  mage: { name: 'Mage', icon: '🔥', color: '#ef8a2a', row: 'back', hp: 65, atk: 10, aspd: 0.7, range: 50, def: 0, crit: 0,
    role: 'Area damage', blurb: 'Every spell splashes 40% damage onto nearby foes.' },
  cleric: { name: 'Cleric', icon: '✨', color: '#f2c94c', row: 'back', hp: 80, atk: 5.5, aspd: 0.8, range: 50, def: 5, crit: 0,
    role: 'Healer', blurb: 'Heals the most wounded hero on every other cast.' },
  summoner: { name: 'Summoner', icon: '🌀', color: '#2bb3a8', row: 'back', hp: 70, atk: 6.5, aspd: 0.8, range: 50, def: 0, crit: 0,
    role: 'Summoner', blurb: 'Every 4th cast calls a wisp to fight in the front row for 8s.' },
};
const CLASS_IDS = Object.keys(CLASSES);
const isMeleeClass = (cls) => CLASSES[cls].range <= 10;

const RARITIES = [
  { id: 'common', name: 'Common', color: '#a7a7a7', mult: 1 },
  { id: 'uncommon', name: 'Uncommon', color: '#3fc35f', mult: 1.35 },
  { id: 'rare', name: 'Rare', color: '#3b8cff', mult: 1.8 },
  { id: 'epic', name: 'Epic', color: '#b05cff', mult: 2.4 },
  { id: 'legendary', name: 'Legendary', color: '#ff9f1c', mult: 3.2 },
];
const HERO_RARITY_STAT = [1, 1.12, 1.25, 1.42, 1.6];
const RECRUIT_COST = 1; // seals per summon
const FREE_SUMMON_SECONDS = 30 * 60;
const MAX_STARS = 5;
const STAR_BONUS = 0.25; // +25% hp/atk per star above 1
const DUPE_AT_MAX_GOLD = 200; // gold per duplicate once a hero is 5 stars (scaled by stage)

// Recruit level: every summon gives 1 recruit XP. Higher levels shift the odds toward rarer heroes.
// RECRUIT_ODDS[level - 1] = % chance of Common, Uncommon, Rare, Epic, Legendary.
const RECRUIT_ODDS = [
  [60, 28, 9, 2.5, 0.5],
  [55, 30, 11, 3.3, 0.7],
  [50, 31, 13, 4.8, 1.2],
  [44, 32, 16, 6.3, 1.7],
  [38, 32, 19, 8.5, 2.5],
  [32, 32, 22, 10.5, 3.5],
  [26, 31, 25, 13, 5],
  [20, 30, 28, 15.5, 6.5],
  [15, 28, 30, 18.5, 8.5],
  [10, 25, 32, 22, 11],
];
const RECRUIT_MAX_LEVEL = RECRUIT_ODDS.length;
const RECRUIT_XP = [3, 5, 7, 10, 13, 16, 20, 25, 30]; // XP from level n to n+1 (one summon = 1 XP)

// Ultimate kinds are implemented in battle.js (ULT_EFFECTS).
const H = (id, name, cls, rarity, kind, ult, desc) => ({ id, name, cls, rarity, ult: { kind, name: ult, desc } });
const HEROES = [
  // Guardians
  H('brannoc', 'Brannoc Stoneward', 'guardian', 0, 'slam', 'Bulwark Slam', 'Smashes the ground: 2× damage to nearby foes and freezes them for 1.5s.'),
  H('doveena', 'Doveena Stillwall', 'guardian', 1, 'taunt', 'Hold the Line', 'Every foe must attack Doveena for 4s, and she gains +50% armour while they try.'),
  H('harl', 'Old Harl the Unbent', 'guardian', 2, 'rally', 'Rally Banner', 'Shields every hero for 35% of Harl’s max HP.'),
  H('gorm', 'Gorm Anvilheart', 'guardian', 4, 'bastion', 'Anvil Bastion', 'The whole party takes 45% less damage for 6s and gains a shield worth 20% of Gorm’s HP.'),
  // Warriors
  H('tobin', 'Tobin Ashfist', 'warrior', 0, 'cleave', 'Wide Cleave', 'A spinning swing: 2.2× damage to every foe within reach.'),
  H('kessa', 'Kessa Ironvein', 'warrior', 1, 'bloodthirst', 'Bloodthirst', 'For 6s: +40% attack and 60% lifesteal.'),
  H('vexa', 'Vexa Dreadhelm', 'warrior', 3, 'roar', 'Dread Roar', 'Fears all foes for 3s (they flee and stop attacking) and deals 1.5× damage.'),
  // Rogues
  H('nim', 'Nim Quietstep', 'rogue', 0, 'backstab', 'Backstab', 'Blinks behind the toughest foe for a 4.5× critical strike.'),
  H('sable', 'Sable Nightreed', 'rogue', 2, 'flurry', 'Knife Flurry', 'Throws 8 knives at random foes, each a guaranteed crit for 0.9×.'),
  H('kito', 'Kito Smokejaw', 'rogue', 3, 'smoke', 'Venom Smoke', 'Poisons every foe for 3× over 4s and gives Kito +50% attack for 5s.'),
  // Rangers
  H('pip', 'Pip Quickstring', 'ranger', 0, 'volley', 'Volley', 'Looses 6 arrows at random foes for 1.3× damage each.'),
  H('sorrel', 'Sorrel Venomfletch', 'ranger', 1, 'viper', 'Viper Shot', 'Poisons the 3 nearest foes for 5× damage over 6s.'),
  H('tamsin', 'Tamsin Farsight', 'ranger', 2, 'pin', 'Pinning Shot', 'Hits the toughest foe for 7× damage and freezes it for 2s.'),
  H('rook', 'Rook Hallowbolt', 'ranger', 4, 'embers', 'Rain of Embers', 'Hits every foe for 1.5× and sets them burning for 3× over 5s.'),
  // Mages
  H('bram', 'Bram Sparkwhistle', 'mage', 0, 'zap', 'Chain Spark', 'Lightning jumps between 4 foes for 1.6× each and stuns them for 0.5s.'),
  H('ilsabet', 'Ilsabet Frostweave', 'mage', 2, 'frost', 'Glacial Bloom', 'Freezes every foe for 2.5s and deals 1.2× damage.'),
  H('corvin', 'Corvin Ashtongue', 'mage', 3, 'nova', 'Cinder Nova', '2.5× damage to every foe, plus a 2× burn over 4s.'),
  H('ysolde', 'Ysolde Starcaller', 'mage', 4, 'meteor', 'Falling Star', 'Drops a star on the battlefield: 5× damage to every foe.'),
  // Clerics
  H('wren', 'Wren Mossmantle', 'cleric', 0, 'mend', 'Mending Rain', 'Heals every hero for 35% of their max HP.'),
  H('alder', 'Brother Alder', 'cleric', 1, 'sanctuary', 'Sanctuary', 'Heals every hero 20% now and another 30% over 5s.'),
  H('maelis', 'Maelis Dawnhand', 'cleric', 3, 'dawn', 'Second Dawn', 'Revives every fallen hero at 60% HP and heals the rest for 25%.'),
  // Summoners
  H('fennick', 'Fennick Bonepipe', 'summoner', 1, 'skeletons', 'Rattle Parade', 'Pipes up 3 skeleton soldiers that fight in front for 10s.'),
  H('odalys', 'Odalys Inkwing', 'summoner', 2, 'spiritwolf', 'Ink Wolf', 'Paints a great ink wolf that fights for 15s with 1.5× Odalys’s attack.'),
  H('yew', 'Mother Yew', 'summoner', 4, 'grove', 'Call of the Grove', 'Summons 2 thorn-stags for 12s and heals the party 20%.'),
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

// One-time redeem codes (case-insensitive). Rewards are applied in game.js redeemCode().
const REDEEM_CODES = {
  BANNER2026: { desc: '5,000 gold' },
  HEROROAD: { desc: '10 Summon Seals (10 free recruits)' },
  LOOTDROP: { desc: '3 Epic gear items' },
  FRONTLINE: { desc: '+5 training levels for every hero in your formation' },
  LEGEND: { desc: 'A guaranteed Legendary hero recruit' },
};
