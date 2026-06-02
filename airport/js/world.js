// world.js — עולם הליכה עליון (Top-Down) חי של הטרמינל, בסגנון משחק.
// השחקן זז (מקלדת/ג'ויסטיק), חוצה ביקורת ביטחון, ומגיע לתחנות שמפעילות מערכות.
// סביבה חיה: מטוסים על הרחבה, נוסעי NPC מתהלכים, מסוע מזוודות, לוח טיסות ואזור ישיבה.

import { openSettings } from './settings.js';
import { enterRole } from './main.js';
import { sfx } from './audio.js';
import { state } from './state.js';
import { FLIGHTS, destByCode } from './data.js';

let raf = null, running = false;
const keys = {};
const joy = { active: false, dx: 0, dy: 0, id: null };
let player, zones, walls, W, H, near = null;
let canvas, cctx, tick = 0;
let npcs = [], bags = [], planes = [], carousel = null;
let onKeyDown, onKeyUp, onResize;

const NZONES = [
  { nx: 0.07, ny: 0.16, nw: 0.20, nh: 0.12, role: 'ramp',     label: 'דלפק רחבה',  icon: '🦺', color: '#0c3a1f' },
  { nx: 0.40, ny: 0.42, nw: 0.20, nh: 0.10, role: 'security', label: 'ביקורת ביטחון', icon: '🛡️', color: '#3a2a08' },
  { nx: 0.73, ny: 0.16, nw: 0.20, nh: 0.12, role: 'manager',  label: 'חדר מנהל',   icon: '👔', color: '#1a0e2e' },
  { nx: 0.09, ny: 0.70, nw: 0.26, nh: 0.13, role: 'checkin',  label: "דלפק צ׳ק-אין", icon: '🧑‍✈️', color: '#0a2342' },
  { nx: 0.80, ny: 0.84, nw: 0.15, nh: 0.10, role: 'settings', label: 'הגדרות',     icon: '⚙️', color: '#1e293b' },
];
const NWALLS = [
  { nx: 0.00, ny: 0.505, nw: 0.38, nh: 0.022 },
  { nx: 0.62, ny: 0.505, nw: 0.38, nh: 0.022 },
];
const NPC_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#eab308', '#64748b', '#f97316'];

export function startWorld() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div id="world-wrap" class="world-wrap">
      <canvas id="world-canvas"></canvas>
      <div class="world-hud">
        <div class="world-title">🛫 טרמינל נתב"ג — מצב הליכה</div>
        <div class="world-hint">זוז עם מקלדת (WASD/חיצים) או הג׳ויסטיק. גש לתחנה ולחץ <b>E</b> / "היכנס".</div>
      </div>
      <button id="world-exit" class="world-exit">← יציאה ללובי</button>
      <div id="near-label" class="near-label"></div>
      <div id="joystick" class="joystick"><div id="joy-stick" class="joy-stick"></div></div>
      <button id="act-btn" class="act-btn">היכנס</button>
    </div>`;

  canvas = document.getElementById('world-canvas');
  cctx = canvas.getContext('2d');
  layout();
  initEntities();

  onResize = () => { layout(); initEntities(); };
  window.addEventListener('resize', onResize);
  onKeyDown = (e) => { keys[e.key.toLowerCase()] = true; if (e.key.toLowerCase() === 'e') tryEnter(); };
  onKeyUp = (e) => { keys[e.key.toLowerCase()] = false; };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  setupJoystick();
  document.getElementById('act-btn').addEventListener('click', tryEnter);
  document.getElementById('world-exit').addEventListener('click', () => { stopWorld(); enterRole('__lobby__'); });

  running = true;
  loop();
}

export function stopWorld() {
  running = false;
  if (raf) cancelAnimationFrame(raf);
  window.removeEventListener('resize', onResize);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
}

function layout() {
  const wrap = document.getElementById('world-wrap');
  if (!wrap) return;
  W = canvas.width = wrap.clientWidth;
  H = canvas.height = wrap.clientHeight;
  zones = NZONES.map((z) => ({ ...z, x: z.nx * W, y: z.ny * H, w: z.nw * W, h: z.nh * H }));
  walls = NWALLS.map((z) => ({ x: z.nx * W, y: z.ny * H, w: z.nw * W, h: z.nh * H }));
  // מסוע מזוודות (אזור הגעה) — מרכז שמאל-תחתון
  carousel = { x: W * 0.46, y: H * 0.74, rx: W * 0.09, ry: H * 0.06 };
  walls.push({ x: carousel.x - carousel.rx, y: carousel.y - carousel.ry, w: carousel.rx * 2, h: carousel.ry * 2 });
  if (!player) player = { x: W * 0.5, y: H * 0.92, r: Math.max(11, W * 0.012), dir: -Math.PI / 2 };
  else { player.x = Math.min(player.x, W - 20); player.y = Math.min(player.y, H - 20); player.r = Math.max(11, W * 0.012); }
}

function initEntities() {
  // נוסעי NPC מתהלכים (רובם באזור הציבורי)
  npcs = [];
  const n = 16;
  for (let i = 0; i < n; i++) {
    npcs.push({
      x: Math.random() * W, y: H * (0.55 + Math.random() * 0.4),
      tx: Math.random() * W, ty: H * (0.55 + Math.random() * 0.4),
      spd: 0.5 + Math.random() * 1.1, color: NPC_COLORS[i % NPC_COLORS.length],
      bag: Math.random() < 0.5, ph: Math.random() * 6,
    });
  }
  // מזוודות על המסוע
  bags = [];
  for (let i = 0; i < 9; i++) bags.push({ a: (i / 9) * Math.PI * 2, c: NPC_COLORS[(i * 3) % NPC_COLORS.length] });
  // מטוסים על הרחבה (חלק עליון)
  planes = [
    { x: W * 0.22, y: H * 0.055, s: Math.max(0.7, W / 1500), taxi: false },
    { x: W * 0.78, y: H * 0.055, s: Math.max(0.7, W / 1500), taxi: false },
    { x: -120, y: H * 0.03, s: Math.max(0.6, W / 1700), taxi: true, vx: 0.7 + W * 0.0006 },
  ];
}

function setupJoystick() {
  const base = document.getElementById('joystick');
  const stick = document.getElementById('joy-stick');
  const rect = () => base.getBoundingClientRect();
  const move = (e) => {
    if (!joy.active) return;
    const t = [...(e.touches || [e])].find((x) => x.identifier === joy.id) || e;
    const rc = rect(); const cx = rc.left + rc.width / 2; const cy = rc.top + rc.height / 2;
    let dx = (t.clientX - cx) / (rc.width / 2); let dy = (t.clientY - cy) / (rc.height / 2);
    const m = Math.hypot(dx, dy) || 1; if (m > 1) { dx /= m; dy /= m; }
    joy.dx = dx; joy.dy = dy;
    stick.style.transform = `translate(${dx * 26}px, ${dy * 26}px)`;
  };
  const start = (e) => { joy.active = true; joy.id = (e.changedTouches ? e.changedTouches[0].identifier : null); move(e); e.preventDefault(); };
  const end = () => { joy.active = false; joy.dx = joy.dy = 0; stick.style.transform = 'translate(0,0)'; };
  base.addEventListener('touchstart', start, { passive: false });
  base.addEventListener('touchmove', move, { passive: false });
  base.addEventListener('touchend', end); base.addEventListener('touchcancel', end);
  base.addEventListener('mousedown', (e) => { start(e); });
  window.addEventListener('mousemove', (e) => { if (joy.active && joy.id === null) move(e); });
  window.addEventListener('mouseup', () => { if (joy.id === null) end(); });
}

function tryEnter() {
  if (!near) return;
  sfx('beep');
  if (near.role === 'settings') { openSettings(); return; }
  stopWorld();
  enterRole(near.role);
}

function collide() {
  const p = player;
  p.x = Math.max(p.r, Math.min(W - p.r, p.x));
  p.y = Math.max(p.r, Math.min(H - p.r, p.y));
  for (const w of walls) {
    const cx = Math.max(w.x, Math.min(p.x, w.x + w.w));
    const cy = Math.max(w.y, Math.min(p.y, w.y + w.h));
    const dx = p.x - cx, dy = p.y - cy; const d = Math.hypot(dx, dy);
    if (d < p.r) {
      if (d === 0) { p.y < w.y + w.h / 2 ? (p.y = w.y - p.r) : (p.y = w.y + w.h + p.r); }
      else { p.x = cx + (dx / d) * p.r; p.y = cy + (dy / d) * p.r; }
    }
  }
}

function loop() {
  if (!running) return;
  if (!document.getElementById('world-canvas')) { running = false; return; }
  tick++;
  // קלט שחקן
  let vx = 0, vy = 0;
  if (keys['arrowup'] || keys['w']) vy -= 1;
  if (keys['arrowdown'] || keys['s']) vy += 1;
  if (keys['arrowleft'] || keys['a']) vx -= 1;
  if (keys['arrowright'] || keys['d']) vx += 1;
  vx += joy.dx; vy += joy.dy;
  const m = Math.hypot(vx, vy);
  const speed = Math.max(2.4, W * 0.0035);
  if (m > 0.05) { vx = (vx / m) * speed; vy = (vy / m) * speed; player.x += vx; player.y += vy; player.dir = Math.atan2(vy, vx); }
  collide();
  updateEntities();

  near = null;
  for (const z of zones) {
    if (player.x > z.x - 30 && player.x < z.x + z.w + 30 && player.y > z.y - 30 && player.y < z.y + z.h + 30) { near = z; break; }
  }
  const nl = document.getElementById('near-label');
  if (nl) nl.textContent = near ? `${near.icon} ${near.label} — לחץ E / "היכנס"` : '';
  const act = document.getElementById('act-btn');
  if (act) act.classList.toggle('ready', !!near);

  draw();
  raf = requestAnimationFrame(loop);
}

function updateEntities() {
  for (const o of npcs) {
    const dx = o.tx - o.x, dy = o.ty - o.y, d = Math.hypot(dx, dy);
    if (d < 6) { o.tx = Math.random() * W; o.ty = H * (0.55 + Math.random() * 0.42); }
    else { o.x += (dx / d) * o.spd; o.y += (dy / d) * o.spd; }
  }
  for (const b of bags) b.a += 0.012;
  for (const pl of planes) if (pl.taxi) { pl.x += pl.vx; if (pl.x > W + 150) pl.x = -150; }
}

// ===== ציור =====
function nightTint() {
  const t = state.shift && state.shift.time;
  if (t === 'night') return 'rgba(2,6,23,0.45)';
  if (t === 'evening') return 'rgba(30,20,60,0.22)';
  if (t === 'morning') return 'rgba(255,200,120,0.05)';
  return null;
}

function draw() {
  const c = cctx;
  c.fillStyle = '#0b1626'; c.fillRect(0, 0, W, H);

  // ----- רחבת מטוסים (Apron) בחלק העליון -----
  c.fillStyle = '#1a2436'; c.fillRect(0, 0, W, H * 0.13);
  c.strokeStyle = '#33415588'; c.lineWidth = 2; c.setLineDash([14, 12]);
  c.beginPath(); c.moveTo(0, H * 0.105); c.lineTo(W, H * 0.105); c.stroke(); c.setLineDash([]);
  for (const pl of planes) drawPlane(c, pl.x, pl.y, pl.s);

  // קיר/חלונות בין הרחבה לטרמינל
  c.fillStyle = '#0e7490'; c.fillRect(0, H * 0.125, W, 3);

  // ----- רצפת טרמינל -----
  c.fillStyle = '#0b1626'; c.fillRect(0, H * 0.13, W, H);
  c.strokeStyle = '#13243b'; c.lineWidth = 1;
  const t = Math.max(40, W / 22);
  for (let x = 0; x < W; x += t) { c.beginPath(); c.moveTo(x, H * 0.13); c.lineTo(x, H); c.stroke(); }
  for (let y = H * 0.13; y < H; y += t) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }

  // צל אזור סטרילי
  c.fillStyle = '#1e3a5f22'; c.fillRect(0, H * 0.13, W, H * 0.37);

  // ----- לוח טיסות (FIDS) במרכז למעלה -----
  drawFids(c);

  // ----- אזור ישיבה (כיסאות) -----
  drawSeats(c, W * 0.40, H * 0.88, 5);

  // ----- מסוע מזוודות -----
  drawCarousel(c);

  // ----- מחסום ביטחון -----
  c.fillStyle = '#475569';
  for (const w of NWALLS.map((z) => ({ x: z.nx * W, y: z.ny * H, w: z.nw * W, h: z.nh * H }))) c.fillRect(w.x, w.y, w.w, w.h);
  c.fillStyle = '#f59e0b'; c.textAlign = 'center'; c.font = `${Math.max(11, W * 0.011)}px Heebo`;
  c.fillText('▼ מעבר ביקורת ▼', W / 2, H * 0.495);
  c.fillStyle = '#94a3b8'; c.font = `${Math.max(11, W * 0.012)}px Heebo`;
  c.fillText('אזור סטרילי (Airside)', W / 2, H * 0.17);
  c.fillText('אזור ציבורי (Landside)', W / 2, H * 0.985);

  // ----- תחנות -----
  for (const z of zones) {
    const hot = near === z;
    c.fillStyle = z.color; c.strokeStyle = hot ? '#fbbf24' : '#334155'; c.lineWidth = hot ? 3 : 1.5;
    roundRect(c, z.x, z.y, z.w, z.h, 10); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.textAlign = 'center';
    c.font = `${Math.max(20, W * 0.022)}px serif`; c.fillText(z.icon, z.x + z.w / 2, z.y + z.h / 2 - 2);
    c.font = `${Math.max(11, W * 0.012)}px Heebo, sans-serif`; c.fillText(z.label, z.x + z.w / 2, z.y + z.h - 8);
  }

  // ----- נוסעי NPC -----
  for (const o of npcs) drawPerson(c, o.x, o.y, o.r || Math.max(8, W * 0.008), o.color, o.bag, tick + o.ph * 10);

  // ----- שחקן -----
  drawPerson(c, player.x, player.y, player.r, '#22d3ee', false, tick, true);
  c.fillStyle = '#e2e8f0'; c.font = `${Math.max(10, W * 0.011)}px Heebo`; c.textAlign = 'center';
  c.fillText('אתה', player.x, player.y - player.r - 5);

  // ----- גוון לפי זמן משמרת -----
  const tint = nightTint();
  if (tint) { c.fillStyle = tint; c.fillRect(0, 0, W, H); }
}

function drawPerson(c, x, y, r, color, bag, t, isPlayer) {
  c.beginPath(); c.ellipse(x, y + r * 0.7, r * 0.9, r * 0.4, 0, 0, Math.PI * 2); c.fillStyle = '#00000040'; c.fill();
  // גוף
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = color; c.fill();
  c.strokeStyle = isPlayer ? '#0e7490' : '#0008'; c.lineWidth = isPlayer ? 2 : 1; c.stroke();
  // ראש
  c.beginPath(); c.arc(x, y - r * 0.5, r * 0.5, 0, Math.PI * 2); c.fillStyle = '#f1c8a3'; c.fill();
  // מזוודה נגררת (תנודה קלה)
  if (bag) { const off = Math.sin(t * 0.15) * 1.5; c.fillStyle = '#475569'; c.fillRect(x + r, y - 1 + off, r * 0.8, r * 0.9); }
}

function drawPlane(c, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = '#cbd5e1'; c.strokeStyle = '#64748b'; c.lineWidth = 2;
  // גוף (מצביע למטה לכיוון הטרמינל)
  c.beginPath(); c.ellipse(0, 0, 16, 60, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  // כנפיים
  c.beginPath(); c.moveTo(-14, 0); c.lineTo(-80, 26); c.lineTo(-78, 36); c.lineTo(-12, 16); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(14, 0); c.lineTo(80, 26); c.lineTo(78, 36); c.lineTo(12, 16); c.closePath(); c.fill(); c.stroke();
  // מייצב אחורי
  c.beginPath(); c.moveTo(-8, -50); c.lineTo(-28, -62); c.lineTo(-26, -56); c.lineTo(-6, -46); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(8, -50); c.lineTo(28, -62); c.lineTo(26, -56); c.lineTo(6, -46); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#0ea5e9'; c.fillRect(-13, 8, 26, 8); // פס חברה
  c.restore();
}

function drawFids(c) {
  const x = W * 0.36, y = H * 0.145, w = W * 0.28, h = H * 0.075;
  c.fillStyle = '#020a14ee'; c.strokeStyle = '#0e7490'; c.lineWidth = 1.5;
  roundRect(c, x, y, w, h, 6); c.fill(); c.stroke();
  c.fillStyle = '#22d3ee'; c.textAlign = 'center'; c.font = `${Math.max(9, W * 0.0095)}px Heebo`;
  c.fillText('● לוח טיסות יוצאות (FIDS) ●', x + w / 2, y + h * 0.22);
  const rows = FLIGHTS.slice(0, 3);
  c.textAlign = 'right'; c.font = `${Math.max(8, W * 0.0085)}px monospace`;
  rows.forEach((f, i) => {
    const d = destByCode(f.dest);
    const blink = (tick % 60 < 40) || i !== 1;
    c.fillStyle = blink ? '#5eead4' : '#0f766e';
    c.fillText(`${f.code}  ${d.city}  ${f.boarding}  שער ${f.gate}`, x + w - 8, y + h * 0.45 + i * (h * 0.18));
  });
}

function drawSeats(c, x, y, n) {
  c.fillStyle = '#334155';
  for (let i = 0; i < n; i++) { const sx = x + i * (W * 0.018); c.fillRect(sx, y, W * 0.012, W * 0.012); c.fillRect(sx, y - W * 0.008, W * 0.012, W * 0.004); }
}

function drawCarousel(c) {
  const { x, y, rx, ry } = carousel;
  c.save();
  c.fillStyle = '#1e293b'; c.strokeStyle = '#475569'; c.lineWidth = 3;
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#0b1626'; c.beginPath(); c.ellipse(x, y, rx * 0.55, ry * 0.5, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#64748b'; c.textAlign = 'center'; c.font = `${Math.max(8, W * 0.008)}px Heebo`;
  c.fillText('מסוע כבודה', x, y + 3);
  for (const b of bags) {
    const bx = x + Math.cos(b.a) * rx * 0.78, by = y + Math.sin(b.a) * ry * 0.78;
    c.fillStyle = b.c; c.fillRect(bx - 6, by - 5, 12, 10); c.strokeStyle = '#0008'; c.lineWidth = 1; c.strokeRect(bx - 6, by - 5, 12, 10);
  }
  c.restore();
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
