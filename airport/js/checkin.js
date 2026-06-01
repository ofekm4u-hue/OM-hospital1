// checkin.js — מסך המשחק של תפקיד דייל הקרקע: עמדת צ'ק-אין מלאה.
// בונה את הפריסה (נוסע מימין, מסוף אלטאה משמאל), מנהל את זרימת הטיפול בכל נוסע,
// ומעביר לשלב הגייט כשהתור הסתיים.

import {
  state, startClock, adjustQueue, adjustReputation, addFine, addFee,
} from './state.js';
import { buildQueue, evaluateApproval } from './passenger.js';
import { createAvatarSVG, applyStress, bodyLanguageTag } from './avatar.js';
import { askPassenger } from './dialogue.js';
import { setupVoice, isVoiceSupported } from './voice.js';
import { openSettings } from './settings.js';
import {
  statusBarHtml, renderStatusBar, toast, pushBubble, clearBubbles,
  renderBubbles, printSlip, escapeHtml,
} from './ui.js';
import { startGate } from './gate.js';
import { RULES, SECURITY_QUESTIONS } from './data.js';

const CHECKIN_TARGET = 6; // כמה נוסעים בשלב הצ'ק-אין לפני מעבר לגייט
let handled = 0;
let questionsShown = false;

export function startCheckin() {
  handled = 0;
  state.queue = buildQueue(CHECKIN_TARGET);
  renderGame();
  startClock();
  loadNextPassenger();
}

function renderGame() {
  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="h-full flex flex-col">
    ${statusBarHtml('עמדת צ׳ק-אין · דלפק 4')}
    <div class="flex-1 grid grid-cols-5 gap-3 p-3 overflow-hidden">
      <!-- צד ימין: הנוסע (2/5 ≈ 40%) -->
      <section class="col-span-2 flex flex-col bg-[#0e1726] rounded-xl border border-slate-700 overflow-hidden">
        <div class="px-4 py-2 bg-slate-800/60 text-slate-300 text-sm font-semibold border-b border-slate-700">הנוסע מולך</div>
        <div class="flex-1 flex flex-col p-3 overflow-hidden">
          <div class="flex gap-3 items-start">
            <div class="relative">
              <div id="avatar-frame" class="avatar-frame w-32 h-36 rounded-xl border-2 overflow-hidden bg-black"></div>
              <div id="body-tag" class="body-tag"></div>
            </div>
            <div id="id-card" class="id-card flex-1"></div>
          </div>

          <div id="chat-box" class="chat-box mt-3 flex-1"></div>

          <div id="interim" class="text-xs text-slate-500 h-4 px-1"></div>
          <div class="flex gap-2 mt-1">
            <button id="mic-btn" class="mic-btn" title="דבר אל הנוסע">🎙️<span class="mic-label">דבר</span></button>
            <input id="ask-input" type="text" placeholder="הקלד שאלה לנוסע..."
              class="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
            <button id="ask-send" class="btn-primary px-4">שלח</button>
          </div>
        </div>
      </section>

      <!-- צד שמאל: מסוף המחשב (3/5 ≈ 60%) -->
      <section class="col-span-3 flex flex-col bg-[#03142b] rounded-xl border border-cyan-900/60 overflow-hidden terminal">
        <div class="terminal-header">
          <span>מערכת קבלה לטיסה — ALTEA·HE</span>
          <span id="term-flag" class="text-cyan-500">●  מקוון</span>
        </div>
        <div class="flex-1 grid grid-rows-[auto_1fr_auto] overflow-hidden">
          <div id="term-toolbar" class="term-toolbar"></div>
          <div id="term-body" class="term-body"></div>
          <div id="term-decision" class="term-decision"></div>
        </div>
        <div id="printer-tray" class="printer-tray"></div>
      </section>
    </div>
  </div>`;

  // הגדרות
  document.getElementById('sb-settings').addEventListener('click', () => openSettings());

  // דיאלוג חופשי
  const input = document.getElementById('ask-input');
  const send = () => {
    const t = input.value.trim();
    if (!t) return;
    input.value = '';
    handleQuestion(t);
  };
  document.getElementById('ask-send').addEventListener('click', send);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

  // קול
  const mic = document.getElementById('mic-btn');
  setupVoice({
    button: mic,
    interimEl: document.getElementById('interim'),
    onFinal: (text) => handleQuestion(text),
  });
  if (!isVoiceSupported()) {
    document.getElementById('interim').textContent = 'זיהוי קולי לא נתמך בדפדפן זה — אפשר להקליד';
  }

  renderStatusBar();
}

// ---- טעינת נוסע ----
function loadNextPassenger() {
  questionsShown = false;
  clearBubbles();
  if (state.queue.length === 0) {
    finishCheckin();
    return;
  }
  const p = state.queue.shift();
  state.current = p;

  // אווטאר
  const frame = document.getElementById('avatar-frame');
  frame.innerHTML = createAvatarSVG(p.seed, p.gender);
  applyStress(frame, p.stress);
  document.getElementById('body-tag').textContent = bodyLanguageTag(p.stress);

  // ת"ז קטנה (גלויה — לא חושפת סטטוס נסתר)
  document.getElementById('id-card').innerHTML = `
    <div class="text-white font-bold text-base">${escapeHtml(p.name)}</div>
    <div class="text-slate-400 text-xs mt-0.5">גיל ${p.age} · ${escapeHtml(p.origin)}</div>
    <div class="mt-2 text-xs text-slate-300">טיסה <b class="text-amber-300">${p.flight.code}</b> ← ${escapeHtml(p.dest.city)}</div>
    <div class="text-xs text-slate-500">שער ${p.flight.gate} · בורדינג ${p.flight.boarding}</div>`;

  pushBubble('passenger', greeting(p));
  renderToolbar();
  renderTerminalIdle();
  renderDecision();
}

function greeting(p) {
  if (p.status === 'nervous') return 'שלום... אני קצת לחוץ, מתי הטיסה ממריאה?';
  if (p.status === 'smuggler') return 'שלום, אפשר כבר לעשות צ׳ק-אין? אני קצת ממהר.';
  if (p.status === 'threat') return 'שלום.';
  return 'בוקר טוב! הנה הדרכון שלי.';
}

// ---- שורת הכלים (כפתורי הפעולה) ----
function renderToolbar() {
  const p = state.current;
  const tb = document.getElementById('term-toolbar');
  const needVisa = p.dest.requiresVisa;
  tb.innerHTML = `
    <button class="term-btn" data-act="scan">F1 · סרוק דרכון</button>
    <button class="term-btn" data-act="security" ${p.scanned ? '' : 'disabled'}>F3 · שאלות ביטחון</button>
    ${needVisa ? `<button class="term-btn" data-act="visa" ${p.scanned ? '' : 'disabled'}>F4 · בדוק ויזה</button>` : ''}
    <button class="term-btn" data-act="bag" ${p.scanned ? '' : 'disabled'}>F2 · הוסף מזוודה</button>
    <button class="term-btn" data-act="tag" ${p.bag.weighed ? '' : 'disabled'}>הדפס תג כבודה</button>
    <button class="term-btn" data-act="boarding" ${p.bag.tagged ? '' : 'disabled'}>F5 · הנפק כרטיס</button>`;
  tb.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => doAction(b.dataset.act)));
}

function doAction(act) {
  const p = state.current;
  switch (act) {
    case 'scan': return actScan(p);
    case 'security': return actSecurity(p);
    case 'visa': return actVisa(p);
    case 'bag': return actBag(p);
    case 'tag': return actTag(p);
    case 'boarding': return actBoarding(p);
  }
}

// ---- פעולות ----
function actScan(p) {
  p.scanned = true;
  const body = document.getElementById('term-body');
  const expClass = p.passport.valid ? 'text-emerald-300' : 'text-red-400';
  const validRule = p.dest.passportMonths > 0
    ? `<div class="text-xs text-slate-400 mt-1">היעד דורש תוקף של ${p.dest.passportMonths} חודשים לפחות מעבר לטיסה.</div>` : '';
  body.innerHTML = `
    <div class="passport" id="passport-card">
      <div class="passport-strip">דרכון · PASSPORT · ישראל</div>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm p-3">
        <div class="text-slate-400">שם</div><div class="text-white font-semibold">${escapeHtml(p.name)}</div>
        <div class="text-slate-400">מס׳ דרכון</div><div class="text-white font-mono">${p.passport.number}</div>
        <div class="text-slate-400">בתוקף עד</div><div class="${expClass} font-mono font-bold">${p.passport.expiry}</div>
        <div class="text-slate-400">יעד</div><div class="text-white">${escapeHtml(p.dest.city)} (${p.dest.code})</div>
        <div class="text-slate-400">טיסה</div><div class="text-white">${p.flight.code}</div>
      </div>
      ${validRule}
    </div>
    ${p.dest.requiresVisa ? `<div class="alert alert-warn mt-2">⚠ שים לב: היעד <b>${escapeHtml(p.dest.country)}</b> דורש אשרת כניסה (ויזה). ודא שהנוסע מציג אותה.</div>` : ''}
    ${!p.passport.valid ? `<div class="alert alert-err mt-2">⛔ אזהרת מערכת: תוקף הדרכון אינו עומד בדרישת היעד.</div>` : ''}`;
  // תקריב דרכון בלחיצה
  document.getElementById('passport-card').addEventListener('click', (e) => e.currentTarget.classList.toggle('zoom'));
  renderToolbar();
  toast('הדרכון נסרק', 'info');
}

function actSecurity(p) {
  questionsShown = !questionsShown;
  let menu = document.getElementById('sec-menu');
  if (!questionsShown) { if (menu) menu.remove(); return; }
  if (menu) return;
  menu = document.createElement('div');
  menu.id = 'sec-menu';
  menu.className = 'sec-menu';
  menu.innerHTML = SECURITY_QUESTIONS.map((q, i) =>
    `<button class="sec-q" data-q="${i}">${escapeHtml(q)}</button>`).join('');
  document.getElementById('chat-box').after(menu);
  menu.querySelectorAll('.sec-q').forEach((b) =>
    b.addEventListener('click', () => {
      let q = SECURITY_QUESTIONS[+b.dataset.q];
      if (q.includes('מטרת הנסיעה')) q = `מה מטרת הנסיעה שלך ל${p.dest.city}?`;
      handleQuestion(q);
    }));
}

function actVisa(p) {
  p.visaChecked = true;
  if (p.hasVisa) {
    toast('הנוסע הציג ויזה תקפה ✓', 'ok');
    document.getElementById('term-body').insertAdjacentHTML('beforeend',
      '<div class="alert alert-ok mt-2">✓ ויזה אומתה.</div>');
  } else {
    toast('לנוסע אין ויזה! אישור עלול לגרור קנס', 'err');
    document.getElementById('term-body').insertAdjacentHTML('beforeend',
      '<div class="alert alert-err mt-2">⛔ הנוסע אינו מציג ויזה ליעד שדורש אותה. אישורו = מחדל.</div>');
  }
}

function actBag(p) {
  const body = document.getElementById('term-body');
  if (document.getElementById('scale-area')) return;
  const area = document.createElement('div');
  area.id = 'scale-area';
  area.className = 'scale-area mt-2';
  area.innerHTML = `
    <div class="scale">
      <div class="scale-readout"><span id="scale-num">0.0</span> ק"ג</div>
      <div class="scale-plate"></div>
    </div>
    <div id="scale-verdict" class="text-sm mt-2"></div>`;
  body.appendChild(area);

  // אנימציית עליית משקל
  const num = area.querySelector('#scale-num');
  const target = p.bag.kg;
  let v = 0;
  const step = target / 28;
  const iv = setInterval(() => {
    v = Math.min(target, v + step);
    num.textContent = v.toFixed(1);
    if (v >= target) {
      clearInterval(iv);
      p.bag.weighed = true;
      weighVerdict(p, area.querySelector('#scale-verdict'));
      renderToolbar();
    }
  }, 35);
}

function weighVerdict(p, el) {
  const kg = p.bag.kg;
  if (kg <= RULES.BAG_LIMIT_KG) {
    el.innerHTML = `<span class="text-emerald-300">✓ ${kg} ק"ג — בתחום המותר (${RULES.BAG_LIMIT_KG} ק"ג).</span>`;
    return;
  }
  const minor = kg <= RULES.BAG_MINOR_KG;
  el.innerHTML = `
    <div class="${minor ? 'text-amber-300' : 'text-red-400'}">${minor ? '⚠ חריגה קלה' : '⛔ חריגה'}: ${kg} ק"ג (מותר ${RULES.BAG_LIMIT_KG}).</div>
    <div class="flex gap-2 mt-2 flex-wrap">
      ${minor ? `<button class="btn-ghost" id="bag-let">החלק הפעם (שביעות רצון +)</button>` : ''}
      <button class="btn-primary" id="bag-fee">חייב דמי חריגה ₪${RULES.EXCESS_FEE}</button>
      <button class="btn-ghost" id="bag-repack">בקש לפתוח ולהוציא בגדים</button>
    </div>`;
  const fee = el.querySelector('#bag-fee');
  const repack = el.querySelector('#bag-repack');
  const letgo = el.querySelector('#bag-let');
  fee && fee.addEventListener('click', () => {
    addFee('דמי חריגת משקל', RULES.EXCESS_FEE);
    toast(`נגבו ₪${RULES.EXCESS_FEE} דמי חריגה`, 'ok');
    el.innerHTML = `<span class="text-emerald-300">✓ שולמו דמי חריגה. ניתן להמשיך.</span>`;
  });
  letgo && letgo.addEventListener('click', () => {
    adjustReputation(+3);
    toast('החלקת לנוסע — שביעות הרצון עלתה', 'ok');
    el.innerHTML = `<span class="text-emerald-300">✓ הוחלק. ניתן להמשיך.</span>`;
  });
  repack && repack.addEventListener('click', () => {
    p.bag.kg = +(RULES.BAG_LIMIT_KG - Math.random()).toFixed(1);
    p.bag.repacked = true;
    adjustQueue(+8);
    toast('הנוסע מוציא בגדים... התור מתארך', 'warn');
    el.innerHTML = `<span class="text-emerald-300">✓ המזוודה עכשיו ${p.bag.kg} ק"ג. הספקת זמן עלה.</span>`;
  });
}

function actTag(p) {
  if (p.bag.tagged) return;
  const html = `<div class="tag-strip">נתב"ג → ${escapeHtml(p.dest.city)}</div>
    <div class="tag-body"><b>${p.flight.code}</b><br/>${Math.min(p.bag.kg, RULES.BAG_LIMIT_KG)}KG<br/><span class="tag-bars"></span></div>`;
  printSlip('tag', html, '#avatar-frame', () => {
    p.bag.tagged = true;
    toast('תג הכבודה הוצמד למזוודה', 'ok');
    renderToolbar();
  });
  toast('גרור את תג הכבודה אל הנוסע/המזוודה', 'info');
}

function actBoarding(p) {
  if (p.boardingIssued) return;
  if (!p.seat) p.seat = assignSeat();
  const cls = p.seat.row <= 4 ? 'עסקים' : 'תיירים';
  const html = `
    <div class="bp-head"><span>BOARDING PASS · כרטיס עלייה למטוס</span></div>
    <div class="bp-grid">
      <div><div class="bp-l">נוסע</div><div class="bp-v">${escapeHtml(p.name)}</div></div>
      <div><div class="bp-l">טיסה</div><div class="bp-v">${p.flight.code}</div></div>
      <div><div class="bp-l">מ→אל</div><div class="bp-v">TLV→${p.dest.code}</div></div>
      <div><div class="bp-l">שער</div><div class="bp-v">${p.flight.gate}</div></div>
      <div><div class="bp-l">בורדינג</div><div class="bp-v">${p.flight.boarding}</div></div>
      <div><div class="bp-l">מושב</div><div class="bp-v">${p.seat.label}</div></div>
      <div><div class="bp-l">מחלקה</div><div class="bp-v">${cls}</div></div>
    </div>`;
  printSlip('boarding', html, '#avatar-frame', () => {
    p.boardingIssued = true;
    toast('כרטיס הטיסה נמסר לנוסע', 'ok');
    renderDecision();
  });
  toast('גרור את כרטיס הטיסה אל הנוסע', 'info');
}

function assignSeat() {
  const row = Math.floor(Math.random() * 40) + 1;
  const letter = 'ABCDEF'[Math.floor(Math.random() * 6)];
  return { row, letter, label: `${row}${letter}` };
}

// ---- שאלה ותשובה (חופשי או מתפריט) ----
async function handleQuestion(text) {
  const p = state.current;
  if (!p) return;
  pushBubble('agent', text);
  // אינדיקציית "חושב"
  state.dialogue.push({ who: 'passenger', text: '…' });
  renderBubbles();
  const res = await askPassenger(p, text);
  state.dialogue.pop(); // מסיר את ה-…
  pushBubble('passenger', res.bodyLanguage ? `${res.reply}  ${res.bodyLanguage}` : res.reply);
  // עדכון לחץ ושפת גוף
  p.stress = Math.max(0, Math.min(100, p.stress + (res.stressDelta || 0)));
  const frame = document.getElementById('avatar-frame');
  applyStress(frame, p.stress);
  document.getElementById('body-tag').textContent = res.bodyLanguage || bodyLanguageTag(p.stress);
}

// ---- החלטה: אשר / עכב ----
function renderDecision() {
  const p = state.current;
  const dec = document.getElementById('term-decision');
  const canApprove = p.scanned && p.boardingIssued;
  dec.innerHTML = `
    <button class="btn-approve" id="dec-approve" ${canApprove ? '' : 'disabled'}>✓ אשר ושלח לגייט</button>
    <button class="btn-detain" id="dec-detain">⛔ עכב לחקירה / פסול</button>`;
  dec.querySelector('#dec-approve').addEventListener('click', () => decideApprove(p));
  dec.querySelector('#dec-detain').addEventListener('click', () => decideDetain(p));
}

function decideApprove(p) {
  const { ok, fines } = evaluateApproval(p);
  if (!ok) {
    fines.forEach((f) => addFine(f.text, f.amount));
    toast(`טעות! ${fines[0].text} · קנס ₪${fines[0].amount}`, 'err');
  } else {
    adjustReputation(+2);
    adjustQueue(-12);
    toast('הנוסע אושר ונשלח לגייט ✓', 'ok');
  }
  state.processed++;
  handled++;
  nextOrGate();
}

function decideDetain(p) {
  const shouldStop = !p.passport.valid
    || (p.dest.requiresVisa && !p.hasVisa)
    || p.status === 'smuggler' || p.status === 'threat';
  if (shouldStop) {
    adjustReputation(+4);
    toast('זיהוי נכון! הנוסע עוכב לבדיקה מעמיקה ✓', 'ok');
  } else {
    adjustReputation(-6);
    adjustQueue(+8);
    toast('עיכבת נוסע תמים — בזבזת זמן והתור מתארך', 'warn');
  }
  state.processed++;
  handled++;
  nextOrGate();
}

function nextOrGate() {
  renderStatusBar();
  // נקה תג ביטחון אם פתוח
  const menu = document.getElementById('sec-menu');
  if (menu) menu.remove();
  const tray = document.getElementById('printer-tray');
  if (tray) tray.innerHTML = '';
  setTimeout(loadNextPassenger, 600);
}

function renderTerminalIdle() {
  document.getElementById('term-body').innerHTML =
    `<div class="text-cyan-600/80 text-sm">לחץ <b>F1 · סרוק דרכון</b> כדי להתחיל לטפל בנוסע.</div>`;
  document.getElementById('term-decision').innerHTML = '';
}

function finishCheckin() {
  toast('שלב הצ׳ק-אין הסתיים — עוברים לגייט', 'info');
  setTimeout(() => startGate(), 900);
}
