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

const ui = { screen: 'battle', modal: null, heroId: null, lastSummon: null, lastSummons: null, sel: null, redeemMsg: null };

// ---------- screens ----------

const SCREENS = {
  world: { title: 'World', tab: '🗺️', render: renderWorld },
  heroes: { title: 'Heroes', tab: '🧙', render: renderHeroes },
  recruit: { title: 'Recruit', tab: '🥚', render: renderRecruit },
  battle: { title: 'Battle', tab: '⚔️', render: renderBattle },
  party: { title: 'Party', tab: '🛡️', render: renderParty },
  bag: { title: 'Bag', tab: '🎒', render: renderBag },
  hero: { title: 'Hero', render: renderHero, parent: 'heroes' },
  settings: { title: 'Options', render: renderSettings },
};
const TABS = ['world', 'heroes', 'recruit', 'battle', 'party', 'bag'];

const rarColor = (r) => RARITIES[r].color;
function portraitHtml(id, cls = '') {
  const d = HERO_BY_ID[id];
  return `<span class="portrait ${cls}" style="--rar:${rarColor(d.rarity)}"><img src="${heroPortrait(id)}" alt=""><i class="cls-badge" title="${CLASSES[d.cls].name}">${CLASSES[d.cls].icon}</i></span>`;
}
const rowOf = (s, id) => { const i = s.formation.indexOf(id); return i < 0 ? 'bench' : slotRow(i); };
const rowTag = (r) => `<span class="rowtag ${r}">${r === 'front' ? 'Front' : r === 'back' ? 'Back' : 'Bench'}</span>`;
const screenTitle = (t, extra = '') => `<div class="ribbon"><span>${t}</span>${extra}</div>`;

function gearTile(s, id, slot) {
  const h = s.heroes[id], it = h.gear[slot], up = bestUpgrade(s, h, slot);
  return `<button class="gtile ${it ? '' : 'empty'}" data-act="gear" data-arg="${id}:${slot}" title="${SLOTS[slot].name}" ${it ? `style="--rar:${rarColor(it.rarity)}"` : ''}>
    ${it ? slotSvg(slot, rarColor(it.rarity)) : '<span class="plus-ic">+</span>'}${it ? `<span class="glv">Lv. ${it.il}</span>` : `<span class="glv dim">${SLOTS[slot].name}</span>`}${up ? '<i class="up">▲</i>' : ''}</button>`;
}

function battleCard(s, id) {
  const d = HERO_BY_ID[id], h = s.heroes[id], st = heroStats(h), c = trainCost(h.level), row = rowOf(s, id);
  return `<div class="bcard" data-hud="${id}" style="--rar:${rarColor(d.rarity)};--cls:${CLASSES[d.cls].color}">
    <div class="bc-name"><b>${esc(d.name.split(' ')[0])}</b> ${rowTag(row)}<span class="stars">${stars(h.stars)}</span></div>
    <div class="bc-main">
      <button class="bc-portrait" data-act="hero" data-arg="${id}" aria-label="${esc(d.name)}">${portraitHtml(id)}</button>
      <div class="bc-tiles">${SLOT_IDS.map((slot) => gearTile(s, id, slot)).join('')}
        <button class="utile" data-act="ult" data-arg="${id}" title="${esc(d.ult.name)}: ${esc(d.ult.desc)}"><i class="ufill" data-hud-ult></i><span class="uic">${CLASSES[d.cls].icon}</span><span class="glv">ULT</span></button></div>
    </div>
    <div class="bc-bars">
      <div class="hpbar"><span class="heart">❤</span><span class="track"><i data-hud-hp></i></span><b data-hud-hptext>${fmt(st.hp)}/${fmt(st.hp)}</b></div>
      <div class="trainrow"><span class="tlv">${h.level}</span><span class="tbar"><i style="width:${(h.xp / xpToNext(h.level)) * 100}%"></i><b>Training Lvl.</b></span>
        <button class="gbtn" data-act="train" data-arg="${id}" data-afford-res="gold" data-afford-cost="${c}" title="Train to Lv ${h.level + 1}">🪙 ${fmt(c)}</button></div>
    </div></div>`;
}

function renderBattle(s) {
  return `<div class="battle">
    <div id="lane-slot" class="lane-slot"></div>
    <div class="bside">
      <div class="battle-bar">
        <button class="chip ${s.settings.autoUlt ? 'on' : ''}" data-act="auto-ult">⚡ Auto ult ${s.settings.autoUlt ? 'ON' : 'OFF'}</button>
        <button class="chip" data-act="go" data-arg="party">🛡️ Formation</button>
        <span class="chip power">⚔ ${fmt(partyPower(s))}</span>
      </div>
      <div class="hero-list">${s.formation.filter(Boolean).map((id) => battleCard(s, id)).join('')}
        <p class="hint small">${battleHint(s)}</p></div>
    </div>
  </div>`;
}
function battleHint(s) {
  if (s.stats.bosses === 0) return 'Heroes fight on their own. Tap a glowing ULT tile to fire an ultimate, the green button to train, and a gear tile to equip loot.';
  if (partyOf(s).length < Math.min(PARTY_SIZE, Object.keys(s.heroes).length)) return 'You have heroes on the bench. Fill all 6 slots on the <b>Party</b> screen.';
  if (s.bag.length && s.newItems) return `New loot in your <b>Bag</b> (${s.newItems}). Tap a gear tile to equip upgrades.`;
  if (s.res.seals >= RECRUIT_COST) return 'You have Summon Seals. Visit <b>Recruit</b> to call a new hero and raise your Recruit Level.';
  return 'Stuck on a boss? Put Guardians in front, train, equip gear, or farm an earlier stage from the <b>World</b> map.';
}

// ---------- formation ----------

function formationSlot(s, i) {
  const id = s.formation[i], sel = ui.sel?.slot === i;
  if (!id) return `<button class="fslot empty ${sel ? 'sel' : ''}" data-act="fslot" data-arg="${i}"><span class="plus-ic">+</span><small>Empty</small></button>`;
  const d = HERO_BY_ID[id], h = s.heroes[id];
  return `<button class="fslot ${sel ? 'sel' : ''}" data-act="fslot" data-arg="${i}" style="--rar:${rarColor(d.rarity)}">
    <img src="${heroSprite(id)}" alt=""><span class="fs-name">${esc(d.name.split(' ')[0])}</span><span class="fs-sub">${CLASSES[d.cls].icon} Lv ${h.level}</span></button>`;
}
function renderParty(s) {
  const bench = Object.keys(s.heroes).filter((id) => !inParty(s, id)).sort((a, b) => heroPower(s.heroes[b]) - heroPower(s.heroes[a]));
  const selId = ui.sel?.slot !== undefined ? s.formation[ui.sel.slot] : ui.sel?.hero;
  const help = ui.sel?.slot !== undefined
    ? (selId ? `Slot selected: tap another slot to swap, or a bench hero to replace ${esc(HERO_BY_ID[selId].name.split(' ')[0])}.` : 'Empty slot selected: tap a bench hero to put them here.')
    : ui.sel?.hero ? `${esc(HERO_BY_ID[ui.sel.hero].name.split(' ')[0])} selected: tap a slot to place them.` : 'Tap a slot, then a bench hero or another slot, to swap heroes around.';
  const col = (row, idxs) => `<div class="fcol ${row}"><div class="fcol-h">${row === 'front' ? '🛡️ FRONT ROW' : '🏹 BACK ROW'}</div>${idxs.map((i) => formationSlot(s, i)).join('')}</div>`;
  return `${screenTitle('Formation', `<span class="ribbon-sub">${partyOf(s).length}/${PARTY_SIZE} · ⚔ ${fmt(partyPower(s))}</span>`)}
    <div class="card fboard">
      <div class="fgrid">${col('back', [3, 4, 5])}<div class="farrow">➜<small>foes</small></div>${col('front', [0, 1, 2])}</div>
      <p class="small fhelp" data-fhelp>${help}</p>
      <div class="btnrow">
        ${ui.sel?.slot !== undefined && selId ? `<button class="btn ghost small" data-act="bench" data-arg="${ui.sel.slot}" ${partyOf(s).length <= 1 ? 'disabled' : ''}>Move to bench</button>` : ''}
        ${ui.sel ? '<button class="btn ghost small" data-act="fsel-clear">Cancel</button>' : ''}
        <button class="btn small" data-act="auto-form">✨ Auto-arrange</button></div>
    </div>
    <div class="card rules small"><b>How rows work</b><br>Enemies always attack the <b>front row</b> first. The <b>back row</b> can’t be hit while anyone in front is still standing. Guardians and Warriors love the front; Rangers, Mages, Clerics and Summoners are happiest in the back.</div>
    <h3>Bench · ${bench.length}</h3>
    ${bench.map((id) => {
      const d = HERO_BY_ID[id], h = s.heroes[id], sel = ui.sel?.hero === id;
      return `<div class="card benchcard ${sel ? 'sel' : ''}" style="--rar:${rarColor(d.rarity)}">
        <button class="bench-pick" data-act="bench-pick" data-arg="${id}">${portraitHtml(id)}<span class="grow"><b style="color:${rarColor(d.rarity)}">${esc(d.name)}</b>
          <span class="small muted">${CLASSES[d.cls].name} (${CLASSES[d.cls].role}) · Lv ${h.level} · ⚔ ${fmt(heroPower(h))}</span></span></button>
        <button class="btn small" data-act="party" data-arg="${id}" ${partyOf(s).length >= PARTY_SIZE ? 'disabled' : ''}>Add</button></div>`;
    }).join('') || '<p class="muted small center">Everyone you own is in the formation. Recruit more heroes to fill the bench.</p>'}`;
}

function heroCard(s, id) {
  const d = HERO_BY_ID[id], h = s.heroes[id];
  const ups = SLOT_IDS.some((slot) => bestUpgrade(s, h, slot));
  return `<button class="card hcard" data-act="hero" data-arg="${id}" style="--rar:${rarColor(d.rarity)}">
    ${portraitHtml(id)}
    <span class="grow"><b style="color:${rarColor(d.rarity)}">${esc(d.name)}</b>
      <span class="small muted">${RARITIES[d.rarity].name} ${CLASSES[d.cls].name} · Lv ${h.level} · <span class="stars">${stars(h.stars)}</span></span>
      <span class="small">Power <b>${fmt(heroPower(h))}</b>${ups ? ' · <span class="ok">▲ gear upgrade</span>' : ''}</span></span>
    ${rowTag(rowOf(s, id))}</button>`;
}

function renderHeroes(s) {
  const owned = Object.keys(s.heroes).sort((a, b) => (inParty(s, b) - inParty(s, a)) || heroPower(s.heroes[b]) - heroPower(s.heroes[a]));
  const classes = CLASS_IDS.map((k) => { const c = CLASSES[k];
    return `<div class="clsrow"><span class="clsic" style="--cls:${c.color}">${c.icon}</span><span class="grow"><b>${c.name}</b> <span class="rowtag ${c.row}">${c.role} · ${c.row}</span><br><span class="small muted">${esc(c.blurb)}</span></span></div>`; }).join('');
  return `${screenTitle('Heroes', `<span class="ribbon-sub">${Object.keys(s.heroes).length}/${HEROES.length} found</span>`)}
    ${owned.map((id) => heroCard(s, id)).join('')}
    <h3>Classes</h3><div class="card">${classes}</div>`;
}

function renderHero(s) {
  const id = ui.heroId, d = HERO_BY_ID[id], h = s.heroes[id];
  if (!h) return '<p class="muted">Unknown hero.</p>';
  const st = heroStats(h), c = trainCost(h.level), here = inParty(s, id);
  const gear = SLOT_IDS.map((slot) => {
    const it = h.gear[slot], up = bestUpgrade(s, h, slot);
    return `<button class="slot" data-act="gear" data-arg="${id}:${slot}" ${it ? `style="--rar:${rarColor(it.rarity)}"` : ''}>
      <span class="slot-icon ${it ? '' : 'empty'}">${slotSvg(slot, it ? rarColor(it.rarity) : '#cfd6dd')}</span>
      <span class="grow">${it ? `<b style="color:${rarColor(it.rarity)}">${esc(it.name)}</b><span class="small muted">Lv. ${it.il} · ${itemStatsLine(it)}</span>`
        : `<span class="muted">${SLOTS[slot].name}: empty</span>`}</span>
      ${up ? `<span class="ok small">▲ +${fmt(up.delta)}</span>` : '<span class="chev">›</span>'}</button>`;
  }).join('');
  return `<div class="ribbon"><button class="btn small ghost" data-act="back">‹ Back</button><span>${esc(d.name.split(' ')[0])}</span></div>
    <div class="card hero-head" style="--rar:${rarColor(d.rarity)}">
      <div class="row">${portraitHtml(id, 'big')}<div class="grow"><b style="color:${rarColor(d.rarity)}">${esc(d.name)}</b>
        <div class="small muted">${rarName(d.rarity)} ${CLASSES[d.cls].name} · ${CLASSES[d.cls].role} · <span class="stars">${stars(h.stars)}</span></div>
        <div class="small">${rowTag(rowOf(s, id))}</div></div>
        <div class="center"><div class="lvl">Lv ${h.level}</div><div class="small">⚔ ${fmt(heroPower(h))}</div></div></div>
      <div class="bar xp"><i style="width:${(h.xp / xpToNext(h.level)) * 100}%"></i></div>
      <div class="statgrid small">
        <span>❤️ ${fmt(st.hp)}</span><span>⚔️ ${fmt(st.atk)}</span><span>⏱ ${st.aspd.toFixed(2)}/s</span>
        <span>🛡 ${Math.round(st.def)}%</span><span>💥 ${Math.round(st.crit)}%</span><span>🩸 ${Math.round(st.ls)}%</span></div>
      ${buyBtn('train', id, 'gold', c, `Train to Lv ${h.level + 1}`)}
      <div class="btnrow"><button class="btn ghost" data-act="train-max" data-arg="${id}">Train max</button>
        ${here ? `<button class="btn ghost" data-act="party" data-arg="${id}" ${partyOf(s).length === 1 ? 'disabled' : ''}>Move to bench</button>`
          : `<button class="btn ghost" data-act="party" data-arg="${id}" ${partyOf(s).length >= PARTY_SIZE ? 'disabled' : ''}>${partyOf(s).length >= PARTY_SIZE ? 'Formation full' : 'Add to formation'}</button>`}
        <button class="btn ghost" data-act="go" data-arg="party">Formation ›</button></div>
    </div>
    <div class="card"><b>✨ ${esc(d.ult.name)}</b><div class="small muted">${esc(d.ult.desc)}</div></div>
    <h3>Gear</h3>${gear}
    <p class="muted small">${esc(CLASSES[d.cls].blurb)} Duplicates from Recruit add a star (+${STAR_BONUS * 100}% health and attack each).</p>`;
}

function itemStatsLine(it) {
  return Object.entries(it.stats).map(([k, v]) => (k === it.main ? `<b>${fmtStat(k, v)}</b>` : fmtStat(k, v))).join(' · ');
}
function itemCard(it, extra = '') {
  return `<div class="card item" style="--rar:${rarColor(it.rarity)}">
    <div class="row"><span class="slot-icon">${slotSvg(it.slot, rarColor(it.rarity))}<span class="glv">Lv. ${it.il}</span></span><div class="grow"><b style="color:${rarColor(it.rarity)}">${esc(it.name)}</b>${it.isNew ? ' <span class="new">NEW</span>' : ''}
      <div class="small muted">${RARITIES[it.rarity].name} ${SLOTS[it.slot].name} · item level ${it.il}</div></div></div>
    <div class="small">${itemStatsLine(it)}</div>${extra}</div>`;
}

function bestHolder(s, it) {
  let best = null;
  for (const id of Object.keys(s.heroes)) {
    const h = s.heroes[id], d = heroPower(h, { slot: it.slot, item: it }) - heroPower(h);
    if (!best || d > best.d || (d === best.d && inParty(s, id))) best = { id, d };
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
  return `${screenTitle('Bag', `<span class="ribbon-sub">${s.bag.length}/${BAG_CAP}</span>`)}
    <p class="hint small">A full bag salvages its weakest piece for gold, so battles never stop.</p>
    <div class="btnrow bagtools"><button class="btn small ghost" data-act="salvage-upto" data-arg="0">Salvage Commons</button>
      <button class="btn small ghost" data-act="salvage-upto" data-arg="1">Salvage Uncommon & below</button>
      <button class="btn small ${s.settings.autoSalvageCommon ? '' : 'ghost'}" data-act="auto-salvage">Auto-salvage Commons: ${s.settings.autoSalvageCommon ? 'On' : 'Off'}</button></div>
    ${list || '<p class="muted center">No loot yet. Enemies drop gear as you fight, and bosses always drop something.</p>'}`;
}

function summonLine(r) {
  const d = HERO_BY_ID[r.heroId];
  const what = r.isNew ? 'joins your band!' : r.stars ? `gains a star (${r.stars}★)` : `is maxed: +${fmt(r.gold)} 🪙`;
  return `<div class="card summon-result" style="--rar:${rarColor(d.rarity)}"><div class="row">${portraitHtml(d.id)}<div class="grow">
    <b style="color:${rarColor(d.rarity)}">${esc(d.name)}</b> ${what}<div class="small muted">${rarName(d.rarity)} ${CLASSES[d.cls].name} · ${esc(d.ult.name)}</div></div></div></div>`;
}

function renderRecruit(s) {
  const now = Date.now(), freeReady = freeSummonReady(s, now), r = s.recruit;
  const need = recruitXpToNext(r.level), maxed = r.level >= RECRUIT_MAX_LEVEL;
  const table = `<table class="odds-table" data-odds><thead><tr><th>Lv</th>${RARITIES.map((x, i) => `<th style="color:${x.color}">${x.name.slice(0, i === 1 ? 3 : 4)}</th>`).join('')}</tr></thead><tbody>
    ${RECRUIT_ODDS.map((row, i) => `<tr class="${i + 1 === r.level ? 'cur' : ''}"><td>${i + 1}</td>${row.map((v) => `<td>${v}%</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  let last = '';
  if (ui.lastSummons?.length) {
    const best = [...ui.lastSummons].sort((a, b) => HERO_BY_ID[b.heroId].rarity - HERO_BY_ID[a.heroId].rarity);
    last = `<div class="card"><b>Summoned ×${ui.lastSummons.length}</b><div class="mini-grid">${best.map((x) => { const d = HERO_BY_ID[x.heroId];
      return `<span class="mini" style="--rar:${rarColor(d.rarity)}" title="${esc(d.name)}"><img src="${heroPortrait(d.id)}" alt="">${x.isNew ? '<i>NEW</i>' : ''}</span>`; }).join('')}</div></div>`;
  } else if (ui.lastSummon) last = summonLine(ui.lastSummon);
  const codex = HEROES.map((d) => {
    const h = s.heroes[d.id];
    return `<button class="codex ${h ? '' : 'unknown'}" ${h ? `data-act="hero" data-arg="${d.id}"` : 'disabled'} style="--rar:${rarColor(d.rarity)}">
      <img src="${heroSprite(d.id)}" alt=""><span class="small">${h ? esc(d.name.split(' ')[0]) : '???'}</span>
      <span class="tiny">${h ? stars(h.stars) : `${CLASSES[d.cls].icon} ${RARITIES[d.rarity].name}`}</span></button>`;
  }).join('');
  return `${screenTitle('Recruit')}
    <div class="card center recruit-card">
      <div class="rlv"><span class="rlv-badge" data-recruit-level>${r.level}</span><div class="grow"><b>Recruit Level ${r.level}${maxed ? ' (MAX)' : ''}</b>
        <div class="bar rxp"><i style="width:${maxed ? 100 : (r.xp / need) * 100}%"></i><b data-recruit-xp>${maxed ? 'MAX' : `${r.xp} / ${need} XP`}</b></div>
        <div class="tiny muted">Every recruit gives +1 XP. Higher levels mean rarer heroes.</div></div></div>
      <div class="big">🔮 <b data-res="seals">${fmt(s.res.seals)}</b> Summon Seals</div>
      <div class="btnrow center-row">
        <button class="btn" data-act="summon" data-afford-res="seals" data-afford-cost="${RECRUIT_COST}">Summon ×1 · ${RECRUIT_COST}🔮</button>
        <button class="btn" data-act="summon-10" data-afford-res="seals" data-afford-cost="${RECRUIT_COST * 10}">Summon ×10 · ${RECRUIT_COST * 10}🔮</button></div>
      ${freeReady ? '<button class="btn wide free" data-act="summon-free">🎁 Free summon ready!</button>'
        : `<button class="btn wide ghost" disabled>Free summon in <span data-cd-end="${s.freeSummonAt}"></span></button>`}
      <div class="small muted">Seals drop from sub-bosses (${SUBBOSS_SEALS}) and stage bosses (${BOSS_SEALS}).</div>
    </div>
    ${last}
    <h3>Rarity odds by Recruit Level</h3><div class="card">${table}</div>
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
        <span class="stage-n">${wi + 1}-${si + 1}</span><span class="grow"><b>${esc(st.name)}</b><span class="small muted">Boss: ${esc(ENEMIES[st.boss].name)}</span></span>
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
  return `${screenTitle('World map', `<span class="ribbon-sub">Now: ${stageInfo(cur).label}</span>`)}
    <p class="hint small">A boss kill sets your checkpoint. Replay any cleared stage to farm gold and loot.</p>${worlds}${endless}
    <div class="card locked"><b>❄️ World 3: Frostmere</b><div class="small muted">Coming soon.</div></div>`;
}

function renderSettings() {
  const fs = document.fullscreenEnabled
    ? `<button class="btn" data-act="fullscreen">${document.fullscreenElement ? 'Exit fullscreen' : 'Go fullscreen'}</button>` : '';
  const st = state.stats, m = ui.redeemMsg;
  return `${screenTitle('Options')}
    <div class="card redeem"><b>🎟️ Redeem code</b>
      <div class="redeem-row"><input id="redeem-code" type="text" maxlength="24" placeholder="Enter code" autocomplete="off" autocapitalize="characters" spellcheck="false">
        <button class="btn" data-act="redeem">Redeem</button></div>
      ${m ? `<div class="redeem-msg ${m.ok ? 'ok' : 'bad'}" data-redeem-msg>${m.ok ? '✅' : '⚠️'} ${esc(m.msg)}</div>` : ''}
      <div class="tiny muted">Codes used on this save: ${state.redeemed.length ? state.redeemed.map(esc).join(', ') : 'none yet'}</div></div>
    <div class="card"><b>💾 Save</b><div class="muted small">Autosaves every few seconds in this browser.</div>
      <div class="btnrow"><button class="btn" data-act="export">Export save</button><button class="btn" data-act="import">Import save</button></div></div>
    ${fs ? `<div class="card"><b>📱 Display</b><div class="btnrow">${fs}</div></div>` : ''}
    <div class="card"><b>📊 Record</b><div class="muted small">Foes slain: ${fmt(st.kills)} · bosses: ${st.bosses} · retreats: ${st.wipes} · loot found: ${st.items} · summons: ${st.summons}<br>Deepest stage: ${stageInfo(state.best).label} · Recruit Level ${state.recruit.level}</div></div>
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
    <span class="pill gold" title="Gold"><span class="pi">🪙</span><b data-res="gold">${fmt(s.res.gold)}</b><button class="plus" data-act="go" data-arg="heroes" aria-label="Spend gold on heroes">+</button></span>
    <span class="pill seals" title="Summon Seals"><span class="pi">🔮</span><b data-res="seals">${fmt(s.res.seals)}</b><button class="plus" data-act="go" data-arg="recruit" aria-label="Recruit">+</button></span>
    <span class="pill hstage" title="Stage"><span class="pi">🚩</span><b data-stage></b></span>
    <button class="icon-btn" data-act="go" data-arg="settings" aria-label="Options">⚙️</button>`;
  $('#tabs').innerHTML = TABS.map((k) => {
    const badge = k === 'bag' && s.newItems ? s.newItems : k === 'recruit' && (freeSummonReady(s) || s.res.seals >= RECRUIT_COST) ? '!' : '';
    const on = ui.screen === k || SCREENS[ui.screen].parent === k;
    return `<button class="tab ${on ? 'on' : ''}" data-act="go" data-arg="${k}"><span class="tab-ic">${SCREENS[k].tab}</span><small>${SCREENS[k].title}</small><i class="dot" data-badge="${k}" ${badge ? '' : 'hidden'}>${badge}</i></button>`;
  }).join('');
  const screen = $('#screen');
  const list = screen.querySelector('.hero-list');
  const keep = screen.dataset.screen === ui.screen ? screen.scrollTop : 0, keepList = list && isMain ? list.scrollTop : 0;
  screen.innerHTML = sc.render(s);
  screen.dataset.screen = ui.screen;
  screen.classList.toggle('is-battle', isMain);
  screen.scrollTop = keep;
  const nl = screen.querySelector('.hero-list'); if (nl) nl.scrollTop = keepList;
  const slot = $('#lane-slot');
  if (slot) slot.appendChild(laneCanvas());
  if (ui.modal?.live) renderModal();
  updateLive();
}

// Cheap refresh of numbers, timers, badges and affordability without rebuilding the DOM.
function updateLive() {
  const s = state, now = Date.now();
  document.querySelectorAll('[data-res]').forEach((el) => { el.textContent = fmt(s.res[el.dataset.res]); });
  document.querySelectorAll('[data-stage]').forEach((el) => { el.textContent = `${stageInfo(s.progress.stage).label} · ${s.progress.wave}/${WAVES_PER_STAGE}`; });
  document.querySelectorAll('[data-cd-end]').forEach((el) => { el.textContent = fmtTime((+el.dataset.cdEnd - now) / 1000); });
  document.querySelectorAll('[data-afford-res]').forEach((el) => { el.disabled = s.res[el.dataset.affordRes] < +el.dataset.affordCost; });
  const bag = document.querySelector('[data-badge="bag"]');
  if (bag) { bag.hidden = !s.newItems; bag.textContent = s.newItems; }
  const rec = document.querySelector('[data-badge="recruit"]');
  if (rec) rec.hidden = !(freeSummonReady(s, now) || s.res.seals >= RECRUIT_COST);
}

// Per-frame hero-card update (HP and ult) on the battle screen.
function updateBattleHud() {
  if (!battle || ui.screen !== 'battle') return;
  for (const el of document.querySelectorAll('[data-hud]')) {
    const u = battle.units.find((x) => x.heroId === el.dataset.hud);
    if (!u) continue;
    el.querySelector('[data-hud-hp]').style.width = `${u.down ? 0 : (u.hp / u.maxHp) * 100}%`;
    const txt = u.down ? `Down · ${Math.max(0, Math.ceil(u.reviveAt - battle.t))}s` : `${fmt(Math.max(0, u.hp))}/${fmt(u.maxHp)}`;
    const te = el.querySelector('[data-hud-hptext]'); if (te.textContent !== txt) te.textContent = txt;
    el.querySelector('[data-hud-ult]').style.height = `${u.ult}%`;
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
    title: `${SLOTS[slot].name} · ${esc(HERO_BY_ID[heroId].name.split(' ')[0])}`, live: true,
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
        return { id, d, html: `<div class="card row">${portraitHtml(id)}<span class="grow"><b>${esc(HERO_BY_ID[id].name)}</b>
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
  while (box.children.length > 1) box.firstChild.remove();
  const el = document.createElement('div');
  el.className = `toast ${cls}`;
  el.innerHTML = html;
  box.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
