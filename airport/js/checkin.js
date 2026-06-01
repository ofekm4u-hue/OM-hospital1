// checkin.js — תפקיד דייל קרקע: מסוף קבלה מלא בסגנון Altea/Amadeus.
// השחקן קורא את המסמכים שהנוסע מגיש (בצד ימין) ומקליד/בוחר בעצמו את כל הנתונים
// במסוף (בצד שמאל): איתור הזמנה, פרטי דרכון, פרטי טיסה, ויזה, כבודה, הושבה ושירות,
// והנפקת תג + כרטיס. בסיום עוברים לשלב הגייט/בורדינג.

import {
  state, startClock, adjustQueue, adjustReputation, addFine, addFee,
} from './state.js';
import { buildQueue, generatePassenger, evaluateApproval } from './passenger.js';
import { createAvatarSVG, applyStress, bodyLanguageTag } from './avatar.js';
import { askPassenger } from './dialogue.js';
import { setupVoice, isVoiceSupported } from './voice.js';
import { openSettings } from './settings.js';
import {
  statusBarHtml, renderStatusBar, toast, pushBubble, clearBubbles, renderBubbles,
  printSlip, escapeHtml,
} from './ui.js';
import { startGate } from './gate.js';
import {
  RULES, QUESTION_BANK, DOC_TYPES, CABIN_CLASSES, SSR_CODES, MEAL_OPTIONS, DESTINATIONS,
} from './data.js';
import { rollScenarios } from './scenarios.js';

let TARGET = 6;
let handled = 0;

// קנס עם מכפיל קושי
function fine(text, amount) { addFine(text, Math.round(amount * state.fineMult)); }

const STAGES = [
  { id: 'pnr',    label: 'איתור הזמנה', code: 'F1' },
  { id: 'doc',    label: 'פרטי מסמך',  code: 'F2' },
  { id: 'flight', label: 'פרטי טיסה',  code: 'F3' },
  { id: 'visa',   label: 'אשרת כניסה', code: 'F4' },
  { id: 'special', label: 'טיפול מיוחד', code: 'F5' },
  { id: 'bag',    label: 'כבודה',      code: 'F6' },
  { id: 'seat',   label: 'הושבה ושירות', code: 'F7' },
  { id: 'issue',  label: 'הנפקה',      code: 'F9' },
];

export function startCheckin(caseCount = 6) {
  TARGET = caseCount;
  handled = 0;
  state.queue = [];
  for (let i = 0; i < TARGET; i++) state.queue.push(prepCase(generatePassenger()));
  renderGame();
  startClock();
  loadNextPassenger();
}

const FF_TIERS = ['ללא מועדון', 'ללא מועדון', 'Silver', 'Gold', 'Platinum'];
function recordLocator() { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
function typoName(name) { // משבש מעט את השם (להתאמת שם בכרטיס)
  const a = name.split(''); const i = 1 + Math.floor(Math.random() * (a.length - 2));
  if (a[i] === ' ') return name + 'י';
  a[i] = ''; return a.join('');
}

// מוסיף לנוסע נתוני-מקור להקלדה (ויזה, ת. לידה), מזהים רשמיים, וסיטואציות.
function prepCase(p) {
  p.dob = `${String(((p.id * 7) % 28) + 1).padStart(2, '0')}/${String(((p.id * 3) % 12) + 1).padStart(2, '0')}/${2026 - p.age}`;
  p.visaNum = p.hasVisa && p.dest.requiresVisa ? `V${Math.floor(1e7 + Math.random() * 8e7)}` : null;
  p.pnr = recordLocator();
  p.eticket = `114-${Math.floor(1e9 + Math.random() * 8e9)}`;
  p.ffTier = FF_TIERS[Math.floor(Math.random() * FF_TIERS.length)];
  p.seq = String(p.id).padStart(3, '0');
  p.scenarios = rollScenarios(p);
  p.ticketName = p.scenarios.some((s) => s.id === 'name_mismatch') ? typoName(p.name) : p.name;
  p.entry = { done: {}, fields: {} };
  return p;
}

function logLine(text, cls = '') {
  const log = document.getElementById('term-log');
  if (!log) return;
  const line = document.createElement('div');
  line.className = `log-line ${cls}`;
  line.textContent = `>> ${text}`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function renderGame() {
  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="h-full flex flex-col">
    ${statusBarHtml('עמדת צ׳ק-אין · דלפק 4 · ALTEA·HE')}
    <div class="flex-1 grid grid-cols-5 gap-3 p-3 overflow-hidden">
      <!-- צד ימין: הנוסע + המסמכים שהוא מגיש -->
      <section class="col-span-2 flex flex-col bg-[#0e1726] rounded-xl border border-slate-700 overflow-hidden">
        <div class="px-4 py-2 bg-slate-800/60 text-slate-300 text-sm font-semibold border-b border-slate-700 flex justify-between">
          <span>הנוסע מולך</span><span class="text-slate-500 text-xs">הקלד מתוך המסמכים ←</span>
        </div>
        <div class="flex-1 flex flex-col p-3 overflow-y-auto">
          <div class="flex gap-3 items-start">
            <div class="relative">
              <div id="avatar-frame" class="avatar-frame w-24 h-28 rounded-xl border-2 overflow-hidden bg-black"></div>
              <div id="body-tag" class="body-tag"></div>
            </div>
            <div id="paper-docs" class="flex-1"></div>
          </div>
          <div id="chat-box" class="chat-box mt-2" style="min-height:5rem;max-height:9rem"></div>
          <div id="interim" class="text-xs text-slate-500 h-4 px-1"></div>
          <div class="flex gap-2 mt-1">
            <button id="mic-btn" class="mic-btn" title="דבר אל הנוסע">🎙️<span class="mic-label">דבר</span></button>
            <input id="ask-input" type="text" placeholder="הקלד שאלה חופשית לנוסע..." class="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
            <button id="ask-send" class="btn-primary px-4">שלח</button>
          </div>
          <button id="q-bank" class="btn-ghost mt-1 text-sm">📋 בנק שאלות מעמיק</button>
        </div>
      </section>

      <!-- צד שמאל: מסוף הקלדת נתונים -->
      <section class="col-span-3 flex flex-col bg-[#03142b] rounded-xl border border-cyan-900/60 overflow-hidden terminal">
        <div class="terminal-header"><span>מערכת קבלה לטיסה — ALTEA·HE</span><span id="term-flag" class="text-cyan-500">● מקוון</span></div>
        <div class="stage-tabs" id="stage-tabs"></div>
        <div class="flex-1 grid grid-rows-[auto_1fr] overflow-hidden">
          <div id="term-log" class="term-log"></div>
          <div id="stage-body" class="term-body"></div>
        </div>
        <div id="term-decision" class="term-decision"></div>
        <div id="printer-tray" class="printer-tray"></div>
      </section>
    </div>
  </div>`;

  document.getElementById('sb-settings').addEventListener('click', () => openSettings());
  const input = document.getElementById('ask-input');
  const send = () => { const t = input.value.trim(); if (!t) return; input.value = ''; handleQuestion(t); };
  document.getElementById('ask-send').addEventListener('click', send);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  document.getElementById('q-bank').addEventListener('click', toggleQuestionBank);
  setupVoice({ button: document.getElementById('mic-btn'), interimEl: document.getElementById('interim'), onFinal: (t) => handleQuestion(t) });
  if (!isVoiceSupported()) document.getElementById('interim').textContent = 'זיהוי קולי לא נתמך — אפשר להקליד';
  renderStatusBar();
}

function loadNextPassenger() {
  clearBubbles();
  if (state.queue.length === 0) return finishCheckin();
  const p = state.queue.shift();
  state.current = p;
  p.entry = { done: {}, fields: {} };

  const frame = document.getElementById('avatar-frame');
  frame.innerHTML = createAvatarSVG(p.seed, p.gender);
  applyStress(frame, p.stress);
  document.getElementById('body-tag').textContent = bodyLanguageTag(p.stress);
  renderPaperDocs(p);
  pushBubble('passenger', greeting(p));
  document.getElementById('term-log').innerHTML = '';
  logLine(`נוסע חדש בדלפק · נא לאתר הזמנה (F1)`);
  renderTabs();
  setStage('pnr');
  renderDecision();
}

function greeting(p) {
  if (p.status === 'nervous') return 'שלום... אני קצת לחוץ, הנה הדרכון והכרטיס שלי.';
  if (p.status === 'smuggler') return 'היי, אפשר לעשות צ׳ק-אין מהר? הנה המסמכים.';
  return 'בוקר טוב! הנה הדרכון וזימון הטיסה שלי.';
}

// ---- מסמכים פיזיים שהנוסע מגיש (מקור הקלדה) ----
function renderPaperDocs(p) {
  const visaDoc = p.dest.requiresVisa
    ? (p.hasVisa
        ? `<div class="paper visa-paper"><div class="paper-h">אשרת כניסה · VISA · ${escapeHtml(p.dest.country)}</div><div class="paper-row"><span>מס׳ ויזה</span><b>${p.visaNum}</b></div></div>`
        : `<div class="paper visa-missing">⚠ הנוסע אינו מגיש אשרת כניסה ל${escapeHtml(p.dest.country)}</div>`)
    : '';
  document.getElementById('paper-docs').innerHTML = `
    <div class="paper passport-paper">
      <div class="paper-h">דרכון · PASSPORT</div>
      <div class="paper-row"><span>שם מלא</span><b>${escapeHtml(p.name)}</b></div>
      <div class="paper-row"><span>שם משפחה</span><b>${escapeHtml(p.last)}</b></div>
      <div class="paper-row"><span>מס׳ דרכון</span><b class="ltr">${p.passport.number}</b></div>
      <div class="paper-row"><span>בתוקף עד</span><b class="ltr">${p.passport.expiry}</b></div>
      <div class="paper-row"><span>אזרחות</span><b>${escapeHtml(p.origin)}</b></div>
    </div>
    <div class="paper ticket-paper">
      <div class="paper-h">כרטיס אלקטרוני · E-TICKET</div>
      <div class="paper-row"><span>שם בכרטיס</span><b>${escapeHtml(p.ticketName)}</b></div>
      <div class="paper-row"><span>קוד הזמנה</span><b class="ltr">${p.pnr}</b></div>
      <div class="paper-row"><span>מס׳ כרטיס</span><b class="ltr">${p.eticket}</b></div>
      <div class="paper-row"><span>טיסה</span><b class="ltr">${p.flight.code}</b></div>
      <div class="paper-row"><span>יעד</span><b>${escapeHtml(p.dest.city)} (${p.dest.code})</b></div>
      ${p.ffTier !== 'ללא מועדון' ? `<div class="paper-row"><span>מועדון</span><b>${p.ffTier}</b></div>` : ''}
    </div>
    ${visaDoc}`;
}

// ---- טאבים של השלבים ----
function renderTabs() {
  const p = state.current;
  const tabs = document.getElementById('stage-tabs');
  tabs.innerHTML = STAGES
    .filter((s) => (s.id !== 'visa' || p.dest.requiresVisa) && (s.id !== 'special' || p.scenarios.length))
    .map((s) => {
      const done = p.entry.done[s.id];
      const enabled = stageEnabled(s.id, p);
      return `<button class="stage-tab ${done ? 'done' : ''}" data-stage="${s.id}" ${enabled ? '' : 'disabled'}>
        <span class="tab-code">${s.code}</span>${s.label}${done ? ' ✓' : ''}</button>`;
    }).join('');
  tabs.querySelectorAll('.stage-tab').forEach((b) => b.addEventListener('click', () => setStage(b.dataset.stage)));
}

function stageEnabled(id, p) {
  const d = p.entry.done;
  const visaOk = !p.dest.requiresVisa || d.visa;
  const specialOk = !p.scenarios.length || d.special;
  switch (id) {
    case 'pnr': return true;
    case 'doc': return d.pnr;
    case 'flight': return d.doc;
    case 'visa': return d.flight;
    case 'special': return d.flight && visaOk;
    case 'bag': return d.flight && visaOk && specialOk;
    case 'seat': return d.bag;
    case 'issue': return d.seat;
    default: return false;
  }
}

let activeStage = 'pnr';
function setStage(id) {
  if (!stageEnabled(id, state.current)) return;
  activeStage = id;
  document.querySelectorAll('.stage-tab').forEach((b) => b.classList.toggle('active', b.dataset.stage === id));
  const r = { pnr: stagePnr, doc: stageDoc, flight: stageFlight, visa: stageVisa, special: stageSpecial, bag: stageBag, seat: stageSeat, issue: stageIssue }[id];
  r && r(state.current);
}

const body = () => document.getElementById('stage-body');
const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ');

// ---- שלב 1: איתור הזמנה ----
function stagePnr(p) {
  body().innerHTML = `
    <div class="stage-title">איתור הזמנה — הקלד את שם המשפחה כפי שמופיע בדרכון</div>
    <div class="field-row">
      <label>שם משפחה</label>
      <input id="f-surname" class="term-input" placeholder="הקלד שם משפחה..." value="${p.entry.fields.surname || ''}" />
      <button class="term-btn" id="do-pnr">אתר ▸</button>
    </div>
    <div id="pnr-msg" class="stage-msg"></div>`;
  const run = () => {
    const v = norm(body().querySelector('#f-surname').value);
    p.entry.fields.surname = v;
    if (v === norm(p.last)) {
      p.entry.done.pnr = true;
      body().querySelector('#pnr-msg').innerHTML = `
        <div class="ok">✓ נמצאה הזמנה — RP/TLV1A0980/${p.pnr}</div>
        <div class="text-xs text-cyan-300/80 mt-1 ltr">1. ${p.last.toUpperCase()}/${p.first} ${p.ffTier !== 'ללא מועדון' ? 'FQTV-' + p.ffTier.toUpperCase() : ''}</div>
        <div class="text-xs text-cyan-300/80 ltr">   ${p.flight.code} Y ${p.dest.code} HK1 · ETKT ${p.eticket}</div>`;
      logLine(`PNR RETRIEVE ${v} → ${p.pnr} · ${p.flight.code}${p.ffTier !== 'ללא מועדון' ? ' · ' + p.ffTier : ''}`, 'ok');
      renderTabs(); setStage('doc');
    } else {
      body().querySelector('#pnr-msg').innerHTML = `<span class="err">⛔ לא נמצאה הזמנה בשם "${escapeHtml(v)}". בדוק שוב מול הדרכון.</span>`;
      logLine(`איתור נכשל: ${v}`, 'err');
    }
  };
  body().querySelector('#do-pnr').addEventListener('click', run);
  body().querySelector('#f-surname').addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
}

// ---- שלב 2: פרטי מסמך ----
function stageDoc(p) {
  body().innerHTML = `
    <div class="stage-title">פרטי מסמך נסיעה — הקלד מתוך הדרכון</div>
    <div class="field-grid">
      <div class="field"><label>סוג מסמך</label>
        <select id="f-doctype" class="term-input">${DOC_TYPES.map((d) => `<option value="${d.code}">${d.label}</option>`).join('')}</select></div>
      <div class="field"><label>מספר דרכון</label><input id="f-pnum" class="term-input ltr" placeholder="מספר דרכון..." value="${p.entry.fields.pnum || ''}"/></div>
      <div class="field"><label>תוקף (DD/MM/YYYY)</label><input id="f-exp" class="term-input ltr" placeholder="00/00/0000" value="${p.entry.fields.exp || ''}"/></div>
      <div class="field"><label>אזרחות</label><input id="f-nat" class="term-input" placeholder="אזרחות..." value="${p.entry.fields.nat || ''}"/></div>
    </div>
    <button class="term-btn" id="do-doc">אמת מסמך ▸</button>
    <div id="doc-msg" class="stage-msg"></div>`;
  body().querySelector('#do-doc').addEventListener('click', () => {
    const dt = body().querySelector('#f-doctype').value;
    const pnum = norm(body().querySelector('#f-pnum').value);
    const exp = norm(body().querySelector('#f-exp').value);
    const nat = norm(body().querySelector('#f-nat').value);
    p.entry.fields = { ...p.entry.fields, doctype: dt, pnum, exp, nat };
    const errs = [];
    if (dt !== 'P') errs.push('סוג המסמך אינו דרכון רגיל');
    if (pnum !== p.passport.number) errs.push('מספר דרכון שגוי');
    if (exp !== p.passport.expiry) errs.push('תאריך תוקף שגוי');
    if (norm(nat) !== norm(p.origin)) errs.push('אזרחות שגויה');
    const msg = body().querySelector('#doc-msg');
    if (errs.length) {
      msg.innerHTML = `<span class="err">⛔ ${errs.join(' · ')} — תקן מול הדרכון.</span>`;
      return;
    }
    p.entry.done.doc = true;
    let extra = '';
    if (!p.passport.valid) extra = `<br/><span class="warn">⚠ תוקף הדרכון אינו עומד בדרישת ${p.dest.passportMonths} החודשים של ${p.dest.country}!</span>`;
    msg.innerHTML = `<span class="ok">✓ מסמך אומת.${extra}</span>`;
    logLine(`מסמך אומת: ${pnum} · תוקף ${exp}`, 'ok');
    renderTabs(); setStage('flight');
  });
}

// ---- שלב 3: פרטי טיסה ----
function stageFlight(p) {
  body().innerHTML = `
    <div class="stage-title">פרטי טיסה — הקלד מתוך זימון הטיסה</div>
    <div class="field-grid">
      <div class="field"><label>מספר טיסה</label><input id="f-flt" class="term-input ltr" placeholder="לדוגמה LY315" value="${p.entry.fields.flt || ''}"/></div>
      <div class="field"><label>יעד</label>
        <select id="f-dest" class="term-input"><option value="">— בחר יעד —</option>${DESTINATIONS.map((d) => `<option value="${d.code}">${d.city} (${d.code})</option>`).join('')}</select></div>
    </div>
    <button class="term-btn" id="do-flt">שייך לטיסה ▸</button>
    <div id="flt-msg" class="stage-msg"></div>`;
  if (p.entry.fields.dest) body().querySelector('#f-dest').value = p.entry.fields.dest;
  body().querySelector('#do-flt').addEventListener('click', () => {
    const flt = norm(body().querySelector('#f-flt').value).toUpperCase();
    const dest = body().querySelector('#f-dest').value;
    p.entry.fields = { ...p.entry.fields, flt, dest };
    const errs = [];
    if (flt !== p.flight.code) errs.push('מספר טיסה אינו תואם לזימון');
    if (dest !== p.dest.code) errs.push('היעד אינו תואם');
    const msg = body().querySelector('#flt-msg');
    if (errs.length) { msg.innerHTML = `<span class="err">⛔ ${errs.join(' · ')}.</span>`; return; }
    p.entry.done.flight = true;
    msg.innerHTML = `<span class="ok">✓ שויך לטיסה ${p.flight.code} · שער ${p.flight.gate} · בורדינג ${p.flight.boarding} · ${p.dest.city}</span>`;
    logLine(`שיוך טיסה: ${flt} → ${p.dest.city} · שער ${p.flight.gate}`, 'ok');
    renderTabs(); setStage(afterFlight(p));
  });
}

// ---- שלב 4: ויזה ----
function stageVisa(p) {
  body().innerHTML = `
    <div class="stage-title">אשרת כניסה — היעד ${escapeHtml(p.dest.country)} דורש ויזה</div>
    <div class="field-row">
      <label>מספר ויזה</label>
      <input id="f-visa" class="term-input ltr" placeholder="הקלד מספר ויזה..." value="${p.entry.fields.visa || ''}"/>
      <button class="term-btn" id="do-visa">אמת ▸</button>
    </div>
    <button class="term-btn-ghost" id="no-visa">הנוסע לא מציג ויזה</button>
    <div id="visa-msg" class="stage-msg"></div>`;
  body().querySelector('#do-visa').addEventListener('click', () => {
    const v = norm(body().querySelector('#f-visa').value).toUpperCase();
    p.entry.fields.visa = v;
    const msg = body().querySelector('#visa-msg');
    if (p.hasVisa && v === p.visaNum) {
      p.entry.done.visa = true; p.visaChecked = true;
      msg.innerHTML = `<span class="ok">✓ ויזה אומתה.</span>`;
      logLine(`ויזה אומתה: ${v}`, 'ok'); renderTabs(); setStage(afterVisa(p));
    } else {
      msg.innerHTML = `<span class="err">⛔ מספר ויזה שגוי או שאין ברשות הנוסע ויזה תקפה.</span>`;
    }
  });
  body().querySelector('#no-visa').addEventListener('click', () => {
    p.entry.done.visa = true; p.visaChecked = true; p.noVisaEntered = true;
    body().querySelector('#visa-msg').innerHTML = `<span class="warn">⚠ סומן: ללא ויזה. אישור נוסע כזה = מחדל וקנס.</span>`;
    logLine('סומן: ללא ויזה', 'warn'); renderTabs(); setStage(afterVisa(p));
  });
}

// ---- ניתוב שלבים מותנה ----
function afterFlight(p) { return p.dest.requiresVisa ? 'visa' : (p.scenarios.length ? 'special' : 'bag'); }
function afterVisa(p) { return p.scenarios.length ? 'special' : 'bag'; }

// ---- שלב טיפול מיוחד (סיטואציות/נהלים) ----
function stageSpecial(p) {
  const sevColor = { info: 'alert-ok', warn: 'alert-warn', danger: 'alert-err' };
  body().innerHTML = `
    <div class="stage-title">טיפול מיוחד — יש לטפל בכל ההתראות לפי הנוהל לפני המשך</div>
    <div id="scn-list"></div>`;
  const render = () => {
    const list = document.getElementById('scn-list');
    list.innerHTML = p.scenarios.map((s, i) => `
      <div class="scn-card ${s.resolved ? 'resolved' : ''}">
        <div class="alert ${sevColor[s.sev]} mb-1">🔔 ${escapeHtml(s.alert)}</div>
        <div class="text-sm text-slate-300 mb-2">${escapeHtml(s.prompt)}</div>
        ${s.resolved
          ? `<div class="${s.resolvedOk ? 'ok' : 'err'} text-sm">${s.resolvedOk ? '✓ טופל לפי הנוהל' : '⛔ טופל באופן שגוי'}</div>`
          : `<div class="flex flex-col gap-1">${s.options.map((o, j) => `<button class="event-opt" data-s="${i}" data-o="${j}">${escapeHtml(o.label)}</button>`).join('')}</div>`}
      </div>`).join('');
    list.querySelectorAll('.event-opt').forEach((b) => b.addEventListener('click', () => {
      pickOption(p.scenarios[+b.dataset.s], +b.dataset.o);
      render();
      if (p.scenarios.every((s) => s.resolved)) {
        p.entry.done.special = true; renderTabs();
        setTimeout(() => setStage('bag'), 500);
      }
    }));
  };
  render();
}

function pickOption(scn, idx) {
  const o = scn.options[idx];
  scn.resolved = true; scn.resolvedOk = o.ok;
  if (o.fee) addFee(scn.label, o.fee);
  if (o.fine) fine(`${scn.label}: ${o.msg}`, o.fine);
  if (o.rep) adjustReputation(o.rep);
  toast(`${o.ok ? '✓' : '⛔'} ${o.msg}`, o.ok ? 'ok' : 'err');
  logLine(`טיפול מיוחד: ${scn.label} → ${o.ok ? 'תקין' : 'שגוי'}`, o.ok ? 'ok' : 'err');
}

// ---- שלב 5: כבודה ----
function stageBag(p) {
  body().innerHTML = `
    <div class="stage-title">כבודה רשומה — הקלד מספר מזוודות ושקול</div>
    <div class="field-row">
      <label>מס׳ מזוודות</label>
      <input id="f-bags" type="number" min="0" max="4" value="${p.entry.fields.bags ?? 1}" class="term-input ltr" style="width:5rem"/>
      <button class="term-btn" id="do-weigh">העלה למשקל ▸</button>
    </div>
    <div id="scale-host" class="mt-2"></div>`;
  body().querySelector('#do-weigh').addEventListener('click', () => {
    const bags = +body().querySelector('#f-bags').value;
    p.entry.fields.bags = bags;
    if (bags <= 0) { p.bag.kg = 0; p.bag.weighed = true; p.entry.done.bag = true;
      document.getElementById('scale-host').innerHTML = `<div class="alert alert-ok">✓ אין כבודה רשומה. ניתן להמשיך.</div>`;
      logLine('אין כבודה רשומה', 'ok'); renderTabs(); return; }
    runScale(p);
  });
  if (p.bag.weighed) showWeighVerdict(p, document.getElementById('scale-host'));
}

function runScale(p) {
  const host = document.getElementById('scale-host');
  host.innerHTML = `<div class="scale-area"><div class="scale"><div class="scale-readout"><span id="scale-num">0.0</span> ק"ג</div><div class="scale-plate"></div></div><div id="scale-verdict" class="text-sm mt-2"></div></div>`;
  const num = host.querySelector('#scale-num');
  const target = p.bag.kg; let v = 0; const step = target / 26;
  const iv = setInterval(() => {
    v = Math.min(target, v + step); num.textContent = v.toFixed(1);
    if (v >= target) { clearInterval(iv); p.bag.weighed = true; showWeighVerdict(p, host); }
  }, 32);
}

function showWeighVerdict(p, host) {
  const el = host.querySelector('#scale-verdict') || host;
  const kg = p.bag.kg;
  if (kg <= RULES.BAG_LIMIT_KG) {
    el.innerHTML = `<span class="text-emerald-300">✓ ${kg} ק"ג — בתחום המותר (${RULES.BAG_LIMIT_KG}).</span>`;
    p.entry.done.bag = true; renderTabs(); return;
  }
  const minor = kg <= RULES.BAG_MINOR_KG;
  el.innerHTML = `<div class="${minor ? 'text-amber-300' : 'text-red-400'}">${minor ? '⚠ חריגה קלה' : '⛔ חריגה'}: ${kg} ק"ג.</div>
    <div class="flex gap-2 mt-2 flex-wrap">
      ${minor ? '<button class="btn-ghost" id="b-let">החלק (שב"ר +)</button>' : ''}
      <button class="btn-primary" id="b-fee">חייב ₪${RULES.EXCESS_FEE}</button>
      <button class="btn-ghost" id="b-repack">בקש להוציא בגדים</button>
    </div>`;
  const done = (html) => { el.innerHTML = `<span class="text-emerald-300">${html}</span>`; p.entry.done.bag = true; renderTabs(); };
  el.querySelector('#b-fee')?.addEventListener('click', () => { addFee('דמי חריגת משקל', RULES.EXCESS_FEE); toast(`נגבו ₪${RULES.EXCESS_FEE}`, 'ok'); logLine('חויבו דמי חריגה', 'ok'); done('✓ שולמו דמי חריגה.'); });
  el.querySelector('#b-let')?.addEventListener('click', () => { adjustReputation(+3); done('✓ הוחלק לנוסע.'); });
  el.querySelector('#b-repack')?.addEventListener('click', () => { p.bag.kg = +(RULES.BAG_LIMIT_KG - Math.random()).toFixed(1); adjustQueue(+8); toast('הנוסע מוציא בגדים... התור מתארך', 'warn'); done(`✓ עכשיו ${p.bag.kg} ק"ג.`); });
}

// ---- שלב 6: הושבה ושירות ----
function stageSeat(p) {
  const occupied = new Set();
  for (let i = 0; i < 40; i++) occupied.add(`${Math.floor(Math.random() * 20) + 1}${'ABCDEF'[Math.floor(Math.random() * 6)]}`);
  let map = '';
  for (let r = 1; r <= 20; r++) {
    map += `<div class="seat-row"><span class="seat-rownum">${r}</span>`;
    for (const c of 'ABCDEF') {
      const id = `${r}${c}`; const occ = occupied.has(id);
      map += `<button class="seat ${occ ? 'occ' : ''} ${r <= 4 ? 'biz' : ''}" data-seat="${id}" ${occ ? 'disabled' : ''}>${c}</button>`;
      if (c === 'C') map += '<span class="aisle"></span>';
    }
    map += '</div>';
  }
  body().innerHTML = `
    <div class="stage-title">הושבה ושירות — בחר מושב ואפשרויות</div>
    <div class="field-grid">
      <div class="field"><label>מחלקה</label><select id="f-class" class="term-input">${CABIN_CLASSES.map((c) => `<option value="${c.code}">${c.label}</option>`).join('')}</select></div>
      <div class="field"><label>ארוחה</label><select id="f-meal" class="term-input">${MEAL_OPTIONS.map((m) => `<option value="${m.code}">${m.label}</option>`).join('')}</select></div>
      <div class="field"><label>בקשת שירות (SSR)</label><select id="f-ssr" class="term-input">${SSR_CODES.map((s) => `<option value="${s.code}">${s.label}</option>`).join('')}</select></div>
      <div class="field"><label>מושב נבחר</label><input id="f-seat" class="term-input ltr" readonly placeholder="בחר במפה ←"/></div>
    </div>
    <div class="seatmap">${map}</div>
    <button class="term-btn mt-2" id="do-seat" disabled>אשר הושבה ▸</button>
    <div id="seat-msg" class="stage-msg"></div>`;
  let chosen = null;
  body().querySelectorAll('.seat:not(.occ)').forEach((s) => s.addEventListener('click', () => {
    body().querySelectorAll('.seat.sel').forEach((x) => x.classList.remove('sel'));
    s.classList.add('sel'); chosen = s.dataset.seat;
    body().querySelector('#f-seat').value = chosen;
    body().querySelector('#do-seat').disabled = false;
  }));
  body().querySelector('#do-seat').addEventListener('click', () => {
    const cls = body().querySelector('#f-class').value;
    const meal = body().querySelector('#f-meal').value;
    const ssr = body().querySelector('#f-ssr').value;
    p.seat = { label: chosen, cls, meal, ssr };
    p.entry.done.seat = true;
    body().querySelector('#seat-msg').innerHTML = `<span class="ok">✓ הושבה: ${chosen} · ${CABIN_CLASSES.find((c) => c.code === cls).label}${ssr !== '—' ? ' · ' + ssr : ''}</span>`;
    logLine(`הושבה: ${chosen} (${cls})${ssr !== '—' ? ' SSR:' + ssr : ''}`, 'ok');
    renderTabs(); setStage('issue');
  });
}

// ---- שלב 7: הנפקה ----
function stageIssue(p) {
  body().innerHTML = `
    <div class="stage-title">הנפקת מסמכים — הדפס תג כבודה וכרטיס טיסה</div>
    <div class="flex gap-2 flex-wrap">
      <button class="term-btn" id="pr-tag" ${p.bag.kg > 0 ? '' : 'disabled'}>🏷️ הדפס תג כבודה</button>
      <button class="term-btn" id="pr-bp">🎫 הנפק כרטיס טיסה</button>
    </div>
    <div id="issue-msg" class="stage-msg"></div>
    <div class="text-xs text-slate-400 mt-1">גרור כל פתק אל הנוסע (או לחץ עליו).</div>`;
  body().querySelector('#pr-tag').addEventListener('click', () => actTag(p));
  body().querySelector('#pr-bp').addEventListener('click', () => actBoarding(p));
}

function actTag(p) {
  if (p.bag.tagged || p.bag.kg <= 0) return;
  const html = `<div class="tag-strip">נתב"ג → ${escapeHtml(p.dest.city)}</div><div class="tag-body"><b>${p.flight.code}</b><br/>${Math.min(p.bag.kg, RULES.BAG_LIMIT_KG)}KG<br/><span class="tag-bars"></span></div>`;
  printSlip('tag', html, '#avatar-frame', () => { p.bag.tagged = true; toast('תג הוצמד למזוודה', 'ok'); logLine('תג כבודה הודפס', 'ok'); checkIssued(p); });
}

function actBoarding(p) {
  if (p.boardingIssued) return;
  const cls = (CABIN_CLASSES.find((c) => c.code === p.seat?.cls) || {}).label || 'תיירים';
  const html = `<div class="bp-head"><span>BOARDING PASS · כרטיס עלייה למטוס</span></div>
    <div class="bp-grid">
      <div><div class="bp-l">נוסע</div><div class="bp-v">${escapeHtml(p.name)}</div></div>
      <div><div class="bp-l">טיסה</div><div class="bp-v">${p.flight.code}</div></div>
      <div><div class="bp-l">מ→אל</div><div class="bp-v">TLV→${p.dest.code}</div></div>
      <div><div class="bp-l">שער</div><div class="bp-v">${p.flight.gate}</div></div>
      <div><div class="bp-l">בורדינג</div><div class="bp-v">${p.flight.boarding}</div></div>
      <div><div class="bp-l">מושב</div><div class="bp-v">${p.seat?.label || '--'}</div></div>
      <div><div class="bp-l">מחלקה</div><div class="bp-v">${cls}</div></div>
    </div>`;
  printSlip('boarding', html, '#avatar-frame', () => { p.boardingIssued = true; toast('כרטיס נמסר לנוסע', 'ok'); logLine('כרטיס טיסה הונפק', 'ok'); checkIssued(p); });
}

function checkIssued(p) {
  const need = p.bag.kg > 0;
  if (p.boardingIssued && (!need || p.bag.tagged)) {
    const m = body().querySelector('#issue-msg');
    if (m) m.innerHTML = '<span class="ok">✓ כל המסמכים הונפקו. ניתן לאשר.</span>';
    renderDecision();
  }
}

// ---- בנק שאלות מעמיק ----
function toggleQuestionBank() {
  let menu = document.getElementById('qbank');
  if (menu) { menu.remove(); return; }
  const p = state.current;
  menu = document.createElement('div');
  menu.id = 'qbank'; menu.className = 'qbank';
  menu.innerHTML = Object.entries(QUESTION_BANK).map(([cat, qs]) =>
    `<div class="qcat">${cat}</div>` + qs.map((q) => `<button class="sec-q">${escapeHtml(q.replace('[יעד]', p.dest.city))}</button>`).join('')
  ).join('');
  document.getElementById('chat-box').after(menu);
  menu.querySelectorAll('.sec-q').forEach((b) => b.addEventListener('click', () => { handleQuestion(b.textContent); menu.remove(); }));
}

async function handleQuestion(text) {
  const p = state.current; if (!p) return;
  pushBubble('agent', text);
  state.dialogue.push({ who: 'passenger', text: '…' }); renderBubbles();
  const res = await askPassenger(p, text);
  state.dialogue.pop();
  pushBubble('passenger', res.bodyLanguage ? `${res.reply}  ${res.bodyLanguage}` : res.reply);
  p.stress = Math.max(0, Math.min(100, p.stress + (res.stressDelta || 0)));
  applyStress(document.getElementById('avatar-frame'), p.stress);
  document.getElementById('body-tag').textContent = res.bodyLanguage || bodyLanguageTag(p.stress);
}

// ---- החלטה ----
function renderDecision() {
  const p = state.current;
  const need = p.bag?.kg > 0;
  const canApprove = p.entry.done.seat && p.boardingIssued && (!need || p.bag.tagged);
  const dec = document.getElementById('term-decision');
  dec.innerHTML = `
    <button class="btn-approve" id="dec-approve" ${canApprove ? '' : 'disabled'}>✓ אשר ושלח לגייט</button>
    <button class="btn-detain" id="dec-detain">⛔ עכב / סרב</button>`;
  dec.querySelector('#dec-approve').addEventListener('click', () => decideApprove(p));
  dec.querySelector('#dec-detain').addEventListener('click', () => decideDetain(p));
}

function decideApprove(p) {
  const { ok, fines } = evaluateApproval(p);
  if (!ok) { fines.forEach((f) => fine(f.text, f.amount)); toast(`טעות! ${fines[0].text}`, 'err'); }
  else { adjustReputation(+2); adjustQueue(-12); toast('הנוסע אושר ונשלח לגייט ✓', 'ok'); }
  state.processed++; handled++; nextOrGate();
}

function decideDetain(p) {
  const shouldStop = !p.passport.valid || (p.dest.requiresVisa && !p.hasVisa) || p.status === 'smuggler' || p.status === 'threat';
  if (shouldStop) { adjustReputation(+4); toast('זיהוי נכון! הנוסע עוכב ✓', 'ok'); }
  else { adjustReputation(-6); adjustQueue(+8); toast('עיכבת נוסע תמים — התור מתארך', 'warn'); }
  state.processed++; handled++; nextOrGate();
}

function nextOrGate() {
  renderStatusBar();
  document.getElementById('qbank')?.remove();
  const tray = document.getElementById('printer-tray'); if (tray) tray.innerHTML = '';
  setTimeout(loadNextPassenger, 550);
}

function finishCheckin() {
  toast('שלב הצ׳ק-אין הסתיים — עוברים לגייט', 'info');
  setTimeout(() => startGate(), 850);
}
