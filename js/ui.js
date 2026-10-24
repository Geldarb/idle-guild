// Rendering and input. Screens are plain functions returning HTML; buttons carry data-act/data-arg.
'use strict';

const $ = (sel) => document.querySelector(sel);
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmt(n) {
  if (n < 10 && n % 1) return n.toFixed(1);
  if (n < 1000) return String(Math.floor(n));
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
  let i = -1;
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
  return `${n.toFixed(n < 100 ? 1 : 0)}${units[i]}`;
}
function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}
const cost = (res, n) => `${fmt(n)} ${RESOURCES[res].icon}`;
// A button that greys itself out live while you can't afford it.
const buyBtn = (act, arg, res, n, label, cls = '') =>
  `<button class="btn buy ${cls}" data-act="${act}" data-arg="${esc(arg)}" data-afford-res="${res}" data-afford-cost="${n}">${label} · ${cost(res, n)}</button>`;
const fmtStat = (k, v) => (STATS[k].pct ? `+${v}% ${STATS[k].name}` : `+${fmt(v)} ${STATS[k].name}`);
const stars = (n) => '★'.repeat(n) + '<span class="dim">' + '★'.repeat(MAX_STARS - n) + '</span>';
const rarName = (r) => `<span style="color:${RARITIES[r].color}">${RARITIES[r].name}</span>`;

const ui = { screen: 'battle', modal: null, heroId: null, lastSummon: null };

// ---------- screens ----------

const SCREENS = {
  battle: { title: 'Battle', tab: '⚔️', render: renderBattle },
  heroes: { title: 'Heroes', tab: '🧙', render: renderHeroes },
  bag: { title: 'Bag', tab: '🎒', render: renderBag },
  recruit: { title: 'Recruit', tab: '🔮', render: renderRecruit },
  world: { title: 'World map', tab: '🗺️', render: renderWorld },
  hero: { title: 'Hero', render: renderHero, parent: 'heroes' },
  settings: { title: 'Settings', render: renderSettings },
};
const TABS = ['battle', 'heroes', 'bag', 'recruit', 'world'];

function heroPortrait(id) {
  const d = HERO_BY_ID[id];
  return `<span class="portrait" style="--rar:${RARITIES[d.rarity].color}">${CLASSES[d.cls].icon}</span>`;
}

function renderBattle(s) {
  const info = stageInfo(s.progress.stage);
  const party = s.party.map((id) => {
    const d = HERO_BY_ID[id], h = s.heroes[id];
    return `<button class="pcard" data-act="ult" data-arg="${id}" data-hud="${id}" style="--rar:${RARITIES[d.rarity].color}" title="${esc(d.ult.name)}: ${esc(d.ult.desc)}">
      <span class="pc-top"><span class="pc-icon">${CLASSES[d.cls].icon}</span><span class="pc-name">${esc(d.name.split(' ')[0])}</span><span class="pc-lv">${h.level}</span></span>
      <span class="mbar hp"><i data-hud-hp></i></span><span class="mbar ult"><i data-hud-ult></i></span>
      <span class="pc-ult">${esc(d.ult.name)}</span></button>`;
  }).join('');
  return `<div class="battle">
    <div id="lane-slot" class="lane-slot"></div>
    <div class="battle-bar">
      <span class="small"><b>${info.world.name}</b> · Stage ${info.label} · <span class="muted">Power ${fmt(partyPower(s))}</span></span>
      <button class="btn small ${s.settings.autoUlt ? '' : 'ghost'}" data-act="auto-ult">Auto ult: ${s.settings.autoUlt ? 'On' : 'Off'}</button>
    </div>
    <div class="party">${party}</div>
    <p class="hint small">${battleHint(s)}</p>
  </div>`;
}
function battleHint(s) {
  if (s.stats.bosses === 0) return 'Your heroes fight on their own. Tap a hero card when it glows to fire their ultimate. Spend gold on <b>Heroes</b> to train them.';
  if (s.bag.length && s.newItems) return `New loot in your <b>Bag</b> (${s.newItems}). Equip upgrades on the <b>Heroes</b> screen.`;
  if (s.res.seals >= RECRUIT_COST) return 'You have Summon Seals. Visit <b>Recruit</b> to call a new hero.';
  return 'Stuck on a boss? Train heroes and equip gear, or farm an earlier stage from the <b>World map</b>.';
}

function heroCard(s, id) {
  const d = HERO_BY_ID[id], h = s.heroes[id];
  const ups = SLOT_IDS.some((slot) => bestUpgrade(s, h, slot));
  return `<button class="card hcard" data-act="hero" data-arg="${id}" style="--rar:${RARITIES[d.rarity].color}">
    ${heroPortrait(id)}
    <span class="grow"><b style="color:${RARITIES[d.rarity].color}">${esc(d.name)}</b>
      <span class="small muted">${CLASSES[d.cls].name} · Lv ${h.level} · <span class="stars">${stars(h.stars)}</span></span>
      <span class="small">Power <b class="gold">${fmt(heroPower(h))}</b>${ups ? ' · <span class="ok">▲ gear upgrade</span>' : ''}</span></span>
    ${s.party.includes(id) ? '<span class="tag on">In party</span>' : '<span class="tag">Resting</span>'}</button>`;
}

function renderHeroes(s) {
  const owned = Object.keys(s.heroes).sort((a, b) => (s.party.includes(b) - s.party.includes(a)) || heroPower(s.heroes[b]) - heroPower(s.heroes[a]));
  return `<p class="hint">Party ${s.party.length}/${PARTY_SIZE} · total power <b class="gold">${fmt(partyPower(s))}</b>. Melee hold the front, ranged and mages hit from behind.</p>
    ${owned.map((id) => heroCard(s, id)).join('')}
    <p class="muted small center">${Object.keys(s.heroes).length}/${HEROES.length} heroes found. Recruit more with Summon Seals.</p>`;
}

function renderHero(s) {
  const id = ui.heroId, d = HERO_BY_ID[id], h = s.heroes[id];
  if (!h) return '<p class="muted">Unknown hero.</p>';
  const st = heroStats(h), c = trainCost(h.level), inParty = s.party.includes(id);
  const gear = SLOT_IDS.map((slot) => {
    const it = h.gear[slot], up = bestUpgrade(s, h, slot);
    return `<button class="slot" data-act="gear" data-arg="${id}:${slot}" ${it ? `style="--rar:${RARITIES[it.rarity].color}"` : ''}>
      <span class="slot-icon">${SLOTS[slot].icon}</span>
      <span class="grow">${it ? `<b style="color:${RARITIES[it.rarity].color}">${esc(it.name)}</b><span class="small muted">${itemStatsLine(it)}</span>`
        : `<span class="muted">${SLOTS[slot].name}: empty</span>`}</span>
      ${up ? `<span class="ok small">▲ +${fmt(up.delta)}</span>` : '<span class="chev">›</span>'}</button>`;
  }).join('');
  return `<div class="card hero-head" style="--rar:${RARITIES[d.rarity].color}">
      <div class="row">${heroPortrait(id)}<div class="grow"><b style="color:${RARITIES[d.rarity].color}">${esc(d.name)}</b>
        <div class="small muted">${rarName(d.rarity)} ${CLASSES[d.cls].name} · <span class="stars">${stars(h.stars)}</span></div></div>
        <div class="center"><div class="lvl">Lv ${h.level}</div><div class="small gold">⚔ ${fmt(heroPower(h))}</div></div></div>
      <div class="bar xp"><i style="width:${(h.xp / xpToNext(h.level)) * 100}%"></i></div>
      <div class="statgrid small">
        <span>❤️ ${fmt(st.hp)}</span><span>⚔️ ${fmt(st.atk)}</span><span>⏱ ${st.aspd.toFixed(2)}/s</span>
        <span>🛡 ${Math.round(st.def)}%</span><span>💥 ${Math.round(st.crit)}%</span><span>🩸 ${Math.round(st.ls)}%</span></div>
      ${buyBtn('train', id, 'gold', c, `Train to Lv ${h.level + 1}`)}
      <div class="btnrow"><button class="btn ghost" data-act="train-max" data-arg="${id}">Train max</button>
        <button class="btn ghost" data-act="party" data-arg="${id}" ${inParty && s.party.length === 1 ? 'disabled' : ''}>${inParty ? 'Rest (leave party)' : s.party.length >= PARTY_SIZE ? 'Party full' : 'Join party'}</button></div>
    </div>
    <div class="card"><b>✨ ${esc(d.ult.name)}</b><div class="small muted">${esc(d.ult.desc)}</div></div>
    <h3>Gear</h3>${gear}
    <p class="muted small">${esc(CLASSES[d.cls].blurb)} Duplicates from Recruit add a star (+${STAR_BONUS * 100}% health and attack each).</p>`;
}

function itemStatsLine(it) {
  return Object.entries(it.stats).map(([k, v]) => (k === it.main ? `<b>${fmtStat(k, v)}</b>` : fmtStat(k, v))).join(' · ');
}
function itemCard(it, extra = '') {
  return `<div class="card item" style="--rar:${RARITIES[it.rarity].color}">
    <div class="row"><span class="slot-icon">${SLOTS[it.slot].icon}</span><div class="grow"><b style="color:${RARITIES[it.rarity].color}">${esc(it.name)}</b>${it.isNew ? ' <span class="new">NEW</span>' : ''}
      <div class="small muted">${RARITIES[it.rarity].name} ${SLOTS[it.slot].name} · item level ${it.il}</div></div></div>
    <div class="small">${itemStatsLine(it)}</div>${extra}</div>`;
}

function bestHolder(s, it) {
  let best = null;
  for (const id of Object.keys(s.heroes)) {
    const h = s.heroes[id], d = heroPower(h, { slot: it.slot, item: it }) - heroPower(h);
    if (!best || d > best.d || (d === best.d && s.party.includes(id))) best = { id, d };
  }
  return best;
}

function renderBag(s) {
  const items = [...s.bag].sort((a, b) => b.rarity - a.rarity || b.il - a.il);
  const list = items.map((it) => {
    const bh = bestHolder(s, it);
    return itemCard(it, `<div class="row small">${bh && bh.d > 0 ? `<span class="ok">Best on ${esc(HERO_BY_ID[bh.id].name.split(' ')[0])}: +${fmt(bh.d)} power</span>` : '<span class="muted">No upgrade for anyone</span>'}
      <span class="btnrow"><button class="btn small" data-act="equip-pick" data-arg="${it.id}">Equip…</button>
      <button class="btn small ghost" data-act="salvage" data-arg="${it.id}">Salvage +${fmt(salvageValue(it))}🪙</button></span></div>`);
  }).join('');
  return `<div class="row"><span class="muted small">${s.bag.length}/${BAG_CAP} items. A full bag salvages its weakest piece for gold, so battles never stop.</span></div>
    <div class="btnrow bagtools"><button class="btn small ghost" data-act="salvage-upto" data-arg="0">Salvage Commons</button>
      <button class="btn small ghost" data-act="salvage-upto" data-arg="1">Salvage Uncommon & below</button>
      <button class="btn small ${s.settings.autoSalvageCommon ? '' : 'ghost'}" data-act="auto-salvage">Auto-salvage Commons: ${s.settings.autoSalvageCommon ? 'On' : 'Off'}</button></div>
    ${list || '<p class="muted center">No loot yet. Enemies drop gear as you fight, and bosses always drop something.</p>'}`;
}

function renderRecruit(s) {
  const now = Date.now(), freeReady = freeSummonReady(s, now);
  const total = RECRUIT_WEIGHTS.reduce((a, b) => a + b, 0);
  const odds = RARITIES.map((r, i) => `<span>${rarName(i)} ${(RECRUIT_WEIGHTS[i] / total * 100).toFixed(1)}%</span>`).join('');
  const last = ui.lastSummon ? (() => {
    const r = ui.lastSummon, d = HERO_BY_ID[r.heroId];
    const what = r.isNew ? 'joins your band!' : r.stars ? `gains a star (${r.stars}★)` : `is maxed: +${fmt(r.gold)} 🪙`;
    return `<div class="card summon-result" style="--rar:${RARITIES[d.rarity].color}"><div class="row">${heroPortrait(d.id)}<div class="grow">
      <b style="color:${RARITIES[d.rarity].color}">${esc(d.name)}</b> ${what}<div class="small muted">${rarName(d.rarity)} ${CLASSES[d.cls].name} · ${esc(d.ult.name)}</div></div></div></div>`;
  })() : '';
  const codex = HEROES.map((d) => {
    const h = s.heroes[d.id];
    return `<button class="codex ${h ? '' : 'unknown'}" ${h ? `data-act="hero" data-arg="${d.id}"` : 'disabled'} style="--rar:${RARITIES[d.rarity].color}">
      <span class="pc-icon">${h ? CLASSES[d.cls].icon : '❔'}</span><span class="small">${h ? esc(d.name.split(' ')[0]) : '???'}</span>
      <span class="tiny stars">${h ? stars(h.stars) : RARITIES[d.rarity].name}</span></button>`;
  }).join('');
  return `<div class="card center"><div class="big">🔮 <b data-res="seals">${fmt(s.res.seals)}</b> Summon Seals</div>
      <div class="small muted">Seals drop from sub-bosses (${SUBBOSS_SEALS}) and stage bosses (${BOSS_SEALS}).</div>
      <button class="btn wide" data-act="summon" data-afford-res="seals" data-afford-cost="${RECRUIT_COST}">Summon a hero · ${RECRUIT_COST} 🔮</button>
      ${freeReady ? '<button class="btn wide free" data-act="summon-free">🎁 Free summon ready!</button>'
        : `<button class="btn wide ghost" disabled>Free summon in <span data-cd-end="${s.freeSummonAt}"></span></button>`}
      <div class="odds small">${odds}</div></div>
    ${last}
    <h3>Hero codex · ${Object.keys(s.heroes).length}/${HEROES.length}</h3>
    <div class="codex-grid">${codex}</div>
    <p class="muted small">Duplicates add a star, up to ${MAX_STARS}★. Beyond that they turn into gold. New heroes join at 60% of your best hero’s level.</p>`;
}

function renderWorld(s) {
  const cur = s.progress.stage;
  const worlds = WORLDS.map((w, wi) => {
    const stages = w.stages.map((st, si) => {
      const g = wi * STAGES_PER_WORLD + si, locked = g > s.best, here = g === cur, cleared = g < s.best;
      return `<button class="stage ${here ? 'here' : ''}" ${locked || here ? 'disabled' : ''} data-act="travel" data-arg="${g}">
        <span class="stage-n">${wi + 1}-${si + 1}</span><span class="grow"><b>${esc(st.name)}</b><span class="small muted">Boss: ${ENEMIES[st.boss].icon} ${esc(ENEMIES[st.boss].name)}</span></span>
        <span>${here ? '⚔️ Here' : cleared ? '✅' : locked ? '🔒' : '▶'}</span></button>`;
    }).join('');
    const open = wi * STAGES_PER_WORLD <= s.best;
    return `<div class="card ${open ? '' : 'locked'}"><b>${wi === 0 ? '🌲' : '🏚️'} World ${wi + 1}: ${esc(w.name)}</b>
      ${open ? stages : `<div class="small muted">Defeat ${esc(ENEMIES[WORLDS[wi - 1].stages[STAGES_PER_WORLD - 1].boss].name)} to open the road here.</div>`}</div>`;
  }).join('');
  const endlessFrom = WORLDS.length * STAGES_PER_WORLD;
  const endless = s.best >= endlessFrom
    ? `<div class="card"><b>♾️ The Endless Road</b><div class="small muted">Deepest stage reached: ${stageInfo(s.best).label}</div>
        ${cur !== s.best ? `<button class="btn wide" data-act="travel" data-arg="${s.best}">Return to the front (${stageInfo(s.best).label})</button>` : '<div class="small ok">You are at the front.</div>'}</div>` : '';
  return `<p class="hint">A boss kill sets your checkpoint. Replay any cleared stage to farm gold and loot.</p>${worlds}${endless}
    <div class="card locked"><b>❄️ World 3: Frostmere</b><div class="small muted">Coming soon.</div></div>`;
}

function renderSettings() {
  const fs = document.fullscreenEnabled
    ? `<button class="btn" data-act="fullscreen">${document.fullscreenElement ? 'Exit fullscreen' : 'Go fullscreen'}</button>` : '';
  const st = state.stats;
  return `<div class="card"><b>💾 Save</b><div class="muted small">Autosaves every few seconds in this browser.</div>
      <div class="btnrow"><button class="btn" data-act="export">Export save</button><button class="btn" data-act="import">Import save</button></div></div>
    ${fs ? `<div class="card"><b>📱 Display</b><div class="btnrow">${fs}</div></div>` : ''}
    <div class="card"><b>📊 Record</b><div class="muted small">Foes slain: ${fmt(st.kills)} · bosses: ${st.bosses} · retreats: ${st.wipes} · loot found: ${st.items} · summons: ${st.summons}<br>Deepest stage: ${stageInfo(state.best).label}</div></div>
    <div class="card"><b>🏮 Lantern Hall Classic</b><div class="muted small">The original guild-hall game (v1) is still here, with its own separate save.</div>
      <a class="btn ghost wide linkbtn" href="${CLASSIC_URL}">Play Lantern Hall Classic ›</a></div>
    <div class="card"><b>⚠️ Danger</b><div class="btnrow"><button class="btn danger" data-act="reset">Start over</button></div></div>
    <p class="muted small center">${GAME_TITLE} v${GAME_VERSION}</p>`;
}

// ---------- frame ----------

function render() {
  const s = state, sc = SCREENS[ui.screen];
  const isMain = ui.screen === 'battle';
  $('#header').innerHTML = `
    ${isMain ? `<span class="brand">🚩 ${GAME_TITLE}</span>` : `<button class="btn back" data-act="back">‹ Back</button><span class="brand">${sc.title}</span>`}
    <button class="icon-btn" data-act="go" data-arg="settings" aria-label="Settings">⚙️</button>`;
  $('#resbar').innerHTML = Object.entries(RESOURCES).map(([k, r]) =>
    `<span class="res" title="${r.name}">${r.icon} <b data-res="${k}">${fmt(s.res[k])}</b></span>`).join('')
    + `<span class="res muted" title="Stage">🚩 <b data-stage></b></span>`;
  $('#tabs').innerHTML = TABS.map((k) => {
    const badge = k === 'bag' && s.newItems ? s.newItems : k === 'recruit' && (freeSummonReady(s) || s.res.seals >= RECRUIT_COST) ? '!' : '';
    const on = ui.screen === k || SCREENS[ui.screen].parent === k;
    return `<button class="tab ${on ? 'on' : ''}" data-act="go" data-arg="${k}"><span>${SCREENS[k].tab}</span><small>${SCREENS[k].title.split(' ')[0]}</small><i class="dot" data-badge="${k}" ${badge ? '' : 'hidden'}>${badge}</i></button>`;
  }).join('');
  const screen = $('#screen');
  const keep = screen.dataset.screen === ui.screen ? screen.scrollTop : 0;
  screen.innerHTML = sc.render(s);
  screen.dataset.screen = ui.screen;
  screen.classList.toggle('is-battle', isMain);
  screen.scrollTop = keep;
  const slot = $('#lane-slot');
  if (slot) slot.appendChild(laneCanvas());
  if (ui.modal?.live) renderModal();
  updateLive();
}

// Cheap refresh of numbers, timers, badges and affordability without rebuilding the DOM.
function updateLive() {
  const s = state, now = Date.now();
  document.querySelectorAll('[data-res]').forEach((el) => { el.textContent = fmt(s.res[el.dataset.res]); });
  document.querySelectorAll('[data-stage]').forEach((el) => { el.textContent = `${stageInfo(s.progress.stage).label} · W${s.progress.wave}`; });
  document.querySelectorAll('[data-cd-end]').forEach((el) => { el.textContent = fmtTime((+el.dataset.cdEnd - now) / 1000); });
  document.querySelectorAll('[data-afford-res]').forEach((el) => { el.disabled = s.res[el.dataset.affordRes] < +el.dataset.affordCost; });
  const bag = document.querySelector('[data-badge="bag"]');
  if (bag) { bag.hidden = !s.newItems; bag.textContent = s.newItems; }
  const rec = document.querySelector('[data-badge="recruit"]');
  if (rec) rec.hidden = !(freeSummonReady(s, now) || s.res.seals >= RECRUIT_COST);
}

// Per-frame party strip update (HP and ult bars) on the battle screen.
function updateBattleHud() {
  if (!battle || ui.screen !== 'battle') return;
  for (const el of document.querySelectorAll('[data-hud]')) {
    const u = battle.units.find((x) => x.heroId === el.dataset.hud);
    if (!u) continue;
    el.querySelector('[data-hud-hp]').style.width = `${u.down ? 0 : (u.hp / u.maxHp) * 100}%`;
    el.querySelector('[data-hud-ult]').style.width = `${u.ult}%`;
    el.classList.toggle('ready', u.ult >= 100 && !u.down);
    el.classList.toggle('down', u.down);
  }
}

// ---------- modals ----------

function openModal(m) { ui.modal = m; renderModal(); }
function closeModal() { ui.modal = null; renderModal(); }

function renderModal() {
  const root = $('#modal');
  if (!ui.modal) { root.hidden = true; root.innerHTML = ''; return; }
  root.hidden = false;
  const keep = root.querySelector('.modal-body')?.scrollTop || 0;
  root.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true">
    <div class="modal-head"><b>${ui.modal.title}</b><button class="btn small" data-act="close">✕ Close</button></div>
    <div class="modal-body">${ui.modal.body()}</div></div>`;
  root.querySelector('.modal-body').scrollTop = keep;
}

function diffLine(h, it) {
  const cur = h.gear[it.slot], keys = new Set([...Object.keys(it.stats), ...Object.keys(cur?.stats || {})]);
  return [...keys].map((k) => {
    const d = (it.stats[k] || 0) - (cur?.stats[k] || 0);
    if (!d) return '';
    const v = STATS[k].pct ? `${Math.abs(Math.round(d * 10) / 10)}%` : fmt(Math.abs(d));
    return `<span class="${d > 0 ? 'ok' : 'bad'}">${d > 0 ? '▲' : '▼'}${v} ${STATS[k].name}</span>`;
  }).filter(Boolean).join(' ');
}

// Choose gear for one hero slot: every bag item for that slot with the comparison.
function gearModal(heroId, slot) {
  openModal({
    title: `${SLOTS[slot].icon} ${SLOTS[slot].name} · ${esc(HERO_BY_ID[heroId].name.split(' ')[0])}`, live: true,
    body: () => {
      const h = state.heroes[heroId], cur = h.gear[slot], base = heroPower(h);
      const opts = state.bag.filter((it) => it.slot === slot)
        .map((it) => ({ it, d: heroPower(h, { slot, item: it }) - base })).sort((a, b) => b.d - a.d);
      return `${cur ? itemCard(cur, `<div class="row small"><span class="muted">Equipped</span><button class="btn small ghost" data-act="unequip" data-arg="${heroId}:${slot}">Unequip</button></div>`) : `<p class="muted">Nothing equipped.</p>`}
        <h3>In your bag</h3>
        ${opts.map(({ it, d }) => itemCard(it, `<div class="small">${diffLine(h, it)}</div><div class="row small"><b class="${d > 0 ? 'ok' : d < 0 ? 'bad' : 'muted'}">Power ${d > 0 ? '+' : d < 0 ? '−' : '±'}${fmt(Math.abs(d))}</b>
          <button class="btn small" data-act="equip" data-arg="${heroId}:${it.id}">Equip</button></div>`)).join('') || `<p class="muted">No ${SLOTS[slot].name.toLowerCase()} in your bag yet.</p>`}`;
    },
  });
}

// Choose which hero wears a bag item.
function equipPickModal(itemId) {
  openModal({
    title: 'Equip on…', live: true,
    body: () => {
      const it = state.bag.find((x) => x.id === itemId);
      if (!it) return '<p class="muted">That item is gone.</p>';
      const rows = Object.keys(state.heroes).map((id) => {
        const h = state.heroes[id], d = heroPower(h, { slot: it.slot, item: it }) - heroPower(h);
        return { id, d, html: `<div class="card row">${heroPortrait(id)}<span class="grow"><b>${esc(HERO_BY_ID[id].name)}</b>
          <span class="small muted">${h.gear[it.slot] ? `Has: ${esc(h.gear[it.slot].name)}` : 'Slot empty'}</span>
          <span class="small">${diffLine(h, it)}</span></span>
          <span class="center"><b class="${d > 0 ? 'ok' : 'bad'}">${d > 0 ? '+' : d < 0 ? '-' : ''}${fmt(Math.abs(d))}</b><br>
          <button class="btn small" data-act="equip" data-arg="${id}:${it.id}">Equip</button></span></div>` };
      }).sort((a, b) => b.d - a.d);
      return itemCard(it) + rows.map((r) => r.html).join('');
    },
  });
}

function showSummary(rep) {
  const byR = RARITIES.map((r, i) => [i, rep.items.filter((it) => it.rarity === i).length]).filter(([, n]) => n);
  openModal({
    title: '🌙 While you were away',
    body: () => `<p class="muted">Your party kept fighting on ${esc(stageInfo(state.progress.stage).label)} for ${fmtTime(rep.seconds)}${rep.seconds >= OFFLINE_CAP_SECONDS ? ' (24h max)' : ''}.</p>
      <ul class="summary"><li>🪙 +${fmt(rep.gold)} gold</li><li>✨ +${fmt(rep.xp)} XP for each party hero</li>
        ${rep.levels.map((l) => `<li>⬆️ ${esc(HERO_BY_ID[l.heroId].name)} Lv ${l.from} → ${l.to}</li>`).join('')}
        ${byR.length ? `<li>🎁 Loot: ${byR.map(([i, n]) => `${n} ${rarName(i)}`).join(', ')}</li>` : ''}
        ${rep.salvagedGold ? `<li>♻️ Bag was full: +${fmt(rep.salvagedGold)} gold from salvage</li>` : ''}</ul>
      <button class="btn wide" data-act="close">Back to battle</button>`,
  });
}

function toast(html, cls = '') {
  const box = $('#toasts');
  while (box.children.length > 2) box.firstChild.remove();
  const el = document.createElement('div');
  el.className = `toast ${cls}`;
  el.innerHTML = html;
  box.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
