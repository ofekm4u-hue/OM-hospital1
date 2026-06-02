// world3d.js — מנוע תלת-ממד גולמי (WebGL, ללא תלות חיצונית) לסימולטור נתב"ג.
// גוף-ראשון, אולם צ'ק-אין עם דלפקים ושילוט עברי זוהר, קשת ביטחון, חלונות לרחבה
// עם מטוסים, נוסעי NPC, תאורת יום/לילה דינמית, ערפל, ושילוב עם מערכות התפקידים.

import { enterRole } from './main.js';
import { openSettings } from './settings.js';
import { sfx } from './audio.js';
import { state } from './state.js';
import { startInterview } from './interview.js';

// ===================== מתמטיקת מטריצות (column-major) =====================
const M = {
  ident: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  persp(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2); const o = new Float32Array(16);
    o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = (2 * f * n) / (n - f); return o;
  },
  trans(x, y, z) { const o = M.ident(); o[12] = x; o[13] = y; o[14] = z; return o; },
  scale(x, y, z) { const o = M.ident(); o[0] = x; o[5] = y; o[10] = z; return o; },
  rotX(r) { const c = Math.cos(r), s = Math.sin(r); const o = M.ident(); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; },
  rotY(r) { const c = Math.cos(r), s = Math.sin(r); const o = M.ident(); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; },
};

// ===================== מצב מודול =====================
let gl, canvas, prog, loc, cubeBuf, quadBuf;
let raf = null, running = false, lastT = 0, tick = 0;
let cam = { x: 0, y: 1.65, z: 26, yaw: 0, pitch: 0 };
const keys = {};
const move = { f: 0, s: 0 };
const look = { active: false, id: null, lx: 0, ly: 0 };
const joy = { active: false, id: null, dx: 0, dy: 0 };
let scene, stations, walls, npcs, planes, palette, sceneMode = 'terminal';
let texCache = {};
let onKey, onKeyUp, onResize;

// ===================== טקסטורות פרוצדורליות =====================
function cvs(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
function texFromCanvas(c, repeat) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.generateMipmap(gl.TEXTURE_2D);
  const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return t;
}
function tileTex() {
  return texFromCanvas(cvs(256, 256, (x) => {
    x.fillStyle = '#cfd6e0'; x.fillRect(0, 0, 256, 256);
    x.fillStyle = '#c2cad6';
    for (let i = 0; i < 256; i += 64) for (let j = 0; j < 256; j += 64) if (((i + j) / 64) % 2) x.fillRect(i, j, 64, 64);
    x.strokeStyle = '#aab4c4'; x.lineWidth = 2;
    for (let i = 0; i <= 256; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
    x.fillStyle = 'rgba(255,255,255,0.10)'; x.fillRect(0, 0, 256, 30);
  }), true);
}
function asphaltTex() {
  return texFromCanvas(cvs(256, 256, (x) => {
    x.fillStyle = '#23262b'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 800; i++) { x.fillStyle = `rgba(${30 + Math.random() * 30|0},${30 + Math.random() * 30|0},${34 + Math.random() * 30|0},0.5)`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    x.strokeStyle = '#f4d03f'; x.lineWidth = 6; x.beginPath(); x.moveTo(128, 0); x.lineTo(128, 256); x.stroke();
  }), true);
}
function signTex(text, sub) {
  return texFromCanvas(cvs(512, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0a4da3'); g.addColorStop(1, '#062f66');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#7fd1ff'; x.fillRect(0, 0, w, 6);
    x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#fff'; x.font = 'bold 54px Heebo, Arial'; x.fillText(text, w / 2, h / 2 - 8);
    if (sub) { x.fillStyle = '#cde8ff'; x.font = '26px Heebo, Arial'; x.fillText(sub, w / 2, h / 2 + 34); }
  }), false);
}
function fidsTex() {
  return texFromCanvas(cvs(512, 256, (x, w, h) => {
    x.fillStyle = '#02060f'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#22d3ee'; x.font = 'bold 26px monospace'; x.textAlign = 'center'; x.fillText('● DEPARTURES · יוצאות ●', w / 2, 34);
    const rows = [['LY315', 'פריז', '08:40', 'B4'], ['LY402', 'בנגקוק', '09:15', 'C2'], ['LY008', 'ניו יורק', '10:05', 'D1'], ['LY316', 'לרנקה', '07:55', 'A7']];
    x.font = '22px monospace'; x.textAlign = 'right';
    rows.forEach((r, i) => { x.fillStyle = i === 1 ? '#fbbf24' : '#5eead4'; x.fillText(`${r[0]}   ${r[1]}   ${r[2]}   שער ${r[3]}`, w - 16, 80 + i * 40); });
  }), false);
}
function getTex(key, gen) { if (!texCache[key]) texCache[key] = gen(); return texCache[key]; }

// ===================== Shader =====================
const VS = `attribute vec3 aPos; attribute vec3 aNormal; attribute vec2 aUV;
uniform mat4 uProj,uView,uModel; varying vec3 vN,vW; varying vec2 vUV;
void main(){ vec4 w=uModel*vec4(aPos,1.0); vW=w.xyz; vN=mat3(uModel)*aNormal; vUV=aUV; gl_Position=uProj*uView*w; }`;
const FS = `precision mediump float;
varying vec3 vN,vW; varying vec2 vUV;
uniform vec3 uColor,uLightDir,uViewPos,uFog,uAmbCol; uniform float uEmissive,uSpec,uFogNear,uFogFar,uUseTex,uUVScale,uAmbient;
uniform sampler2D uTex;
uniform vec3 uPL[4]; uniform vec3 uPLc[4]; uniform float uPLon;
void main(){
  vec3 n=normalize(vN); vec3 L=normalize(uLightDir);
  vec3 base = uUseTex>0.5 ? texture2D(uTex, vUV*uUVScale).rgb : uColor;
  float diff=max(dot(n,L),0.0);
  vec3 V=normalize(uViewPos-vW); vec3 H=normalize(L+V);
  float spec=pow(max(dot(n,H),0.0),48.0)*uSpec;
  vec3 col = base*(uAmbCol*uAmbient + diff*(1.0-uAmbient)) + vec3(spec);
  if(uPLon>0.5){ for(int i=0;i<4;i++){ vec3 d=uPL[i]-vW; float dist=length(d); float att=1.0/(1.0+0.15*dist*dist); col += base*uPLc[i]*max(dot(n,normalize(d)),0.0)*att*3.0; } }
  col = mix(col, base, uEmissive);
  float dist=length(uViewPos-vW); float fog=clamp((dist-uFogNear)/(uFogFar-uFogNear),0.0,1.0);
  col = mix(col, uFog, fog);
  gl_FragColor=vec4(col,1.0);
}`;

function compile(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }

// ===================== גאומטריה =====================
function buildBuffers() {
  // קוביית יחידה -0.5..0.5 עם נורמלים ו-UV (36 קודקודים)
  const f = [
    // +X
    [[.5, -.5, -.5], [1, 0, 0], [0, 0]], [[.5, .5, -.5], [1, 0, 0], [0, 1]], [[.5, .5, .5], [1, 0, 0], [1, 1]],
    [[.5, -.5, -.5], [1, 0, 0], [0, 0]], [[.5, .5, .5], [1, 0, 0], [1, 1]], [[.5, -.5, .5], [1, 0, 0], [1, 0]],
    // -X
    [[-.5, -.5, .5], [-1, 0, 0], [0, 0]], [[-.5, .5, .5], [-1, 0, 0], [0, 1]], [[-.5, .5, -.5], [-1, 0, 0], [1, 1]],
    [[-.5, -.5, .5], [-1, 0, 0], [0, 0]], [[-.5, .5, -.5], [-1, 0, 0], [1, 1]], [[-.5, -.5, -.5], [-1, 0, 0], [1, 0]],
    // +Y
    [[-.5, .5, -.5], [0, 1, 0], [0, 0]], [[-.5, .5, .5], [0, 1, 0], [0, 1]], [[.5, .5, .5], [0, 1, 0], [1, 1]],
    [[-.5, .5, -.5], [0, 1, 0], [0, 0]], [[.5, .5, .5], [0, 1, 0], [1, 1]], [[.5, .5, -.5], [0, 1, 0], [1, 0]],
    // -Y
    [[-.5, -.5, .5], [0, -1, 0], [0, 0]], [[-.5, -.5, -.5], [0, -1, 0], [0, 1]], [[.5, -.5, -.5], [0, -1, 0], [1, 1]],
    [[-.5, -.5, .5], [0, -1, 0], [0, 0]], [[.5, -.5, -.5], [0, -1, 0], [1, 1]], [[.5, -.5, .5], [0, -1, 0], [1, 0]],
    // +Z
    [[-.5, -.5, .5], [0, 0, 1], [0, 0]], [[.5, -.5, .5], [0, 0, 1], [1, 0]], [[.5, .5, .5], [0, 0, 1], [1, 1]],
    [[-.5, -.5, .5], [0, 0, 1], [0, 0]], [[.5, .5, .5], [0, 0, 1], [1, 1]], [[-.5, .5, .5], [0, 0, 1], [0, 1]],
    // -Z
    [[.5, -.5, -.5], [0, 0, -1], [0, 0]], [[-.5, -.5, -.5], [0, 0, -1], [1, 0]], [[-.5, .5, -.5], [0, 0, -1], [1, 1]],
    [[.5, -.5, -.5], [0, 0, -1], [0, 0]], [[-.5, .5, -.5], [0, 0, -1], [1, 1]], [[.5, .5, -.5], [0, 0, -1], [0, 1]],
  ];
  const arr = [];
  for (const v of f) { arr.push(...v[0], ...v[1], ...v[2]); }
  cubeBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
}

function bindGeom() {
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuf);
  const stride = 8 * 4;
  gl.enableVertexAttribArray(loc.aPos); gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(loc.aNormal); gl.vertexAttribPointer(loc.aNormal, 3, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(loc.aUV); gl.vertexAttribPointer(loc.aUV, 2, gl.FLOAT, false, stride, 24);
}

// ציור קופסה: opt {pos,size,color,emissive,spec,tex,uv}
function drawBox(o) {
  const model = M.mul(M.trans(o.pos[0], o.pos[1], o.pos[2]), M.scale(o.size[0], o.size[1], o.size[2]));
  gl.uniformMatrix4fv(loc.uModel, false, model);
  gl.uniform3fv(loc.uColor, o.color || [1, 1, 1]);
  gl.uniform1f(loc.uEmissive, o.emissive || 0);
  gl.uniform1f(loc.uSpec, o.spec || 0);
  if (o.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, o.tex); gl.uniform1i(loc.uTex, 0); gl.uniform1f(loc.uUseTex, 1); gl.uniform1f(loc.uUVScale, o.uv || 1); }
  else gl.uniform1f(loc.uUseTex, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 36);
}

// ===================== סצנות =====================
function buildTerminal() {
  const T = getTex('tile', tileTex), A = getTex('asph', asphaltTex);
  const boxes = [];
  // רצפה (שיש מבריק)
  boxes.push({ pos: [0, -0.05, 0], size: [44, 0.1, 64], color: [.85, .87, .92], tex: T, uv: 11, spec: 0.6 });
  // תקרה
  boxes.push({ pos: [0, 10, 0], size: [44, 0.3, 64], color: [.16, .19, .25] });
  // קשתות תקרה (קורות)
  for (let z = -28; z <= 28; z += 8) boxes.push({ pos: [0, 9.4, z], size: [40, 0.5, 0.7], color: [.3, .34, .42], spec: .2 });
  // קירות צד
  boxes.push({ pos: [-22, 5, 0], size: [0.4, 10, 64], color: [.82, .8, .74] });
  boxes.push({ pos: [22, 5, 0], size: [0.4, 10, 64], color: [.82, .8, .74] });
  // קיר אחורי (כניסה)
  boxes.push({ pos: [0, 5, 32], size: [44, 10, 0.4], color: [.82, .8, .74] });
  // קיר חלונות קדמי (לרחבה) — זכוכית זוהרת
  boxes.push({ pos: [0, 6.5, -32], size: [44, 7, 0.3], color: [.5, .72, .95], emissive: .55 });
  boxes.push({ pos: [0, 1.5, -32], size: [44, 3, 0.4], color: [.3, .34, .42] });
  // רחבה מעבר לחלונות
  boxes.push({ pos: [0, -0.2, -48], size: [80, 0.2, 36], color: [.18, .2, .24], tex: A, uv: 8 });
  // ----- דלפקי צ'ק-אין (שמאל) + שילוט -----
  const dests = [['פריז', 'CDG'], ['בנגקוק', 'BKK'], ['ניו יורק', 'JFK'], ['לרנקה', 'LCA']];
  for (let i = 0; i < 4; i++) {
    const z = -6 + i * 7;
    boxes.push({ pos: [-16, 0.5, z], size: [5, 1, 2.4], color: [.3, .33, .4], spec: .3 }); // דלפק
    boxes.push({ pos: [-16, 1.15, z - 1.0], size: [5, 0.3, 0.3], color: [.7, .74, .8], spec: .5 }); // נירוסטה
    boxes.push({ pos: [-16, 4.2, z], size: [4.2, 1.3, 0.2], color: [1, 1, 1], emissive: 1, tex: signTex(dests[i][0], 'CHECK-IN ' + dests[i][1]), uv: 1 }); // שילוט
  }
  // ----- קשת ביטחון (מרכז) -----
  boxes.push({ pos: [-1.6, 1.4, 6], size: [0.5, 2.8, 0.6], color: [.75, .77, .8], spec: .4 });
  boxes.push({ pos: [1.6, 1.4, 6], size: [0.5, 2.8, 0.6], color: [.75, .77, .8], spec: .4 });
  boxes.push({ pos: [0, 3.0, 6], size: [3.7, 0.5, 0.6], color: [.2, .5, .9], emissive: .6 });
  boxes.push({ pos: [0, 3.6, 6], size: [3, 0.5, 0.2], color: [1, 1, 1], emissive: 1, tex: signTex('ביקורת ביטחון', 'SECURITY'), uv: 1 });
  // ----- לוח טיסות (FIDS) על הקיר האחורי -----
  boxes.push({ pos: [10, 5.5, 31.7], size: [9, 4, 0.2], color: [1, 1, 1], emissive: 1, tex: fidsTex(), uv: 1 });
  // ----- דלתות רחבה/מנהל (airside) -----
  boxes.push({ pos: [-19, 2, -20], size: [2.5, 4, 0.3], color: [.9, .8, .2], emissive: .3, tex: signTex('רחבה', 'RAMP'), uv: 1 });
  boxes.push({ pos: [19, 2, -20], size: [2.5, 4, 0.3], color: [.5, .3, .8], emissive: .3, tex: signTex('חדר מנהל', 'OPS'), uv: 1 });
  // ----- מסוע כבודה -----
  boxes.push({ pos: [12, 0.6, 14], size: [8, 0.4, 3.5], color: [.12, .12, .14], spec: .2 });
  boxes.push({ pos: [12, 0.95, 14], size: [7, 0.2, 2.6], color: [.2, .2, .22] });
  // ----- אזור ישיבה -----
  for (let i = 0; i < 5; i++) boxes.push({ pos: [6 + i * 1.6, 0.5, 24], size: [1.2, 1, 1.2], color: [.2, .35, .6], spec: .2 });
  // ----- מתקן הגדרות -----
  boxes.push({ pos: [16, 1, 26], size: [1.6, 2, 1.2], color: [.25, .28, .34], emissive: .15, tex: signTex('הגדרות', 'INFO'), uv: 1 });

  // קירות לקוליז'ן (footprint x,z, חצי-רוחב)
  walls = [
    [-22, 0, 0.4, 64], [22, 0, 0.4, 64], [0, 32, 44, 0.6], [0, -32, 44, 0.6],
    [-16, -6, 5, 2.6], [-16, 1, 5, 2.6], [-16, 8, 5, 2.6], [-16, 15, 5, 2.6],
    [12, 14, 8, 3.6], [16, 26, 1.8, 1.4],
  ].map(([x, z, w, d]) => ({ x, z, hw: w / 2, hd: d / 2 }));

  // תחנות אינטראקטיביות
  stations = [
    { x: -16, z: 0, role: 'checkin', label: 'דלפק צ׳ק-אין', icon: '🧑‍✈️' },
    { x: 0, z: 6, role: 'security', label: 'ביקורת ביטחון', icon: '🛡️' },
    { x: -19, z: -20, role: 'ramp', label: 'רחבה', icon: '🦺' },
    { x: 19, z: -20, role: 'manager', label: 'חדר מנהל', icon: '👔' },
    { x: 16, z: 26, role: 'settings', label: 'הגדרות', icon: '⚙️' },
  ];

  // נוסעים מתהלכים
  npcs = [];
  const cols = [[.9, .2, .2], [.2, .4, .9], [.1, .7, .4], [.95, .65, .1], [.7, .2, .8], [.1, .7, .7], [.6, .6, .65]];
  for (let i = 0; i < 14; i++) npcs.push({ x: (Math.random() - 0.5) * 30, z: 8 + Math.random() * 20, tx: 0, tz: 0, c: cols[i % cols.length], spd: 1 + Math.random() * 1.5, bag: Math.random() < .5 });
  npcs.forEach(retarget);

  // מטוסים על הרחבה
  planes = [{ x: -14, z: -44, s: 1 }, { x: 14, z: -44, s: 1 }, { x: -40, z: -50, s: 0.9, taxi: true, vx: 2.5 }];

  scene = boxes;
  cam = { x: 0, y: 1.65, z: 28, yaw: 0, pitch: 0 };
}

function buildOffice() {
  const T = getTex('tile', tileTex);
  const boxes = [];
  boxes.push({ pos: [0, -0.05, 0], size: [12, 0.1, 12], color: [.8, .82, .88], tex: T, uv: 4, spec: .5 });
  boxes.push({ pos: [0, 4, 0], size: [12, 0.3, 12], color: [.9, .9, .86] });
  boxes.push({ pos: [-6, 2, 0], size: [0.3, 4, 12], color: [.93, .9, .82] });
  boxes.push({ pos: [6, 2, 0], size: [0.3, 4, 12], color: [.93, .9, .82] });
  boxes.push({ pos: [0, 2, -6], size: [12, 4, 0.3], color: [.93, .9, .82] });
  // חלון לכביש
  boxes.push({ pos: [0, 2.5, 6], size: [12, 3, 0.2], color: [.5, .7, .95], emissive: .5 });
  // שולחן אלון + כיסאות
  boxes.push({ pos: [0, 0.75, -1.5], size: [3.4, 0.2, 1.6], color: [.45, .28, .12], spec: .3 });
  boxes.push({ pos: [0, 0.4, -1.5], size: [0.3, 0.8, 0.3], color: [.3, .2, .1] });
  boxes.push({ pos: [0, 0.9, 0.5], size: [0.8, 1, 0.8], color: [.12, .12, .14] }); // הכיסא שלך
  boxes.push({ pos: [0, 1.3, -2.6], size: [0.8, 1.4, 0.8], color: [.1, .1, .12] }); // המראיין
  boxes.push({ pos: [0, 2.05, -2.6], size: [0.5, 0.5, 0.5], color: [.92, .78, .62] }); // ראש המראיין
  boxes.push({ pos: [0, 3.3, -5.7], size: [4, 1, 0.15], color: [1, 1, 1], emissive: 1, tex: signTex('רשות שדות התעופה', 'ראיון קבלה'), uv: 1 });
  walls = [[-6, 0, .3, 12], [6, 0, .3, 12], [0, -6, 12, .3], [0, 6, 12, .3], [0, -1.5, 3.4, 1.6]].map(([x, z, w, d]) => ({ x, z, hw: w / 2, hd: d / 2 }));
  stations = []; npcs = []; planes = [];
  scene = boxes;
  cam = { x: 0, y: 1.5, z: 2.5, yaw: 0, pitch: -0.05 };
}

function retarget(n) { n.tx = (Math.random() - 0.5) * 34; n.tz = 9 + Math.random() * 20; }

// ===================== פלטת יום/לילה =====================
function setPalette() {
  const t = (state.shift && state.shift.time) || 'morning';
  const P = {
    morning: { light: [0.5, 0.8, 0.6], amb: 0.55, ambCol: [1, .96, .88], fog: [.72, .8, .9], sky: [.6, .72, .88], pl: false },
    noon: { light: [0.3, 1, 0.4], amb: 0.62, ambCol: [1, 1, 1], fog: [.8, .85, .92], sky: [.66, .78, .92], pl: false },
    evening: { light: [0.6, 0.4, -0.3], amb: 0.42, ambCol: [1, .8, .6], fog: [.5, .42, .5], sky: [.5, .38, .42], pl: true },
    night: { light: [0.2, 0.5, 0.2], amb: 0.22, ambCol: [.6, .7, .95], fog: [.05, .07, .13], sky: [.03, .05, .1], pl: true },
  };
  palette = P[t] || P.morning;
}

// ===================== אתחול =====================
export function startWorld3D(mode = 'terminal') {
  sceneMode = mode;
  const app = document.getElementById('app');
  app.innerHTML = `
    <div id="w3d-wrap" class="w3d-wrap">
      <canvas id="w3d-canvas"></canvas>
      <div class="w3d-cross">+</div>
      <div class="w3d-hud-top">
        <span id="w3d-clock">🕐</span><span id="w3d-info"></span>
      </div>
      <div id="w3d-prompt" class="w3d-prompt"></div>
      <button id="w3d-exit" class="world-exit">← יציאה</button>
      <div id="w3d-help" class="w3d-help">עכבר/גרירה = הסתכלות · WASD/ג׳ויסטיק = תנועה · E = פעולה</div>
      <div id="joystick" class="joystick"><div id="joy-stick" class="joy-stick"></div></div>
      <button id="act-btn" class="act-btn">E</button>
      ${mode === 'interview' ? '<div id="iv-host"></div>' : ''}
    </div>`;
  canvas = document.getElementById('w3d-canvas');
  gl = canvas.getContext('webgl', { antialias: true }) || canvas.getContext('experimental-webgl');
  if (!gl) { app.innerHTML = '<div style="color:#fff;padding:2rem;text-align:center">הדפדפן אינו תומך ב-WebGL. נסה דפדפן עדכני.</div>'; return; }

  prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); gl.useProgram(prog);
  loc = {};
  ['aPos', 'aNormal', 'aUV'].forEach((a) => loc[a] = gl.getAttribLocation(prog, a));
  ['uProj', 'uView', 'uModel', 'uColor', 'uEmissive', 'uSpec', 'uLightDir', 'uViewPos', 'uFog', 'uAmbCol', 'uFogNear', 'uFogFar', 'uUseTex', 'uUVScale', 'uAmbient', 'uTex', 'uPLon'].forEach((u) => loc[u] = gl.getUniformLocation(prog, u));
  loc.uPL = gl.getUniformLocation(prog, 'uPL'); loc.uPLc = gl.getUniformLocation(prog, 'uPLc');
  gl.enable(gl.DEPTH_TEST);
  texCache = {};
  buildBuffers();
  setPalette();
  if (mode === 'interview') buildOffice(); else buildTerminal();

  resize(); onResize = () => resize(); window.addEventListener('resize', onResize);
  bindInput();
  if (mode === 'interview') startInterview(document.getElementById('iv-host'), () => startWorld3D('terminal'));

  running = true; lastT = performance.now(); loop();
}

export function stopWorld3D() {
  running = false; if (raf) cancelAnimationFrame(raf);
  window.removeEventListener('resize', onResize);
  window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp);
  if (document.pointerLockElement) document.exitPointerLock();
}

function resize() {
  const wrap = document.getElementById('w3d-wrap'); if (!wrap) return;
  canvas.width = wrap.clientWidth; canvas.height = wrap.clientHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
}

// ===================== קלט =====================
function bindInput() {
  onKey = (e) => { keys[e.key.toLowerCase()] = true; if (e.key.toLowerCase() === 'e') tryEnter(); };
  onKeyUp = (e) => { keys[e.key.toLowerCase()] = false; };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('click', () => { if (canvas.requestPointerLock) canvas.requestPointerLock(); });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) { cam.yaw -= e.movementX * 0.0025; cam.pitch -= e.movementY * 0.0025; clampPitch(); }
  });
  // מגע: חצי שמאל = ג'ויסטיק, חצי ימין = הסתכלות
  const wrap = document.getElementById('w3d-wrap');
  wrap.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) { if (t.clientX < window.innerWidth / 2) { joy.active = true; joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; } else { look.active = true; look.id = t.identifier; look.lx = t.clientX; look.ly = t.clientY; } } }, { passive: true });
  wrap.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (joy.active && t.identifier === joy.id) { joy.dx = Math.max(-1, Math.min(1, (t.clientX - joy.ox) / 50)); joy.dy = Math.max(-1, Math.min(1, (t.clientY - joy.oy) / 50)); }
      if (look.active && t.identifier === look.id) { cam.yaw -= (t.clientX - look.lx) * 0.005; cam.pitch -= (t.clientY - look.ly) * 0.005; clampPitch(); look.lx = t.clientX; look.ly = t.clientY; }
    }
  }, { passive: true });
  wrap.addEventListener('touchend', (e) => { for (const t of e.changedTouches) { if (t.identifier === joy.id) { joy.active = false; joy.dx = joy.dy = 0; } if (t.identifier === look.id) look.active = false; } });
  document.getElementById('act-btn').addEventListener('click', tryEnter);
  document.getElementById('w3d-exit').addEventListener('click', () => { stopWorld3D(); enterRole('__lobby__'); });
}
function clampPitch() { cam.pitch = Math.max(-1.3, Math.min(1.3, cam.pitch)); }

let nearStation = null;
function tryEnter() {
  if (!nearStation) return;
  sfx('beep');
  if (nearStation.role === 'settings') { openSettings(); return; }
  stopWorld3D(); enterRole(nearStation.role);
}

// ===================== עדכון =====================
function update(dt) {
  let f = 0, s = 0;
  if (keys['w'] || keys['arrowup']) f += 1;
  if (keys['s'] || keys['arrowdown']) f -= 1;
  if (keys['d'] || keys['arrowright']) s += 1;
  if (keys['a'] || keys['arrowleft']) s -= 1;
  f -= joy.dy; s += joy.dx;
  const fwd = [-Math.sin(cam.yaw), -Math.cos(cam.yaw)];
  const right = [Math.cos(cam.yaw), -Math.sin(cam.yaw)];
  const spd = 4.5 * dt;
  let nx = cam.x + (fwd[0] * f + right[0] * s) * spd;
  let nz = cam.z + (fwd[1] * f + right[1] * s) * spd;
  // קוליז'ן
  const r = 0.4;
  for (const w of walls) {
    const cx = Math.max(w.x - w.hw, Math.min(nx, w.x + w.hw));
    const cz = Math.max(w.z - w.hd, Math.min(nz, w.z + w.hd));
    const dx = nx - cx, dz = nz - cz, d = Math.hypot(dx, dz);
    if (d < r) { if (d === 0) { nx = w.x + (w.hw + r); } else { nx = cx + (dx / d) * r; nz = cz + (dz / d) * r; } }
  }
  cam.x = Math.max(-21, Math.min(21, nx)); cam.z = Math.max(-31, Math.min(31, nz));

  // NPCs
  for (const n of npcs) { const dx = n.tx - n.x, dz = n.tz - n.z, d = Math.hypot(dx, dz); if (d < 0.6) retarget(n); else { n.x += (dx / d) * n.spd * dt; n.z += (dz / d) * n.spd * dt; } }
  for (const p of planes) if (p.taxi) { p.x += p.vx * dt; if (p.x > 45) p.x = -45; }

  // תחנה קרובה
  nearStation = null; let best = 3.2;
  for (const st of stations) { const d = Math.hypot(st.x - cam.x, st.z - cam.z); if (d < best) { best = d; nearStation = st; } }
  const prompt = document.getElementById('w3d-prompt');
  if (prompt) { prompt.textContent = nearStation ? `${nearStation.icon} ${nearStation.label} — לחץ E / כפתור` : ''; prompt.classList.toggle('on', !!nearStation); }
  const act = document.getElementById('act-btn'); if (act) act.classList.toggle('ready', !!nearStation);
}

// ===================== ציור =====================
function render() {
  gl.clearColor(palette.sky[0], palette.sky[1], palette.sky[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const proj = M.persp(1.15, canvas.width / canvas.height, 0.1, 200);
  const view = M.mul(M.mul(M.rotX(-cam.pitch), M.rotY(-cam.yaw)), M.trans(-cam.x, -cam.y, -cam.z));
  gl.uniformMatrix4fv(loc.uProj, false, proj);
  gl.uniformMatrix4fv(loc.uView, false, view);
  gl.uniform3fv(loc.uLightDir, palette.light);
  gl.uniform1f(loc.uAmbient, palette.amb);
  gl.uniform3fv(loc.uAmbCol, palette.ambCol);
  gl.uniform3fv(loc.uViewPos, [cam.x, cam.y, cam.z]);
  gl.uniform3fv(loc.uFog, palette.fog);
  gl.uniform1f(loc.uFogNear, 25); gl.uniform1f(loc.uFogFar, 90);
  // תאורת נקודה (לילה/ערב) — מנורות מסלול/תקרה
  if (palette.pl) {
    gl.uniform1f(loc.uPLon, 1);
    gl.uniform3fv(loc.uPL, new Float32Array([0, 8, -10, -14, 1, -44, 14, 1, -44, 0, 8, 18]));
    gl.uniform3fv(loc.uPLc, new Float32Array([.3, .4, .8, .2, .9, .3, .9, .2, .2, .8, .7, .4]));
  } else gl.uniform1f(loc.uPLon, 0);

  bindGeom();
  for (const b of scene) drawBox(b);
  // NPCs (גוף + ראש)
  for (const n of npcs) {
    drawBox({ pos: [n.x, 0.85, n.z], size: [0.55, 1.7, 0.35], color: n.c });
    drawBox({ pos: [n.x, 1.85, n.z], size: [0.42, 0.42, 0.42], color: [.92, .78, .62] });
    if (n.bag) drawBox({ pos: [n.x + 0.5, 0.45, n.z], size: [0.35, 0.5, 0.3], color: [.3, .3, .34] });
  }
  // מטוסים
  for (const p of planes) drawPlane(p);
}

function drawPlane(p) {
  const c = [.86, .88, .92];
  drawBox({ pos: [p.x, 3, p.z], size: [3, 3, 16 * p.s], color: c, spec: .3 }); // גוף
  drawBox({ pos: [p.x, 3, p.z + 2], size: [20 * p.s, 0.5, 3], color: c, spec: .3 }); // כנפיים
  drawBox({ pos: [p.x, 4.5, p.z - 6 * p.s], size: [0.4, 3, 2.4], color: [.2, .5, .9], emissive: .3 }); // מייצב
  drawBox({ pos: [p.x, 3, p.z + 8 * p.s], size: [2.4, 2.4, 1], color: [.1, .55, .85], emissive: .2 }); // חרטום/פס
}

function loop() {
  if (!running) return;
  if (!document.getElementById('w3d-canvas')) { running = false; return; }
  const now = performance.now(); const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; tick++;
  update(dt); render();
  const clk = document.getElementById('w3d-clock'); const info = document.getElementById('w3d-info');
  if (clk) clk.textContent = '🕐 ' + ((state.shift && state.shift.time === 'night') ? 'לילה' : (state.shift && state.shift.time) === 'evening' ? 'ערב' : 'יום');
  if (info) info.textContent = sceneMode === 'interview' ? ' · ראיון קבלה' : ' · טרמינל 3';
  raf = requestAnimationFrame(loop);
}
