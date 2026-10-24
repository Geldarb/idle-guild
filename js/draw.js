// Canvas renderer for the battle lane. Reads `battle` and state, never changes them.
'use strict';

// Per-hero colours: [hair or hat, cloth]
const HERO_LOOKS = {
  brannoc: ['#6b4a2b', '#8a8f99'], kessa: ['#c0392b', '#7a5a3a'], harl: ['#d8d8d8', '#a08040'], vexa: ['#2b2b38', '#5a2a6a'],
  pip: ['#e0b050', '#4f8a3a'], sorrel: ['#5a3a1a', '#3a6a3a'], tamsin: ['#f0d080', '#3a5a7a'], rook: ['#2a2a2a', '#7a2a1a'],
  wren: ['#5a8a4a', '#4a6a3a'], ilsabet: ['#cfe8ff', '#4a6aa0'], corvin: ['#1a1a1a', '#8a2a2a'], yew: ['#3a6a2a', '#5a4a2a'],
};

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

// Lane geometry: ground band where units stand.
const gx = (x) => (x / 100) * lane.w;
const gy = (y) => lane.h * (0.5 + y * 0.36);
const unitScale = () => Math.max(0.75, Math.min(1.6, lane.h / 200, lane.w / 330));

function drawBackground(ctx, info) {
  const key = `${info.world.id}:${lane.w}x${lane.h}`;
  if (lane.bgKey !== key) {
    const off = document.createElement('canvas');
    off.width = lane.canvas.width; off.height = lane.canvas.height;
    const o = off.getContext('2d');
    o.scale(lane.dpr, lane.dpr);
    const { w, h } = lane, wd = info.world;
    const sky = o.createLinearGradient(0, 0, 0, h * 0.5);
    sky.addColorStop(0, wd.sky[0]); sky.addColorStop(1, wd.sky[1]);
    o.fillStyle = sky; o.fillRect(0, 0, w, h);
    // distant hills or ruins
    o.fillStyle = 'rgba(0,0,0,.22)';
    o.beginPath(); o.moveTo(0, h * 0.5);
    for (let i = 0; i <= 12; i++) o.lineTo((i / 12) * w, h * (0.36 + 0.07 * Math.sin(i * 1.7 + (wd.id === 'crypt' ? 2 : 0))));
    o.lineTo(w, h * 0.5); o.fill();
    if (wd.id === 'bramble') { // trees
      o.fillStyle = 'rgba(10,30,15,.55)';
      for (let i = 0; i < 9; i++) { const x = ((i * 137) % 100) / 100 * w, s = h * (0.1 + (i % 3) * 0.03);
        o.beginPath(); o.moveTo(x, h * 0.5 - s * 1.8); o.lineTo(x - s * 0.6, h * 0.5); o.lineTo(x + s * 0.6, h * 0.5); o.fill(); }
    } else { // tombstones
      o.fillStyle = 'rgba(30,20,30,.6)';
      for (let i = 0; i < 8; i++) { const x = ((i * 113) % 100) / 100 * w, s = h * 0.05;
        o.beginPath(); o.roundRect(x, h * 0.5 - s * 1.4, s, s * 1.4, [s / 2, s / 2, 0, 0]); o.fill(); }
    }
    o.fillStyle = wd.ground; o.fillRect(0, h * 0.5, w, h * 0.5);
    o.fillStyle = wd.groundLine; o.fillRect(0, h * 0.5, w, 3);
    // the road
    o.fillStyle = 'rgba(255,230,180,.07)';
    o.beginPath(); o.moveTo(0, h * 0.62); o.lineTo(w, h * 0.58); o.lineTo(w, h * 0.78); o.lineTo(0, h * 0.84); o.fill();
    lane.bg = off; lane.bgKey = key;
  }
  ctx.drawImage(lane.bg, 0, 0, lane.w, lane.h);
}

function hpBar(ctx, x, y, wpx, frac, color, shield = 0) {
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - wpx / 2 - 1, y - 1, wpx + 2, 6);
  ctx.fillStyle = color; ctx.fillRect(x - wpx / 2, y, wpx * Math.max(0, Math.min(1, frac)), 4);
  if (shield > 0) { ctx.fillStyle = '#ffe38a'; ctx.fillRect(x - wpx / 2, y - 3, wpx * Math.min(1, shield), 2); }
}

function drawHero(ctx, u, t, k) {
  const look = u.heroId ? HERO_LOOKS[u.heroId] : ['#4a7a3a', '#6a5a3a'];
  const x = gx(u.x) + (u.lunge || 0) * 6 * k, y = gy(u.y);
  const bob = u.down ? 0 : Math.sin(t * 6 + u.y * 10) * 1.2 * k;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 0, 11 * k, 3.5 * k, 0, 0, 7); ctx.fill();
  if (u.summon) { ctx.font = `${22 * k}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(u.icon, 0, 2 * k); ctx.restore(); return; }
  if (u.down) { ctx.globalAlpha = 0.45; ctx.rotate(-Math.PI / 2.2); ctx.translate(-6 * k, -8 * k); }
  const cls = u.cls;
  // legs + body
  ctx.fillStyle = '#2a2230'; ctx.fillRect(-5 * k, -9 * k + bob, 3.5 * k, 9 * k); ctx.fillRect(1.5 * k, -9 * k + bob, 3.5 * k, 9 * k);
  ctx.fillStyle = look[1]; ctx.beginPath(); ctx.roundRect(-7 * k, -24 * k + bob, 14 * k, 16 * k, 4 * k); ctx.fill();
  ctx.fillStyle = CLASSES[cls].color; ctx.fillRect(-7 * k, -13 * k + bob, 14 * k, 2.5 * k); // belt in class colour
  // head
  ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(0, -29 * k + bob, 6 * k, 0, 7); ctx.fill();
  ctx.fillStyle = '#222'; ctx.fillRect(2 * k, -30 * k + bob, 1.6 * k, 1.6 * k);
  ctx.fillStyle = look[0];
  if (cls === 'melee') { ctx.beginPath(); ctx.arc(0, -30 * k + bob, 6.5 * k, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#9aa0aa'; ctx.fillRect(-6.5 * k, -31 * k + bob, 13 * k, 2 * k); }
  else if (cls === 'ranged') { ctx.beginPath(); ctx.arc(0, -30 * k + bob, 6.8 * k, Math.PI * 0.95, Math.PI * 2.05); ctx.lineTo(-7 * k, -24 * k + bob); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(-8 * k, -32 * k + bob); ctx.lineTo(8 * k, -32 * k + bob); ctx.lineTo(-1 * k, -46 * k + bob); ctx.fill(); }
  // gear
  if (cls === 'melee') {
    ctx.strokeStyle = '#dfe6ee'; ctx.lineWidth = 2.5 * k; ctx.beginPath(); ctx.moveTo(8 * k, -16 * k + bob); ctx.lineTo(18 * k, -30 * k + bob); ctx.stroke();
    ctx.fillStyle = look[1]; ctx.strokeStyle = '#d8b060'; ctx.lineWidth = 1.5 * k; ctx.beginPath(); ctx.arc(-7 * k, -17 * k + bob, 6 * k, 0, 7); ctx.fill(); ctx.stroke();
  } else if (cls === 'ranged') {
    ctx.strokeStyle = '#a0703a'; ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.arc(8 * k, -18 * k + bob, 9 * k, -Math.PI / 2.2, Math.PI / 2.2); ctx.stroke();
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 0.8 * k; ctx.beginPath(); ctx.moveTo(10 * k, -26.5 * k + bob); ctx.lineTo(10 * k, -9.5 * k + bob); ctx.stroke();
  } else {
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.moveTo(10 * k, -2 * k + bob); ctx.lineTo(10 * k, -36 * k + bob); ctx.stroke();
    ctx.fillStyle = CLASSES.mage.color; ctx.shadowColor = '#b9a8ff'; ctx.shadowBlur = 8 * k;
    ctx.beginPath(); ctx.arc(10 * k, -38 * k + bob, 3.5 * k, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  }
  ctx.restore();
  if (u.buff) { ctx.strokeStyle = u.buff.color; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 10); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y - 18 * k, 13 * k, 22 * k, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
  if (!u.down) hpBar(ctx, x, y - 52 * k, 26 * k, u.hp / u.maxHp, '#5fd46f', u.shield / u.maxHp);
  if (u.heroId && !u.down && u.ult >= 100) { ctx.fillStyle = '#ffd34a'; ctx.font = `bold ${10 * k}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('★', x, y - 56 * k); }
}

function drawFoe(ctx, u, t, k) {
  const sz = 24 * k * (u.size || 1);
  const x = gx(u.x) - (u.lunge || 0) * 6 * k, y = gy(u.y);
  const bob = Math.abs(Math.sin(t * 7 + u.y * 9)) * 2 * k * (t < u.freeze ? 0 : 1);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y, sz * 0.45, sz * 0.13, 0, 0, 7); ctx.fill();
  ctx.save();
  ctx.translate(x, y - bob);
  if (u.boss) { ctx.shadowColor = u.boss === 2 ? '#ff5a3a' : '#ffc94a'; ctx.shadowBlur = 14 * k; }
  ctx.font = `${sz}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(u.icon, 0, 0);
  ctx.restore();
  if (t < u.freeze) { ctx.fillStyle = 'rgba(140,210,255,.35)'; ctx.beginPath(); ctx.arc(x, y - sz * 0.5, sz * 0.55, 0, 7); ctx.fill(); }
  if (u.dots.length) { ctx.fillStyle = u.dots[0].kind === 'poison' ? 'rgba(110,255,90,.25)' : 'rgba(255,140,60,.25)'; ctx.beginPath(); ctx.arc(x, y - sz * 0.5, sz * 0.5, 0, 7); ctx.fill(); }
  if (t < u.fear) { ctx.fillStyle = '#d58cff'; ctx.font = `bold ${12 * k}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('!', x, y - sz - 8 * k); }
  if (u.boss !== 2) hpBar(ctx, x, y - sz - 6 * k, Math.max(22 * k, sz * 0.8), u.hp / u.maxHp, '#ef5b5b');
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

  const units = [...b.units].sort((a, c2) => a.y - c2.y);
  for (const u of units) (u.side === 'hero' ? drawHero : drawFoe)(ctx, u, t, k);

  for (const f of b.fx) {
    const p = (t - f.t0) / f.dur;
    if (f.kind === 'shot') {
      const x = gx(f.x1 + (f.x2 - f.x1) * p), y = gy(f.y1 + (f.y2 - f.y1) * p) - 18 * k;
      ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(x, y, 2.5 * k, 0, 7); ctx.fill();
      ctx.strokeStyle = f.color; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5 * k; ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(gx(f.x1 + (f.x2 - f.x1) * Math.max(0, p - 0.3)), gy(f.y1 + (f.y2 - f.y1) * Math.max(0, p - 0.3)) - 18 * k); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (f.kind === 'ring') {
      ctx.strokeStyle = f.color; ctx.globalAlpha = 1 - p; ctx.lineWidth = 4 * k;
      ctx.beginPath(); ctx.ellipse(gx(f.x), gy(f.y), gx(f.r) * p, gx(f.r) * p * 0.35, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (f.kind === 'flash' || f.kind === 'party') {
      ctx.fillStyle = f.color; ctx.globalAlpha = 0.28 * (1 - p); ctx.fillRect(0, 0, f.kind === 'party' ? lane.w * 0.45 : lane.w, lane.h); ctx.globalAlpha = 1;
    } else if (f.kind === 'loot') {
      const x = gx(f.x), y = gy(f.y) - 20 * k - p * 26 * k;
      ctx.globalAlpha = 1 - p; ctx.font = `${16 * k}px serif`; ctx.textAlign = 'center'; ctx.fillText('🎁', x, y);
      ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 6 * k, 12 * k * (0.6 + p), 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  ctx.textAlign = 'center';
  for (const f of b.floats) {
    const p = (t - f.t0) / 0.9;
    ctx.globalAlpha = 1 - p * p;
    ctx.font = `bold ${(f.big ? 15 : 11.5) * k}px system-ui`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)';
    const x = gx(f.x), y = gy(f.y) - 40 * k - p * 22 * k;
    ctx.strokeText(f.text, x, y); ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
  }
  ctx.globalAlpha = 1;

  // HUD: wave pips and boss bar
  const wave = s.progress.wave, pipW = Math.min(16, lane.w / 26);
  for (let i = 1; i <= WAVES_PER_STAGE; i++) {
    const x = lane.w - 8 - (WAVES_PER_STAGE - i + 1) * (pipW + 3), y = 8;
    ctx.fillStyle = i < wave ? '#ffc94a' : i === wave ? '#fff' : 'rgba(255,255,255,.22)';
    if (isBoss(i) || isSubBoss(i)) { ctx.beginPath(); ctx.arc(x + pipW / 2, y + 4, isBoss(i) ? 5 : 4, 0, 7); ctx.fill(); }
    else ctx.fillRect(x, y + 2, pipW, 4);
  }
  ctx.textAlign = 'left'; ctx.font = 'bold 12px system-ui'; ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.fillText(`${info.label} ${info.name}`, 8, 17);
  ctx.textAlign = 'right'; ctx.font = '11px system-ui'; ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.fillText(`Wave ${wave}/${WAVES_PER_STAGE}`, lane.w - 8, 30);
  const boss = b.units.find((u) => u.boss === 2);
  if (boss) {
    const bw = Math.min(lane.w * 0.6, 280), bx = (lane.w - bw) / 2, by = 40;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(bx - 2, by - 2, bw + 4, 12);
    ctx.fillStyle = '#d94040'; ctx.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.maxHp), 8);
    ctx.textAlign = 'center'; ctx.font = 'bold 11px system-ui'; ctx.fillStyle = '#fff'; ctx.fillText(boss.name, lane.w / 2, by + 22);
  }
  if (b.banner && t < b.banner.until) {
    const a = Math.min(1, (b.banner.until - t) * 2);
    ctx.globalAlpha = a; ctx.textAlign = 'center';
    ctx.font = `bold ${b.banner.small ? 14 : Math.min(22, lane.w / 18)}px system-ui`;
    const y = lane.h * (b.banner.small ? 0.3 : 0.36);
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(b.banner.text, lane.w / 2, y);
    ctx.fillStyle = b.banner.color; ctx.fillText(b.banner.text, lane.w / 2, y);
    ctx.globalAlpha = 1;
  }
}
