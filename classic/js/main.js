// Boot, actions, game loop, saving, and install/update plumbing.
'use strict';

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return deserialize(raw);
  } catch (e) { console.warn('Save unreadable, starting fresh', e); }
  return newGame();
}

function save() {
  try { localStorage.setItem(SAVE_KEY, serialize(state)); } catch (e) { console.warn('Save failed', e); }
}

function catchUp() {
  const rep = advance(state);
  if (rep.seconds > 60) showSummary(rep);
  else reportToasts(rep);
  return rep;
}

// ---------- actions (data-act on any button) ----------

const ACTIONS = {
  go: (screen) => { ui.screen = screen; },
  back: () => { ui.screen = 'hall'; },
  close: () => closeModal(),
  build: (id) => upgradeFacility(state, id),
  upgrade: (id) => upgradeFacility(state, id),
  'op-up': (id) => upgradeOp(state, id),
  unassign: (op) => assignOverseer(state, op, null),
  'pick-overseer': (op) => pickerModal(`Overseer for ${OPERATIONS[op].name}`,
    () => state.adventurers.filter((a) => !adventurerTask(state, a.id)), 'assign', op,
    (a) => `+${Math.round(((a.stats[OPERATIONS[op].stat] * 2 + a.level * 3) / 100) * 100)}% output`),
  assign: (arg) => { const [op, id] = arg.split(':'); assignOverseer(state, op, +id); closeModal(); },
  'pick-quester': (tierId) => {
    const t = QUEST_TIERS.find((x) => x.id === tierId);
    pickerModal(`${t.icon} ${state.board[tierId].title}`, () => state.adventurers.filter((a) => !adventurerTask(state, a.id)),
      'send', tierId, (a) => `${Math.round(successChance(a, t, state.board[tierId]) * 100)}% success`);
  },
  send: (arg) => { const [tier, id] = arg.split(':'); startQuest(state, tier, +id); closeModal(); },
  hire: (id) => { if (hire(state, +id)) toast('🍺 A new adventurer joins the guild!'); },
  reroll: () => { if (spend(state, 'gold', rerollCost(state))) state.recruits = rollRecruits(state); },
  dismiss: (id) => {
    const a = findAdventurer(state, +id);
    if (a && confirm(`Dismiss ${a.name}? They will leave the guild for good.`)) dismiss(state, +id);
  },
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
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `lantern-hall-${new Date().toISOString().slice(0, 10)}.txt` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  import: () => openModal({
    title: '📥 Import save',
    body: () => `<p class="muted small">Paste a save code or pick a save file. This replaces your current guild.</p>
      <textarea id="import-code" rows="6" placeholder="Paste save code here"></textarea>
      <div class="btnrow"><button class="btn" data-act="import-text">Load code</button>
      <label class="btn">Choose file<input type="file" id="import-file" accept=".txt,.json,text/plain" hidden></label></div>`,
  }),
  'import-text': () => applyImport($('#import-code').value),
  reset: () => {
    if (confirm('Start a brand-new guild? Your current guild will be lost (export it first if you want to keep it).')) {
      state = newGame(); save(); ui.screen = 'hall';
    }
  },
};

function applyImport(text) {
  try {
    const s = importCode(text);
    state = s;
    closeModal();
    ui.screen = 'hall';
    catchUp();
    save();
    toast('Save loaded');
  } catch (e) {
    toast('That save could not be read');
  }
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (!fn) return;
  const result = fn(el.dataset.arg);
  if (result instanceof Promise) return;
  save();
  render();
});

document.addEventListener('change', (e) => {
  if (e.target.id !== 'import-file' || !e.target.files[0]) return;
  e.target.files[0].text().then(applyImport);
});

// Tap outside a modal closes it.
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') { closeModal(); } });

// ---------- loop ----------

setInterval(() => {
  const before = state.quests.length;
  const rep = advance(state);
  if (rep.seconds > 60) { showSummary(rep); render(); save(); return; }
  if (rep.quests.length) { reportToasts(rep); save(); }
  if (rep.quests.length || rep.newRecruits || before !== state.quests.length) render();
  else updateLive();
}, 250);

setInterval(save, 5000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  else { catchUp(); render(); swReg?.update().catch(() => {}); }
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

catchUp();
save();
render();
window.__game = { get state() { return state; }, ACTIONS, render };
window.__ready = true;
