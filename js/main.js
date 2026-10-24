// Boot, actions, battle loop, saving, and install/update plumbing.
'use strict';

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return deserialize(raw);
  } catch (e) { console.warn('Save unreadable, starting fresh', e); }
  const s = newGame();
  // Someone who played Lantern Hall here before: their guild is untouched at /classic/.
  try { if (localStorage.getItem(CLASSIC_SAVE_KEY)) s.note = 'classic'; } catch { /* storage blocked */ }
  return s;
}

function save() {
  try { localStorage.setItem(SAVE_KEY, serialize(state)); } catch (e) { console.warn('Save failed', e); }
}

// ---------- time & battle ----------

// Advance the game to `now`. Short gaps are fought out for real; long ones use offline rewards.
function tick(now = Date.now()) {
  const gap = (now - state.lastTick) / 1000;
  state.lastTick = now;
  if (gap <= 0) return;
  if (gap > 60) {
    const rep = offlineRewards(state, gap);
    refreshParty(state);
    showSummary(rep);
    save();
    render();
    return;
  }
  handleEvents(runBattle(state, gap));
}

function handleEvents(events) {
  let rerender = false;
  const levels = [];
  for (const e of events) {
    if (e.type === 'loot') {
      const it = e.res.added;
      if (it && it.rarity >= 2) toast(`🎁 <b style="color:${RARITIES[it.rarity].color}">${esc(it.name)}</b> dropped!`, 'loot');
    } else if (e.type === 'stage') {
      const i = stageInfo(e.g);
      toast(`🚩 Checkpoint! On to ${i.label} ${esc(i.name)}`);
      rerender = true;
    } else if (e.type === 'wipe') {
      toast('💀 The party fell. Regrouping at the checkpoint…');
      rerender = true;
    } else if (e.type === 'seals') {
      toast(`🔮 +${e.n} Summon Seal${e.n > 1 ? 's' : ''}`);
    } else if (e.type === 'level') levels.push(e);
  }
  if (levels.length) {
    const last = new Map(levels.map((l) => [l.heroId, l.level]));
    toast(`⬆️ ${[...last].map(([id, lv]) => `${esc(HERO_BY_ID[id].name.split(' ')[0])} Lv ${lv}`).join(', ')}`);
    refreshParty(state);
    if (ui.screen === 'hero' || ui.screen === 'heroes') rerender = true;
  }
  if (rerender) { save(); render(); }
}

let lastLive = 0;
function frame() {
  const now = Date.now();
  tick(now);
  drawBattle(state, now);
  updateBattleHud();
  if (now - lastLive > 250) { lastLive = now; updateLive(); }
  requestAnimationFrame(frame);
}
// rAF pauses in background tabs; this keeps the fight going at a slower beat when the tab is visible but throttled.
setInterval(() => { if (Date.now() - state.lastTick > 900) tick(); }, 1000);

// ---------- actions (data-act on any button) ----------

const NO_RENDER = Symbol('no-render');
const ACTIONS = {
  go: (screen) => {
    if (ui.screen === 'bag' && screen !== 'bag') state.bag.forEach((it) => { it.isNew = false; });
    if (screen === 'bag') state.newItems = 0;
    if (screen !== ui.screen) { ui.sel = null; if (screen !== 'settings') ui.redeemMsg = null; }
    ui.screen = screen;
  },
  back: () => { ACTIONS.go(SCREENS[ui.screen].parent || 'battle'); },
  close: () => closeModal(),
  hero: (id) => { closeModal(); ui.heroId = id; ui.screen = 'hero'; },
  train: (id) => { if (train(state, id)) refreshParty(state); },
  'train-max': (id) => { const n = trainMax(state, id); if (n) { toast(`🏋️ +${n} level${n > 1 ? 's' : ''}`); refreshParty(state); } else toast('Not enough gold to train'); },
  party: (id) => { toggleParty(state, id); ui.sel = null; refreshParty(state); },
  fslot: (i) => {
    i = +i;
    const sel = ui.sel;
    if (sel?.hero) { setSlot(state, i, sel.hero); ui.sel = null; refreshParty(state); }
    else if (sel && sel.slot !== undefined && sel.slot !== i) { swapSlots(state, sel.slot, i); ui.sel = null; refreshParty(state); }
    else if (sel && sel.slot === i) ui.sel = null;
    else ui.sel = { slot: i };
  },
  'bench-pick': (id) => {
    const sel = ui.sel;
    if (sel && sel.slot !== undefined) { setSlot(state, sel.slot, id); ui.sel = null; refreshParty(state); }
    else ui.sel = sel?.hero === id ? null : { hero: id };
  },
  bench: (i) => { if (!setSlot(state, +i, null)) toast('Keep at least one hero in the formation'); ui.sel = null; refreshParty(state); },
  'fsel-clear': () => { ui.sel = null; },
  'auto-form': () => { autoArrange(state); ui.sel = null; refreshParty(state); toast('✨ Formation arranged: tanks in front, damage behind'); },
  redeem: () => {
    const el = $('#redeem-code');
    const r = redeemCode(state, el ? el.value : '');
    ui.redeemMsg = r;
    if (r.ok) {
      if (r.summon) ui.lastSummon = r.summon;
      refreshParty(state);
    }
  },
  gear: (arg) => { const [id, slot] = arg.split(':'); gearModal(id, slot); },
  equip: (arg) => { const [id, itemId] = arg.split(':'); if (equip(state, id, +itemId)) { refreshParty(state); closeModal(); toast('🛡️ Equipped'); } },
  unequip: (arg) => { const [id, slot] = arg.split(':'); if (unequip(state, id, slot)) refreshParty(state); },
  'equip-pick': (id) => equipPickModal(+id),
  salvage: (id) => { const g = salvage(state, +id); if (g) toast(`♻️ +${fmt(g)} 🪙`); },
  'salvage-upto': (r) => { const { gold, n } = salvageUpTo(state, +r); toast(n ? `♻️ Salvaged ${n} item${n > 1 ? 's' : ''}: +${fmt(gold)} 🪙` : 'Nothing to salvage'); },
  'auto-salvage': () => { state.settings.autoSalvageCommon = !state.settings.autoSalvageCommon; },
  'auto-ult': () => { state.settings.autoUlt = !state.settings.autoUlt; },
  ult: (id) => { if (!manualUlt(state, id)) toast('Not charged yet'); return NO_RENDER; },
  summon: () => doSummon(false),
  'summon-10': () => {
    const lv = state.recruit.level, rs = summonMany(state, 10);
    if (!rs.length) return;
    ui.lastSummons = rs; ui.lastSummon = null;
    const fresh = rs.filter((r) => r.isNew).length, best = Math.max(...rs.map((r) => HERO_BY_ID[r.heroId].rarity));
    toast(`🔮 ×${rs.length}: best ${rarName(best)}${fresh ? `, ${fresh} new` : ''}${state.recruit.level > lv ? ` · ⬆️ Recruit Lv ${state.recruit.level}!` : ''}`, state.recruit.level > lv ? 'loot' : '');
    refreshParty(state);
  },
  'summon-free': () => doSummon(true),
  travel: (g) => { if (travel(state, +g)) { restartBattle(state); ui.screen = 'battle'; } },
  fullscreen: () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  },
  export: () => openModal({
    title: '💾 Export save',
    body: () => `<p class="muted small">Copy this code somewhere safe, or download it as a file.</p>
      <textarea id="save-code" readonly rows="6">${esc(exportCode(state))}</textarea>
      <div class="btnrow"><button class="btn" data-act="copy-save">Copy</button><button class="btn" data-act="download-save">Download file</button></div>`,
  }),
  'copy-save': async () => {
    const el = $('#save-code');
    try { await navigator.clipboard.writeText(el.value); toast('Copied save code'); }
    catch { el.select(); document.execCommand('copy'); toast('Copied save code'); }
  },
  'download-save': () => {
    const blob = new Blob([exportCode(state)], { type: 'text/plain' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `banner-road-${new Date().toISOString().slice(0, 10)}.txt` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  import: () => openModal({
    title: '📥 Import save',
    body: () => `<p class="muted small">Paste a save code or pick a save file. This replaces your current progress.</p>
      <textarea id="import-code" rows="6" placeholder="Paste save code here"></textarea>
      <div class="btnrow"><button class="btn" data-act="import-text">Load code</button>
      <label class="btn">Choose file<input type="file" id="import-file" accept=".txt,.json,text/plain" hidden></label></div>`,
  }),
  'import-text': () => applyImport($('#import-code').value),
  reset: () => {
    if (confirm('Start over from Stage 1-1? Your heroes and loot will be lost (export first if you want to keep them).')) {
      state = newGame(); save(); restartBattle(state); ui.screen = 'battle';
    }
  },
};

function doSummon(free) {
  const r = summon(state, free);
  if (!r) return;
  ui.lastSummon = r; ui.lastSummons = null;
  const d = HERO_BY_ID[r.heroId];
  toast(r.isNew ? `🎉 <b style="color:${RARITIES[d.rarity].color}">${esc(d.name)}</b> joins!` : r.stars ? `⭐ ${esc(d.name)} is now ${r.stars}★` : `🪙 +${fmt(r.gold)} from a duplicate`);
  if (r.recruitUp) toast(`⬆️ Recruit Level ${state.recruit.level}! Rarer heroes now`, 'loot');
  refreshParty(state);
}

function applyImport(text) {
  try {
    state = importCode(text);
    closeModal();
    ui.screen = 'battle';
    restartBattle(state);
    tick();
    save();
    toast('Save loaded');
  } catch (e) {
    toast(e instanceof OldSaveError ? 'That is a Lantern Hall save. Import it in Lantern Hall Classic (Settings).' : 'That save could not be read');
  }
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (!fn) return;
  const result = fn(el.dataset.arg);
  if (result instanceof Promise || result === NO_RENDER) return;
  save();
  render();
});

// Enter in the redeem box redeems.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'redeem-code') { e.preventDefault(); ACTIONS.redeem(); save(); render(); }
});

document.addEventListener('change', (e) => {
  if (e.target.id !== 'import-file' || !e.target.files[0]) return;
  e.target.files[0].text().then(applyImport);
});

// Tap outside a modal closes it.
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') { closeModal(); } });

setInterval(save, 5000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  else { tick(); swReg?.update().catch(() => {}); }
});
window.addEventListener('pagehide', save);

// ---------- service worker: offline play + "update ready" prompt ----------

let swReg = null;
let updateRequested = false; // only reload when the player tapped "update", never on first install
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    swReg = reg;
    const offer = (w) => {
      const bar = $('#update-bar');
      bar.hidden = false;
      bar.onclick = () => { bar.textContent = 'Updating…'; updateRequested = true; w.postMessage('skip-waiting'); };
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
    setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
  }).catch((e) => console.warn('SW registration failed', e));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !updateRequested) return;
    reloading = true;
    save();
    location.reload();
  });
}

// ---------- boot ----------

newBattle(state);
tick();
save();
render();
if (state.note === 'classic') {
  state.note = null;
  openModal({
    title: '🚩 Welcome to Banner Road',
    body: () => `<p>This is a brand-new auto-battler: recruit heroes, gear them up and march them down the Banner Road.</p>
      <p class="muted">Your <b>Lantern Hall</b> guild is safe and still playable, with its save untouched.</p>
      <div class="btnrow"><a class="btn ghost linkbtn" href="${CLASSIC_URL}">Open Lantern Hall Classic</a><button class="btn" data-act="close">Start the march</button></div>`,
  });
}
requestAnimationFrame(frame);
window.__game = { get state() { return state; }, get battle() { return battle; }, ACTIONS, render, tick };
window.__ready = true;
