// Canvas renderer for the battle lane: bright side-on street, chunky outlined chibi sprites.
// All art is drawn procedurally here (no image files). Reads `battle` and state, never changes them.
'use strict';

const INK = '#2a1c16'; // outline colour

// ---------- looks ----------
// skin, hair colour, hair style, outfit, trim, headwear, weapon, extras
const L = (skin, hair, style, outfit, trim, hat, weapon, extra = {}) => ({ skin, hair, style, outfit, trim, hat, weapon, ...extra });
const HERO_LOOKS = {
  brannoc: L('#f1c27d', '#6b4a2b', 'short', '#8d99a8', '#4f8fe0', 'helm', 'sword', { shield: '#4f8fe0', beard: true }),
  doveena: L('#e8b48a', '#f4d03f', 'bob', '#5d9bd5', '#ffffff', null, 'mace', { shield: '#e9eef5' }),
  harl: L('#e0ac69', '#e8e8e8', 'bald', '#b08a3e', '#7a1f1f', null, 'banner', { beard: true, shield: '#b08a3e' }),
  gorm: L('#c68642', '#8b4513', 'short', '#6f7b8a', '#f2c94c', 'horned', 'hammer', { beard: true, shield: '#f2c94c' }),
  tobin: L('#f1c27d', '#d35400', 'spiky', '#c0392b', '#f2c94c', null, 'greatsword'),
  kessa: L('#e8b48a', '#c0392b', 'long', '#7a5a3a', '#e0563f', null, 'axe'),
  vexa: L('#d9a07a', '#2b2b38', 'long', '#5a2a6a', '#b0b0c0', 'darkhelm', 'greatsword'),
  nim: L('#f5d0a9', '#34495e', 'short', '#4a4a5a', '#9b59d0', 'hood', 'dagger', { hoodColor: '#3d3d50' }),
  sable: L('#c68642', '#1a1a1a', 'long', '#6c3483', '#f2c94c', null, 'dagger', { mask: '#2b1b3a' }),
  kito: L('#e0ac69', '#27ae60', 'spiky', '#3c5a46', '#7dff5a', null, 'dagger', { mask: '#26352b' }),
  pip: L('#f5d0a9', '#e0b050', 'spiky', '#4f8a3a', '#a0522d', 'cap', 'bow'),
  sorrel: L('#e0ac69', '#5a3a1a', 'short', '#3a6a3a', '#7dff5a', 'hood', 'bow', { hoodColor: '#2f6b3a' }),
  tamsin: L('#f1c27d', '#f0d080', 'long', '#3a5a7a', '#ffffff', null, 'bow'),
  rook: L('#8d5524', '#2a2a2a', 'short', '#7a2a1a', '#ffb347', 'hood', 'bow', { hoodColor: '#5a1e14' }),
  bram: L('#f5d0a9', '#f39c12', 'spiky', '#3a6fd8', '#f2c94c', 'wizard', 'staff', { hatColor: '#3a6fd8', orb: '#bfe9ff' }),
  ilsabet: L('#fce4d6', '#cfe8ff', 'long', '#4a6aa0', '#bfe9ff', null, 'staff', { orb: '#9fe3ff' }),
  corvin: L('#e0ac69', '#1a1a1a', 'short', '#8a2a2a', '#ffb347', 'wizard', 'staff', { hatColor: '#6a1f1f', orb: '#ff8a3a' }),
  ysolde: L('#c68642', '#f8f8ff', 'long', '#2c2f7a', '#ffe27a', 'wizard', 'staff', { hatColor: '#2c2f7a', orb: '#ffe27a' }),
  wren: L('#f1c27d', '#5a8a4a', 'bob', '#f4f1e6', '#4a8a3a', null, 'staff', { orb: '#7dff9a' }),
  alder: L('#e0ac69', '#6b4a2b', 'bald', '#8b5a2b', '#f2c94c', null, 'mace', { beard: true }),
  maelis: L('#fce4d6', '#f7dc6f', 'long', '#f4f1e6', '#f2c94c', 'circlet', 'staff', { orb: '#fff2a8' }),
  fennick: L('#e8d8c0', '#95a5a6', 'short', '#5b3f7a', '#d0d0d0', 'hood', 'tome', { hoodColor: '#4a3266' }),
  odalys: L('#8d5524', '#1b1b2f', 'bun', '#16a085', '#1b1b2f', null, 'tome'),
  yew: L('#c9b28a', '#3a6a2a', 'long', '#5a4a2a', '#7dcf5a', 'leaves', 'staff', { orb: '#9be37a' }),
};
const FOE_LOOKS = {
  goblin: { body: 'chibi', look: L('#7cb342', '#3e2723', 'bald', '#8d6e63', '#5d4037', 'bandana', 'sling', { ears: true, hatColor: '#c0392b' }) },
  bones: { body: 'chibi', look: L('#efe8d4', '#efe8d4', 'bald', '#efe8d4', '#8a8270', null, 'sword', { skull: true }) },
  ghoul: { body: 'chibi', look: L('#8fbc8f', '#4b5d4b', 'short', '#6b5b4b', '#3e3e3e', null, 'claws', { pale: true }) },
  mummy: { body: 'chibi', look: L('#e8dcc0', '#e8dcc0', 'bald', '#e8dcc0', '#b8ab8a', 'wrap', 'claws', { wrapped: true }) },
  lich: { body: 'chibi', look: L('#efe8d4', '#efe8d4', 'bald', '#5b2a86', '#f2c94c', 'crown', 'staff', { skull: true, orb: '#b56cff' }) },
  troll: { body: 'chibi', look: L('#6b8e23', '#3e5a1a', 'bald', '#795548', '#4e342e', null, 'club', { ears: true, tusks: true }) },
  ogre: { body: 'chibi', look: L('#c27c3a', '#4e342e', 'bun', '#5d4037', '#2e7d32', 'thorns', 'club', { tusks: true }) },
  wolf: { body: 'beast', kind: 'wolf', c: '#8d99a6', c2: '#dfe4ea' },
  boar: { body: 'beast', kind: 'boar', c: '#8d5a3b', c2: '#f3b5a5' },
  bear: { body: 'beast', kind: 'bear', c: '#7b4a26', c2: '#c69c6d' },
  spider: { body: 'spider', c: '#4b3a5a', c2: '#ff4d4d' },
  scorp: { body: 'scorp', c: '#c0612b', c2: '#7a2f12' },
  shade: { body: 'ghost', c: '#d9d2ff', c2: '#7a6ab0' },
  wyrm: { body: 'beast', kind: 'wyrm', c: '#c0392b', c2: '#f5b041' },
};
const SUMMON_LOOKS = {
  stag: { body: 'beast', kind: 'stag', c: '#a0703c', c2: '#f3e1c0' },
  inkwolf: { body: 'beast', kind: 'wolf', c: '#2b2f4a', c2: '#6f79c8' },
  wisp: { body: 'ghost', c: '#9ff5ea', c2: '#2bb3a8' },
  skeleton: { body: 'chibi', look: L('#efe8d4', '#efe8d4', 'bald', '#efe8d4', '#8a8270', null, 'sword', { skull: true, shield: '#9a8a6a' }) },
};

// ---------- drawing helpers ----------
let LW = 2.2; // outline width in sprite units
function fillStroke(ctx, fill) { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = LW; ctx.strokeStyle = INK; ctx.stroke(); }
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function circ(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
function shade(hex, f) { // f<0 darker, f>0 lighter
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const m = f < 0 ? 0 : 255, a = Math.abs(f);
  r = Math.round(r + (m - r) * a); g = Math.round(g + (m - g) * a); b = Math.round(b + (m - b) * a);
  return `rgb(${r},${g},${b})`;
}

// Chibi humanoid, feet at (0,0), facing right, about 46 units tall. swing 0..1 for attack lunge.
function drawChibi(ctx, lk, swing = 0, opts = {}) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const hx = 1, hy = -30, hr = 12;
  // long hair behind the head
  if (lk.style === 'long' && !lk.hat?.includes?.('hood')) { rr(ctx, hx - 13, hy - 6, 20, 26, 8); fillStroke(ctx, lk.hair); }
  if (lk.style === 'bun') { circ(ctx, hx - 9, hy - 10, 6); fillStroke(ctx, lk.hair); }
  // cape for some classes
  if (lk.cape) { ctx.beginPath(); ctx.moveTo(-6, -20); ctx.lineTo(-12, -2); ctx.lineTo(2, -4); ctx.closePath(); fillStroke(ctx, lk.cape); }
  // legs
  const pants = shade(lk.outfit, -0.35);
  rr(ctx, -6, -9, 5, 9, 2); fillStroke(ctx, lk.wrapped || lk.skull ? lk.skin : pants);
  rr(ctx, 1, -9, 5, 9, 2); fillStroke(ctx, lk.wrapped || lk.skull ? lk.skin : pants);
  if (!lk.skull && !lk.wrapped) { rr(ctx, -7, -3, 7, 3.5, 1.5); fillStroke(ctx, '#4a2f22'); rr(ctx, 0.5, -3, 7.5, 3.5, 1.5); fillStroke(ctx, '#4a2f22'); }
  // body
  if (lk.skull) {
    rr(ctx, -6, -21, 12, 13, 4); fillStroke(ctx, lk.outfit === lk.skin ? '#3b3530' : lk.outfit);
    if (lk.outfit === lk.skin) { ctx.strokeStyle = lk.skin; ctx.lineWidth = 1.8; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-4, -18 + i * 3.5); ctx.lineTo(4, -18 + i * 3.5); ctx.stroke(); } }
  } else {
    rr(ctx, -8, -21, 16, 14, 5); fillStroke(ctx, lk.outfit);
    ctx.fillStyle = lk.trim; ctx.fillRect(-7.5, -11, 15, 2.6); // belt
    if (lk.wrapped) { ctx.strokeStyle = lk.trim; ctx.lineWidth = 1.2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-7, -19 + i * 3); ctx.lineTo(7, -17 + i * 3); ctx.stroke(); } }
  }
  // head
  if (lk.ears) { ctx.beginPath(); ctx.moveTo(hx - 9, hy - 3); ctx.lineTo(hx - 20, hy - 9); ctx.lineTo(hx - 10, hy + 4); ctx.closePath(); fillStroke(ctx, lk.skin); }
  circ(ctx, hx, hy, hr); fillStroke(ctx, lk.skin);
  if (lk.ears) { ctx.beginPath(); ctx.moveTo(hx + 8, hy - 6); ctx.lineTo(hx + 17, hy - 13); ctx.lineTo(hx + 11, hy + 1); ctx.closePath(); fillStroke(ctx, lk.skin); }
  // face
  if (lk.skull) {
    ctx.fillStyle = INK; circ(ctx, hx + 3, hy, 3.2); ctx.fill(); circ(ctx, hx + 9.5, hy, 2.6); ctx.fill();
    ctx.fillRect(hx + 3, hy + 7, 7, 1.6);
    if (lk.orb) { ctx.fillStyle = lk.orb; circ(ctx, hx + 3, hy, 1.2); ctx.fill(); circ(ctx, hx + 9.5, hy, 1); ctx.fill(); }
  } else {
    const ey = hy + 1;
    ctx.fillStyle = opts.down ? INK : INK;
    if (opts.down) { ctx.lineWidth = 1.5; ctx.strokeStyle = INK; for (const ex of [hx + 4, hx + 10]) { ctx.beginPath(); ctx.moveTo(ex - 1.8, ey - 1.8); ctx.lineTo(ex + 1.8, ey + 1.8); ctx.moveTo(ex + 1.8, ey - 1.8); ctx.lineTo(ex - 1.8, ey + 1.8); ctx.stroke(); } }
    else {
      for (const ex of [hx + 4, hx + 10]) { ctx.beginPath(); ctx.ellipse(ex, ey, 1.9, 2.8, 0, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#fff'; circ(ctx, hx + 4.6, ey - 1, 0.8); ctx.fill(); circ(ctx, hx + 10.6, ey - 1, 0.8); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,110,110,.35)'; circ(ctx, hx + 2, hy + 5.5, 2.2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(hx + 6, hy + 7); ctx.lineTo(hx + 9, hy + 6.5); ctx.stroke();
    if (lk.tusks) { ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.moveTo(hx + 5, hy + 7); ctx.lineTo(hx + 6, hy + 3); ctx.lineTo(hx + 7.5, hy + 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(hx + 9.5, hy + 7); ctx.lineTo(hx + 10.5, hy + 3.5); ctx.lineTo(hx + 11.5, hy + 7); ctx.fill(); }
    if (lk.mask) { rr(ctx, hx - 2, hy + 3, 15, 7, 3); fillStroke(ctx, lk.mask); }
  }
  if (lk.beard) { ctx.beginPath(); ctx.moveTo(hx - 5, hy + 4); ctx.quadraticCurveTo(hx + 5, hy + 18, hx + 12, hy + 4); ctx.quadraticCurveTo(hx + 4, hy + 9, hx - 5, hy + 4); fillStroke(ctx, lk.hair); }
  // hair on top
  const hat = lk.hat;
  if (!['hood', 'helm', 'darkhelm', 'wrap'].includes(hat)) {
    if (lk.style === 'short' || lk.style === 'long' || lk.style === 'bob' || lk.style === 'bun') {
      ctx.beginPath(); ctx.arc(hx, hy, hr + 1, Math.PI * 0.95, Math.PI * 2.02);
      ctx.quadraticCurveTo(hx + 6, hy - 6, hx + 2, hy - 4); ctx.quadraticCurveTo(hx - 4, hy - 2, hx - 8, hy + (lk.style === 'bob' ? 8 : 2));
      ctx.closePath(); fillStroke(ctx, lk.hair);
    } else if (lk.style === 'spiky') {
      ctx.beginPath(); ctx.moveTo(hx - 13, hy + 2);
      const pts = [[-15, -8], [-9, -12], [-8, -19], [-2, -15], [2, -22], [6, -14], [12, -17], [11, -9], [15, -4], [8, -5], [4, -2], [-2, -5], [-8, 4]];
      for (const [px, py] of pts) ctx.lineTo(hx + px, hy + py);
      ctx.closePath(); fillStroke(ctx, lk.hair);
    }
  }
  // headwear
  if (hat === 'helm' || hat === 'darkhelm' || hat === 'horned') {
    const c = hat === 'darkhelm' ? '#4a4a5c' : '#b9c2cc';
    if (hat === 'horned') { for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + s * 8, hy - 8); ctx.quadraticCurveTo(hx + s * 18, hy - 12, hx + s * 16, hy - 22); ctx.quadraticCurveTo(hx + s * 12, hy - 14, hx + s * 4, hy - 11); ctx.closePath(); fillStroke(ctx, '#f3ead2'); } }
    ctx.beginPath(); ctx.arc(hx, hy - 1, hr + 1.5, Math.PI, 0); ctx.lineTo(hx + hr + 1.5, hy + 1); ctx.lineTo(hx - hr - 1.5, hy + 1); ctx.closePath(); fillStroke(ctx, c);
    rr(ctx, hx - hr - 2, hy - 2, hr * 2 + 4, 4, 2); fillStroke(ctx, shade(c, -0.25));
    if (hat !== 'horned') { rr(ctx, hx + 5, hy - 2, 3, 9, 1.5); fillStroke(ctx, shade(c, -0.15)); }
    if (hat === 'darkhelm') { ctx.beginPath(); ctx.moveTo(hx - 2, hy - 13); ctx.quadraticCurveTo(hx - 12, hy - 26, hx - 18, hy - 16); ctx.quadraticCurveTo(hx - 10, hy - 18, hx - 6, hy - 11); fillStroke(ctx, '#c0392b'); }
  } else if (hat === 'hood') {
    const c = lk.hoodColor || shade(lk.outfit, -0.1);
    ctx.beginPath(); ctx.arc(hx, hy, hr + 2.5, Math.PI * 0.55, Math.PI * 1.95);
    ctx.quadraticCurveTo(hx + 4, hy - 6, hx + 1, hy + 3); ctx.quadraticCurveTo(hx - 2, hy + 10, hx - 4, hy + 14); ctx.closePath(); fillStroke(ctx, c);
    ctx.beginPath(); ctx.moveTo(hx - 6, hy - 12); ctx.quadraticCurveTo(hx - 16, hy - 16, hx - 18, hy - 6); ctx.lineTo(hx - 10, hy - 4); ctx.closePath(); fillStroke(ctx, c);
  } else if (hat === 'wizard') {
    const c = lk.hatColor || lk.outfit;
    ctx.beginPath(); ctx.ellipse(hx, hy - 9, 17, 4, 0, 0, 7); fillStroke(ctx, c);
    ctx.beginPath(); ctx.moveTo(hx - 10, hy - 10); ctx.quadraticCurveTo(hx - 4, hy - 26, hx - 12, hy - 36); ctx.quadraticCurveTo(hx + 4, hy - 30, hx + 10, hy - 10); ctx.closePath(); fillStroke(ctx, c);
    ctx.fillStyle = lk.trim; ctx.fillRect(hx - 9, hy - 14, 18, 3);
  } else if (hat === 'cap') {
    ctx.beginPath(); ctx.arc(hx, hy - 4, hr - 0.5, Math.PI, 0); ctx.closePath(); fillStroke(ctx, lk.outfit);
    ctx.beginPath(); ctx.moveTo(hx - 6, hy - 14); ctx.quadraticCurveTo(hx - 16, hy - 26, hx - 20, hy - 18); ctx.quadraticCurveTo(hx - 12, hy - 18, hx - 6, hy - 12); fillStroke(ctx, '#e74c3c');
  } else if (hat === 'bandana') {
    ctx.beginPath(); ctx.arc(hx, hy - 3, hr, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); fillStroke(ctx, lk.hatColor);
    ctx.beginPath(); ctx.moveTo(hx - 10, hy - 6); ctx.lineTo(hx - 18, hy - 2); ctx.lineTo(hx - 15, hy - 9); ctx.closePath(); fillStroke(ctx, lk.hatColor);
  } else if (hat === 'circlet' || hat === 'crown') {
    ctx.beginPath(); ctx.moveTo(hx - 10, hy - 8); ctx.lineTo(hx - 10, hy - 16); ctx.lineTo(hx - 5, hy - 12); ctx.lineTo(hx, hy - 19); ctx.lineTo(hx + 5, hy - 12); ctx.lineTo(hx + 10, hy - 16); ctx.lineTo(hx + 10, hy - 8); ctx.closePath();
    fillStroke(ctx, '#f2c94c');
    ctx.fillStyle = lk.orb || '#e74c3c'; circ(ctx, hx, hy - 11, 1.8); ctx.fill();
  } else if (hat === 'wrap') {
    ctx.strokeStyle = lk.trim; ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(hx - 11, hy - 8 + i * 5); ctx.lineTo(hx + 11, hy - 10 + i * 5); ctx.stroke(); }
    ctx.fillStyle = '#ffdf5a'; circ(ctx, hx + 7, hy + 1, 1.6); ctx.fill();
  } else if (hat === 'leaves' || hat === 'thorns') {
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (1.05 + i * 0.22), x = hx + Math.cos(a) * (hr + 1), y = hy + Math.sin(a) * (hr + 1);
      ctx.beginPath(); ctx.ellipse(x, y, hat === 'leaves' ? 4.5 : 2, hat === 'leaves' ? 2.5 : 5, a, 0, 7); fillStroke(ctx, hat === 'leaves' ? '#5fbf3f' : '#2e7d32');
    }
  }
  // shield on the front arm
  if (lk.shield) {
    ctx.beginPath(); ctx.moveTo(6, -22); ctx.quadraticCurveTo(17, -22, 17, -18); ctx.quadraticCurveTo(17, -6, 11.5, -2); ctx.quadraticCurveTo(6, -6, 6, -18); ctx.closePath();
    fillStroke(ctx, lk.shield);
    ctx.fillStyle = shade(lk.shield, -0.3); circ(ctx, 11.5, -13, 2.2); ctx.fill();
  }
  drawWeapon(ctx, lk, swing);
}

function drawWeapon(ctx, lk, swing) {
  const w = lk.weapon;
  ctx.save();
  const handX = lk.shield ? -6 : 8, handY = -13;
  ctx.translate(handX, handY);
  if (['sword', 'greatsword', 'axe', 'mace', 'hammer', 'club', 'dagger', 'banner'].includes(w)) ctx.rotate(-0.5 + swing * 1.6);
  if (w === 'sword' || w === 'greatsword' || w === 'dagger') {
    const len = w === 'greatsword' ? 26 : w === 'dagger' ? 10 : 18, wd = w === 'greatsword' ? 5 : 3.6;
    ctx.beginPath(); ctx.moveTo(-wd / 2, -3); ctx.lineTo(-wd / 2, -len); ctx.lineTo(0, -len - 4); ctx.lineTo(wd / 2, -len); ctx.lineTo(wd / 2, -3); ctx.closePath(); fillStroke(ctx, '#e8eef4');
    rr(ctx, -5, -4, 10, 3, 1.5); fillStroke(ctx, '#c9a227');
    rr(ctx, -1.5, -1, 3, 5, 1); fillStroke(ctx, '#6b4a2b');
  } else if (w === 'axe') {
    rr(ctx, -1.5, -22, 3, 24, 1); fillStroke(ctx, '#7a5230');
    ctx.beginPath(); ctx.moveTo(1, -21); ctx.quadraticCurveTo(12, -24, 11, -13); ctx.quadraticCurveTo(6, -15, 1, -13); ctx.closePath(); fillStroke(ctx, '#d0d6dc');
  } else if (w === 'mace' || w === 'hammer' || w === 'club') {
    const big = w === 'club' ? 1.4 : 1;
    rr(ctx, -1.5, -20 * big, 3, 22 * big, 1); fillStroke(ctx, '#7a5230');
    if (w === 'hammer') { rr(ctx, -7, -26, 14, 8, 2); fillStroke(ctx, '#aab4bf'); }
    else if (w === 'club') { ctx.beginPath(); ctx.ellipse(0, -28, 6, 9, 0, 0, 7); fillStroke(ctx, '#8d6e63'); }
    else { circ(ctx, 0, -22, 5); fillStroke(ctx, '#c9a227'); }
  } else if (w === 'banner') {
    rr(ctx, -1.2, -34, 2.4, 36, 1); fillStroke(ctx, '#7a5230');
    ctx.beginPath(); ctx.moveTo(1, -33); ctx.lineTo(14, -31); ctx.lineTo(10, -26); ctx.lineTo(14, -21); ctx.lineTo(1, -22); ctx.closePath(); fillStroke(ctx, lk.trim);
  } else if (w === 'bow') {
    ctx.translate(4, -2);
    ctx.beginPath(); ctx.arc(-4, 0, 14, -1.15, 1.15); ctx.lineWidth = LW + 2.4; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.4; ctx.strokeStyle = '#a0662f'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4 + 14 * Math.cos(-1.15), 14 * Math.sin(-1.15)); ctx.lineTo(-4 - swing * 4, 0); ctx.lineTo(-4 + 14 * Math.cos(1.15), 14 * Math.sin(1.15)); ctx.lineWidth = 0.9; ctx.strokeStyle = '#f3ead2'; ctx.stroke();
  } else if (w === 'staff') {
    rr(ctx, -1.5, -30, 3, 34, 1.2); fillStroke(ctx, '#8a5a2b');
    circ(ctx, 0, -32, 4.5); fillStroke(ctx, lk.orb || '#9fe3ff');
    ctx.fillStyle = 'rgba(255,255,255,.7)'; circ(ctx, -1.3, -33.5, 1.4); ctx.fill();
  } else if (w === 'tome') {
    rr(ctx, -4, -9, 11, 13, 2); fillStroke(ctx, lk.trim === '#d0d0d0' ? '#5b3f7a' : '#0e6655');
    ctx.fillStyle = '#f3ead2'; ctx.fillRect(-2.5, -7, 1.5, 9);
  } else if (w === 'sling') {
    circ(ctx, 2, -2, 3.2); fillStroke(ctx, '#9e9e9e');
  }
  if (w !== 'bow') { circ(ctx, 0, 0, 3); fillStroke(ctx, lk.skull || lk.wrapped ? lk.skin : lk.skin); }
  ctx.restore();
}

// Four-legged beasts, facing right.
function drawBeast(ctx, d, t, moving) {
  const step = moving ? Math.sin(t * 12) * 2 : 0, c = d.c, c2 = d.c2, kind = d.kind;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (kind === 'wyrm') { // wings
    ctx.beginPath(); ctx.moveTo(-6, -24); ctx.lineTo(-20, -44 + step); ctx.lineTo(-10, -36); ctx.lineTo(-2, -42 + step); ctx.lineTo(2, -24); ctx.closePath(); fillStroke(ctx, shade(c, -0.25));
  }
  for (const [lx, ph] of [[-11, 1], [-5, -1], [5, 1], [11, -1]]) { rr(ctx, lx - 2.5, -9 + (ph * step > 0 ? -1 : 0), 5, 9, 2); fillStroke(ctx, shade(c, -0.2)); }
  // tail
  if (kind === 'wolf') { ctx.beginPath(); ctx.moveTo(-14, -16); ctx.quadraticCurveTo(-24, -20, -22, -28); ctx.quadraticCurveTo(-18, -20, -12, -12); fillStroke(ctx, c); }
  if (kind === 'wyrm') { ctx.beginPath(); ctx.moveTo(-14, -12); ctx.quadraticCurveTo(-30, -10, -30, -22); ctx.lineTo(-26, -16); ctx.quadraticCurveTo(-24, -12, -14, -18); fillStroke(ctx, c); }
  const bw = kind === 'bear' ? 20 : kind === 'boar' ? 18 : 17, bh = kind === 'bear' ? 14 : 11;
  ctx.beginPath(); ctx.ellipse(0, -16, bw, bh, 0, 0, 7); fillStroke(ctx, c);
  ctx.beginPath(); ctx.ellipse(2, -11, bw * 0.6, bh * 0.4, 0, 0, 7); ctx.fillStyle = shade(c, 0.25); ctx.fill();
  if (kind === 'wyrm') { ctx.fillStyle = c2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-12 + i * 6, -26); ctx.lineTo(-9 + i * 6, -32); ctx.lineTo(-6 + i * 6, -26); ctx.fill(); } }
  // head
  const hx = bw - 2, hy = kind === 'bear' ? -24 : -22;
  if (kind === 'stag') { for (const s of [0, 5]) { ctx.beginPath(); ctx.moveTo(hx + s - 2, hy - 8); ctx.lineTo(hx + s - 6, hy - 20); ctx.moveTo(hx + s - 4, hy - 14); ctx.lineTo(hx + s + 1, hy - 18); ctx.lineWidth = LW + 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = c2; ctx.stroke(); } }
  if (kind === 'wolf' || kind === 'stag') { ctx.beginPath(); ctx.moveTo(hx - 5, hy - 6); ctx.lineTo(hx - 3, hy - 16); ctx.lineTo(hx + 2, hy - 8); fillStroke(ctx, c); }
  if (kind === 'bear') { circ(ctx, hx - 4, hy - 9, 4); fillStroke(ctx, c); }
  if (kind === 'wyrm') { ctx.beginPath(); ctx.moveTo(hx - 4, hy - 7); ctx.lineTo(hx - 10, hy - 18); ctx.lineTo(hx + 1, hy - 9); fillStroke(ctx, c2); }
  circ(ctx, hx, hy, kind === 'bear' ? 10 : 9); fillStroke(ctx, c);
  rr(ctx, hx + 3, hy - 2, kind === 'boar' ? 11 : 10, kind === 'boar' ? 9 : 7, 3.5); fillStroke(ctx, kind === 'boar' ? c2 : shade(c, 0.2));
  ctx.fillStyle = INK; circ(ctx, hx + 12, hy + 0.5, 1.5); ctx.fill();
  if (kind === 'boar') { ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.moveTo(hx + 6, hy + 6); ctx.quadraticCurveTo(hx + 10, hy + 2, hx + 9, hy - 2); ctx.lineTo(hx + 7.5, hy + 5); ctx.fill(); }
  if (kind === 'wyrm') { ctx.fillStyle = '#ffdf5a'; } else ctx.fillStyle = INK;
  ctx.beginPath(); ctx.ellipse(hx + 2, hy - 3, 1.8, 2.6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; circ(ctx, hx + 2.5, hy - 4, 0.7); ctx.fill();
}
function drawSpider(ctx, d, t) {
  const step = Math.sin(t * 14) * 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(s * 4, -10); ctx.lineTo(s * (12 + i * 2), -16 + (i % 2 ? step : -step)); ctx.lineTo(s * (16 + i * 2), 0);
    ctx.lineWidth = LW + 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = d.c; ctx.stroke();
  }
  ctx.beginPath(); ctx.ellipse(-6, -14, 11, 9, 0, 0, 7); fillStroke(ctx, d.c);
  circ(ctx, 7, -11, 7); fillStroke(ctx, shade(d.c, 0.15));
  ctx.fillStyle = d.c2; for (const [x, y] of [[8, -13], [11, -12], [9, -9]]) { circ(ctx, x, y, 1.4); ctx.fill(); }
  ctx.fillStyle = shade(d.c, 0.35); ctx.beginPath(); ctx.ellipse(-8, -17, 4, 2.5, 0, 0, 7); ctx.fill();
}
function drawScorp(ctx, d, t) {
  const w = Math.sin(t * 6) * 2;
  for (const s of [-8, -3, 2, 7]) { rr(ctx, s - 1.5, -6, 3, 6, 1.5); fillStroke(ctx, d.c2); }
  ctx.beginPath(); ctx.ellipse(0, -9, 13, 6, 0, 0, 7); fillStroke(ctx, d.c);
  ctx.beginPath(); ctx.moveTo(-11, -10); ctx.quadraticCurveTo(-24, -14, -18, -30 + w); ctx.lineWidth = LW + 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = d.c; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-18, -30 + w); ctx.lineTo(-11, -32 + w); ctx.lineTo(-15, -26 + w); ctx.closePath(); fillStroke(ctx, d.c2);
  for (const y of [-14, -6]) { ctx.beginPath(); ctx.ellipse(16, y, 5, 3, 0, 0, 7); fillStroke(ctx, d.c); }
  ctx.fillStyle = INK; circ(ctx, 8, -11, 1.4); ctx.fill(); circ(ctx, 11, -11, 1.4); ctx.fill();
}
function drawGhost(ctx, d, t) {
  const f = Math.sin(t * 4) * 2;
  ctx.globalAlpha *= 0.92;
  ctx.beginPath(); ctx.moveTo(-11, -6 + f); ctx.quadraticCurveTo(-13, -34 + f, 0, -34 + f); ctx.quadraticCurveTo(13, -34 + f, 11, -10 + f);
  ctx.lineTo(8, -2 + f); ctx.lineTo(4, -7 + f); ctx.lineTo(0, -1 + f); ctx.lineTo(-4, -7 + f); ctx.lineTo(-8, -1 + f); ctx.closePath(); fillStroke(ctx, d.c);
  ctx.fillStyle = d.c2; ctx.beginPath(); ctx.ellipse(1, -22 + f, 2, 3, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(7, -22 + f, 2, 3, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(4, -15 + f, 2, 1.4, 0, 0, 7); ctx.fill();
}

function drawSprite(ctx, spec, t, swing, moving, opts) {
  if (spec.body === 'chibi') drawChibi(ctx, spec.look, swing, opts);
  else if (spec.body === 'beast') drawBeast(ctx, spec, t, moving);
  else if (spec.body === 'spider') drawSpider(ctx, spec, t);
  else if (spec.body === 'scorp') drawScorp(ctx, spec, t);
  else if (spec.body === 'ghost') drawGhost(ctx, spec, t);
}

// ---------- lane canvas ----------
const lane = { canvas: null, ctx: null, w: 0, h: 0, dpr: 1, ro: null, bg: null, bgKey: '' };

function laneCanvas() {
  if (lane.canvas) return lane.canvas;
  const c = document.createElement('canvas');
  c.id = 'lane';
  lane.canvas = c; lane.ctx = c.getContext('2d');
  lane.ro = new ResizeObserver(() => sizeLane());
  lane.ro.observe(c);
  return c;
}
function sizeLane() {
  const c = lane.canvas, r = c.getBoundingClientRect();
  if (!r.width || !r.height) return;
  lane.dpr = Math.min(2, window.devicePixelRatio || 1);
  lane.w = r.width; lane.h = r.height;
  c.width = Math.round(r.width * lane.dpr); c.height = Math.round(r.height * lane.dpr);
  lane.bgKey = '';
}

// Lane geometry. Street layout (fractions of height): roofs and house fronts, stone wall, dirt road, kerb.
const ROAD_TOP = 0.46, ROAD_BOT = 0.92;
const gx = (x) => (x / 100) * lane.w;
const gy = (y) => lane.h * (0.55 + y * 0.42);
const unitScale = () => Math.max(0.6, Math.min(1.5, lane.h / 230, lane.w / 330));

const STREET = {
  bramble: { sky: '#8fd3ff', roof: '#3d6fc4', roof2: '#2f58a3', wall: '#f6e7c8', beam: '#7a4a2a', win: '#4aa3df', stone: '#a9adb3', stone2: '#8d9197', road: '#c9a46f', road2: '#b8925e', grass: '#5cb85c' },
  crypt: { sky: '#c9a7e8', roof: '#6b4b8a', roof2: '#553a70', wall: '#e8dccb', beam: '#5a3d2b', win: '#ffcf5a', stone: '#9a96a3', stone2: '#7f7a8a', road: '#b6a28a', road2: '#a08c75', grass: '#7aa35a' },
};

function drawBackground(ctx, info) {
  const key = `${info.world.id}:${lane.w}x${lane.h}`;
  if (lane.bgKey !== key) {
    const off = document.createElement('canvas');
    off.width = lane.canvas.width; off.height = lane.canvas.height;
    const o = off.getContext('2d');
    o.scale(lane.dpr, lane.dpr);
    const { w, h } = lane, P = STREET[info.world.id] || STREET.bramble;
    o.lineJoin = 'round';
    o.fillStyle = P.sky; o.fillRect(0, 0, w, h);
    // house fronts
    const houseW = Math.max(110, h * 0.75), wallTop = h * 0.08, wallBot = h * 0.34;
    for (let i = 0, x = -houseW * 0.3; x < w; i++, x += houseW) {
      o.fillStyle = P.wall; o.fillRect(x, wallTop, houseW - 6, wallBot - wallTop);
      o.strokeStyle = INK; o.lineWidth = 2; o.strokeRect(x, wallTop, houseW - 6, wallBot - wallTop);
      o.fillStyle = P.beam; // timber frame
      o.fillRect(x, wallTop + (wallBot - wallTop) * 0.45, houseW - 6, 4);
      o.fillRect(x + 8, wallTop, 5, wallBot - wallTop); o.fillRect(x + houseW - 19, wallTop, 5, wallBot - wallTop);
      // windows
      const ww = houseW * 0.22, wh = (wallBot - wallTop) * 0.34;
      for (const fx of [0.3, 0.62]) {
        const wx = x + houseW * fx - ww / 2 + (i % 2 ? 4 : 0), wy = wallTop + (wallBot - wallTop) * 0.55;
        o.fillStyle = P.beam; o.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
        o.fillStyle = P.win; o.fillRect(wx, wy, ww, wh);
        o.fillStyle = 'rgba(255,255,255,.45)'; o.fillRect(wx + 2, wy + 2, ww * 0.3, wh * 0.4);
        o.fillStyle = P.beam; o.fillRect(wx + ww / 2 - 1, wy, 2, wh);
      }
      // roof tiles
      const roofH = wallTop + h * 0.07;
      o.fillStyle = P.roof; o.fillRect(x - 4, -2, houseW + 2, roofH);
      o.fillStyle = P.roof2;
      for (let ry = 0; ry < roofH; ry += 7) for (let rx = x - 4 + ((ry / 7) % 2) * 6; rx < x + houseW - 2; rx += 12) o.fillRect(rx, ry + 4, 9, 2);
      o.strokeStyle = INK; o.lineWidth = 2.5; o.strokeRect(x - 4, -2, houseW + 2, roofH + 2);
    }
    // stone wall
    const sTop = wallBot, sBot = h * ROAD_TOP;
    o.fillStyle = P.stone; o.fillRect(0, sTop, w, sBot - sTop);
    const bh = (sBot - sTop) / 3;
    o.strokeStyle = P.stone2; o.lineWidth = 1.5;
    for (let r = 0; r < 3; r++) for (let bx = (r % 2) * 14 - 14; bx < w; bx += 28) { o.strokeRect(bx, sTop + r * bh, 28, bh); }
    o.fillStyle = shade(P.stone, 0.25); o.fillRect(0, sTop, w, 4);
    o.strokeStyle = INK; o.lineWidth = 2.5; o.beginPath(); o.moveTo(0, sTop); o.lineTo(w, sTop); o.moveTo(0, sBot); o.lineTo(w, sBot); o.stroke();
    // road
    o.fillStyle = P.road; o.fillRect(0, sBot, w, h * ROAD_BOT - sBot);
    let seed = 7; const r01 = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < (w * h) / 900; i++) {
      o.fillStyle = r01() < 0.5 ? P.road2 : shade(P.road, 0.12);
      o.beginPath(); o.ellipse(r01() * w, sBot + 6 + r01() * (h * ROAD_BOT - sBot - 8), 2 + r01() * 5, 1 + r01() * 2, 0, 0, 7); o.fill();
    }
    for (let i = 0; i < 6; i++) { // grass tufts
      const gx2 = r01() * w, gy2 = sBot + 3 + (r01() < 0.5 ? 0 : h * ROAD_BOT - sBot - 12);
      o.fillStyle = P.grass; o.beginPath(); o.moveTo(gx2, gy2 + 6); o.lineTo(gx2 + 2, gy2); o.lineTo(gx2 + 4, gy2 + 6); o.lineTo(gx2 + 6, gy2 + 1); o.lineTo(gx2 + 8, gy2 + 6); o.fill();
    }
    // kerb and lower wall
    const kTop = h * ROAD_BOT;
    o.fillStyle = P.stone; o.fillRect(0, kTop, w, h - kTop);
    o.strokeStyle = P.stone2; o.lineWidth = 1.5;
    for (let bx = 0; bx < w; bx += 22) o.strokeRect(bx, kTop + 3, 22, h - kTop);
    o.strokeStyle = INK; o.lineWidth = 2.5; o.beginPath(); o.moveTo(0, kTop); o.lineTo(w, kTop); o.stroke();
    lane.bg = off; lane.bgKey = key;
  }
  ctx.drawImage(lane.bg, 0, 0, lane.w, lane.h);
}

function hpBar(ctx, x, y, wpx, frac, color, shield = 0) {
  const hpx = Math.max(4, wpx * 0.14);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(x - wpx / 2 - 1.5, y - 1.5, wpx + 3, hpx + 3, 3); ctx.fill();
  ctx.fillStyle = '#4a2020'; ctx.fillRect(x - wpx / 2, y, wpx, hpx);
  ctx.fillStyle = color; ctx.fillRect(x - wpx / 2, y, wpx * Math.max(0, Math.min(1, frac)), hpx);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x - wpx / 2, y, wpx * Math.max(0, Math.min(1, frac)), hpx * 0.4);
  if (shield > 0) { ctx.fillStyle = '#ffe38a'; ctx.fillRect(x - wpx / 2, y - 3, wpx * Math.min(1, shield), 2.5); }
}
function shieldGlyph(ctx, x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.8, y - s * 0.6); ctx.quadraticCurveTo(x + s * 0.7, y + s * 0.6, x, y + s); ctx.quadraticCurveTo(x - s * 0.7, y + s * 0.6, x - s * 0.8, y - s * 0.6); ctx.closePath();
  ctx.fillStyle = '#5aa9ff'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
}

function unitSpec(u) {
  if (u.side === 'hero') return u.heroId ? { body: 'chibi', look: HERO_LOOKS[u.heroId] } : SUMMON_LOOKS[u.look] || SUMMON_LOOKS.wisp;
  return FOE_LOOKS[u.type] || FOE_LOOKS.goblin;
}

function drawUnit(ctx, u, t, k, b) {
  const hero = u.side === 'hero', sz = (u.size || 1) * k * (hero && u.summon ? 0.85 : 1);
  const frozen = t < u.freeze;
  const x = gx(u.x) + (hero ? 1 : -1) * (u.lunge || 0) * 7 * k, y = gy(u.y);
  const moving = !hero && !frozen && u.x > 40;
  const bob = u.down || frozen ? 0 : Math.abs(Math.sin(t * 6 + u.y * 10)) * 1.4 * k;
  // ground shadow; heroes get a row ring (gold front, blue back)
  ctx.fillStyle = 'rgba(60,40,20,.28)'; ctx.beginPath(); ctx.ellipse(x, y, 15 * sz, 4.5 * sz, 0, 0, 7); ctx.fill();
  if (hero && u.heroId) { ctx.strokeStyle = u.row === 'front' ? 'rgba(255,190,60,.9)' : 'rgba(80,170,255,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 14 * sz, 4.5 * sz, 0, 0, 7); ctx.stroke(); }
  ctx.save();
  ctx.translate(x, y - bob);
  if (u.down) { ctx.globalAlpha = 0.55; ctx.translate(0, -3 * sz); ctx.rotate(-Math.PI / 2); ctx.translate(14 * sz, 0); }
  ctx.scale(hero ? sz : -sz, sz);
  if (u.boss) { ctx.shadowColor = u.boss === 2 ? 'rgba(255,60,40,.7)' : 'rgba(255,200,60,.7)'; ctx.shadowBlur = 10; }
  LW = 2.2;
  drawSprite(ctx, unitSpec(u), t + (u.y * 3), u.lunge || 0, moving, { down: u.down });
  ctx.restore();
  ctx.globalAlpha = 1;
  const top = y - 50 * sz;
  if (frozen) { ctx.fillStyle = 'rgba(140,210,255,.4)'; ctx.beginPath(); ctx.ellipse(x, y - 22 * sz, 18 * sz, 26 * sz, 0, 0, 7); ctx.fill(); }
  if (u.dots.length) { ctx.fillStyle = u.dots[0].kind === 'poison' ? 'rgba(110,230,90,.28)' : 'rgba(255,140,60,.28)'; ctx.beginPath(); ctx.ellipse(x, y - 20 * sz, 16 * sz, 22 * sz, 0, 0, 7); ctx.fill(); }
  if (u.buff) { ctx.strokeStyle = u.buff.color || '#fff'; ctx.globalAlpha = 0.7; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y - 22 * sz, 18 * sz, 26 * sz, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
  if (t < u.fear) { ctx.fillStyle = '#d58cff'; ctx.font = `900 ${13 * k}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('!', x, top - 6 * k); }
  if (u.down) {
    if (u.heroId && u.reviveAt) { ctx.font = `800 ${10 * k}px system-ui`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = INK; const s = `${Math.ceil(u.reviveAt - t)}s`; ctx.strokeText(s, x, y - 20 * k); ctx.fillStyle = '#fff'; ctx.fillText(s, x, y - 20 * k); }
    return;
  }
  if (u.boss === 2) return; // boss uses the big bar
  const bw = Math.max(22 * k, 26 * sz);
  hpBar(ctx, x, top, bw, u.hp / u.maxHp, hero ? '#46d160' : '#ef4a4a', u.shield > 0 ? u.shield / u.maxHp : 0);
  if (hero && u.heroId) {
    ctx.fillStyle = '#3a2a10'; ctx.fillRect(x - bw / 2, top + bw * 0.14 + 2.5, bw, 2.5);
    ctx.fillStyle = u.ult >= 100 ? '#ffe14a' : '#e6a52e'; ctx.fillRect(x - bw / 2, top + bw * 0.14 + 2.5, bw * u.ult / 100, 2.5);
    if (u.row === 'back' && b.frontUp) shieldGlyph(ctx, x - bw / 2 - 6 * k, top + 2 * k, 4.5 * k);
  }
}

function outlinedText(ctx, text, x, y, size, fill, weight = 900) {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.28); ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

// Stage title and numbered wave nodes across the top of the lane.
function drawStageHud(ctx, s, info) {
  const wave = s.progress.wave, w = lane.w;
  const ts = Math.max(13, Math.min(20, w / 22));
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  outlinedText(ctx, `${info.name} - ${info.label}`, w / 2, ts + 4, ts, '#fff');
  const n = WAVES_PER_STAGE, nodeW = Math.min(30, (w - 24) / n - 4), gap = 4, total = n * nodeW + (n - 1) * gap;
  const x0 = (w - total) / 2, y = ts + 11, nh = Math.max(14, nodeW * 0.62);
  ctx.fillStyle = INK; ctx.fillRect(x0, y + nh / 2 - 3, total, 6);
  ctx.fillStyle = '#5ad0ff'; ctx.fillRect(x0, y + nh / 2 - 1.5, Math.max(0, (wave - 1) / (n - 1)) * total, 3);
  for (let i = 1; i <= n; i++) {
    const x = x0 + (i - 1) * (nodeW + gap), cur = i === wave, done = i < wave;
    const fill = cur ? '#5ad0ff' : done ? '#9be37a' : isBoss(i) ? '#ff6b5a' : isSubBoss(i) ? '#ffb347' : '#f2f4f7';
    const grow = cur ? 3 : 0;
    ctx.beginPath(); ctx.roundRect(x - grow / 2, y - grow / 2, nodeW + grow, nh + grow, 5); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(x + 2, y + 2, nodeW - 4, nh * 0.3);
    ctx.font = `900 ${Math.max(9, nh * 0.62)}px system-ui`; ctx.fillStyle = INK; ctx.textBaseline = 'middle';
    ctx.fillText(isBoss(i) ? '☠' : String(i), x + nodeW / 2, y + nh / 2 + 1);
  }
  ctx.textBaseline = 'alphabetic';
  return y + nh;
}

function drawBattle(s, now) {
  const c = lane.canvas;
  if (!c || !c.isConnected || !battle) return;
  if (!lane.w) sizeLane();
  if (!lane.w) return;
  const ctx = lane.ctx, b = battle, t = b.t, k = unitScale();
  const info = stageInfo(s.progress.stage);
  ctx.setTransform(lane.dpr, 0, 0, lane.dpr, 0, 0);
  drawBackground(ctx, info);
  b.frontUp = b.units.some((u) => u.heroId && u.row === 'front' && !u.down);

  // row tags on the road edge
  ctx.textAlign = 'center';
  for (const [lbl, x, col] of [['BACK', BACK_X, '#5aa9ff'], ['FRONT', FRONT_X, '#ffb347']]) {
    const px = gx(x + 1), py = lane.h * ROAD_TOP + 9 * k, fs = 8.5 * k;
    ctx.font = `900 ${fs}px system-ui`; const tw = ctx.measureText(lbl).width + 8 * k;
    ctx.beginPath(); ctx.roundRect(px - tw / 2, py - fs * 0.9, tw, fs * 1.35, 5); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = INK; ctx.fillText(lbl, px, py + fs * 0.25);
  }

  const units = [...b.units].sort((a, c2) => a.y - c2.y);
  for (const u of units) drawUnit(ctx, u, t, k, b);

  for (const f of b.fx) {
    const p = (t - f.t0) / f.dur;
    if (f.kind === 'shot') {
      const x = gx(f.x1 + (f.x2 - f.x1) * p), y = gy(f.y1 + (f.y2 - f.y1) * p) - 22 * k;
      ctx.fillStyle = f.color; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 3.2 * k, 0, 7); ctx.fill(); ctx.stroke();
    } else if (f.kind === 'ring') {
      ctx.strokeStyle = f.color; ctx.globalAlpha = 1 - p; ctx.lineWidth = 5 * k;
      ctx.beginPath(); ctx.ellipse(gx(f.x), gy(f.y), gx(f.r) * p, gx(f.r) * p * 0.35, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (f.kind === 'flash' || f.kind === 'party') {
      ctx.fillStyle = f.color; ctx.globalAlpha = 0.28 * (1 - p); ctx.fillRect(0, 0, f.kind === 'party' ? lane.w * 0.5 : lane.w, lane.h); ctx.globalAlpha = 1;
    } else if (f.kind === 'loot') {
      const x = gx(f.x), y = gy(f.y) - 24 * k - p * 26 * k, s2 = 8 * k;
      ctx.globalAlpha = 1 - p * p;
      ctx.beginPath(); ctx.roundRect(x - s2, y - s2, s2 * 2, s2 * 1.6, 3); ctx.fillStyle = f.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = '#ffe14a'; ctx.fillRect(x - 1.5 * k, y - s2, 3 * k, s2 * 1.6);
      ctx.globalAlpha = 1;
    }
  }

  ctx.textAlign = 'center';
  for (const f of b.floats) {
    const p = (t - f.t0) / 0.9;
    ctx.globalAlpha = 1 - p * p;
    outlinedText(ctx, f.text, gx(f.x), gy(f.y) - 52 * k - p * 20 * k, (f.big ? 15 : 11) * k, f.color, 900);
  }
  ctx.globalAlpha = 1;

  const hudBottom = drawStageHud(ctx, s, info);
  const boss = b.units.find((u) => u.boss === 2);
  if (boss) {
    const bw = Math.min(lane.w * 0.6, 280), bx = (lane.w - bw) / 2, by = hudBottom + 8;
    ctx.beginPath(); ctx.roundRect(bx - 2, by - 2, bw + 4, 13, 4); ctx.fillStyle = INK; ctx.fill();
    ctx.fillStyle = '#ef4a4a'; ctx.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.maxHp), 9);
    ctx.textAlign = 'center'; outlinedText(ctx, boss.name, lane.w / 2, by + 24, 12, '#ffd0c0');
  }
  if (b.banner && t < b.banner.until) {
    const a = Math.min(1, (b.banner.until - t) * 2);
    ctx.globalAlpha = a; ctx.textAlign = 'center';
    outlinedText(ctx, b.banner.text, lane.w / 2, lane.h * (b.banner.small ? 0.5 : 0.56), b.banner.small ? 15 : Math.min(22, lane.w / 18), b.banner.color);
    ctx.globalAlpha = 1;
  }
}

// ---------- portraits & icons for the HTML UI ----------
const portraitCache = {};
function heroPortrait(id) {
  if (portraitCache[id]) return portraitCache[id];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.translate(58, 150); ctx.scale(3.4, 3.4);
  LW = 1.9;
  drawChibi(ctx, HERO_LOOKS[id] || HERO_LOOKS.brannoc, 0.15);
  LW = 2.2;
  return (portraitCache[id] = c.toDataURL());
}
const spriteCache = {};
function spriteImage(key, spec) { // full-body sprite (for codex, formation slots)
  if (spriteCache[key]) return spriteCache[key];
  const c = document.createElement('canvas'); c.width = 96; c.height = 112;
  const ctx = c.getContext('2d');
  ctx.translate(46, 104); ctx.scale(1.9, 1.9);
  LW = 2; drawSprite(ctx, spec, 0, 0, false, {}); LW = 2.2;
  return (spriteCache[key] = c.toDataURL());
}
const heroSprite = (id) => spriteImage(`h:${id}`, { body: 'chibi', look: HERO_LOOKS[id] });

// Gear-slot icons as inline SVG (thick outline, rarity-tinted).
function slotSvg(slot, color = '#cfd6dd') {
  const o = 'stroke="#2a1c16" stroke-width="3" stroke-linejoin="round"';
  const p = {
    weapon: `<path d="M30 6 L36 10 L18 34 L13 30 Z" fill="${color}" ${o}/><rect x="6" y="28" width="16" height="5" rx="2" transform="rotate(-50 14 30)" fill="#c9a227" ${o}/><rect x="5" y="34" width="5" height="9" rx="2" transform="rotate(-50 8 38)" fill="#7a5230" ${o}/>`,
    armour: `<path d="M12 8 L18 6 Q24 11 30 6 L36 8 L42 16 L36 20 L35 40 L13 40 L12 20 L6 16 Z" fill="${color}" ${o}/><path d="M24 12 V38" stroke="#2a1c16" stroke-width="2"/>`,
    shield: `<path d="M24 5 L40 11 Q40 32 24 43 Q8 32 8 11 Z" fill="${color}" ${o}/><circle cx="24" cy="21" r="5" fill="#ffe14a" ${o}/>`,
    ring: `<circle cx="24" cy="29" r="12" fill="none" stroke="#2a1c16" stroke-width="9"/><circle cx="24" cy="29" r="12" fill="none" stroke="#f2c94c" stroke-width="4"/><path d="M17 12 L24 5 L31 12 L24 19 Z" fill="${color}" ${o}/>`,
    charm: `<path d="M10 6 Q24 26 38 6" fill="none" stroke="#2a1c16" stroke-width="2.5"/><path d="M24 18 L35 29 L24 43 L13 29 Z" fill="${color}" ${o}/><path d="M24 22 L28 29 L24 35" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/>`,
  }[slot];
  return `<svg viewBox="0 0 48 48" class="gi" aria-hidden="true">${p}</svg>`;
}
