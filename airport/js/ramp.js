// ramp.js — תפקיד פקח רחבה (Ramp Agent).
// ניהול היפוך מטוס על הרחבה: תדלוק מדויק, חלוקת משקלים (מרכז כובד), בדיקה היקפית
// (זיהוי תקלות), ואישור דחיפה (Pushback). שעון היפוך לוחץ על כל מטוס.

import { state, startClock, stopClock, adjustReputation, addFine, addFee } from './state.js';
import { statusBarHtml, renderStatusBar, toast, escapeHtml } from './ui.js';
import { openSettings } from './settings.js';
import { showDebrief } from './main.js';

function fine(text, amount) { addFine(text, Math.round(amount * state.fineMult)); }

const ZONES = [
  { id: 'nose', label: 'חרטום / מכ"ם' },
  { id: 'engL', label: 'מנוע שמאל' },
  { id: 'engR', label: 'מנוע ימין' },
  { id: 'wingL', label: 'כנף שמאל' },
  { id: 'wingR', label: 'כנף ימין' },
  { id: 'gear', label: 'כן נסע / צמיגים' },
  { id: 'tail', label: 'מטוס אחורי / הגאי' },
];
const DEFECTS = {
  nose: 'סדק בכיפת המכ"ם', engL: 'ציפור תקועה במניפת המנוע', engR: 'נזילת שמן מהמנוע',
  wingL: 'נזק זר בקצה הכנף', wingR: 'מכסה תא דלק פתוח', gear: 'צמיג שחוק עד החוטים',
  tail: 'נזילת נוזל הידראולי ירוק',
};

let fleet = [], idx = 0, dispatched = 0;
let air = null;

function makeAircraft(i) {
  const regs = ['4X-EKA', '4X-EKB', '4X-ECC', '4X-EHD', '4X-EAE'];
  const flights = ['LY315', 'LY402', 'LY008', 'LY316', 'LY221'];
  const req = 12000 + Math.floor(Math.random() * 8) * 1000;        // דלק דרוש
  const cur = 2000 + Math.floor(Math.random() * 4) * 1000;         // דלק נוכחי
  const hasDefect = Math.random() < 0.6;
  const defectZone = hasDefect ? ZONES[Math.floor(Math.random() * ZONES.length)].id : null;
  return {
    reg: regs[i % regs.length], flight: flights[i % flights.length],
    currentFuel: cur, requiredFuel: req, bagsTotal: 40 + Math.floor(Math.random() * 40),
    defectZone, inspected: {}, fwd: null, aft: null,
    done: { fuel: false, load: false, walk: false, push: false },
    pushStep: 0,
  };
}

export function startRamp(cases = 3) {
  fleet = []; idx = 0; dispatched = 0;
  const n = Math.max(2, Math.min(4, Math.round(cases / 2)));
  for (let i = 0; i < n; i++) fleet.push(makeAircraft(i));
  renderScreen();
  startClock();
  loadAircraft();
}

function renderScreen() {
  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="h-full flex flex-col">
    ${statusBarHtml('פקח רחבה · רחבת חניה W3')}
    <div class="flex-1 grid grid-cols-5 gap-3 p-3 overflow-hidden">
      <section class="col-span-2 flex flex-col bg-[#0e1726] rounded-xl border border-slate-700 overflow-hidden">
        <div class="px-4 py-2 bg-slate-800/60 text-slate-300 text-sm font-semibold border-b border-slate-700">המטוס ברחבה</div>
        <div class="flex-1 flex flex-col p-3 overflow-y-auto">
          <div id="ramp-info" class="ramp-info"></div>
          <div class="turn-clock mt-3"><div class="text-xs text-slate-400">שעון היפוך עד דחיפה</div><div id="turn-time" class="turn-time">--:--</div></div>
          <div id="ramp-checklist" class="ramp-checklist mt-3"></div>
        </div>
      </section>
      <section class="col-span-3 flex flex-col bg-[#0a1f0a] rounded-xl border border-emerald-900/60 overflow-hidden terminal">
        <div class="terminal-header sec-header"><span>בקרת רחבה — RAMP·HE</span><span id="ramp-flag" class="text-emerald-500">● פעיל</span></div>
        <div class="stage-tabs" id="ramp-tabs"></div>
        <div id="ramp-body" class="term-body flex-1"></div>
      </section>
    </div>
  </div>`;
  document.getElementById('sb-settings').addEventListener('click', () => openSettings());
  renderStatusBar();
  startTurnClock();
}

let turnTimer = null;
function startTurnClock() {
  if (turnTimer) clearInterval(turnTimer);
  turnTimer = setInterval(updateTurn, 500);
}
function updateTurn() {
  const el = document.getElementById('turn-time');
  if (!el || !air || air.done.push) return;
  const rem = Math.max(0, air.deadline - state.clock);
  el.textContent = rem > 0 ? `${rem} דק׳` : 'באיחור!';
  el.style.color = rem > 15 ? '#f59e0b' : rem > 0 ? '#fca5a5' : '#ef4444';
}

function loadAircraft() {
  if (idx >= fleet.length) return finish();
  air = fleet[idx];
  air.deadline = state.clock + 40;
  updateTurn();
  document.getElementById('ramp-info').innerHTML = `
    <div class="text-white font-bold text-lg">${air.reg}</div>
    <div class="text-slate-400 text-sm">טיסה ${air.flight} · ${air.bagsTotal} מזוודות בעגלות</div>`;
  renderTabs(); renderChecklist(); setTab('fuel');
}

const TABS = [{ id: 'fuel', l: 'תדלוק' }, { id: 'load', l: 'טעינה ואיזון' }, { id: 'walk', l: 'בדיקה היקפית' }, { id: 'push', l: 'דחיפה' }];

function renderTabs() {
  const t = document.getElementById('ramp-tabs');
  t.innerHTML = TABS.map((x) => `<button class="stage-tab ${air.done[x.id] ? 'done' : ''}" data-t="${x.id}" ${tabEnabled(x.id) ? '' : 'disabled'}>${x.l}${air.done[x.id] ? ' ✓' : ''}</button>`).join('');
  t.querySelectorAll('.stage-tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.t)));
}
function tabEnabled(id) {
  if (id === 'fuel') return true;
  if (id === 'load') return air.done.fuel;
  if (id === 'walk') return air.done.load;
  if (id === 'push') return air.done.walk;
}
function renderChecklist() {
  document.getElementById('ramp-checklist').innerHTML = TABS.map((x) =>
    `<div class="check-item ${air.done[x.id] ? 'ok' : ''}">${air.done[x.id] ? '✓' : '○'} ${x.l}</div>`).join('');
}

function setTab(id) {
  if (!tabEnabled(id)) return;
  document.querySelectorAll('#ramp-tabs .stage-tab').forEach((b) => b.classList.toggle('active', b.dataset.t === id));
  ({ fuel: tabFuel, load: tabLoad, walk: tabWalk, push: tabPush }[id])();
}
const body = () => document.getElementById('ramp-body');

// ---- תדלוק ----
function tabFuel() {
  const need = air.requiredFuel - air.currentFuel;
  body().innerHTML = `
    <div class="stage-title">תדלוק — חשב כמה דלק להזמין מהמיכלית</div>
    <div class="fuel-card">
      <div class="prof-row"><span class="prof-l">דלק נוכחי במטוס</span><b class="ltr">${air.currentFuel.toLocaleString()} ק"ג</b></div>
      <div class="prof-row"><span class="prof-l">דלק דרוש לטיסה (מהטייס)</span><b class="ltr text-amber-300">${air.requiredFuel.toLocaleString()} ק"ג</b></div>
    </div>
    <div class="field-row mt-2">
      <label>כמות להזמנה (ק"ג)</label>
      <input id="fuel-in" type="number" class="term-input ltr" placeholder="הקלד כמות..." style="width:9rem"/>
      <button class="term-btn" id="fuel-go">הזמן תדלוק ▸</button>
    </div>
    <div id="fuel-msg" class="stage-msg"></div>`;
  body().querySelector('#fuel-go').addEventListener('click', () => {
    const order = +body().querySelector('#fuel-in').value;
    const diff = order - need;
    const msg = body().querySelector('#fuel-msg');
    if (Math.abs(diff) <= 200) {
      air.done.fuel = true; adjustReputation(+2);
      msg.innerHTML = `<span class="ok">✓ תדלוק מדויק. סה"כ במטוס: ${(air.currentFuel + order).toLocaleString()} ק"ג.</span>`;
      finishTab('load');
    } else if (diff < 0) {
      fine('תדלוק חסר — סיכון לנחיתת חירום', 4000);
      msg.innerHTML = `<span class="err">⛔ חסרים ${Math.abs(diff).toLocaleString()} ק"ג! סיכון בטיחותי — קנס.</span>`;
      air.done.fuel = true; finishTab('load');
    } else {
      addFee('—', 0); adjustReputation(-3);
      msg.innerHTML = `<span class="warn">⚠ עודף ${diff.toLocaleString()} ק"ג — המטוס כבד והחברה מפסידה דלק.</span>`;
      air.done.fuel = true; finishTab('load');
    }
  });
}

// ---- טעינה ואיזון ----
function tabLoad() {
  if (air.fwd === null) { air.fwd = Math.floor(air.bagsTotal / 2); air.aft = air.bagsTotal - air.fwd; }
  body().innerHTML = `
    <div class="stage-title">חלוקת משקלים — אזן בין הבטן הקדמית לאחורית (אזור ירוק 40%-60% קדימה)</div>
    <div class="load-holds">
      <div class="hold"><div class="hold-h">בטן קדמית (FWD)</div><div class="hold-n" id="fwd-n">${air.fwd}</div>
        <div class="flex gap-1 justify-center mt-1"><button class="term-btn" data-mv="fwd-up">▲</button><button class="term-btn" data-mv="fwd-dn">▼</button></div></div>
      <div class="hold"><div class="hold-h">בטן אחורית (AFT)</div><div class="hold-n" id="aft-n">${air.aft}</div>
        <div class="flex gap-1 justify-center mt-1"><button class="term-btn" data-mv="aft-up">▲</button><button class="term-btn" data-mv="aft-dn">▼</button></div></div>
    </div>
    <div class="cog-wrap mt-3">
      <div class="text-xs text-slate-400">מרכז כובד (CoG)</div>
      <div class="cog-bar"><div class="cog-zone"></div><div id="cog-marker" class="cog-marker"></div></div>
    </div>
    <button class="term-btn mt-3" id="load-go">אשר טעינה ▸</button>
    <div id="load-msg" class="stage-msg"></div>`;
  const upd = () => {
    document.getElementById('fwd-n').textContent = air.fwd;
    document.getElementById('aft-n').textContent = air.aft;
    const pct = air.fwd / air.bagsTotal * 100;
    document.getElementById('cog-marker').style.right = `${Math.max(0, Math.min(100, pct))}%`;
  };
  body().querySelectorAll('[data-mv]').forEach((b) => b.addEventListener('click', () => {
    const m = b.dataset.mv;
    if (m === 'fwd-up' && air.aft > 0) { air.fwd++; air.aft--; }
    if (m === 'fwd-dn' && air.fwd > 0) { air.fwd--; air.aft++; }
    if (m === 'aft-up' && air.fwd > 0) { air.aft++; air.fwd--; }
    if (m === 'aft-dn' && air.aft > 0) { air.aft--; air.fwd++; }
    upd();
  }));
  upd();
  body().querySelector('#load-go').addEventListener('click', () => {
    const pct = air.fwd / air.bagsTotal * 100;
    const msg = body().querySelector('#load-msg');
    if (pct >= 40 && pct <= 60) {
      air.done.load = true; adjustReputation(+2);
      msg.innerHTML = `<span class="ok">✓ מאוזן (${pct.toFixed(0)}% קדימה). מרכז הכובד תקין.</span>`;
      finishTab('walk');
    } else {
      fine('חלוקת משקל לקויה — תקלת איזון מהטייס', 2500);
      msg.innerHTML = `<span class="err">⛔ לא מאוזן (${pct.toFixed(0)}% קדימה). הטייס דיווח על תקלת איזון — קנס.</span>`;
      air.done.load = true; finishTab('walk');
    }
  });
}

// ---- בדיקה היקפית ----
function tabWalk() {
  body().innerHTML = `
    <div class="stage-title">בדיקה היקפית — לחץ על כל אזור כדי לבדוק. דווח אם מצאת תקלה.</div>
    <div class="walk-grid">
      ${ZONES.map((z) => `<button class="walk-zone ${air.inspected[z.id] ? 'seen' : ''}" data-z="${z.id}">${z.label}</button>`).join('')}
    </div>
    <div id="walk-result" class="stage-msg"></div>
    <div class="flex gap-2 mt-3">
      <button class="btn-approve" id="walk-ok">✓ המטוס תקין — אשר</button>
      <button class="btn-detain" id="walk-tech">🔧 הזמן טכנאי (עיכוב)</button>
    </div>`;
  body().querySelectorAll('.walk-zone').forEach((b) => b.addEventListener('click', () => {
    const z = b.dataset.z; air.inspected[z] = true; b.classList.add('seen');
    const def = air.defectZone === z;
    body().querySelector('#walk-result').innerHTML = def
      ? `<span class="err">⛔ נמצאה תקלה ב${ZONES.find((x) => x.id === z).label}: ${DEFECTS[z]}!</span>`
      : `<span class="ok">✓ ${ZONES.find((x) => x.id === z).label}: תקין.</span>`;
  }));
  body().querySelector('#walk-ok').addEventListener('click', () => {
    const msg = body().querySelector('#walk-result');
    if (air.defectZone) {
      fine('אישור מטוס עם תקלה — סיכון בטיחותי חמור', 9000);
      msg.innerHTML = `<span class="err">⛔ אישרת מטוס עם תקלה (${DEFECTS[air.defectZone]})! מחדל חמור.</span>`;
    } else { adjustReputation(+3); msg.innerHTML = `<span class="ok">✓ המטוס תקין ואושר.</span>`; }
    air.done.walk = true; finishTab('push');
  });
  body().querySelector('#walk-tech').addEventListener('click', () => {
    const msg = body().querySelector('#walk-result');
    if (air.defectZone) { adjustReputation(+4); toast('זיהוי נכון! הטכנאי מטפל בתקלה', 'ok'); msg.innerHTML = `<span class="ok">✓ טכנאי הוזמן — התקלה תטופל. (עיכוב מוצדק)</span>`; }
    else { adjustReputation(-4); toast('לא הייתה תקלה — עיכבת את הטיסה לחינם', 'warn'); msg.innerHTML = `<span class="warn">⚠ לא נמצאה תקלה — עיכוב מיותר.</span>`; }
    air.done.walk = true; finishTab('push');
  });
}

// ---- דחיפה ----
const PUSH_STEPS = ['חבר רכב דחיפה (Tug)', 'בקש אישור ממגדל הפיקוח', 'שחרר בלמים', 'בצע דחיפה ונתק'];
function tabPush() {
  body().innerHTML = `
    <div class="stage-title">נוהל דחיפה — בצע בסדר הנכון</div>
    <div id="push-steps" class="push-steps"></div>
    <div id="push-msg" class="stage-msg"></div>`;
  renderPush();
}
function renderPush() {
  document.getElementById('push-steps').innerHTML = PUSH_STEPS.map((s, i) =>
    `<button class="push-step ${i < air.pushStep ? 'done' : ''} ${i === air.pushStep ? 'next' : ''}" data-i="${i}" ${i === air.pushStep ? '' : 'disabled'}>
      ${i < air.pushStep ? '✓ ' : `${i + 1}. `}${s}</button>`).join('');
  document.querySelectorAll('.push-step').forEach((b) => b.addEventListener('click', () => {
    if (+b.dataset.i !== air.pushStep) return;
    air.pushStep++;
    if (air.pushStep >= PUSH_STEPS.length) {
      air.done.push = true; renderChecklist();
      document.getElementById('push-msg').innerHTML = `<span class="ok">✓ המטוס שוחרר לדרך! היפוך הושלם.</span>`;
      dispatched++; state.processed++; adjustReputation(+3);
      setTimeout(() => { idx++; loadAircraft(); }, 1100);
    } else renderPush();
  }));
}

function finishTab(next) { renderTabs(); renderChecklist(); setTab(next); }

function finish() {
  stopClock();
  if (turnTimer) { clearInterval(turnTimer); turnTimer = null; }
  state.summaryTitle = 'סיכום משמרת רחבה';
  state.summaryTiles = [{ num: dispatched, label: 'מטוסים ששוחררו', cls: 'text-emerald-300' }];
  toast('כל המטוסים טופלו', 'info');
  setTimeout(() => showDebrief(), 800);
}
