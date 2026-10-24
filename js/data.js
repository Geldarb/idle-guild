// Static game data. New content (facilities, operations, quest tiers, classes) goes here.
'use strict';

const GAME_VERSION = '1.0.0';
const SAVE_KEY = 'lanternhall-save';
const OFFLINE_CAP_SECONDS = 24 * 3600;

const RESOURCES = {
  gold:     { name: 'Gold',     icon: '🪙' },
  supplies: { name: 'Supplies', icon: '🎒' },
  renown:   { name: 'Renown',   icon: '⭐' },
};

const STATS = { mig: 'Might', agi: 'Agility', wit: 'Wit' };

// growth = stat points gained per level (before rarity multiplier).
const CLASSES = {
  ironwarden:   { name: 'Ironwarden',   icon: '🛡️', growth: { mig: 3, agi: 1, wit: 1 } },
  thornstrider: { name: 'Thornstrider', icon: '🏹', growth: { mig: 1, agi: 3, wit: 1 } },
  runecaller:   { name: 'Runecaller',   icon: '🔮', growth: { mig: 1, agi: 1, wit: 3 } },
  emberpriest:  { name: 'Emberpriest',  icon: '🔥', growth: { mig: 2, agi: 1, wit: 2 } },
  gloamblade:   { name: 'Gloamblade',   icon: '🗡️', growth: { mig: 2, agi: 2, wit: 1 } },
};

const RARITIES = [
  { name: 'Plain',     mult: 1.0,  hireMult: 1,  color: '#b8aa98' },
  { name: 'Promising', mult: 1.2,  hireMult: 2.5, color: '#5fd38a' },
  { name: 'Gifted',    mult: 1.45, hireMult: 6,  color: '#66a8ff' },
  { name: 'Storied',   mult: 1.75, hireMult: 15, color: '#c38bff' },
  { name: 'Fabled',    mult: 2.1,  hireMult: 40, color: '#ffc94a' },
];

// Renown ranks: each rank improves recruit odds and opens the next quest tier.
const RANKS = [
  { name: 'Unknown',   at: 0,    weights: [80, 18, 2, 0, 0] },
  { name: 'Whispered', at: 25,   weights: [60, 30, 9, 1, 0] },
  { name: 'Known',     at: 120,  weights: [40, 35, 20, 5, 0] },
  { name: 'Respected', at: 500,  weights: [25, 35, 27, 11, 2] },
  { name: 'Renowned',  at: 1800, weights: [12, 30, 33, 19, 6] },
  { name: 'Legendary', at: 6000, weights: [5, 20, 35, 28, 12] },
];

// Rooms of the guild hall, in build order. `comingSoon` rooms are hooks for later versions.
const FACILITIES = {
  commons:  { name: 'Common Room', icon: '🍺', desc: 'Bunks and a crackling hearth. Each level houses one more adventurer.',
              buildCost: 0, upgradeBase: 40, upgradeGrowth: 2.6, maxLevel: 15 },
  workshop: { name: 'Workshop', icon: '🔨', desc: 'Benches, a forge and a packing table. Runs operations that earn while you rest.',
              buildCost: 20, upgradeBase: 150, upgradeGrowth: 3, maxLevel: 10, ops: ['lanterns', 'provisions'] },
  maproom:  { name: 'Map Room', icon: '🗺️', comingSoon: 'Exploration: send scouts to chart new regions.' },
  barracks: { name: 'Barracks', icon: '⚔️', comingSoon: 'Hirelings: hire hands to staff your operations.' },
};

// Each workshop level adds this much output to every operation.
const WORKSHOP_LEVEL_BONUS = 0.15;
// Operation output doubles at each of these levels.
const OP_MILESTONES = [10, 25, 50, 75, 100, 150, 200];

const OPERATIONS = {
  lanterns:   { name: 'Lantern Forging', icon: '🏮', res: 'gold', base: 0.4, stat: 'mig', unlockAt: 1,
                costBase: 12, costGrowth: 1.21, desc: 'Brass storm-lanterns, sold to night travellers on the Old Road.' },
  provisions: { name: 'Provision Packing', icon: '🎒', res: 'supplies', base: 0.06, stat: 'wit', unlockAt: 2,
                costBase: 60, costGrowth: 1.23, desc: 'Trail bread, rope and lamp oil, packed for questing parties.' },
};

// Quest tiers. minRank = renown rank index needed. req = party power for ~85% success.
const QUEST_TIERS = [
  { id: 'errand', name: 'Errand',     icon: '📜', minRank: 0, dur: 30,   req: 20,  gold: 12,   xp: 8,    renown: 2,   supplies: 0 },
  { id: 'patrol', name: 'Patrol',     icon: '🛤️', minRank: 1, dur: 180,  req: 45,  gold: 70,   xp: 40,   renown: 6,   supplies: 4 },
  { id: 'hunt',   name: 'Hunt',       icon: '🐗', minRank: 2, dur: 900,  req: 100, gold: 400,  xp: 160,  renown: 18,  supplies: 15 },
  { id: 'delve',  name: 'Delve',      icon: '🕳️', minRank: 3, dur: 2700, req: 210, gold: 1500, xp: 500,  renown: 50,  supplies: 40 },
  { id: 'saga',   name: 'Saga',       icon: '🐉', minRank: 4, dur: 7200, req: 420, gold: 5000, xp: 1600, renown: 150, supplies: 100 },
];

const QUEST_TITLES = {
  errand: ['Fetch herbs from Mossy Hollow', 'Chase rats from the Copper Kettle', 'Deliver a sealed letter to Pellford',
           'Find the miller\'s lost goat', 'Escort a cheesemonger across Wren Bridge', 'Clear crows from the barley fields'],
  patrol: ['Walk the Old Road at dusk', 'Guard the Saltmarsh toll gate', 'Scout the Brindle woods',
           'Watch the caravan camp at Dunmere', 'Sweep the hill shrines for bandits'],
  hunt:   ['Track the tusked beast of Harrow Fen', 'Drive off the cinder wolves', 'Hunt the barrow stalker',
           'Bring down the moss troll of Grey Ford'],
  delve:  ['Descend into the Sunken Cistern', 'Map the Hollow King\'s crypt', 'Recover relics from Ashpit Mine',
           'Seal the Weeping Vault'],
  saga:   ['Wake the drowned bell of Orrin', 'Duel the storm wyrm on Kestrel Peak', 'Unmake the Lantern Eater'],
};

const NAME_PARTS = {
  first: ['Ael', 'Bran', 'Cora', 'Dov', 'Eli', 'Fen', 'Gwyn', 'Hal', 'Isa', 'Jory', 'Kael', 'Lio', 'Mira', 'Nell', 'Oren',
          'Pip', 'Quill', 'Rhea', 'Sav', 'Tamsin', 'Ulla', 'Vey', 'Wren', 'Yara', 'Zed', 'Bryn', 'Odo', 'Tilda', 'Cass', 'Merrin'],
  last:  ['Ashby', 'Brightwater', 'Coldbrook', 'Dunmore', 'Emberley', 'Fallowmere', 'Greythorn', 'Hollin', 'Ironside',
          'Kettlewick', 'Larkspur', 'Mossgrave', 'Nightingale', 'Oakhart', 'Pennywhistle', 'Quarrel', 'Rookwood',
          'Stonefield', 'Thistle', 'Underhill', 'Vane', 'Whitlow'],
};

const RECRUIT_SLOTS = 3;
// Overseers learn on the job: XP per minute spent overseeing.
const OVERSEER_XP_PER_MIN = 2;
const RECRUIT_FREE_REFRESH_SECONDS = 600;
