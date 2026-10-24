// Auto-battle simulation. Pure logic: the canvas only reads `battle`, never writes it.
// Lane coordinates: x from 0 (left, heroes) to 100 (right, enemies arrive); y from 0 to 1 is depth.
'use strict';

const STEP = 0.05; // seconds per simulation step
const HOME_X = { melee: 36, ranged: 23, mage: 12 };
const ROW_Y = [0.5, 0.18, 0.82, 0.34, 0.66];

let battle = null;

function newBattle(s) {
  const b = { t: 0, events: [], units: [], fx: [], floats: [], queue: [], phase: 'spawn', phaseUntil: 0, banner: null, flash: null, secGold: 0, secXp: 0, secT: 0 };
  battle = b;
  placeParty(s, b);
  startWave(s, b);
  return b;
}

function placeParty(s, b, keepHp = false) {
  const old = Object.fromEntries(b.units.filter((u) => u.heroId).map((u) => [u.heroId, u]));
  b.units = b.units.filter((u) => u.side === 'foe');
  const order = { melee: 0, ranged: 1, mage: 2 };
  const ids = [...s.party].sort((a, c) => order[HERO_BY_ID[a].cls] - order[HERO_BY_ID[c].cls]);
  const perClass = {};
  ids.forEach((id, i) => {
    const h = s.heroes[id], def = HERO_BY_ID[id], st = heroStats(h);
    const n = perClass[def.cls] = (perClass[def.cls] || 0) + 1;
    const prev = keepHp ? old[id] : null;
    const u = makeUnit('hero', st, HOME_X[def.cls] - (n - 1) * 4, ROW_Y[i % ROW_Y.length]);
    Object.assign(u, { heroId: id, cls: def.cls, ultKind: def.ult.kind, ult: prev ? prev.ult : 0, home: u.x });
    if (prev) { u.hp = Math.min(u.maxHp, prev.hp * (u.maxHp / prev.maxHp)); u.down = prev.down; u.reviveAt = prev.reviveAt; u.x = prev.x; }
    b.units.push(u);
  });
}

// Party changed (training, gear, new member): refresh numbers but keep the fight going.
function refreshParty(s) { if (battle) placeParty(s, battle, true); }

function makeUnit(side, st, x, y) {
  return {
    side, x, y, hp: st.hp, maxHp: st.hp, atk: st.atk, aspd: st.aspd, range: st.range, speed: st.speed || 0,
    def: st.def || 0, crit: st.crit || 0, ls: st.ls || 0, ultRate: 1 + (st.ult || 0) / 100,
    cd: Math.random() * 0.5, shield: 0, down: false, freeze: 0, fear: 0, dots: [], buff: null, lunge: 0, size: st.size || 1,
  };
}

function startWave(s, b) {
  const { stage: g, wave } = s.progress, info = stageInfo(g), w = info.world;
  const sc = enemyScale(g, wave);
  const list = [];
  if (isBoss(wave)) list.push({ type: info.boss, boss: 2 }, { type: pick(w.mobs) }, { type: pick(w.mobs) });
  else if (isSubBoss(wave)) list.push({ type: w.sub, boss: 1 }, { type: pick(w.mobs) }, { type: pick(w.mobs) });
  else for (let i = 0, n = Math.min(6, 3 + Math.floor(wave / 3)); i < n; i++) list.push({ type: pick(w.mobs) });
  b.queue = list.map((e, i) => {
    const t = ENEMIES[e.type];
    return { at: b.t + 0.4 + i * 0.7, e: { ...e, icon: t.icon, name: t.name,
      st: { hp: ENEMY_HP * sc * t.hp, atk: ENEMY_ATK * sc * t.atk, aspd: t.aspd, range: t.range, speed: t.speed, size: t.size || 1 } } };
  });
  b.phase = 'fight';
  if (isBoss(wave)) b.banner = { text: `BOSS · ${ENEMIES[info.boss].name}`, until: b.t + 2.2, color: '#ff8a5a' };
  else if (isSubBoss(wave)) b.banner = { text: `Sub-boss · ${ENEMIES[w.sub].name}`, until: b.t + 1.8, color: '#ffc94a' };
}

const heroes = (b) => b.units.filter((u) => u.side === 'hero' && !u.down);
const foes = (b) => b.units.filter((u) => u.side === 'foe' && u.hp > 0);
const front = (list) => list.reduce((m, u) => (!m || u.x > m.x ? u : m), null);
const nearestFoe = (b) => foes(b).reduce((m, u) => (!m || u.x < m.x ? u : m), null);

function float(b, u, text, color, big = false) {
  b.floats.push({ x: u.x, y: u.y, text, color, big, t0: b.t });
  if (b.floats.length > 40) b.floats.shift();
}

function hit(s, b, src, tgt, dmg, opts = {}) {
  if (tgt.hp <= 0 || tgt.down) return 0;
  let crit = false;
  if (!opts.noCrit && src && Math.random() * 100 < src.crit) { dmg *= 1.8; crit = true; }
  dmg *= 1 - (tgt.def || 0) / 100;
  if (tgt.shield > 0) { const a = Math.min(tgt.shield, dmg); tgt.shield -= a; dmg -= a; }
  tgt.hp -= dmg;
  if (src && src.side === 'hero') {
    const ls = (src.ls + (src.buff?.ls || 0)) / 100;
    if (ls > 0 && !src.down) src.hp = Math.min(src.maxHp, src.hp + dmg * ls);
  }
  if (tgt.side === 'hero' && tgt.heroId) tgt.ult = Math.min(100, tgt.ult + ULT_CHARGE_PER_HURT * tgt.ultRate);
  float(b, tgt, fmtDmg(dmg), opts.color || (crit ? '#ffd34a' : tgt.side === 'hero' ? '#ff8f8f' : '#fff'), crit);
  if (tgt.hp <= 0) onDeath(s, b, tgt);
  return dmg;
}
function heal(b, u, amt) {
  if (u.down) return;
  const a = Math.min(u.maxHp - u.hp, amt);
  if (a > 0.5) { u.hp += a; float(b, u, `+${fmtDmg(a)}`, '#7dff9a'); }
}
const fmtDmg = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}K` : String(Math.max(1, Math.round(n))));

function onDeath(s, b, u) {
  if (u.side === 'hero') {
    if (u.summon) { u.hp = 0; u.down = true; return; }
    u.hp = 0; u.down = true; u.reviveAt = b.t + REVIVE_SECONDS; u.dots = []; u.buff = null; u.shield = 0;
    b.events.push({ type: 'fallen', heroId: u.heroId });
    return;
  }
  const g = s.progress.stage, wave = s.progress.wave;
  const mult = u.boss === 2 ? 25 : u.boss === 1 ? 8 : 1;
  const gold = Math.round(goldPerKill(g, wave) * mult);
  s.res.gold += gold; b.secGold += gold;
  s.stats.kills++;
  float(b, u, `+${gold}🪙`, '#ffc94a');
  const xp = xpPerKill(g) * mult;
  b.secXp += xp;
  for (const id of s.party) gainXp(s, s.heroes[id], xp, b.events);
  const drops = u.boss === 2 ? 2 : u.boss === 1 ? 1 : (Math.random() < ITEM_DROP_CHANCE ? 1 : 0);
  for (let i = 0; i < drops; i++) {
    const item = rollLoot(s, g, u.boss ? BOSS_LOOT_WEIGHTS : LOOT_RARITY_WEIGHTS);
    const res = addLoot(s, item);
    b.events.push({ type: 'loot', item, res });
    b.fx.push({ kind: 'loot', x: u.x, y: u.y, t0: b.t, dur: 1.2, color: RARITIES[item.rarity].color });
  }
  if (u.boss) {
    const seals = u.boss === 2 ? BOSS_SEALS : SUBBOSS_SEALS;
    s.res.seals += seals;
    b.events.push({ type: 'seals', n: seals });
  }
}

// ---------- ultimates ----------

function ultTargetsReady(b, u) {
  const fs = foes(b);
  if (!fs.length || fs.every((f) => f.x > 96)) return false;
  if (u.ultKind === 'mend' || u.ultKind === 'rally') return heroes(b).some((h) => h.hp / h.maxHp < 0.7);
  return true;
}

const ULT_EFFECTS = {
  slam(s, b, u) {
    for (const f of foes(b)) if (Math.abs(f.x - u.x) < 22) { hit(s, b, u, f, u.atk * 2); f.freeze = Math.max(f.freeze, b.t + 1.5); }
    b.fx.push({ kind: 'ring', x: u.x, y: u.y, t0: b.t, dur: 0.5, color: '#e8c08a', r: 22 });
  },
  bloodthirst(s, b, u) { u.buff = { atkMul: 1.4, ls: 60, until: b.t + 6, color: '#ff4d4d' }; },
  rally(s, b, u) {
    for (const h of heroes(b)) { h.shield = Math.max(h.shield, u.maxHp * 0.35); }
    b.fx.push({ kind: 'party', t0: b.t, dur: 0.7, color: '#ffd77a' });
  },
  roar(s, b, u) {
    for (const f of foes(b)) { if (f.boss !== 2) f.fear = Math.max(f.fear, b.t + 3); else f.freeze = Math.max(f.freeze, b.t + 1); hit(s, b, u, f, u.atk * 1.5); }
    b.fx.push({ kind: 'ring', x: u.x, y: u.y, t0: b.t, dur: 0.7, color: '#b44dff', r: 60 });
  },
  volley(s, b, u) {
    for (let i = 0; i < 6; i++) { const f = pick(foes(b)); if (!f) break; shot(b, u, f, '#e8f0a0'); hit(s, b, u, f, u.atk * 1.3); }
  },
  viper(s, b, u) {
    for (const f of foes(b).sort((a, c) => a.x - c.x).slice(0, 3)) { f.dots.push({ dps: u.atk * 5 / 6, until: b.t + 6, kind: 'poison' }); shot(b, u, f, '#7dff5a'); }
  },
  pin(s, b, u) {
    const f = foes(b).reduce((m, x) => (!m || x.hp > m.hp ? x : m), null);
    if (f) { shot(b, u, f, '#9fd1ff'); hit(s, b, u, f, u.atk * 7); f.freeze = Math.max(f.freeze, b.t + 2); }
  },
  embers(s, b, u) {
    for (const f of foes(b)) { hit(s, b, u, f, u.atk * 1.5, { noCrit: true }); f.dots.push({ dps: u.atk * 3 / 5, until: b.t + 5, kind: 'burn' }); }
    b.fx.push({ kind: 'flash', t0: b.t, dur: 0.5, color: '#ff7a2a' });
  },
  mend(s, b, u) {
    for (const h of heroes(b)) heal(b, h, h.maxHp * 0.35);
    b.fx.push({ kind: 'party', t0: b.t, dur: 0.7, color: '#7dff9a' });
  },
  frost(s, b, u) {
    for (const f of foes(b)) { f.freeze = Math.max(f.freeze, b.t + 2.5); hit(s, b, u, f, u.atk * 1.2); }
    b.fx.push({ kind: 'flash', t0: b.t, dur: 0.5, color: '#8fd8ff' });
  },
  nova(s, b, u) {
    for (const f of foes(b)) { hit(s, b, u, f, u.atk * 2.5); f.dots.push({ dps: u.atk * 2 / 4, until: b.t + 4, kind: 'burn' }); }
    b.fx.push({ kind: 'flash', t0: b.t, dur: 0.5, color: '#ff9a4a' });
  },
  grove(s, b, u) {
    for (const h of heroes(b)) heal(b, h, h.maxHp * 0.2);
    const fx = front(heroes(b))?.x ?? 40;
    for (let i = 0; i < 2; i++) {
      const w = makeUnit('hero', { hp: u.maxHp * 0.9, atk: u.atk * 0.8, aspd: 1.1, range: 8, def: 20 }, fx + 3, i ? 0.3 : 0.7);
      Object.assign(w, { summon: true, icon: '🦌', expires: b.t + 12, home: w.x, cls: 'melee' });
      b.units.push(w);
    }
  },
};

function fireUlt(s, b, u) {
  if (!u || u.down || u.ult < 100 || !foes(b).length) return false;
  u.ult = 0;
  ULT_EFFECTS[u.ultKind](s, b, u);
  b.banner = { text: HERO_BY_ID[u.heroId].ult.name, until: b.t + 1.1, color: CLASSES[u.cls].color, small: true };
  return true;
}
function manualUlt(s, heroId) {
  if (!battle) return false;
  return fireUlt(s, battle, battle.units.find((u) => u.heroId === heroId));
}

function shot(b, from, to, color) {
  b.fx.push({ kind: 'shot', x1: from.x, y1: from.y, x2: to.x, y2: to.y, t0: b.t, dur: 0.18, color });
}

// ---------- step ----------

function stepBattle(s, b, dt) {
  b.t += dt;
  const t = b.t;
  // once a second: smooth live earnings for offline rewards
  b.secT += dt;
  if (b.secT >= 1) {
    const a = 1 / 300;
    s.rate.gold = s.rate.gold * (1 - a) + b.secGold / b.secT * a;
    s.rate.xp = s.rate.xp * (1 - a) + b.secXp / b.secT * a;
    b.secGold = 0; b.secXp = 0; b.secT = 0;
  }
  b.fx = b.fx.filter((f) => t - f.t0 < f.dur);
  b.floats = b.floats.filter((f) => t - f.t0 < 0.9);

  if (b.phase === 'wipe' || b.phase === 'clear') {
    if (t >= b.phaseUntil) afterPause(s, b);
    return;
  }
  while (b.queue.length && b.queue[0].at <= t) {
    const { e } = b.queue.shift();
    const u = makeUnit('foe', e.st, 104 + Math.random() * 3, 0.12 + Math.random() * 0.76);
    Object.assign(u, { icon: e.icon, name: e.name, boss: e.boss || 0 });
    if (e.boss) u.y = 0.5;
    b.units.push(u);
  }

  const hs = heroes(b), fs = foes(b);
  for (const u of b.units) {
    // damage over time
    if (u.dots.length && u.hp > 0 && !u.down) {
      for (const d of u.dots) if (t < d.until) { u.hp -= d.dps * dt; }
      u.dots = u.dots.filter((d) => t < d.until);
      if (Math.random() < dt * 2) float(b, u, '•', u.dots[0]?.kind === 'poison' ? '#7dff5a' : '#ff9a4a');
      if (u.hp <= 0) onDeath(s, b, u);
    }
    if (u.buff && t >= u.buff.until) u.buff = null;
    u.lunge = Math.max(0, u.lunge - dt * 4);
  }

  // heroes: revive, ult, attack
  for (const u of b.units) {
    if (u.side !== 'hero') continue;
    if (u.summon && t >= u.expires) { u.down = true; u.gone = true; continue; }
    if (u.down) {
      if (!u.summon && t >= u.reviveAt) { u.down = false; u.hp = u.maxHp * 0.5; float(b, u, 'Back up!', '#7dff9a'); }
      continue;
    }
    if (u.heroId) {
      u.ult = Math.min(100, u.ult + ULT_CHARGE_PER_SEC * u.ultRate * dt);
      if (u.ult >= 100 && s.settings.autoUlt && ultTargetsReady(b, u)) fireUlt(s, b, u);
    }
    const target = nearestFoe(b);
    if (!target) { if (u.x !== u.home) u.x += Math.sign(u.home - u.x) * Math.min(Math.abs(u.home - u.x), 15 * dt); continue; }
    const dist = target.x - u.x;
    if (dist > u.range) {
      // melee steps forward to reach foes that hang back; others hold position
      if (u.cls === 'melee' && target.x < 96 && u.x < u.home + 24) u.x += Math.min(12 * dt, dist - u.range);
      continue;
    }
    u.cd -= dt;
    if (u.cd > 0) continue;
    u.cd = 1 / u.aspd;
    const atk = u.atk * (u.buff?.atkMul || 1);
    if (u.heroId) u.ult = Math.min(100, u.ult + ULT_CHARGE_PER_HIT * u.ultRate);
    // mages mend the weakest ally every third cast when someone is hurt
    if (u.cls === 'mage' && u.heroId) {
      u.casts = (u.casts || 0) + 1;
      const weak = hs.filter((h) => !h.down).reduce((m, h) => (!m || h.hp / h.maxHp < m.hp / m.maxHp ? h : m), null);
      if (u.casts % 3 === 0 && weak && weak.hp / weak.maxHp < 0.75) { heal(b, weak, atk * 1.4); shot(b, u, weak, '#7dff9a'); continue; }
    }
    if (u.cls === 'melee') u.lunge = 1; else shot(b, u, target, u.cls === 'mage' ? '#b9a8ff' : '#f2e3b0');
    hit(s, b, u, target, atk);
  }

  // foes: move, attack
  const hf = front(heroes(b));
  for (const u of fs) {
    if (u.hp <= 0) continue;
    if (t < u.freeze) continue;
    if (t < u.fear) { u.x = Math.min(104, u.x + u.speed * 0.8 * dt); continue; }
    if (!hf) continue;
    const dist = u.x - hf.x;
    if (dist > u.range) { u.x -= Math.min(u.speed * dt, dist - u.range); continue; }
    u.cd -= dt;
    if (u.cd > 0) continue;
    u.cd = 1 / u.aspd;
    if (u.range > 10) shot(b, u, hf, '#ff8a8a'); else u.lunge = 1;
    hit(s, b, u, hf, u.atk);
  }
  b.units = b.units.filter((u) => !(u.side === 'foe' && u.hp <= 0) && !u.gone);

  // outcomes
  const realHeroes = b.units.filter((u) => u.heroId);
  if (realHeroes.length && realHeroes.every((u) => u.down)) {
    s.stats.wipes++;
    b.phase = 'wipe'; b.phaseUntil = t + 2.5;
    b.banner = { text: 'The party fell… regrouping at the checkpoint', until: t + 2.5, color: '#ff8f8f' };
    b.events.push({ type: 'wipe' });
    return;
  }
  if (!b.queue.length && !foes(b).length) {
    const wave = s.progress.wave;
    if (isBoss(wave)) {
      s.stats.bosses++;
      s.progress.stage++; s.progress.wave = 1;
      s.best = Math.max(s.best, s.progress.stage);
      const info = stageInfo(s.progress.stage);
      b.banner = { text: `Checkpoint! ${info.label} ${info.name}`, until: t + 2.2, color: '#7dff9a' };
      b.events.push({ type: 'stage', g: s.progress.stage });
      b.phase = 'clear'; b.phaseUntil = t + 2.2;
    } else {
      s.progress.wave++;
      b.phase = 'clear'; b.phaseUntil = t + 1;
    }
  }
}

function afterPause(s, b) {
  const wiped = b.phase === 'wipe', newStage = s.progress.wave === 1;
  if (wiped) { s.progress.wave = 1; }
  // regroup: summons leave, foes clear; full heal after a wipe or a stage clear, a breather between waves
  b.units = b.units.filter((u) => u.side === 'hero' && !u.summon);
  for (const u of b.units) {
    u.x = u.home; u.dots = []; u.freeze = 0;
    if (wiped || newStage) { u.down = false; u.hp = u.maxHp; u.shield = 0; }
    else if (!u.down) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.2);
  }
  startWave(s, b);
}

// Runs the fight for `seconds` and returns what happened (for UI toasts).
function runBattle(s, seconds) {
  if (!battle) newBattle(s);
  const b = battle;
  b.events = [];
  let left = seconds;
  while (left > 1e-6) { const dt = Math.min(STEP, left); stepBattle(s, b, dt); left -= dt; }
  return b.events;
}

function restartBattle(s) { battle = null; newBattle(s); }
