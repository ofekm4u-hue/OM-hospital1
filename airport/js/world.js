// world.js — עולם הליכה עליון (Top-Down) של הטרמינל, בסגנון משחק.
// השחקן זז עם מקלדת (WASD/חיצים) או ג'ויסטיק מגע, חוצה את הביקורת הביטחונית,
// ומגיע לתחנות אינטראקטיביות שמפעילות את מערכות התפקידים.

import { openSettings } from './settings.js';
import { enterRole } from './main.js';
import { sfx } from './audio.js';

let raf = null, running = false;
const keys = {};
const joy = { active: false, dx: 0, dy: 0, id: null };
let player, zones, walls, W, H, near = null;
let canvas, cctx;
let onKeyDown, onKeyUp, onResize;

const NZONES = [
  { nx: 0.07, ny: 0.14, nw: 0.20, nh: 0.12, role: 'ramp',     label: 'דלפק רחבה',  icon: '🦺', color: '#0c3a1f' },
  { nx: 0.40, ny: 0.40, nw: 0.20, nh: 0.10, role: 'security', label: 'ביקורת ביטחון', icon: '🛡️', color: '#3a2a08' },
  { nx: 0.72, ny: 0.14, nw: 0.20, nh: 0.12, role: 'manager',  label: 'חדר מנהל',   icon: '👔', color: '#1a0e2e' },
  { nx: 0.10, ny: 0.70, nw: 0.26, nh: 0.13, role: 'checkin',  label: "דלפק צ׳ק-אין", icon: '🧑‍✈️', color: '#0a2342' },
  { nx: 0.70, ny: 0.72, nw: 0.18, nh: 0.11, role: 'settings', label: 'הגדרות',     icon: '⚙️', color: '#1e293b' },
];
const NWALLS = [
  { nx: 0.00, ny: 0.49, nw: 0.38, nh: 0.025 }, // מחסום ביטחון שמאל
  { nx: 0.62, ny: 0.49, nw: 0.38, nh: 0.025 }, // מחסום ביטחון ימין (פער במרכז)
];

export function startWorld() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div id="world-wrap" class="world-wrap">
      <canvas id="world-canvas"></canvas>
      <div class="world-hud">
        <div class="world-title">🛫 טרמינל נתב"ג — מצב הליכה</div>
        <div class="world-hint">זוז עם מקלדת (WASD/חיצים) או הג׳ויסטיק. גש לתחנה ולחץ <b>E</b> / כפתור "היכנס".</div>
      </div>
      <button id="world-exit" class="world-exit">← יציאה ללובי</button>
      <div id="near-label" class="near-label"></div>
      <div id="joystick" class="joystick"><div id="joy-stick" class="joy-stick"></div></div>
      <button id="act-btn" class="act-btn">היכנס</button>
    </div>`;

  canvas = document.getElementById('world-canvas');
  cctx = canvas.getContext('2d');
  layout();

  onResize = () => layout();
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
  if (!player) player = { x: W * 0.5, y: H * 0.9, r: Math.max(11, W * 0.012), dir: -Math.PI / 2 };
  else { player.x = Math.min(player.x, W - 20); player.y = Math.min(player.y, H - 20); player.r = Math.max(11, W * 0.012); }
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
  // קלט
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

  // קרבה לתחנה
  near = null;
  for (const z of zones) {
    const inX = player.x > z.x - 30 && player.x < z.x + z.w + 30;
    const inY = player.y > z.y - 30 && player.y < z.y + z.h + 30;
    if (inX && inY) { near = z; break; }
  }
  const nl = document.getElementById('near-label');
  if (nl) nl.textContent = near ? `${near.icon} ${near.label} — לחץ E / "היכנס"` : '';
  const act = document.getElementById('act-btn');
  if (act) act.classList.toggle('ready', !!near);

  draw();
  raf = requestAnimationFrame(loop);
}

function draw() {
  const c = cctx;
  // רצפה
  c.fillStyle = '#0b1626'; c.fillRect(0, 0, W, H);
  // אריחי רצפה
  c.strokeStyle = '#13243b'; c.lineWidth = 1;
  const t = Math.max(40, W / 22);
  for (let x = 0; x < W; x += t) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 0; y < H; y += t) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }

  // תוויות אזורים (Landside/Airside)
  c.fillStyle = '#1e3a5f33'; c.fillRect(0, 0, W, H * 0.49);
  c.fillStyle = '#94a3b8'; c.font = `${Math.max(12, W * 0.013)}px Heebo, sans-serif`; c.textAlign = 'center';
  c.fillText('אזור סטרילי (Airside) — שערים, רחבה, ניהול', W / 2, H * 0.06);
  c.fillText('אזור ציבורי (Landside) — כניסה וצ׳ק-אין', W / 2, H * 0.97);

  // מחסום ביטחון
  c.fillStyle = '#475569';
  for (const w of walls) { c.fillRect(w.x, w.y, w.w, w.h); }
  c.fillStyle = '#f59e0b'; c.font = `${Math.max(11, W * 0.011)}px Heebo`;
  c.fillText('▼ מעבר ביקורת ▼', W / 2, H * 0.47);

  // תחנות
  for (const z of zones) {
    const hot = near === z;
    c.fillStyle = z.color; c.strokeStyle = hot ? '#fbbf24' : '#334155'; c.lineWidth = hot ? 3 : 1.5;
    roundRect(c, z.x, z.y, z.w, z.h, 10); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.textAlign = 'center';
    c.font = `${Math.max(20, W * 0.022)}px serif`;
    c.fillText(z.icon, z.x + z.w / 2, z.y + z.h / 2 - 2);
    c.font = `${Math.max(11, W * 0.012)}px Heebo, sans-serif`;
    c.fillText(z.label, z.x + z.w / 2, z.y + z.h - 8);
  }

  // שחקן
  const p = player;
  c.beginPath(); c.arc(p.x, p.y + 3, p.r, 0, Math.PI * 2); c.fillStyle = '#00000055'; c.fill(); // צל
  c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fillStyle = '#22d3ee'; c.fill();
  c.strokeStyle = '#0e7490'; c.lineWidth = 2; c.stroke();
  // כיוון
  c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + Math.cos(p.dir) * p.r, p.y + Math.sin(p.dir) * p.r); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
  c.fillStyle = '#e2e8f0'; c.font = `${Math.max(10, W * 0.011)}px Heebo`; c.textAlign = 'center';
  c.fillText('אתה', p.x, p.y - p.r - 4);
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
