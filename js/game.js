// Game rules and state. No DOM here, so it also runs in Node for balance sims.
'use strict';

const rnd = Math.random;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function weighted(weights) {
  let r = rnd() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
  return weights.length - 1;
}

// ---------- new game & saves ----------

function newGame() {
  const now = Date.now();
  const s = {
    v: 2, created: now, lastTick: now,
    res: { gold: 0, seals: 3 },
    heroes: {}, formation: Array(PARTY_SIZE).fill(null), // slots 0-2 front row, 3-5 back row
    recruit: { level: 1, xp: 0 }, redeemed: [],
    bag: [], nextItemId: 1, newItems: 0,
    progress: { stage: 0, wave: 1 }, best: 0,
    settings: { autoUlt: true, autoSalvageCommon: false },
    freeSummonAt: now, // first free summon is ready right away
    rate: { gold: 0, xp: 0 }, // live earnings per second (smoothed), drives offline rewards
    stats: { kills: 0, bosses: 0, wipes: 0, summons: 0, items: 0 },
    note: null,
    ext: {}, // room for future systems (pets, merchants) without breaking saves
  };
  for (const id of STARTERS) addHero(s, id);
  return s;
}

function migrate(s) {
  const fresh = newGame();
  for (const k of Object.keys(fresh)) if (s[k] === undefined) s[k] = fresh[k];
  for (const k of Object.keys(fresh.res)) if (s.res[k] === undefined) s.res[k] = 0;
  for (const k of Object.keys(fresh.settings)) if (s.settings[k] === undefined) s.settings[k] = fresh.settings[k];
  for (const k of Object.keys(fresh.stats)) if (s.stats[k] === undefined) s.stats[k] = 0;
  for (const id of Object.keys(s.heroes)) if (!HERO_BY_ID[id]) delete s.heroes[id];
  // v2.0 saves had a 5-hero party list: place them into the 6-slot formation by class row.
  if (Array.isArray(s.party)) {
    const old = s.party.filter((id) => s.heroes[id]);
    delete s.party;
    s.formation = Array(PARTY_SIZE).fill(null);
    for (const id of old) placeInFormation(s, id);
  }
  s.formation = Array.from({ length: PARTY_SIZE }, (_, i) => (s.heroes[s.formation[i]] ? s.formation[i] : null));
  s.formation = s.formation.map((id, i) => (id && s.formation.indexOf(id) === i ? id : null));
  if (!partyOf(s).length) Object.keys(s.heroes).slice(0, PARTY_SIZE).forEach((id) => placeInFormation(s, id));
  return s;
}

class OldSaveError extends Error {}

function serialize(s) { return JSON.stringify(s); }
function deserialize(text) {
  const s = JSON.parse(text);
  if (s && Array.isArray(s.adventurers)) throw new OldSaveError('Lantern Hall v1 save');
  if (!s || s.v !== 2 || !s.heroes || !s.res) throw new Error('Not a Banner Road save');
  return migrate(s);
}
function exportCode(s) { return btoa(unescape(encodeURIComponent(serialize(s)))); }
function importCode(code) {
  const text = code.trim();
  return deserialize(text.startsWith('{') ? text : decodeURIComponent(escape(atob(text))));
}

// ---------- stages ----------

function stageInfo(g) {
  const lastWorld = WORLDS.length - 1;
  const wi = Math.min(Math.floor(g / STAGES_PER_WORLD), lastWorld);
  const world = WORLDS[wi];
  const endless = g >= WORLDS.length * STAGES_PER_WORLD;
  const si = endless ? (g % STAGES_PER_WORLD) : g % STAGES_PER_WORLD;
  const st = world.stages[si];
  const depth = g - WORLDS.length * STAGES_PER_WORLD + 1;
  return {
    g, world, wi, si, endless, boss: st.boss,
    name: endless ? `Endless Road ${depth}` : st.name,
    label: endless ? `∞-${depth}` : `${wi + 1}-${si + 1}`,
  };
}
const enemyScale = (g, wave) => Math.pow(STAGE_GROWTH, g) * (1 + WAVE_GROWTH * (wave - 1));
const goldPerKill = (g, wave) => GOLD_PER_KILL * Math.pow(GOLD_STAGE_GROWTH, g) * (1 + 0.05 * (wave - 1));
const xpPerKill = (g) => XP_PER_KILL * Math.pow(XP_STAGE_GROWTH, g);
const isSubBoss = (wave) => wave === SUBBOSS_EVERY;
const isBoss = (wave) => wave === WAVES_PER_STAGE;

function travel(s, g) {
  if (g < 0 || g > s.best) return false;
  s.progress = { stage: g, wave: 1 };
  return true;
}

// ---------- heroes ----------

function addHero(s, id, level = 1) {
  s.heroes[id] = { id, level, xp: 0, stars: 1, gear: Object.fromEntries(SLOT_IDS.map((k) => [k, null])) };
  placeInFormation(s, id);
  return s.heroes[id];
}

// ---------- formation ----------

const partyOf = (s) => s.formation.filter(Boolean);
const inParty = (s, id) => s.formation.includes(id);
const slotRow = (slot) => (slot < FRONT_SLOTS ? 'front' : 'back');
// Put a hero in the first free slot of the row its class prefers (or any free slot). Returns the slot or -1.
function placeInFormation(s, id) {
  if (inParty(s, id)) return s.formation.indexOf(id);
  const want = CLASSES[HERO_BY_ID[id].cls].row === 'front' ? [0, 1, 2, 3, 4, 5] : [3, 4, 5, 0, 1, 2];
  const slot = want.find((i) => !s.formation[i]);
  if (slot === undefined) return -1;
  s.formation[slot] = id;
  return slot;
}
// Move a hero into a slot. Whoever was there swaps into the hero's old slot (or goes to the bench).
function setSlot(s, slot, id) {
  if (slot < 0 || slot >= PARTY_SIZE || (id && !s.heroes[id])) return false;
  const cur = s.formation[slot];
  if (!id) { // clear the slot, but never empty the whole party
    if (!cur || partyOf(s).length <= 1) return false;
    s.formation[slot] = null;
    return true;
  }
  const from = s.formation.indexOf(id);
  if (from === slot) return false;
  s.formation[slot] = id;
  if (from >= 0) s.formation[from] = cur;
  return true;
}
function benchHero(s, id) {
  const i = s.formation.indexOf(id);
  return i >= 0 ? setSlot(s, i, null) : false;
}

const xpToNext = (lvl) => Math.round(XP_BASE * Math.pow(XP_GROWTH, lvl - 1));
const trainCost = (lvl) => Math.round(TRAIN_BASE * Math.pow(TRAIN_GROWTH, lvl - 1));

function gearTotals(h, swap) {
  const t = { atk: 0, hp: 0, spd: 0, crit: 0, def: 0, ls: 0, ult: 0 };
  for (const slot of SLOT_IDS) {
    const it = swap && swap.slot === slot ? swap.item : h.gear[slot];
    if (it) for (const [k, v] of Object.entries(it.stats)) t[k] += v;
  }
  return t;
}

// Full combat numbers for a hero. `swap` = {slot, item} previews a gear change.
function heroStats(h, swap) {
  const def = HERO_BY_ID[h.id], c = CLASSES[def.cls];
  const mult = HERO_RARITY_STAT[def.rarity] * Math.pow(LEVEL_GROWTH, h.level - 1) * (1 + STAR_BONUS * (h.stars - 1));
  const g = gearTotals(h, swap);
  return {
    hp: Math.round(c.hp * mult + g.hp),
    atk: Math.round((c.atk * mult + g.atk) * 10) / 10,
    aspd: c.aspd * (1 + Math.min(g.spd, STAT_CAPS.spd) / 100),
    range: c.range,
    def: Math.min(STAT_CAPS.def, c.def + g.def),
    crit: Math.min(STAT_CAPS.crit, 5 + c.crit + g.crit),
    ls: Math.min(STAT_CAPS.ls, g.ls),
    ult: Math.min(STAT_CAPS.ult, g.ult),
  };
}

function statPower(st) {
  const dps = st.atk * st.aspd * (1 + st.crit / 100 * 0.8) * (1 + st.ult / 300);
  const ehp = st.hp / (1 - st.def / 100) * (1 + st.ls / 100);
  return Math.round(Math.sqrt(dps * ehp) * 4);
}
const heroPower = (h, swap) => statPower(heroStats(h, swap));
const partyPower = (s) => partyOf(s).reduce((a, id) => a + heroPower(s.heroes[id]), 0);

function gainXp(s, h, xp, events) {
  h.xp += xp;
  let up = 0;
  while (h.xp >= xpToNext(h.level)) { h.xp -= xpToNext(h.level); h.level++; up++; }
  if (up && events) events.push({ type: 'level', heroId: h.id, level: h.level });
  return up;
}

function train(s, id) {
  const h = s.heroes[id];
  if (!h) return false;
  const c = trainCost(h.level);
  if (s.res.gold < c) return false;
  s.res.gold -= c;
  h.level++;
  return true;
}
function trainMax(s, id) {
  let n = 0;
  while (n < 500 && train(s, id)) n++;
  return n;
}

// Swap the contents of two slots (either may be empty).
function swapSlots(s, a, b) {
  if (a === b || a < 0 || b < 0 || a >= PARTY_SIZE || b >= PARTY_SIZE) return false;
  [s.formation[a], s.formation[b]] = [s.formation[b], s.formation[a]];
  return true;
}
// Strongest heroes fill the formation; front-row classes take the front, the rest the back.
function autoArrange(s) {
  const ids = Object.keys(s.heroes).sort((a, b) => heroPower(s.heroes[b]) - heroPower(s.heroes[a])).slice(0, PARTY_SIZE);
  const front = ids.filter((id) => CLASSES[HERO_BY_ID[id].cls].row === 'front');
  const back = ids.filter((id) => CLASSES[HERO_BY_ID[id].cls].row !== 'front');
  while (front.length > FRONT_SLOTS) back.push(front.pop());
  while (back.length > PARTY_SIZE - FRONT_SLOTS) front.push(back.shift()); // sturdiest-looking spare goes forward
  s.formation = Array(PARTY_SIZE).fill(null);
  front.forEach((id, i) => { s.formation[i] = id; });
  back.forEach((id, i) => { s.formation[FRONT_SLOTS + i] = id; });
  return true;
}

function toggleParty(s, id) {
  if (inParty(s, id)) return benchHero(s, id);
  return placeInFormation(s, id) >= 0;
}

// ---------- recruiting ----------

function freeSummonReady(s, now = Date.now()) { return now >= s.freeSummonAt; }

const recruitOdds = (level) => RECRUIT_ODDS[clamp(level, 1, RECRUIT_MAX_LEVEL) - 1];
const recruitXpToNext = (level) => (level >= RECRUIT_MAX_LEVEL ? Infinity : RECRUIT_XP[level - 1]);

function gainRecruitXp(s, n) {
  const r = s.recruit;
  let up = 0;
  r.xp += n;
  while (r.level < RECRUIT_MAX_LEVEL && r.xp >= recruitXpToNext(r.level)) { r.xp -= recruitXpToNext(r.level); r.level++; up++; }
  if (r.level >= RECRUIT_MAX_LEVEL) r.xp = 0;
  return up;
}

// Adds a hero of the given rarity: a new face if possible, otherwise a star (or gold at max stars).
function grantHero(s, rarity, preferNew = false) {
  let pool = HEROES.filter((h) => h.rarity === rarity);
  if (preferNew && pool.some((h) => !s.heroes[h.id])) pool = pool.filter((h) => !s.heroes[h.id]);
  const def = pick(pool);
  const owned = s.heroes[def.id];
  if (!owned) {
    // Newcomers train with the band: they join at 60% of your best hero's level.
    const top = Math.max(1, ...Object.values(s.heroes).map((h) => h.level));
    addHero(s, def.id, Math.max(1, Math.floor(top * 0.6)));
    return { heroId: def.id, isNew: true };
  }
  if (owned.stars < MAX_STARS) { owned.stars++; return { heroId: def.id, stars: owned.stars }; }
  const gold = Math.round(DUPE_AT_MAX_GOLD * Math.pow(GOLD_STAGE_GROWTH, s.best));
  s.res.gold += gold;
  return { heroId: def.id, gold };
}

function summon(s, free = false, now = Date.now()) {
  if (free) { if (!freeSummonReady(s, now)) return null; s.freeSummonAt = now + FREE_SUMMON_SECONDS * 1000; }
  else { if (s.res.seals < RECRUIT_COST) return null; s.res.seals -= RECRUIT_COST; }
  s.stats.summons++;
  const r = grantHero(s, weighted(recruitOdds(s.recruit.level)));
  r.recruitUp = gainRecruitXp(s, 1);
  return r;
}
function summonMany(s, n) {
  const out = [];
  for (let i = 0; i < n; i++) { const r = summon(s); if (!r) break; out.push(r); }
  return out;
}

// ---------- redeem codes ----------

function redeemCode(s, raw) {
  const code = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!code) return { ok: false, msg: 'Type a code first.' };
  if (!REDEEM_CODES[code]) return { ok: false, msg: `“${code}” is not a valid code.` };
  if (s.redeemed.includes(code)) return { ok: false, msg: `${code} has already been used on this save.` };
  let msg;
  if (code === 'BANNER2026') { s.res.gold += 5000; msg = '+5,000 🪙 gold!'; }
  else if (code === 'HEROROAD') { s.res.seals += 10; msg = '+10 🔮 Summon Seals: that’s 10 free recruits!'; }
  else if (code === 'LOOTDROP') {
    const items = ['weapon', 'armour', 'shield'].map((slot) => makeItem(s, s.best + 1, 3, slot));
    items.forEach((it) => { s.bag.push(it); s.newItems++; s.stats.items++; });
    msg = `3 Epic items are in your Bag: ${items.map((i) => i.name).join(', ')}.`;
  } else if (code === 'FRONTLINE') {
    const ids = partyOf(s);
    ids.forEach((id) => { s.heroes[id].level += 5; });
    msg = `+5 training levels for ${ids.length} heroes in your formation!`;
  } else if (code === 'LEGEND') {
    const r = grantHero(s, 4, true), d = HERO_BY_ID[r.heroId];
    msg = r.isNew ? `Legendary ${d.name} joins your band!` : r.stars ? `Legendary ${d.name} gains a star (${r.stars}★)!` : `Legendary ${d.name} was maxed: +${r.gold} 🪙`;
    s.stats.summons++;
    return (s.redeemed.push(code), { ok: true, code, msg, summon: r });
  }
  s.redeemed.push(code);
  return { ok: true, code, msg };
}

// ---------- gear ----------

function rollStat(k, il, rarity, share) {
  const m = RARITIES[rarity].mult * share * (0.8 + rnd() * 0.4);
  if (ITEM_FLAT[k] != null) return Math.max(1, Math.round(ITEM_FLAT[k] * Math.pow(ITEM_FLAT_GROWTH, il - 1) * m));
  return Math.round(ITEM_PCT[k] * m * (1 + 0.03 * (il - 1)) * 10) / 10;
}

function makeItem(s, il, rarity, slot = pick(SLOT_IDS)) {
  const sd = SLOTS[slot];
  const stats = { [sd.main]: rollStat(sd.main, il, rarity, 1) };
  const pool = Object.keys(STATS).filter((k) => k !== sd.main);
  const bonus = [];
  for (let i = 0; i < rarity; i++) { // rarer items roll extra bonus stats
    const k = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    stats[k] = rollStat(k, il, rarity, 0.45);
    bonus.push(k);
  }
  const mat = MATERIALS[Math.min(MATERIALS.length - 1, Math.floor((il - 1) / 2))];
  const name = `${mat} ${pick(sd.bases)}${bonus.length ? ` ${SUFFIXES[bonus[0]]}` : ''}`;
  return { id: s.nextItemId++, slot, rarity, il, name, main: sd.main, stats, isNew: true };
}

const salvageValue = (it) => Math.round(SALVAGE_BASE * (it.rarity + 1) * (it.rarity + 1) * Math.pow(GOLD_STAGE_GROWTH, it.il - 1));

// Adds a drop to the bag. Never blocks: a full bag salvages the weakest item for gold.
function addLoot(s, item) {
  s.stats.items++;
  if (s.settings.autoSalvageCommon && item.rarity === 0) { s.res.gold += salvageValue(item); return { salvaged: item }; }
  if (s.bag.length >= BAG_CAP) {
    let worst = 0;
    for (let i = 1; i < s.bag.length; i++) if (itemRank(s.bag[i]) < itemRank(s.bag[worst])) worst = i;
    if (itemRank(item) <= itemRank(s.bag[worst])) { s.res.gold += salvageValue(item); return { salvaged: item }; }
    const out = s.bag.splice(worst, 1)[0];
    s.res.gold += salvageValue(out);
    s.bag.push(item); s.newItems++;
    return { added: item, salvaged: out };
  }
  s.bag.push(item); s.newItems++;
  return { added: item };
}
const itemRank = (it) => it.rarity * 1000 + it.il;

function rollLoot(s, g, weights) { return makeItem(s, g + 1, weighted(weights)); }

function equip(s, heroId, itemId) {
  const h = s.heroes[heroId], i = s.bag.findIndex((x) => x.id === itemId);
  if (!h || i < 0) return false;
  const it = s.bag.splice(i, 1)[0];
  it.isNew = false;
  const old = h.gear[it.slot];
  h.gear[it.slot] = it;
  if (old) s.bag.push(old);
  return true;
}
function unequip(s, heroId, slot) {
  const h = s.heroes[heroId];
  if (!h || !h.gear[slot]) return false;
  s.bag.push(h.gear[slot]);
  h.gear[slot] = null;
  return true;
}
function salvage(s, itemId) {
  const i = s.bag.findIndex((x) => x.id === itemId);
  if (i < 0) return 0;
  const v = salvageValue(s.bag.splice(i, 1)[0]);
  s.res.gold += v;
  return v;
}
function salvageUpTo(s, maxRarity) {
  let gold = 0, n = 0;
  s.bag = s.bag.filter((it) => { if (it.rarity <= maxRarity) { gold += salvageValue(it); n++; return false; } return true; });
  s.res.gold += gold;
  return { gold, n };
}
// Best upgrade in the bag for a hero's slot, by power gained.
function bestUpgrade(s, h, slot) {
  const base = heroPower(h);
  let best = null;
  for (const it of s.bag) {
    if (it.slot !== slot) continue;
    const d = heroPower(h, { slot, item: it }) - base;
    if (d > 0 && (!best || d > best.delta)) best = { item: it, delta: d };
  }
  return best;
}

// ---------- offline ----------

// While away the party keeps farming its current stage (never pushes past a boss).
function offlineRewards(s, seconds) {
  seconds = Math.min(seconds, OFFLINE_CAP_SECONDS);
  const g = s.progress.stage;
  const rep = { seconds, gold: 0, xp: 0, items: [], salvagedGold: 0, levels: [] };
  const estGold = goldPerKill(g, 5) * 0.35, estXp = xpPerKill(g) * 0.35;
  const gps = clamp(s.rate.gold || estGold, estGold * 0.25, estGold * 4);
  const xps = clamp(s.rate.xp || estXp, estXp * 0.25, estXp * 4);
  rep.gold = Math.round(gps * seconds * OFFLINE_EFFICIENCY);
  rep.xp = Math.round(xps * seconds * OFFLINE_EFFICIENCY);
  s.res.gold += rep.gold;
  for (const id of partyOf(s)) {
    const h = s.heroes[id], before = h.level;
    gainXp(s, h, rep.xp);
    if (h.level > before) rep.levels.push({ heroId: id, from: before, to: h.level });
  }
  const rolls = Math.min(60, Math.floor(seconds / OFFLINE_LOOT_EVERY));
  for (let i = 0; i < rolls; i++) {
    const res = addLoot(s, rollLoot(s, g, LOOT_RARITY_WEIGHTS));
    if (res.added) rep.items.push(res.added);
    if (res.salvaged) rep.salvagedGold += salvageValue(res.salvaged);
  }
  return rep;
}
