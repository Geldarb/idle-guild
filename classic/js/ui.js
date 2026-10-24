// Rendering and input. Screens are plain functions returning HTML; buttons carry data-act/data-arg.
'use strict';

const $ = (sel) => document.querySelector(sel);
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmt(n) {
  if (n < 10 && n % 1) return n.toFixed(1);
  if (n < 1000) return String(Math.floor(n));
  const units = ['K', 'M', 'B', 'T'];
  let i = -1;
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
  return `${n.toFixed(n < 100 ? 1 : 0)}${units[i]}`;
}
function fmtRate(n) { return n === 0 ? '0' : n < 10 ? n.toFixed(2) : fmt(n); }
function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}
const cost = (res, n) => `${fmt(n)} ${RESOURCES[res].icon}`;
// A button that greys itself out live while you can't afford it.
const buyBtn = (act, arg, res, n, label) =>
  `<button class="btn buy" data-act="${act}" data-arg="${esc(arg)}" data-afford-res="${res}" data-afford-cost="${n}">${label} · ${cost(res, n)}</button>`;

const ui = { screen: 'hall', modal: null };

// ---------- screens ----------

const SCREENS = {
  hall: { title: 'Guild Hall', tab: '🏰', render: renderHall },
  roster: { title: 'Common Room', tab: '👥', render: renderRoster },
  quests: { title: 'Quest Board', tab: '📜', render: renderQuests },
  recruit: { title: 'Notice Board', tab: '🍺', render: renderRecruit },
  workshop: { title: 'Workshop', render: renderWorkshop },
  settings: { title: 'Settings', render: renderSettings },
};
const TAB_LABELS = { hall: 'Hall', roster: 'Roster', quests: 'Quests', recruit: 'Recruit' };

function hallArt(s) {
  const ws = s.facilities.workshop > 0, smoke = ws && Object.values(s.ops).some((l) => l > 0);
  return `<svg class="hall-art" viewBox="0 0 320 130" role="img" aria-label="Your guild hall">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2140"/><stop offset="1" stop-color="#3a2b45"/></linearGradient></defs>
    <rect width="320" height="130" fill="url(#sky)"/>
    <circle cx="276" cy="26" r="11" fill="#f4e7c1" opacity=".9"/>
    <rect y="112" width="320" height="18" fill="#2b3a2a"/>
    <!-- main hall -->
    <rect x="96" y="54" width="128" height="60" fill="#6b5844" stroke="#3b2f24" stroke-width="2"/>
    <polygon points="88,56 160,18 232,56" fill="#8a3b2e" stroke="#4a1f18" stroke-width="2"/>
    <rect x="148" y="80" width="24" height="34" rx="12" fill="#3b2a1c"/>
    <rect x="110" y="66" width="18" height="16" fill="#ffcf6b"/><rect x="192" y="66" width="18" height="16" fill="#ffcf6b"/>
    <line x1="160" y1="38" x2="160" y2="52" stroke="#3b2f24" stroke-width="2"/>
    <circle cx="160" cy="58" r="5" fill="#ffd977" class="glow"/>
    <!-- common room wing -->
    <rect x="40" y="74" width="56" height="40" fill="#5d4c3b" stroke="#3b2f24" stroke-width="2"/>
    <polygon points="34,76 68,56 102,76" fill="#7a3428"/>
    <rect x="58" y="86" width="16" height="12" fill="#ffcf6b"/>
    <!-- workshop wing -->
    ${ws ? `<rect x="224" y="74" width="60" height="40" fill="#5d4c3b" stroke="#3b2f24" stroke-width="2"/>
    <polygon points="218,76 254,56 290,76" fill="#7a3428"/>
    <rect x="266" y="50" width="10" height="20" fill="#4a3c30"/>
    <rect x="236" y="86" width="16" height="12" fill="#ff9d4a"/><rect x="258" y="86" width="16" height="12" fill="#ff9d4a"/>
    ${smoke ? '<g class="smoke"><circle cx="271" cy="44" r="5"/><circle cx="275" cy="34" r="6"/><circle cx="270" cy="23" r="7"/></g>' : ''}`
    : `<rect x="226" y="96" width="56" height="18" fill="none" stroke="#9b8a6f" stroke-dasharray="4 3"/><text x="254" y="92" fill="#9b8a6f" font-size="9" text-anchor="middle">empty plot</text>`}
  </svg>`;
}

function renderHall(s) {
  const rooms = Object.entries(FACILITIES).map(([id, f]) => {
    const lvl = s.facilities[id] || 0;
    if (f.comingSoon) {
      return `<div class="card room locked"><div class="room-icon">${f.icon}</div><div class="grow"><b>${f.name}</b>
        <div class="muted">${f.comingSoon}</div></div><span class="tag">Coming soon</span></div>`;
    }
    if (!lvl) {
      return `<div class="card room unbuilt"><div class="room-icon">${f.icon}</div><div class="grow"><b>${f.name}</b>
        <div class="muted">${f.desc}</div></div>${buyBtn('build', id, 'gold', f.buildCost, 'Build')}</div>`;
    }
    const target = id === 'commons' ? 'roster' : id;
    const status = id === 'commons' ? `${s.adventurers.length}/${rosterCap(s)} adventurers`
      : `<span data-rate="gold">+${fmtRate(totalRates(s).gold)}</span> 🪙/s`;
    return `<button class="card room" data-act="go" data-arg="${target}"><div class="room-icon">${f.icon}</div>
      <div class="grow"><b>${f.name}</b> <span class="lvl">Lv ${lvl}</span><div class="muted">${status}</div></div><span class="chev">›</span></button>`;
  }).join('');
  const idle = s.adventurers.filter((a) => !adventurerTask(s, a.id)).length;
  const hint = !s.facilities.workshop ? 'Build a Workshop to start earning gold while you rest.'
    : idle ? `${idle} adventurer${idle > 1 ? 's are' : ' is'} idle: send them on a quest or put them to work.`
    : 'Everyone is busy. The hall hums along.';
  return `${hallArt(s)}<p class="hint">${hint}</p><h3>Rooms</h3>${rooms}`;
}

function renderWorkshop(s) {
  const lvl = s.facilities.workshop, f = FACILITIES.workshop;
  const up = lvl < f.maxLevel ? buyBtn('upgrade', 'workshop', 'gold', facilityCost('workshop', lvl), 'Upgrade')
    : '<span class="tag">Max level</span>';
  const nextUnlock = Object.values(OPERATIONS).find((o) => o.unlockAt > lvl);
  const ops = f.ops.map((id) => {
    const o = OPERATIONS[id], level = s.ops[id];
    if (!opUnlocked(s, id)) {
      return `<div class="card locked"><b>${o.icon} ${o.name}</b><div class="muted">Unlocks at Workshop Lv ${o.unlockAt}.</div></div>`;
    }
    const rate = opRate(s, id), next = opRate(s, id, level + 1);
    const ms = nextMilestone(level);
    const ov = findAdventurer(s, s.overseers[id]);
    const overseer = ov
      ? `<div class="row"><span>👁️ Overseer: <b>${esc(ov.name)}</b> (+${Math.round(overseerBonus(s, id) * 100)}%)</span>
         <button class="btn small ghost" data-act="unassign" data-arg="${id}">Remove</button></div>`
      : `<div class="row"><span class="muted">No overseer. ${STATS[o.stat]} adventurers boost output.</span>
         <button class="btn small" data-act="pick-overseer" data-arg="${id}">Assign</button></div>`;
    return `<div class="card op">
      <div class="row"><b>${o.icon} ${o.name}</b><span class="lvl">Lv ${level}</span></div>
      <div class="muted">${o.desc}</div>
      <div class="row nums"><span>Now: <b>${fmtRate(rate)}</b> ${RESOURCES[o.res].icon}/s</span><span>Next: <b>${fmtRate(next)}</b> ${RESOURCES[o.res].icon}/s</span></div>
      ${ms ? `<div class="bar"><i style="width:${(level / ms) * 100}%"></i></div><div class="muted small">Output doubles at Lv ${ms}</div>` : ''}
      ${overseer}
      ${buyBtn('op-up', id, 'gold', opCost(id, level), level ? 'Upgrade' : 'Open')}
    </div>`;
  }).join('');
  return `<div class="card"><div class="row"><b>🔨 Workshop</b><span class="lvl">Lv ${lvl}</span></div>
    <div class="muted">Each level: +${WORKSHOP_LEVEL_BONUS * 100}% to every operation.${nextUnlock ? ` Lv ${nextUnlock.unlockAt} unlocks ${nextUnlock.name}.` : ''}</div>${up}</div>
    <h3>Operations</h3>${ops}`;
}

function advCard(s, a, extra = '') {
  const c = CLASSES[a.cls], r = RARITIES[a.rarity];
  const task = adventurerTask(s, a.id);
  let status = '<span class="ok">Idle</span>';
  if (task?.type === 'oversee') status = `Overseeing ${OPERATIONS[task.op].name}`;
  if (task?.type === 'quest') status = `On quest · <span data-cd-end="${task.quest.end}">${fmtTime((task.quest.end - Date.now()) / 1000)}</span>`;
  const isRecruit = a.hireCost != null;
  return `<div class="card adv" style="--rar:${r.color}">
    <div class="row"><span class="adv-icon">${c.icon}</span><div class="grow"><b>${esc(a.name)}</b>
      <div class="muted small"><span style="color:${r.color}">${r.name}</span> ${c.name} · Lv ${a.level}</div></div>
      <span class="power" title="Power">⚔ ${power(a)}</span></div>
    <div class="statline">${Object.entries(STATS).map(([k, n]) => `<span>${n} <b>${a.stats[k]}</b></span>`).join('')}</div>
    ${isRecruit ? '' : `<div class="bar xp"><i style="width:${(a.xp / xpToNext(a.level)) * 100}%"></i></div>
    <div class="row small"><span class="muted">${status}</span><span class="muted">XP ${a.xp}/${xpToNext(a.level)}</span></div>`}
    ${extra}</div>`;
}

function renderRoster(s) {
  const lvl = s.facilities.commons, f = FACILITIES.commons;
  const up = lvl < f.maxLevel ? buyBtn('upgrade', 'commons', 'gold', facilityCost('commons', lvl), 'Add a bunk')
    : '<span class="tag">Max level</span>';
  const cards = s.adventurers.map((a) => advCard(s, a, adventurerTask(s, a.id)?.type === 'quest' ? ''
    : `<div class="row end"><button class="btn small ghost" data-act="dismiss" data-arg="${a.id}">Dismiss</button></div>`)).join('');
  return `<div class="card"><div class="row"><b>🍺 Common Room</b><span class="lvl">Lv ${lvl}</span></div>
    <div class="muted">Houses ${rosterCap(s)} adventurers (${s.adventurers.length} now).</div>${up}</div>
    <h3>Adventurers</h3>${cards || '<p class="muted">No one here yet. Visit the Notice Board.</p>'}`;
}

function renderQuests(s) {
  const now = Date.now();
  const active = s.quests.map((q) => {
    const a = findAdventurer(s, q.advId), t = QUEST_TIERS.find((x) => x.id === q.tier);
    return `<div class="card quest active"><div class="row"><b>${t.icon} ${esc(q.title)}</b></div>
      <div class="row small"><span>${esc(a?.name ?? '?')} · ${Math.round(q.chance * 100)}% success</span><span data-cd-end="${q.end}">${fmtTime((q.end - now) / 1000)}</span></div>
      <div class="bar"><i data-bar-start="${q.start}" data-bar-end="${q.end}" style="width:${Math.min(100, ((now - q.start) / (q.end - q.start)) * 100)}%"></i></div></div>`;
  }).join('');
  const rank = rankIndex(s.res.renown);
  const tiers = QUEST_TIERS.map((t) => {
    if (!tierUnlocked(s, t)) {
      return `<div class="card quest locked"><b>${t.icon} ${t.name}</b><div class="muted">Needs renown rank ${RANKS[t.minRank].name} (${RANKS[t.minRank].at} ⭐).</div></div>`;
    }
    const p = s.board[t.id];
    return `<div class="card quest"><div class="row"><b>${t.icon} ${t.name}</b><span class="muted small">${fmtTime(t.dur)}</span></div>
      <div>${esc(p.title)}</div>
      <div class="muted small">Favours ${STATS[p.stat]} · Suggested power ${t.req}${t.supplies ? ` · Costs ${cost('supplies', t.supplies)}` : ''}</div>
      <div class="row small rewards"><span>🪙 ${fmt(t.gold)}</span><span>✨ ${t.xp} XP</span><span>⭐ ${t.renown}</span></div>
      <button class="btn" data-act="pick-quester" data-arg="${t.id}" ${t.supplies ? `data-afford-res="supplies" data-afford-cost="${t.supplies}"` : ''}>Send adventurer…</button></div>`;
  }).join('');
  return `${active ? `<h3>Under way</h3>${active}` : ''}
    <div class="muted small">Renown rank: <b>${RANKS[rank].name}</b>${RANKS[rank + 1] ? ` · next at ${RANKS[rank + 1].at} ⭐` : ''}</div>
    <h3>Postings</h3>${tiers}`;
}

function renderRecruit(s) {
  const rank = rankIndex(s.res.renown), full = s.adventurers.length >= rosterCap(s);
  const odds = RANKS[rank].weights, total = odds.reduce((a, b) => a + b, 0);
  const cards = s.recruits.map((a) => advCard(s, a, full
    ? '<div class="muted small">Common Room is full. Add a bunk first.</div>'
    : buyBtn('hire', a.id, 'gold', a.hireCost, 'Hire'))).join('');
  return `<div class="card"><div class="muted small">Renown rank <b>${RANKS[rank].name}</b>. Odds:
      ${RARITIES.map((r, i) => odds[i] ? `<span style="color:${r.color}">${r.name} ${Math.round((odds[i] / total) * 100)}%</span>` : '').join(' ')}</div>
    <div class="row small"><span class="muted">New faces in <span data-cd-end="${s.recruitRefreshAt}">${fmtTime((s.recruitRefreshAt - Date.now()) / 1000)}</span></span>
    ${buyBtn('reroll', '', 'gold', rerollCost(s), 'Call now')}</div></div>
    ${cards}`;
}

function renderSettings() {
  const fs = document.fullscreenEnabled
    ? `<button class="btn" data-act="fullscreen">${document.fullscreenElement ? 'Exit fullscreen' : 'Go fullscreen'}</button>` : '';
  return `<div class="card"><b>💾 Save</b><div class="muted small">Autosaves every few seconds in this browser.</div>
      <div class="btnrow"><button class="btn" data-act="export">Export save</button><button class="btn" data-act="import">Import save</button></div></div>
    ${fs ? `<div class="card"><b>📱 Display</b><div class="btnrow">${fs}</div></div>` : ''}
    <div class="card"><b>📊 Guild record</b><div class="muted small">Quests won: ${state.stats.questsDone} · failed: ${state.stats.questsFailed}</div></div>
    <div class="card"><b>⚠️ Danger</b><div class="btnrow"><button class="btn danger" data-act="reset">Start a new guild</button></div></div>
    <p class="muted small center">Lantern Hall v${GAME_VERSION}</p>`;
}

// ---------- frame ----------

function render() {
  const s = state, sc = SCREENS[ui.screen];
  const isMain = ui.screen === 'hall';
  $('#header').innerHTML = `
    ${isMain ? `<span class="brand">🏮 ${esc(s.guildName)}</span>` : `<button class="btn back" data-act="back">‹ Back</button><span class="brand">${sc.title}</span>`}
    <button class="icon-btn" data-act="go" data-arg="settings" aria-label="Settings">⚙️</button>`;
  $('#resbar').innerHTML = Object.entries(RESOURCES).map(([k, r]) =>
    `<span class="res" title="${r.name}">${r.icon} <b data-res="${k}">${fmt(s.res[k])}</b>${k !== 'renown' ? `<small data-rate="${k}"></small>` : ''}</span>`).join('');
  $('#tabs').innerHTML = Object.keys(TAB_LABELS).map((k) =>
    `<button class="tab ${ui.screen === k || (k === 'hall' && ui.screen === 'workshop') ? 'on' : ''}" data-act="go" data-arg="${k}">
      <span>${SCREENS[k].tab}</span><small>${TAB_LABELS[k]}</small>${k === 'quests' && idleCount(s) ? `<i class="dot">${idleCount(s)}</i>` : ''}</button>`).join('');
  const screen = $('#screen');
  const keep = screen.dataset.screen === ui.screen ? screen.scrollTop : 0;
  screen.innerHTML = sc.render(s);
  screen.dataset.screen = ui.screen;
  screen.scrollTop = keep;
  if (ui.modal?.live) renderModal();
  updateLive();
}

function idleCount(s) { return s.adventurers.filter((a) => !adventurerTask(s, a.id)).length; }

// Cheap per-tick refresh of numbers, timers and affordability without rebuilding the DOM.
function updateLive() {
  const s = state, now = Date.now(), rates = totalRates(s);
  document.querySelectorAll('[data-res]').forEach((el) => { el.textContent = fmt(s.res[el.dataset.res]); });
  document.querySelectorAll('[data-rate]').forEach((el) => {
    const r = rates[el.dataset.rate];
    el.textContent = el.tagName === 'SMALL' ? (r ? ` +${fmtRate(r)}/s` : '') : `+${fmtRate(r)}`;
  });
  document.querySelectorAll('[data-cd-end]').forEach((el) => { el.textContent = fmtTime((+el.dataset.cdEnd - now) / 1000); });
  document.querySelectorAll('[data-bar-end]').forEach((el) => {
    const a = +el.dataset.barStart, b = +el.dataset.barEnd;
    el.style.width = `${Math.min(100, ((now - a) / (b - a)) * 100)}%`;
  });
  document.querySelectorAll('[data-afford-res]').forEach((el) => {
    el.disabled = s.res[el.dataset.affordRes] < +el.dataset.affordCost;
  });
}

// ---------- modals ----------

function openModal(m) { ui.modal = m; renderModal(); }
function closeModal() { ui.modal = null; renderModal(); }

function renderModal() {
  const root = $('#modal');
  if (!ui.modal) { root.hidden = true; root.innerHTML = ''; return; }
  root.hidden = false;
  root.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true">
    <div class="modal-head"><b>${ui.modal.title}</b><button class="btn small" data-act="close">✕ Close</button></div>
    <div class="modal-body">${ui.modal.body()}</div></div>`;
}

function pickerModal(title, list, act, arg, describe) {
  openModal({
    title,
    live: true,
    body: () => (list().length ? list().map((a) => advCard(state, a,
      `<div class="row"><span class="small">${describe(a)}</span><button class="btn small" data-act="${act}" data-arg="${arg}:${a.id}">Choose</button></div>`)).join('')
      : '<p class="muted">Nobody is free right now. Idle adventurers show up here.</p>'),
  });
}

function showSummary(rep) {
  const lines = [];
  for (const k of ['gold', 'supplies', 'renown']) if (rep[k] >= 1) lines.push(`<li>${RESOURCES[k].icon} +${fmt(rep[k])} ${RESOURCES[k].name}</li>`);
  const quests = rep.quests.map((q) => `<li>${q.success ? '✅' : '❌'} ${esc(q.name)}: ${esc(q.title)} (+${q.xp} XP)${q.levels ? ` · <b>Lv ${q.newLevel}!</b>` : ''}</li>`).join('');
  openModal({
    title: '🌙 While you were away',
    body: () => `<p class="muted">Your guild kept busy for ${fmtTime(rep.seconds)}.</p>
      <ul class="summary">${lines.join('')}${quests || (lines.length ? '' : '<li>All quiet. Open an operation to earn while away.</li>')}</ul>
      ${rep.newRecruits ? '<p class="muted small">New faces on the Notice Board.</p>' : ''}
      <button class="btn wide" data-act="close">Back to the hall</button>`,
  });
}

function toast(html) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = html;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function reportToasts(rep) {
  for (const q of rep.quests) {
    toast(q.success ? `✅ ${esc(q.name)} returned: +${q.gold} 🪙 +${q.renown} ⭐${q.levels ? ` · Lv ${q.newLevel}!` : ''}`
      : `❌ ${esc(q.name)} failed, but learned something (+${q.xp} XP)`);
  }
}
