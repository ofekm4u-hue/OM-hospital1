// world3d.js — מנוע תלת-ממד גולמי (WebGL) ברמת High-Fidelity לסימולטור נתב"ג.
// חומרים מבוססי roughness/metalness (ספקולר+פרנל), מפת צללים רכים (PCF),
// תקרת קשת + קורות, קיר זכוכית + שמיים, ספוטלייטים, נוסעים הומנואידים + טרולי.
// גוף-ראשון (עכבר/מקלדת + מגע). מתחבר למערכות התפקידים כ"מסך מחשב".

import { enterRole } from './main.js';
import { openSettings } from './settings.js';
import { sfx } from './audio.js';
import { state } from './state.js';
import { startInterview } from './interview.js';

// ===================== מטריצות (column-major) =====================
const M = {
  ident: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; },
  mulAll(...m) { return m.reduce((a, b) => M.mul(a, b)); },
  persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = (2 * f * n) / (n - f); return o; },
  ortho(l, r, b, t, n, f) { const o = new Float32Array(16); o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n); o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); o[15] = 1; return o; },
  trans(x, y, z) { const o = M.ident(); o[12] = x; o[13] = y; o[14] = z; return o; },
  scale(x, y, z) { const o = M.ident(); o[0] = x; o[5] = y; o[10] = z; return o; },
  rotX(r) { const c = Math.cos(r), s = Math.sin(r), o = M.ident(); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; },
  rotY(r) { const c = Math.cos(r), s = Math.sin(r), o = M.ident(); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; },
  rotZ(r) { const c = Math.cos(r), s = Math.sin(r), o = M.ident(); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o; },
  lookAt(e, c, up) {
    const z = norm([e[0] - c[0], e[1] - c[1], e[2] - c[2]]);
    const x = norm(cross(up, z)); const y = cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]);
  },
};
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

// ===================== מצב =====================
let gl, canvas, prog, dprog, loc, dloc;
let meshes = {}; // {cube,sphere,cyl}
let raf = null, running = false, lastT = 0;
let cam = { x: 0, y: 1.65, z: 26, yaw: 0, pitch: 0 };
const keys = {}; const look = { active: false, id: null, lx: 0, ly: 0 }; const joy = { active: false, id: null, dx: 0, dy: 0, ox: 0, oy: 0 };
let scene, stations, walls, npcs, planes, cars, palette, sceneMode = 'terminal';
let texCache = {}; let shadowFBO, shadowTex, lightVP;
let onKey, onKeyUp, onResize, nearStation = null;
const SHADOW_SIZE = 1024;

// ===================== טקסטורות =====================
function cvs(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
const isPOT = (n) => (n & (n - 1)) === 0;
function texFromCanvas(c, repeat) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  const pot = isPOT(c.width) && isPOT(c.height);
  if (pot) {
    gl.generateMipmap(gl.TEXTURE_2D);
    const w = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  } else { // NPOT — חובה CLAMP + ללא mipmap, אחרת הטקסטורה "לא שלמה" ומרונדרת שחור
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return t;
}
function marbleTex() {
  return texFromCanvas(cvs(512, 512, (x) => {
    x.fillStyle = '#eef1f5'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(150,160,175,${0.05 + Math.random() * 0.12})`; x.lineWidth = 1 + Math.random() * 2; x.beginPath(); let px = Math.random() * 512, py = Math.random() * 512; x.moveTo(px, py); for (let j = 0; j < 6; j++) { px += (Math.random() - 0.5) * 120; py += (Math.random() - 0.5) * 120; x.lineTo(px, py); } x.stroke(); }
    x.strokeStyle = 'rgba(150,160,175,0.5)'; x.lineWidth = 2;
    for (let i = 0; i <= 512; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
  }), true);
}
function asphaltTex() {
  return texFromCanvas(cvs(256, 256, (x) => { x.fillStyle = '#23262b'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 600; i++) { x.fillStyle = `rgba(${40 + Math.random() * 30 | 0},${40 + Math.random() * 30 | 0},${44 + Math.random() * 30 | 0},0.6)`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); } }), true);
}
function skyTex() {
  return texFromCanvas(cvs(16, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); const t = (state.shift && state.shift.time) || 'morning'; if (t === 'night') { g.addColorStop(0, '#0a0f2a'); g.addColorStop(1, '#1a2550'); } else if (t === 'evening') { g.addColorStop(0, '#243a6b'); g.addColorStop(.6, '#c96b3a'); g.addColorStop(1, '#f0a868'); } else { g.addColorStop(0, '#4a86d6'); g.addColorStop(1, '#bfe0f5'); } x.fillStyle = g; x.fillRect(0, 0, w, h); }), false);
}
// שילוט עברי — מתוקן RTL ולא הפוך (flipX מתקן את ההיפוך על פאת המצלמה)
function signTex(text, sub, bg1, bg2, flip) {
  return texFromCanvas(cvs(512, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, bg1 || '#0a4da3'); g.addColorStop(1, bg2 || '#062f66'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#7fd1ff'; x.fillRect(0, 0, w, 10);
    if (flip) { x.translate(w, 0); x.scale(-1, 1); }
    x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#fff'; x.font = '900 60px Heebo, Arial'; x.fillText(text, w / 2, h / 2 - 10);
    if (sub) { x.fillStyle = '#cfe8ff'; x.font = '600 30px Heebo, Arial'; x.fillText(sub, w / 2, h / 2 + 40); }
  }), false);
}
function fidsTex() {
  return texFromCanvas(cvs(1024, 512, (x, w, h) => {
    x.fillStyle = '#02060f'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#0a1830'; x.fillRect(0, 0, w, 70);
    x.fillStyle = '#22d3ee'; x.font = '900 44px Heebo,monospace'; x.textAlign = 'center'; x.direction = 'rtl'; x.fillText('טיסות יוצאות · DEPARTURES', w / 2, 48);
    const head = ['טיסה', 'יעד', 'המראה', 'סטטוס']; const xs = [880, 620, 360, 140];
    x.font = '700 30px Heebo,monospace'; x.fillStyle = '#7dd3fc'; head.forEach((t, i) => x.fillText(t, xs[i], 110));
    const rows = [['LY315', 'פריז', '08:40', 'צ׳ק-אין'], ['LY402', 'בנגקוק', '09:15', 'בורדינג'], ['LY008', 'ניו יורק', '10:05', 'צ׳ק-אין'], ['LY221', 'לונדון', '11:20', 'מעוכבת'], ['LY316', 'לרנקה', '07:55', 'יצא']];
    x.font = '600 30px Heebo,monospace';
    rows.forEach((r, i) => { const y = 165 + i * 62; x.fillStyle = i % 2 ? '#0a1422' : '#0d1a2e'; x.fillRect(20, y - 38, w - 40, 54); r.forEach((cell, j) => { x.fillStyle = j === 3 ? (cell === 'בורדינג' ? '#34d399' : cell === 'מעוכבת' ? '#f87171' : cell === 'יצא' ? '#94a3b8' : '#fbbf24') : '#e2e8f0'; x.fillText(cell, xs[j], y); }); });
  }), false);
}
const getTex = (k, gen) => (texCache[k] || (texCache[k] = gen()));

// ===================== Shaders =====================
const VS = `attribute vec3 aPos,aNormal; attribute vec2 aUV;
uniform mat4 uProj,uView,uModel,uLightVP; varying vec3 vN,vW; varying vec2 vUV; varying vec4 vLS;
void main(){ vec4 w=uModel*vec4(aPos,1.0); vW=w.xyz; vN=normalize(mat3(uModel)*aNormal); vUV=aUV; vLS=uLightVP*w; gl_Position=uProj*uView*w; }`;
const FS = `precision highp float;
varying vec3 vN,vW; varying vec2 vUV; varying vec4 vLS;
uniform vec3 uColor,uLightDir,uLightCol,uViewPos,uFog,uAmbCol;
uniform float uEmissive,uRough,uMetal,uOpacity,uFogNear,uFogFar,uUseTex,uUVScale,uAmbient,uShadowOn,uFlipU;
uniform sampler2D uTex,uShadowTex;
uniform vec3 uSpotPos[4],uSpotDir[4],uSpotCol[4];
float unpack(vec4 c){ return dot(c, vec4(1.0,1.0/255.0,1.0/65025.0,1.0/16581375.0)); }
float shadow(){
  vec3 p=vLS.xyz/vLS.w*0.5+0.5;
  if(p.z>1.0||p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0) return 1.0;
  float cur=p.z-0.003; float s=0.0; float tx=1.0/${SHADOW_SIZE}.0;
  for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++){ float d=unpack(texture2D(uShadowTex,p.xy+vec2(float(i),float(j))*tx)); s+= cur<=d?1.0:0.0; }
  return mix(0.45,1.0,s/9.0);
}
void main(){
  vec3 n=normalize(vN); vec3 L=normalize(uLightDir); vec3 V=normalize(uViewPos-vW);
  vec2 uv=vUV; if(uFlipU>0.5) uv.x=1.0-uv.x;
  vec3 base = uUseTex>0.5 ? texture2D(uTex, uv*uUVScale).rgb : uColor;
  float shininess = mix(8.0,140.0,1.0-uRough);
  float specK = mix(0.04,1.0,uMetal)*(1.0-uRough*0.7);
  float sh = uShadowOn>0.5 ? shadow() : 1.0;
  float diff=max(dot(n,L),0.0)*sh;
  vec3 H=normalize(L+V); float spec=pow(max(dot(n,H),0.0),shininess)*specK*sh;
  vec3 col = base*(uAmbCol*uAmbient) + base*uLightCol*diff + uLightCol*spec;
  // ספוטלייטים
  for(int i=0;i<4;i++){
    vec3 d=uSpotPos[i]-vW; float dist=length(d); vec3 sd=normalize(d);
    float c=dot(-sd,normalize(uSpotDir[i]));
    float cone=smoothstep(0.86,0.95,c); float att=cone/(1.0+0.06*dist*dist);
    float sdiff=max(dot(n,sd),0.0);
    vec3 sH=normalize(sd+V); float sspec=pow(max(dot(n,sH),0.0),shininess)*specK;
    col += uSpotCol[i]*att*(base*sdiff + sspec)*1.3;
  }
  // פרנל (זכוכית/מתכת)
  float fres=pow(1.0-max(dot(n,V),0.0),3.0);
  col += fres*specK*uLightCol*0.4;
  col = mix(col, base, uEmissive);
  float dist=length(uViewPos-vW); float fog=clamp((dist-uFogNear)/(uFogFar-uFogNear),0.0,1.0);
  col = mix(col, uFog, fog*0.85);
  // Tone-mapping למשטחים מוארים (מונע הצפת לבן ברצפת השיש), שילוט אמיסיב נשאר מלא
  vec3 mapped = col/(col+vec3(0.8));
  col = mix(mapped, col, step(0.5,uEmissive));
  gl_FragColor=vec4(col, uOpacity);
}`;
// shader עומק לצללים (packing)
const DVS = `attribute vec3 aPos; uniform mat4 uLightVP,uModel; void main(){ gl_Position=uLightVP*uModel*vec4(aPos,1.0); }`;
const DFS = `precision highp float; vec4 pack(float d){ vec4 c=fract(d*vec4(1.0,255.0,65025.0,16581375.0)); c-=c.yzww*vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0); return c; } void main(){ gl_FragColor=pack(gl_FragCoord.z); }`;

function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
function link(vs, fs) { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; }

// ===================== גאומטריה =====================
function packMesh(verts) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW); return { buf: b, count: verts.length / 8 }; }
function buildMeshes() {
  // cube
  const F = [[[.5, -.5, -.5], [1, 0, 0]], [[.5, .5, -.5], [1, 0, 0]], [[.5, .5, .5], [1, 0, 0]], [[.5, -.5, -.5], [1, 0, 0]], [[.5, .5, .5], [1, 0, 0]], [[.5, -.5, .5], [1, 0, 0]],
  [[-.5, -.5, .5], [-1, 0, 0]], [[-.5, .5, .5], [-1, 0, 0]], [[-.5, .5, -.5], [-1, 0, 0]], [[-.5, -.5, .5], [-1, 0, 0]], [[-.5, .5, -.5], [-1, 0, 0]], [[-.5, -.5, -.5], [-1, 0, 0]],
  [[-.5, .5, -.5], [0, 1, 0]], [[-.5, .5, .5], [0, 1, 0]], [[.5, .5, .5], [0, 1, 0]], [[-.5, .5, -.5], [0, 1, 0]], [[.5, .5, .5], [0, 1, 0]], [[.5, .5, -.5], [0, 1, 0]],
  [[-.5, -.5, .5], [0, -1, 0]], [[-.5, -.5, -.5], [0, -1, 0]], [[.5, -.5, -.5], [0, -1, 0]], [[-.5, -.5, .5], [0, -1, 0]], [[.5, -.5, -.5], [0, -1, 0]], [[.5, -.5, .5], [0, -1, 0]],
  [[-.5, -.5, .5], [0, 0, 1]], [[.5, -.5, .5], [0, 0, 1]], [[.5, .5, .5], [0, 0, 1]], [[-.5, -.5, .5], [0, 0, 1]], [[.5, .5, .5], [0, 0, 1]], [[-.5, .5, .5], [0, 0, 1]],
  [[.5, -.5, -.5], [0, 0, -1]], [[-.5, -.5, -.5], [0, 0, -1]], [[-.5, .5, -.5], [0, 0, -1]], [[.5, -.5, -.5], [0, 0, -1]], [[-.5, .5, -.5], [0, 0, -1]], [[.5, .5, -.5], [0, 0, -1]]];
  const cv = []; F.forEach((v, i) => { const u = [(i % 6 < 3) ? 0 : 1, (i % 2)]; cv.push(...v[0], ...v[1], (v[0][0] + .5), (v[0][1] + .5)); });
  meshes.cube = packMesh(cv);
  // sphere
  const sv = []; const La = 12, Lo = 16;
  for (let i = 0; i < La; i++) for (let j = 0; j < Lo; j++) {
    const verts = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j], [i + 1, j + 1], [i, j + 1]];
    for (const [a, b] of verts) { const th = a / La * Math.PI, ph = b / Lo * 2 * Math.PI; const x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph); sv.push(x * .5, y * .5, z * .5, x, y, z, b / Lo, a / La); }
  }
  meshes.sphere = packMesh(sv);
  // cylinder (ציר Y, רדיוס .5, גובה 1)
  const cy = []; const R = 14;
  for (let i = 0; i < R; i++) {
    const a0 = i / R * 2 * Math.PI, a1 = (i + 1) / R * 2 * Math.PI; const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    // side
    cy.push(c0 * .5, -.5, s0 * .5, c0, 0, s0, i / R, 0); cy.push(c1 * .5, -.5, s1 * .5, c1, 0, s1, (i + 1) / R, 0); cy.push(c1 * .5, .5, s1 * .5, c1, 0, s1, (i + 1) / R, 1);
    cy.push(c0 * .5, -.5, s0 * .5, c0, 0, s0, i / R, 0); cy.push(c1 * .5, .5, s1 * .5, c1, 0, s1, (i + 1) / R, 1); cy.push(c0 * .5, .5, s0 * .5, c0, 0, s0, i / R, 1);
    // caps
    cy.push(0, .5, 0, 0, 1, 0, .5, .5); cy.push(c0 * .5, .5, s0 * .5, 0, 1, 0, 0, 0); cy.push(c1 * .5, .5, s1 * .5, 0, 1, 0, 1, 0);
    cy.push(0, -.5, 0, 0, -1, 0, .5, .5); cy.push(c1 * .5, -.5, s1 * .5, 0, -1, 0, 1, 0); cy.push(c0 * .5, -.5, s0 * .5, 0, -1, 0, 0, 0);
  }
  meshes.cyl = packMesh(cy);
}

function bindMesh(m, program, attribs) {
  gl.bindBuffer(gl.ARRAY_BUFFER, m.buf); const stride = 32;
  gl.enableVertexAttribArray(attribs.aPos); gl.vertexAttribPointer(attribs.aPos, 3, gl.FLOAT, false, stride, 0);
  if (attribs.aNormal != null && attribs.aNormal >= 0) { gl.enableVertexAttribArray(attribs.aNormal); gl.vertexAttribPointer(attribs.aNormal, 3, gl.FLOAT, false, stride, 12); }
  if (attribs.aUV != null && attribs.aUV >= 0) { gl.enableVertexAttribArray(attribs.aUV); gl.vertexAttribPointer(attribs.aUV, 2, gl.FLOAT, false, stride, 24); }
}

function modelMat(o) {
  let m = M.trans(o.pos[0], o.pos[1], o.pos[2]);
  if (o.rot) m = M.mulAll(m, M.rotY(o.rot[1] || 0), M.rotX(o.rot[0] || 0), M.rotZ(o.rot[2] || 0));
  return M.mul(m, M.scale(o.size[0], o.size[1], o.size[2]));
}

function drawObj(o, depthPass) {
  const mesh = meshes[o.mesh || 'cube'];
  const model = modelMat(o);
  if (depthPass) { gl.uniformMatrix4fv(dloc.uModel, false, model); bindMesh(mesh, dprog, { aPos: dloc.aPos }); gl.drawArrays(gl.TRIANGLES, 0, mesh.count); return; }
  gl.uniformMatrix4fv(loc.uModel, false, model);
  gl.uniform3fv(loc.uColor, o.color || [1, 1, 1]);
  gl.uniform1f(loc.uEmissive, o.emissive || 0);
  gl.uniform1f(loc.uRough, o.rough == null ? 0.7 : o.rough);
  gl.uniform1f(loc.uMetal, o.metal || 0);
  gl.uniform1f(loc.uOpacity, o.opacity == null ? 1 : o.opacity);
  gl.uniform1f(loc.uFlipU, o.flipU ? 1 : 0);
  if (o.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, o.tex); gl.uniform1i(loc.uTex, 0); gl.uniform1f(loc.uUseTex, 1); gl.uniform1f(loc.uUVScale, o.uv || 1); }
  else gl.uniform1f(loc.uUseTex, 0);
  bindMesh(mesh, prog, { aPos: loc.aPos, aNormal: loc.aNormal, aUV: loc.aUV });
  gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
}

// ===================== סצנות =====================
function buildTerminal() {
  const marble = getTex('marble', marbleTex), asph = getTex('asph', asphaltTex), sky = getTex('sky', skyTex);
  const o = []; scene = o;
  // שמיים (קופסה ענקית מסביב, אמיסיב)
  o.push({ pos: [0, 20, 0], size: [240, 120, 240], color: [1, 1, 1], emissive: 1, tex: sky, uv: 1, mesh: 'cube' });
  // רצפת שיש מבריקה
  o.push({ pos: [0, -0.05, 0], size: [46, 0.1, 66], color: [.93, .94, .97], tex: marble, uv: 6, rough: 0.12, metal: 0.1 });
  // קירות צד + אחורי
  o.push({ pos: [22.5, 6, 0], size: [0.5, 12, 66], color: [.9, .88, .82], rough: .9 });
  o.push({ pos: [0, 6, 33], size: [46, 12, 0.5], color: [.9, .88, .82], rough: .9 });
  // קיר זכוכית שמאלי (Curtain Wall): פרופילי אלומיניום + זכוכית
  for (let z = -30; z <= 30; z += 5) o.push({ pos: [-22.4, 6, z], size: [0.3, 12, 0.3], color: [.7, .72, .76], rough: .3, metal: .8 }); // מולים אנכיים
  for (let y = 1; y <= 11; y += 5) o.push({ pos: [-22.4, y, 0], size: [0.25, 0.25, 66], color: [.7, .72, .76], rough: .3, metal: .8 }); // מולים אופקיים
  o.push({ pos: [-22.3, 6.5, 0], size: [0.12, 11, 65], color: [.6, .8, .95], rough: .05, metal: .2, opacity: 0.32, glass: true });
  // כביש חיצוני (מעבר לזכוכית)
  o.push({ pos: [-30, -0.3, 0], size: [16, 0.2, 80], color: [.2, .22, .25], tex: asph, uv: 6, rough: .9 });
  // רחבת מטוסים (מימין/קדמי)
  o.push({ pos: [0, -0.25, -52], size: [120, 0.2, 44], color: [.2, .22, .26], tex: asph, uv: 10, rough: .9 });
  // ----- תקרת קשת + קורות -----
  buildArch(o);
  // ----- דלפקי צ'ק-אין + חומרה + שילוט -----
  const dests = [['פריז', 'CDG', '#0a4da3'], ['בנגקוק', 'BKK', '#7c3aed'], ['ניו יורק', 'JFK', '#0f766e'], ['לרנקה', 'LCA', '#b45309']];
  for (let i = 0; i < 4; i++) {
    const z = -7 + i * 7, X = -17;
    o.push({ pos: [X, 0.45, z], size: [5.4, 0.9, 2.2], color: [.22, .24, .29], rough: .8 }); // בסיס פלסטיק
    o.push({ pos: [X, 0.96, z], size: [5.4, 0.12, 2.2], color: [.8, .82, .86], rough: .2, metal: .8 }); // נירוסטה
    o.push({ pos: [X - 0.6, 1.25, z + 0.4], size: [0.7, 0.5, 0.05], color: [.05, .05, .06], rough: .3 }); // מסך מחשב
    o.push({ pos: [X - 0.6, 1.0, z + 0.7], size: [0.5, 0.05, 0.2], color: [.1, .1, .12], rough: .6 }); // מקלדת
    o.push({ pos: [X + 0.8, 1.0, z + 0.6], size: [0.4, 0.08, 0.5], color: [.15, .15, .18], rough: .5 }); // סורק דרכונים
    o.push({ pos: [X, 4.6, z], size: [4.6, 1.2, 0.18], color: [1, 1, 1], emissive: 1, tex: signTex(dests[i][0], 'CHECK-IN · ' + dests[i][1], dests[i][2], '#04122e', true), uv: 1, flipU: false }); // שילוט תלוי
    o.push({ pos: [X, 5.3, z], size: [0.08, 0.6, 0.08], color: [.5, .5, .5], metal: .7 }); // מתלה
  }
  // ----- קשת ביטחון (כחול נתב"ג + ניאון) -----
  o.push({ pos: [-1.7, 1.4, 7], size: [0.5, 2.8, 0.7], color: [.1, .25, .6], rough: .25, metal: .7 });
  o.push({ pos: [1.7, 1.4, 7], size: [0.5, 2.8, 0.7], color: [.1, .25, .6], rough: .25, metal: .7 });
  o.push({ pos: [0, 3.0, 7], size: [4.4, 0.55, 0.7], color: [.12, .4, .95], emissive: .5 });
  o.push({ pos: [0, 3.7, 7], size: [3.2, 0.6, 0.12], color: [1, 1, 1], emissive: 1, tex: signTex('הכניסה למטוס', 'SECURITY', '#0a4da3', '#04122e', true), uv: 1 });
  // ----- לוח FIDS ענק תלוי על קורות -----
  o.push({ pos: [9, 6.2, 32.6], size: [12, 5, 0.25], color: [1, 1, 1], emissive: 1, tex: fidsTex(), uv: 1, flipU: true });
  o.push({ pos: [5, 8.8, 32.4], size: [0.1, 2, 0.1], color: [.5, .5, .5], metal: .7 }); o.push({ pos: [13, 8.8, 32.4], size: [0.1, 2, 0.1], color: [.5, .5, .5], metal: .7 });
  // ----- דלתות airside -----
  o.push({ pos: [-19, 2.1, -22], size: [2.6, 4.2, 0.3], color: [.85, .7, .15], emissive: .25, tex: signTex('רחבה', 'RAMP', '#7a5b00', '#3a2a00', true), uv: 1 });
  o.push({ pos: [19, 2.1, -22], size: [2.6, 4.2, 0.3], color: [.45, .25, .7], emissive: .25, tex: signTex('חדר מנהל', 'OPS', '#3b1a66', '#1a0a33', true), uv: 1 });
  // ----- מסוע כבודה -----
  o.push({ pos: [13, 0.55, 16], size: [9, 0.5, 3.4], color: [.1, .1, .12], rough: .7 });
  o.push({ pos: [13, 0.9, 16], size: [8, 0.18, 2.6], color: [.16, .16, .18], rough: .5 });
  // ----- מתקן הגדרות -----
  o.push({ pos: [17, 1.1, 27], size: [1.6, 2.2, 1.2], color: [.2, .22, .28], emissive: .12, tex: signTex('הגדרות', 'INFO', '#1e293b', '#0b1220', true), uv: 1 });

  walls = [[22.5, 0, .5, 66], [0, 33, 46, .5], [0, -33, 46, .5], [-22.4, 0, .4, 66],
  [-17, -7, 5.4, 2.2], [-17, 0, 5.4, 2.2], [-17, 7, 5.4, 2.2], [-17, 14, 5.4, 2.2], [13, 16, 9, 3.4], [17, 27, 1.8, 1.4]].map(([x, z, w, d]) => ({ x, z, hw: w / 2, hd: d / 2 }));
  stations = [
    { x: -17, z: 0, role: 'checkin', label: 'דלפק צ׳ק-אין', icon: '🧑‍✈️' },
    { x: 0, z: 7, role: 'security', label: 'ביקורת ביטחון', icon: '🛡️' },
    { x: -19, z: -22, role: 'ramp', label: 'רחבה', icon: '🦺' },
    { x: 19, z: -22, role: 'manager', label: 'חדר מנהל', icon: '👔' },
    { x: 17, z: 27, role: 'settings', label: 'הגדרות', icon: '⚙️' },
  ];
  // נוסעים + טרולי
  npcs = []; const cols = [[.15, .2, .5], [.1, .1, .12], [.85, .85, .88], [.4, .42, .48], [.5, .12, .15], [.12, .4, .35], [.3, .25, .5]];
  for (let i = 0; i < 10; i++) npcs.push({ x: (Math.random() - .5) * 30, z: 9 + Math.random() * 20, tx: 0, tz: 0, c: cols[i % cols.length], skin: [.92 - Math.random() * .25, .76 - Math.random() * .2, .6 - Math.random() * .15], spd: .9 + Math.random(), bag: Math.random() < .6, ph: Math.random() * 6 });
  npcs.forEach(retarget);
  planes = [{ x: -16, z: -50, s: 1 }, { x: 16, z: -50, s: 1 }];
  cars = [{ z: -40, x: -30, v: 6 }, { z: 30, x: -30, v: -5 }];
  cam = { x: 0, y: 1.65, z: 29, yaw: 0, pitch: 0 };
}

function buildArch(o) {
  // קשת תקרה חלולה מקטעי לוחות + קורות מתכת (צילינדרים)
  const segs = 12, span = 46, baseY = 9, rise = 4;
  for (let i = 0; i < segs; i++) {
    const a0 = i / segs * Math.PI, a1 = (i + 1) / segs * Math.PI;
    const x0 = -span / 2 + (span) * (i / segs), x1 = -span / 2 + span * ((i + 1) / segs);
    const y0 = baseY + Math.sin(a0) * rise, y1 = baseY + Math.sin(a1) * rise;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
    o.push({ pos: [mx, my, 0], size: [len, 0.4, 66], rot: [0, 0, ang], color: [.86, .87, .9], rough: .6 });
  }
  // קורות תמיכה מטאליות (צילינדרים לרוחב)
  for (let z = -28; z <= 28; z += 7) {
    o.push({ pos: [0, baseY + rise + 0.3, z], size: [0.25, span, 0.25], rot: [0, 0, Math.PI / 2], color: [.7, .72, .76], rough: .35, metal: .8, mesh: 'cyl' });
    o.push({ pos: [0, baseY + 1.5, z], size: [0.12, 4, 0.12], color: [.65, .67, .7], metal: .7, mesh: 'cyl' });
  }
}

function buildOffice() {
  const marble = getTex('marble', marbleTex), sky = getTex('sky', skyTex);
  const o = []; scene = o;
  o.push({ pos: [0, 8, 0], size: [80, 50, 80], color: [1, 1, 1], emissive: 1, tex: sky, uv: 1 });
  o.push({ pos: [0, -0.05, 0], size: [13, 0.1, 13], color: [.93, .94, .97], tex: marble, uv: 3, rough: .12, metal: .1 });
  o.push({ pos: [0, 4.5, 0], size: [13, 0.3, 13], color: [.95, .93, .88], rough: .9 });
  o.push({ pos: [-6.5, 2.25, 0], size: [0.3, 4.5, 13], color: [.94, .91, .84], rough: .9 });
  o.push({ pos: [0, 2.25, -6.5], size: [13, 4.5, 0.3], color: [.94, .91, .84], rough: .9 });
  o.push({ pos: [6.5, 2.5, 0], size: [0.2, 3.2, 10], color: [.6, .8, .95], opacity: .35, rough: .05, glass: true });
  // שולחן אלון + רגליים
  o.push({ pos: [0, 0.78, -1.6], size: [3.6, 0.16, 1.7], color: [.42, .26, .12], rough: .35, metal: .05 });
  [[-1.6, -2.3], [1.6, -2.3], [-1.6, -0.9], [1.6, -0.9]].forEach(([x, z]) => o.push({ pos: [x, 0.4, z], size: [0.12, 0.8, 0.12], color: [.3, .2, .1], mesh: 'cyl' }));
  // כיסא שלך + מראיין
  o.push({ pos: [0, 0.5, 1.0], size: [0.9, 1, 0.9], color: [.08, .08, .1], rough: .6 });
  o.push({ pos: [0, 1.0, 1.0], size: [0.9, 1.2, 0.2], color: [.08, .08, .1], rough: .6 });
  npcHuman(o, 0, -2.9, [.1, .15, .35], [.92, .76, .6], 0); // המראיין יושב/עומד
  o.push({ pos: [0, 3.4, -6.3], size: [4.5, 1.1, 0.15], color: [1, 1, 1], emissive: 1, tex: signTex('רשות שדות התעופה', 'ראיון קבלה', '#0a4da3', '#04122e', true), uv: 1 });
  walls = [[-6.5, 0, .3, 13], [6.5, 0, .3, 13], [0, -6.5, 13, .3], [0, 6.5, 13, .3], [0, -1.6, 3.6, 1.7]].map(([x, z, w, d]) => ({ x, z, hw: w / 2, hd: d / 2 }));
  stations = []; npcs = []; planes = []; cars = [];
  cam = { x: 0, y: 1.5, z: 3, yaw: 0, pitch: -0.05 };
}

// דמות הומנואידית (ראש כדור, גוף צילינדר, גפיים)
function npcHuman(list, x, z, c, skin, t) {
  const sway = Math.sin(t) * 0.12;
  list.push({ pos: [x, 0.95, z], size: [0.62, 1.0, 0.42], color: c, rough: .8, mesh: 'cyl' });    // גוף
  list.push({ pos: [x, 1.75, z], size: [0.34, 0.34, 0.34], color: skin, rough: .6, mesh: 'sphere' }); // ראש
  list.push({ pos: [x - 0.38, 1.0, z], size: [0.16, 0.8, 0.16], color: c, rough: .8, mesh: 'cyl', rot: [sway, 0, 0] });  // יד
  list.push({ pos: [x + 0.38, 1.0, z], size: [0.16, 0.8, 0.16], color: c, rough: .8, mesh: 'cyl', rot: [-sway, 0, 0] });
  list.push({ pos: [x - 0.16, 0.3, z], size: [0.18, 0.7, 0.18], color: [.15, .15, .2], rough: .8, mesh: 'cyl', rot: [-sway, 0, 0] }); // רגל
  list.push({ pos: [x + 0.16, 0.3, z], size: [0.18, 0.7, 0.18], color: [.15, .15, .2], rough: .8, mesh: 'cyl', rot: [sway, 0, 0] });
}
function trolley(list, x, z, col) {
  list.push({ pos: [x, 0.5, z], size: [0.5, 0.9, 0.32], color: col || [.25, .25, .3], rough: .5 }); // גוף מזוודה
  list.push({ pos: [x, 1.05, z], size: [0.06, 0.5, 0.06], color: [.7, .72, .76], metal: .8, mesh: 'cyl' }); // ידית
  list.push({ pos: [x, 1.3, z], size: [0.3, 0.06, 0.06], color: [.7, .72, .76], metal: .8, mesh: 'cyl', rot: [0, 0, Math.PI / 2] });
  list.push({ pos: [x - 0.18, 0.06, z], size: [0.1, 0.1, 0.1], color: [.05, .05, .06], mesh: 'cyl', rot: [Math.PI / 2, 0, 0] });
  list.push({ pos: [x + 0.18, 0.06, z], size: [0.1, 0.1, 0.1], color: [.05, .05, .06], mesh: 'cyl', rot: [Math.PI / 2, 0, 0] });
}
function retarget(n) { n.tx = (Math.random() - .5) * 34; n.tz = 10 + Math.random() * 20; }

// ===================== פלטה =====================
function setPalette() {
  const t = (state.shift && state.shift.time) || 'morning';
  const P = {
    morning: { light: [-0.5, 0.7, 0.3], lcol: [1, .96, .9], amb: .42, ambCol: [.9, .92, 1], fog: [.78, .85, .93], pl: false },
    noon: { light: [-0.3, 1, 0.2], lcol: [1, 1, .98], amb: .5, ambCol: [.95, .96, 1], fog: [.82, .88, .95], pl: false },
    evening: { light: [-0.7, 0.35, 0.2], lcol: [1, .72, .45], amb: .32, ambCol: [.8, .7, .8], fog: [.45, .4, .5], pl: true },
    night: { light: [-0.3, 0.6, 0.2], lcol: [.5, .6, .85], amb: .18, ambCol: [.4, .5, .8], fog: [.04, .06, .12], pl: true },
  };
  palette = P[t] || P.morning;
}

// ===================== Init =====================
export function startWorld3D(mode = 'terminal') {
  sceneMode = mode;
  const app = document.getElementById('app');
  app.innerHTML = `
    <div id="w3d-wrap" class="w3d-wrap">
      <canvas id="w3d-canvas"></canvas>
      <div class="w3d-cross">+</div>
      <div class="w3d-hud-top"><span id="w3d-clock">🕐</span><span id="w3d-info"></span></div>
      <div id="w3d-prompt" class="w3d-prompt"></div>
      <button id="w3d-exit" class="world-exit">← יציאה</button>
      <div id="w3d-help" class="w3d-help">עכבר/גרירה = מבט · WASD/ג׳ויסטיק = תנועה · E = פעולה</div>
      <div id="joystick" class="joystick"><div id="joy-stick" class="joy-stick"></div></div>
      <button id="act-btn" class="act-btn">E</button>
      ${mode === 'interview' ? '<div id="iv-host"></div>' : ''}
    </div>`;
  canvas = document.getElementById('w3d-canvas');
  gl = canvas.getContext('webgl', { antialias: true }) || canvas.getContext('experimental-webgl');
  if (!gl) { app.innerHTML = '<div style="color:#fff;padding:2rem;text-align:center">הדפדפן אינו תומך ב-WebGL.</div>'; return; }
  prog = link(VS, FS); dprog = link(DVS, DFS);
  loc = {}; ['aPos', 'aNormal', 'aUV'].forEach((a) => loc[a] = gl.getAttribLocation(prog, a));
  ['uProj', 'uView', 'uModel', 'uLightVP', 'uColor', 'uEmissive', 'uRough', 'uMetal', 'uOpacity', 'uLightDir', 'uLightCol', 'uViewPos', 'uFog', 'uAmbCol', 'uFogNear', 'uFogFar', 'uUseTex', 'uUVScale', 'uAmbient', 'uTex', 'uShadowTex', 'uShadowOn', 'uFlipU'].forEach((u) => loc[u] = gl.getUniformLocation(prog, u));
  loc.uSpotPos = gl.getUniformLocation(prog, 'uSpotPos[0]'); loc.uSpotDir = gl.getUniformLocation(prog, 'uSpotDir[0]'); loc.uSpotCol = gl.getUniformLocation(prog, 'uSpotCol[0]');
  dloc = { aPos: gl.getAttribLocation(dprog, 'aPos'), uLightVP: gl.getUniformLocation(dprog, 'uLightVP'), uModel: gl.getUniformLocation(dprog, 'uModel') };
  gl.enable(gl.DEPTH_TEST);
  texCache = {}; buildMeshes(); setPalette(); setupShadow();
  if (mode === 'interview') buildOffice(); else buildTerminal();
  resize(); onResize = () => resize(); window.addEventListener('resize', onResize);
  bindInput();
  if (mode === 'interview') startInterview(document.getElementById('iv-host'), () => startWorld3D('terminal'));
  running = true; lastT = performance.now(); loop();
}
export function stopWorld3D() {
  running = false; if (raf) cancelAnimationFrame(raf);
  window.removeEventListener('resize', onResize); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp);
  if (document.pointerLockElement) document.exitPointerLock();
}
function setupShadow() {
  shadowTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, shadowTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SHADOW_SIZE, SHADOW_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  shadowFBO = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFBO);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, shadowTex, 0);
  const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, SHADOW_SIZE, SHADOW_SIZE);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
function resize() { const w = document.getElementById('w3d-wrap'); if (!w) return; canvas.width = w.clientWidth; canvas.height = w.clientHeight; }

// ===================== קלט =====================
function bindInput() {
  onKey = (e) => { keys[e.key.toLowerCase()] = true; if (e.key.toLowerCase() === 'e') tryEnter(); }; onKeyUp = (e) => { keys[e.key.toLowerCase()] = false; };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('click', () => { if (canvas.requestPointerLock) canvas.requestPointerLock(); });
  document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === canvas) { cam.yaw -= e.movementX * 0.0025; cam.pitch -= e.movementY * 0.0025; clampP(); } });
  const wrap = document.getElementById('w3d-wrap');
  wrap.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) { if (t.clientX < window.innerWidth / 2) { joy.active = true; joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; } else { look.active = true; look.id = t.identifier; look.lx = t.clientX; look.ly = t.clientY; } } }, { passive: true });
  wrap.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) { if (joy.active && t.identifier === joy.id) { joy.dx = Math.max(-1, Math.min(1, (t.clientX - joy.ox) / 50)); joy.dy = Math.max(-1, Math.min(1, (t.clientY - joy.oy) / 50)); } if (look.active && t.identifier === look.id) { cam.yaw -= (t.clientX - look.lx) * 0.005; cam.pitch -= (t.clientY - look.ly) * 0.005; clampP(); look.lx = t.clientX; look.ly = t.clientY; } } }, { passive: true });
  wrap.addEventListener('touchend', (e) => { for (const t of e.changedTouches) { if (t.identifier === joy.id) { joy.active = false; joy.dx = joy.dy = 0; } if (t.identifier === look.id) look.active = false; } });
  document.getElementById('act-btn').addEventListener('click', tryEnter);
  document.getElementById('w3d-exit').addEventListener('click', () => { stopWorld3D(); enterRole('__lobby__'); });
}
function clampP() { cam.pitch = Math.max(-1.3, Math.min(1.3, cam.pitch)); }
function tryEnter() { if (!nearStation) return; sfx('beep'); if (nearStation.role === 'settings') { openSettings(); return; } stopWorld3D(); enterRole(nearStation.role); }

// ===================== עדכון =====================
function update(dt) {
  let f = 0, s = 0;
  if (keys['w'] || keys['arrowup']) f += 1; if (keys['s'] || keys['arrowdown']) f -= 1;
  if (keys['d'] || keys['arrowright']) s += 1; if (keys['a'] || keys['arrowleft']) s -= 1;
  f -= joy.dy; s += joy.dx;
  const fwd = [-Math.sin(cam.yaw), -Math.cos(cam.yaw)], right = [Math.cos(cam.yaw), -Math.sin(cam.yaw)], spd = 4.6 * dt;
  let nx = cam.x + (fwd[0] * f + right[0] * s) * spd, nz = cam.z + (fwd[1] * f + right[1] * s) * spd;
  const r = 0.4;
  for (const w of walls) { const cx = Math.max(w.x - w.hw, Math.min(nx, w.x + w.hw)), cz = Math.max(w.z - w.hd, Math.min(nz, w.z + w.hd)); const dx = nx - cx, dz = nz - cz, d = Math.hypot(dx, dz); if (d < r) { if (d === 0) nx = w.x + w.hw + r; else { nx = cx + dx / d * r; nz = cz + dz / d * r; } } }
  cam.x = Math.max(-21.5, Math.min(21.5, nx)); cam.z = Math.max(-31.5, Math.min(31.5, nz));
  for (const n of npcs) { const dx = n.tx - n.x, dz = n.tz - n.z, d = Math.hypot(dx, dz); if (d < .6) retarget(n); else { n.x += dx / d * n.spd * dt; n.z += dz / d * n.spd * dt; } n.ph += dt * 6; }
  for (const c of cars) { c.z += c.v * dt; if (c.z > 42) c.z = -42; if (c.z < -42) c.z = 42; }
  nearStation = null; let best = 3.4;
  for (const st of stations) { const d = Math.hypot(st.x - cam.x, st.z - cam.z); if (d < best) { best = d; nearStation = st; } }
  const pr = document.getElementById('w3d-prompt'); if (pr) { pr.textContent = nearStation ? `${nearStation.icon} ${nearStation.label} — לחץ E / כפתור` : ''; pr.classList.toggle('on', !!nearStation); }
  const act = document.getElementById('act-btn'); if (act) act.classList.toggle('ready', !!nearStation);
}

// אוסף את כל האובייקטים הדינמיים (נוסעים+טרולי+מטוסים+מכוניות) לציור
function dynamicObjs() {
  const d = [];
  for (const n of npcs) { npcHuman(d, n.x, n.z, n.c, n.skin, n.ph); if (n.bag) trolley(d, n.x + 0.55, n.z, [.2, .2, .26]); }
  for (const p of planes) { d.push({ pos: [p.x, 3, p.z], size: [3.2, 3.2, 18 * p.s], color: [.9, .92, .95], rough: .3, metal: .3, mesh: 'cyl', rot: [Math.PI / 2, 0, 0] }); d.push({ pos: [p.x, 3, p.z + 2], size: [22 * p.s, 0.4, 3], color: [.88, .9, .93], rough: .3 }); d.push({ pos: [p.x, 5, p.z - 7 * p.s], size: [0.4, 3.4, 2.6], color: [.15, .45, .85], emissive: .25 }); }
  for (const c of cars) { d.push({ pos: [c.x, 0.5, c.z], size: [1.8, 1.0, 4], color: [Math.random() < .5 ? .7 : .2, .2, .2], rough: .3, metal: .4 }); d.push({ pos: [c.x, 1.1, c.z - 0.3], size: [1.6, 0.7, 2], color: [.2, .25, .3], rough: .2 }); }
  return d;
}

// ===================== Render =====================
function render() {
  const dyn = dynamicObjs();
  // ---- מעבר צללים (מבט מהשמש) ----
  const c = [0, 2, -2], dist = 55; const lp = [c[0] - palette.light[0] * dist, c[1] - palette.light[1] * dist, c[2] - palette.light[2] * dist];
  lightVP = M.mul(M.ortho(-42, 42, -42, 42, 1, 130), M.lookAt(lp, c, [0, 1, 0]));
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFBO); gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
  gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(dprog); gl.uniformMatrix4fv(dloc.uLightVP, false, lightVP);
  for (const o of scene) if (!o.glass && !o.emissive) drawObj(o, true);
  for (const o of dyn) drawObj(o, true);

  // ---- מעבר עיקרי ----
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(palette.fog[0], palette.fog[1], palette.fog[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(prog);
  const proj = M.persp(1.1, canvas.width / canvas.height, 0.1, 300);
  const view = M.mulAll(M.rotX(-cam.pitch), M.rotY(-cam.yaw), M.trans(-cam.x, -cam.y, -cam.z));
  gl.uniformMatrix4fv(loc.uProj, false, proj); gl.uniformMatrix4fv(loc.uView, false, view); gl.uniformMatrix4fv(loc.uLightVP, false, lightVP);
  gl.uniform3fv(loc.uLightDir, palette.light); gl.uniform3fv(loc.uLightCol, palette.lcol);
  gl.uniform1f(loc.uAmbient, palette.amb); gl.uniform3fv(loc.uAmbCol, palette.ambCol);
  gl.uniform3fv(loc.uViewPos, [cam.x, cam.y, cam.z]); gl.uniform3fv(loc.uFog, palette.fog);
  gl.uniform1f(loc.uFogNear, 28); gl.uniform1f(loc.uFogFar, 110); gl.uniform1f(loc.uShadowOn, 1);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, shadowTex); gl.uniform1i(loc.uShadowTex, 1);
  // ספוטלייטים מעל הדלפקים והמרכז
  const sp = [[-17, 5.5, -7], [-17, 5.5, 7], [0, 8, 0], [13, 5, 16]];
  gl.uniform3fv(loc.uSpotPos, new Float32Array(sp.flat()));
  gl.uniform3fv(loc.uSpotDir, new Float32Array([0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0]));
  const sc = palette.pl ? [1, .92, .72] : [.28, .27, .22];
  gl.uniform3fv(loc.uSpotCol, new Float32Array([...sc, ...sc, ...sc, ...sc]));

  // אטומים
  gl.disable(gl.BLEND); gl.depthMask(true);
  for (const o of scene) if (!o.glass) drawObj(o, false);
  for (const o of dyn) drawObj(o, false);
  // זכוכית (שקוף, ללא כתיבת עומק)
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
  for (const o of scene) if (o.glass) drawObj(o, false);
  gl.depthMask(true); gl.disable(gl.BLEND);
}

function loop() {
  if (!running) return; if (!document.getElementById('w3d-canvas')) { running = false; return; }
  const now = performance.now(), dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
  update(dt); render();
  const clk = document.getElementById('w3d-clock'), info = document.getElementById('w3d-info');
  if (clk) clk.textContent = '🕐 ' + ((state.shift && state.shift.time) === 'night' ? 'לילה' : (state.shift && state.shift.time) === 'evening' ? 'ערב' : 'יום');
  if (info) info.textContent = sceneMode === 'interview' ? ' · ראיון קבלה' : ' · טרמינל 3 · נתב"ג';
  raf = requestAnimationFrame(loop);
}
