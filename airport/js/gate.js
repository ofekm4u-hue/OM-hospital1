// gate.js — שלב הגייט/בורדינג. הנוסעים עוברים אחד-אחד, השחקן סורק כרטיסים ומטפל
// בבעיות בזמן אמת: טרולי גדול מדי, נוסע שלא במערכת, שדרוג עצמי לא חוקי, אוברבוקינג,
// ומאחרים. בסיום עוברים למסך הסיכום.

import { state, adjustReputation, adjustQueue, addFee, addFine } from './state.js';
import { announce } from './audio.js';
import { renderStatusBar, statusBarHtml, toast, escapeHtml } from './ui.js';
import { createAvatarSVG, applyStress } from './avatar.js';
import { generatePassenger } from './passenger.js';
import { openSettings } from './settings.js';
import { showDebrief } from './main.js';
import { RULES, flightByCode, destByCode } from './data.js';

function destName() { const d = destByCode(gateFlight.dest); return d ? d.city : ''; }

let gateQueue = [];
let boarded = 0;
let denied = 0;
let gateFlight = null;
let boardingState = 'closed'; // closed | open | final | done

// סוגי בעיה אפשריים בגייט.
function assignIssue(i, total) {
  // האחרונים = אוברבוקינג; אחרת רנדומלי
  if (i >= total - 2) return 'overbook';
  const r = Math.random();
  if (r < 0.18) return 'trolley';
  if (r < 0.30) return 'notfound';
  if (r < 0.42) return 'upgrade';
  if (r < 0.52) return 'late';
  return 'ok';
}

export function startGate() {
  state.phase = 'gate';
  gateFlight = flightByCode('LY402'); // טיסת הבורדינג (עם אוברבוקינג)
  boarded = 0; denied = 0;
  const total = 8;
  gateQueue = [];
  for (let i = 0; i < total; i++) {
    const p = generatePassenger(gateFlight.code);
    p.issue = assignIssue(i, total);
    p.boardingIssued = true;
    gateQueue.push(p);
  }
  boardingState = 'closed';
  finished = false;
  renderGateScreen();
  loadNextGate();
}

// פתיחת/סגירת בורדינג — מאפשרת/חוסמת סריקת כרטיסים.
function openBoarding() {
  if (boardingState !== 'closed') return;
  boardingState = 'open';
  document.getElementById('g-status').textContent = 'פתוח';
  document.getElementById('g-status').className = 'text-emerald-300';
  document.getElementById('board-open').disabled = true;
  ['anno-board', 'anno-final', 'g-scan', 'board-close'].forEach((id) => { document.getElementById(id).disabled = false; });
  announce(`הבורדינג לטיסה ${gateFlight.code} ליעד ${destName()} נפתח כעת.`);
  toast('🟢 הבורדינג נפתח — אפשר להתחיל לסרוק כרטיסים', 'ok');
}

function closeBoarding() {
  if (boardingState === 'closed' || boardingState === 'done') return;
  const left = gateQueue.length + (current ? 1 : 0);
  if (left > 0 && boardingState !== 'final') {
    // סגירה מוקדמת בלי קריאה אחרונה — נוסעים נשארים מאחור
    adjustReputation(-2 * left);
    toast(`🔴 סגרת מוקדם — ${left} נוסעים נותרו בשער (פגיעה במוניטין)`, 'warn');
  } else {
    toast('🔴 הבורדינג נסגר. הטיסה מוכנה לדחיפה.', 'ok');
  }
  boardingState = 'done';
  gateQueue = []; current = null;
  finishGate();
}

function renderGateScreen() {
  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="h-full flex flex-col">
    ${statusBarHtml(`שער ${gateFlight.gate} · בורדינג ${gateFlight.code}`)}
    <div class="flex-1 grid grid-cols-5 gap-3 p-3 overflow-hidden">
      <section class="col-span-2 flex flex-col bg-[#0e1726] rounded-xl border border-slate-700 overflow-hidden">
        <div class="px-4 py-2 bg-slate-800/60 text-slate-300 text-sm font-semibold border-b border-slate-700">נוסע בשער</div>
        <div class="flex-1 flex flex-col p-3 overflow-hidden">
          <div class="flex gap-3 items-start">
            <div id="g-avatar" class="avatar-frame w-32 h-36 rounded-xl border-2 overflow-hidden bg-black"></div>
            <div id="g-id" class="id-card flex-1"></div>
          </div>
          <div id="g-pass" class="gate-pass mt-3"></div>
        </div>
      </section>

      <section class="col-span-3 flex flex-col bg-[#03142b] rounded-xl border border-cyan-900/60 overflow-hidden terminal">
        <div class="terminal-header">
          <span>בקרת עלייה למטוס — GATE ${gateFlight.gate}</span>
          <span>סטטוס: <b id="g-status" class="text-amber-300">סגור</b> · עלו <b id="g-counter" class="text-cyan-300">0</b>/${gateFlight.seatsTotal}</span>
        </div>
        <div class="flex-1 grid grid-rows-[auto_1fr_auto] overflow-hidden">
          <div class="term-toolbar">
            <button class="term-btn" id="board-open">🟢 פתח בורדינג</button>
            <button class="term-btn" id="anno-board" disabled>📢 כריזת בורדינג</button>
            <button class="term-btn" id="anno-final" disabled>📢 קריאה אחרונה</button>
            <button class="term-btn" id="g-scan" disabled>סרוק כרטיס</button>
            <button class="term-btn btn-close-gate" id="board-close" disabled>🔴 סגור בורדינג</button>
          </div>
          <div id="g-body" class="term-body"></div>
          <div id="g-decision" class="term-decision"></div>
        </div>
      </section>
    </div>
  </div>`;

  document.getElementById('sb-settings').addEventListener('click', () => openSettings());
  document.getElementById('board-open').addEventListener('click', openBoarding);
  document.getElementById('board-close').addEventListener('click', closeBoarding);
  document.getElementById('anno-board').addEventListener('click', () => {
    const msg = `טיסה ${gateFlight.code} ליעד ${destName()}, מתחילים בעלייה למטוס. נא להכין כרטיסי עלייה ודרכונים.`;
    announce(msg); toast(`📢 ${msg}`, 'info');
  });
  document.getElementById('anno-final').addEventListener('click', () => {
    boardingState = 'final';
    document.getElementById('g-status').textContent = 'קריאה אחרונה';
    adjustQueue(-5);
    const msg = `קריאה אחרונה לנוסעי טיסה ${gateFlight.code}. שערי הטיסה ייסגרו בעוד דקות ספורות.`;
    announce(msg); toast(`📢 ${msg}`, 'info');
  });
  document.getElementById('g-scan').addEventListener('click', () => scanCurrent());
  renderStatusBar();
}

let current = null;

function loadNextGate() {
  if (boardingState === 'done') return;
  if (gateQueue.length === 0) {
    current = null;
    document.getElementById('g-pass').innerHTML = `<div class="alert alert-ok">✓ כל הנוסעים טופלו. לחץ "סגור בורדינג" כדי לשחרר את הטיסה.</div>`;
    document.getElementById('g-body').innerHTML = '';
    document.getElementById('g-decision').innerHTML = '';
    return;
  }
  current = gateQueue.shift();
  const av = document.getElementById('g-avatar');
  av.innerHTML = createAvatarSVG(current.seed, current.gender);
  applyStress(av, current.stress);
  document.getElementById('g-id').innerHTML = `
    <div class="text-white font-bold text-base">${escapeHtml(current.name)}</div>
    <div class="text-slate-400 text-xs mt-0.5">טיסה ${current.flight.code} · ${escapeHtml(current.dest.city)}</div>`;
  document.getElementById('g-pass').innerHTML =
    `<div class="text-slate-500 text-sm">לחץ <b>"סרוק כרטיס"</b> כדי לבדוק את הנוסע.</div>`;
  document.getElementById('g-body').innerHTML = '';
  document.getElementById('g-decision').innerHTML = '';
}

function scanCurrent() {
  if (boardingState === 'closed') { toast('יש לפתוח את הבורדינג קודם 🟢', 'warn'); return; }
  if (!current) return;
  const p = current;
  const body = document.getElementById('g-body');
  const pass = document.getElementById('g-pass');
  pass.innerHTML = `
    <div class="bp-mini">
      <span>${escapeHtml(p.name)}</span><span>${p.flight.code}</span>
      <span>שער ${p.flight.gate}</span><span>${p.boarding || p.flight.boarding}</span>
    </div>`;

  let msg = '', actions = '';
  switch (p.issue) {
    case 'trolley':
      msg = `<div class="alert alert-warn">⚠ לנוסע טרולי שאינו נכנס למתקן המדידה. יש לגבות דמי הטענה לבטן המטוס.</div>`;
      actions = `<button class="btn-primary" data-do="fee">גבה דמי טרולי ₪${RULES.GATE_BAG_FEE}</button>
                 <button class="btn-detain" data-do="deny">סרב לעלייה</button>`;
      break;
    case 'notfound':
      msg = `<div class="alert alert-err">⛔ הכרטיס לא נמצא במערכת לטיסה זו. הנוסע אינו רשום.</div>`;
      actions = `<button class="btn-detain" data-do="refer">העבר לבירור בדלפק</button>
                 <button class="btn-approve" data-do="board">העלה בכל זאת</button>`;
      break;
    case 'upgrade':
      msg = `<div class="alert alert-warn">😏 הנוסע מבקש לשבת בביזנס "כי יש מקום", בלי לשלם.</div>`;
      actions = `<button class="btn-primary" data-do="board">סרב והושב בתיירים</button>
                 <button class="btn-detain" data-do="freeup">שדרג בחינם (לא חוקי)</button>`;
      break;
    case 'late':
      msg = `<div class="alert alert-warn">⏱ הנוסע הגיע מאוחר, שמו עלה בכריזה. הגייט עומד להיסגר.</div>`;
      actions = `<button class="btn-approve" data-do="board">קלוט מהר והעלה</button>
                 <button class="btn-detain" data-do="deny">סגור גייט (לא טס)</button>`;
      break;
    case 'overbook':
      msg = `<div class="alert alert-err">⛔ אוברבוקינג: הטיסה מלאה (${gateFlight.seatsSold}/${gateFlight.seatsTotal}). אין מקום בתיירים.</div>`;
      actions = `<button class="btn-primary" data-do="upgrade">שדרג לביזנס (פתרון)</button>
                 <button class="btn-detain" data-do="bump">הורד מהטיסה</button>`;
      break;
    default:
      msg = `<div class="alert alert-ok">✓ הכרטיס תקין והנוסע רשום לטיסה.</div>`;
      actions = `<button class="btn-approve" data-do="board">סרוק ועלה למטוס</button>`;
  }
  body.innerHTML = msg;
  const dec = document.getElementById('g-decision');
  dec.innerHTML = actions;
  dec.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => resolveGate(b.dataset.do)));
}

function resolveGate(action) {
  const p = current;
  switch (action) {
    case 'board':
      board(); break;
    case 'fee':
      addFee('דמי טרולי בגייט', RULES.GATE_BAG_FEE);
      toast(`נגבו ₪${RULES.GATE_BAG_FEE} · הנוסע עלה`, 'ok'); board(); break;
    case 'deny':
      denied++; adjustReputation(-3); toast('הנוסע לא הועלה', 'warn'); next(); break;
    case 'refer':
      adjustReputation(+3); toast('זיהוי נכון — הנוסע הופנה לבירור ✓', 'ok'); next(); break;
    case 'freeup':
      addFine('שדרוג לא חוקי לביזנס ללא תשלום', 600);
      toast('שדרגת בלי אישור — קנס ₪600', 'err'); board(); break;
    case 'upgrade':
      adjustReputation(+5); toast('פתרת את האוברבוקינג בשדרוג ✓', 'ok'); board(); break;
    case 'bump':
      adjustReputation(-8); adjustQueue(+10);
      toast('הורדת נוסע מהטיסה — צעקות ובכי בגייט', 'warn'); denied++; next(); break;
    default: next();
  }
}

function board() {
  boarded++;
  document.getElementById('g-counter').textContent = boarded;
  adjustReputation(+1);
  next();
}

function next() {
  renderStatusBar();
  setTimeout(loadNextGate, 500);
}

let finished = false;
function finishGate() {
  if (finished) return;
  finished = true;
  state.gateStats = { boarded, denied };
  state.summaryTitle = 'סיכום משמרת דייל קרקע';
  state.summaryTiles = [
    { num: state.processed, label: 'נוסעים בצ׳ק-אין' },
    { num: boarded, label: 'עלו למטוס בגייט', cls: 'text-emerald-300' },
  ];
  setTimeout(() => showDebrief(), 900);
}
