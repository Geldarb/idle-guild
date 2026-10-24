// Game rules and state. No DOM here: everything takes the state and returns or mutates it.
'use strict';

const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];

function weightedIndex(weights) {
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) { roll -= weights[i]; if (roll < 0) return i; }
  return 0;
}

// ---------- state ----------

function newGame(now = Date.now()) {
  const s = {
    v: 1,
    guildName: 'The Lantern Hall',
    res: { gold: 40, supplies: 10, renown: 0 },
    facilities: { commons: 1, workshop: 0 },     // room id -> level (0 = not built)
    ops: { lanterns: 0, provisions: 0 },          // operation id -> level (0 = not opened)
    overseers: {},                                // operation id -> adventurer id
    adventurers: [],
    quests: [],                                   // active quests
    board: {},                                    // quest tier id -> current posting
    recruits: [],
    recruitRefreshAt: now + RECRUIT_FREE_REFRESH_SECONDS * 1000,
    nextId: 1,
    stats: { questsDone: 0, questsFailed: 0 },
    lastTick: now,
    // hooks for later systems (exploration, hirelings...) keep their own state here
    ext: {},
  };
  const starter = makeAdventurer(s, 0, 'ironwarden');
  s.adventurers.push(starter);
  s.recruits = rollRecruits(s);
  for (const t of QUEST_TIERS) s.board[t.id] = makePosting(t);
  return s;
}

// Upgrade an older save to the current shape. Add a step per save version.
function migrate(s) {
  const fresh = newGame();
  for (const k of Object.keys(fresh)) if (s[k] === undefined) s[k] = fresh[k];
  for (const k of Object.keys(fresh.res)) if (s.res[k] === undefined) s.res[k] = 0;
  for (const k of Object.keys(fresh.facilities)) if (s.facilities[k] === undefined) s.facilities[k] = 0;
  for (const k of Object.keys(fresh.ops)) if (s.ops[k] === undefined) s.ops[k] = 0;
  for (const t of QUEST_TIERS) if (!s.board[t.id]) s.board[t.id] = makePosting(t);
  s.v = 1;
  return s;
}

// ---------- renown & adventurers ----------

function rankIndex(renown) {
  let r = 0;
  RANKS.forEach((rank, i) => { if (renown >= rank.at) r = i; });
  return r;
}

function makeName() { return `${pick(NAME_PARTS.first)} ${pick(NAME_PARTS.last)}`; }

function makeAdventurer(s, rarity, cls = pick(Object.keys(CLASSES)), level = 1) {
  const mult = RARITIES[rarity].mult;
  const g = CLASSES[cls].growth;
  const base = {};
  for (const k of Object.keys(STATS)) base[k] = Math.round((3 + g[k] + rand(3)) * mult);
  const a = { id: s.nextId++, name: makeName(), cls, rarity, level: 1, xp: 0, base, stats: { ...base } };
  for (let i = 1; i < level; i++) levelUp(a);
  return a;
}

function xpToNext(level) { return Math.round(10 * Math.pow(1.35, level - 1)); }

function levelUp(a) {
  a.level++;
  const g = CLASSES[a.cls].growth, mult = RARITIES[a.rarity].mult;
  for (const k of Object.keys(STATS)) a.stats[k] += Math.max(1, Math.round(g[k] * mult));
}

function gainXp(a, xp) {
  a.xp += xp;
  let gained = 0;
  while (a.xp >= xpToNext(a.level)) { a.xp -= xpToNext(a.level); levelUp(a); gained++; }
  return gained;
}

function power(a) { return a.stats.mig + a.stats.agi + a.stats.wit; }

function adventurerTask(s, id) {
  for (const [op, advId] of Object.entries(s.overseers)) if (advId === id) return { type: 'oversee', op };
  const q = s.quests.find((q) => q.advId === id);
  return q ? { type: 'quest', quest: q } : null;
}

function findAdventurer(s, id) { return s.adventurers.find((a) => a.id === id); }

function rosterCap(s) { return 2 + s.facilities.commons; }

// ---------- recruiting ----------

function rollRecruit(s) {
  const r = rankIndex(s.res.renown);
  const rarity = weightedIndex(RANKS[r].weights);
  const level = 1 + rand(r + 1);
  const a = makeAdventurer(s, rarity, undefined, level);
  a.hireCost = Math.round(20 * RARITIES[rarity].hireMult * (1 + 0.25 * (level - 1)));
  return a;
}

function rollRecruits(s) {
  const list = [];
  for (let i = 0; i < RECRUIT_SLOTS; i++) list.push(rollRecruit(s));
  return list;
}

function rerollCost(s) { return 10 * (1 + rankIndex(s.res.renown)); }

function hire(s, id) {
  const i = s.recruits.findIndex((a) => a.id === id);
  if (i < 0 || s.adventurers.length >= rosterCap(s)) return false;
  const a = s.recruits[i];
  if (!spend(s, 'gold', a.hireCost)) return false;
  delete a.hireCost;
  s.adventurers.push(a);
  s.recruits.splice(i, 1, rollRecruit(s));
  return true;
}

function dismiss(s, id) {
  if (adventurerTask(s, id)?.type === 'quest') return false;
  for (const [op, advId] of Object.entries(s.overseers)) if (advId === id) delete s.overseers[op];
  s.adventurers = s.adventurers.filter((a) => a.id !== id);
  return true;
}

// ---------- economy ----------

function spend(s, res, amount) {
  if (s.res[res] < amount) return false;
  s.res[res] -= amount;
  return true;
}

function facilityCost(id, level) {
  const f = FACILITIES[id];
  if (level === 0) return f.buildCost;
  return Math.round(f.upgradeBase * Math.pow(f.upgradeGrowth, level - 1));
}

function upgradeFacility(s, id) {
  const f = FACILITIES[id], lvl = s.facilities[id] || 0;
  if (f.comingSoon || lvl >= f.maxLevel) return false;
  if (!spend(s, 'gold', facilityCost(id, lvl))) return false;
  s.facilities[id] = lvl + 1;
  return true;
}

function opUnlocked(s, id) { return (s.facilities.workshop || 0) >= OPERATIONS[id].unlockAt; }

function opCost(id, level) { const o = OPERATIONS[id]; return Math.round(o.costBase * Math.pow(o.costGrowth, level)); }

function milestoneMult(level) { return Math.pow(2, OP_MILESTONES.filter((m) => level >= m).length); }

function nextMilestone(level) { return OP_MILESTONES.find((m) => m > level); }

function overseerBonus(s, opId) {
  const a = findAdventurer(s, s.overseers[opId]);
  if (!a) return 0;
  return (a.stats[OPERATIONS[opId].stat] * 2 + a.level * 3) / 100;
}

// Resource per second produced by one operation.
function opRate(s, id, level = s.ops[id]) {
  if (!level || !opUnlocked(s, id)) return 0;
  const o = OPERATIONS[id];
  const workshop = 1 + WORKSHOP_LEVEL_BONUS * ((s.facilities.workshop || 1) - 1);
  return o.base * level * milestoneMult(level) * workshop * (1 + overseerBonus(s, id));
}

function totalRates(s) {
  const r = { gold: 0, supplies: 0, renown: 0 };
  for (const id of Object.keys(OPERATIONS)) r[OPERATIONS[id].res] += opRate(s, id);
  return r;
}

function upgradeOp(s, id) {
  if (!opUnlocked(s, id)) return false;
  if (!spend(s, 'gold', opCost(id, s.ops[id]))) return false;
  s.ops[id]++;
  return true;
}

function assignOverseer(s, opId, advId) {
  if (advId != null && adventurerTask(s, advId)) return false;
  if (advId == null) delete s.overseers[opId];
  else s.overseers[opId] = advId;
  return true;
}

// ---------- quests ----------

function makePosting(tier) { return { title: pick(QUEST_TITLES[tier.id]), stat: pick(Object.keys(STATS)) }; }

function tierUnlocked(s, tier) { return rankIndex(s.res.renown) >= tier.minRank; }

// Adventurers whose best stat matches the posting's favoured stat get +20% power.
function questPower(a, posting) {
  const best = Object.keys(STATS).reduce((b, k) => (a.stats[k] > a.stats[b] ? k : b), 'mig');
  return power(a) * (best === posting.stat ? 1.2 : 1);
}

function successChance(a, tier, posting) {
  const ratio = questPower(a, posting) / tier.req;
  return Math.max(0.1, Math.min(0.97, 0.15 + 0.7 * ratio));
}

function startQuest(s, tierId, advId, now = Date.now()) {
  const tier = QUEST_TIERS.find((t) => t.id === tierId);
  const a = findAdventurer(s, advId);
  if (!tier || !a || !tierUnlocked(s, tier) || adventurerTask(s, advId)) return false;
  if (!spend(s, 'supplies', tier.supplies)) return false;
  const posting = s.board[tierId];
  s.quests.push({ id: s.nextId++, tier: tierId, advId, title: posting.title, stat: posting.stat,
                  chance: successChance(a, tier, posting), start: now, end: now + tier.dur * 1000 });
  s.board[tierId] = makePosting(tier);
  return true;
}

function resolveQuest(s, q, report) {
  const tier = QUEST_TIERS.find((t) => t.id === q.tier);
  const a = findAdventurer(s, q.advId);
  s.quests = s.quests.filter((x) => x !== q);
  if (!a) return;
  const success = Math.random() < q.chance;
  const gold = success ? tier.gold : 0;
  const renown = success ? tier.renown : 0;
  const xp = success ? tier.xp : Math.ceil(tier.xp / 2);
  s.res.gold += gold;
  s.res.renown += renown;
  const levels = gainXp(a, xp);
  s.stats[success ? 'questsDone' : 'questsFailed']++;
  report.gold += gold;
  report.renown += renown;
  report.quests.push({ title: q.title, name: a.name, success, gold, renown, xp, levels, newLevel: a.level });
}

// ---------- time ----------

function emptyReport() { return { seconds: 0, gold: 0, supplies: 0, renown: 0, quests: [] }; }

// Move the world forward to `now`. Works the same for one frame or a day offline.
function advance(s, now = Date.now(), report = emptyReport()) {
  const seconds = Math.min(Math.max(0, (now - s.lastTick) / 1000), OFFLINE_CAP_SECONDS);
  const rates = totalRates(s);
  for (const k of Object.keys(rates)) { s.res[k] += rates[k] * seconds; report[k] += rates[k] * seconds; }
  report.seconds += seconds;
  for (const advId of Object.values(s.overseers)) {
    const a = findAdventurer(s, advId);
    if (!a) continue;
    a.oxp = (a.oxp || 0) + (seconds / 60) * OVERSEER_XP_PER_MIN;
    const whole = Math.floor(a.oxp);
    if (whole) { a.oxp -= whole; gainXp(a, whole); }
  }
  for (const q of [...s.quests].sort((a, b) => a.end - b.end)) if (q.end <= now) resolveQuest(s, q, report);
  if (now >= s.recruitRefreshAt) {
    s.recruits = rollRecruits(s);
    s.recruitRefreshAt = now + RECRUIT_FREE_REFRESH_SECONDS * 1000;
    report.newRecruits = true;
  }
  for (const sys of EXTENSIONS) sys.advance?.(s, seconds, report);
  s.lastTick = now;
  return report;
}

// Later systems (exploration, hirelings, more facilities) register here: { id, advance(s, seconds, report) }.
const EXTENSIONS = [];

// ---------- saves ----------

function serialize(s) { return JSON.stringify(s); }

function deserialize(text) {
  const s = JSON.parse(text);
  if (!s || typeof s !== 'object' || !s.res || !Array.isArray(s.adventurers)) throw new Error('Not a Lantern Hall save');
  return migrate(s);
}

function exportCode(s) { return btoa(unescape(encodeURIComponent(serialize(s)))); }

function importCode(code) {
  const text = code.trim();
  return deserialize(text.startsWith('{') ? text : decodeURIComponent(escape(atob(text))));
}
