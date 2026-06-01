// security.js — תפקיד בודק ביטחוני (סלקטור).
// שיקוף כבודת-יד ברנטגן (זיהוי חפצים אסורים), מסך פרופיילר מודיעין, תשאול חופשי
// (קול/הקלדה) עם מד-לחץ ואמינות, ובדיקת תעודות. החלטה: העבר הלאה / עכב לחקירה.

import { state, startClock, adjustReputation, adjustQueue, addFine } from './state.js';
import { generatePassenger } from './passenger.js';
import { createAvatarSVG, applyStress, bodyLanguageTag } from './avatar.js';
import { askPassenger } from './dialogue.js';
import { setupVoice, isVoiceSupported } from './voice.js';
import { openSettings } from './settings.js';
import {
  statusBarHtml, renderStatusBar, toast, pushBubble, clearBubbles, renderBubbles, escapeHtml,
} from './ui.js';
import { showDebrief } from './main.js';
import { SECURITY_QUESTIONS, RULES } from './data.js';

let TARGET = 6;
let handled = 0, caught = 0;
let questionsShown = false;

// ---- מאגר חפצי רנטגן ----
// suspicious=true => חפץ אסור שיש לסמן. כל חפץ מצויר כצללית פשוטה ב-SVG.
const XRAY_POOL = [
  { id: 'laptop',  label: 'מחשב נייד', susp: false, shape: (x, y) => `<rect x="${x}" y="${y}" width="58" height="38" rx="3"/>` },
  { id: 'clothes', label: 'בגדים',     susp: false, shape: (x, y) => `<path d="M${x} ${y+26} q14 -22 28 0 q14 -22 28 0 v18 h-56 Z"/>` },
  { id: 'book',    label: 'ספר',       susp: false, shape: (x, y) => `<rect x="${x}" y="${y}" width="34" height="44" rx="2"/>` },
  { id: 'phone',   label: 'טלפון',     susp: false, shape: (x, y) => `<rect x="${x}" y="${y}" width="20" height="38" rx="4"/>` },
  { id: 'shoes',   label: 'נעליים',    susp: false, shape: (x, y) => `<path d="M${x} ${y+20} h40 q8 0 8 8 h-48 Z"/>` },
  { id: 'camera',  label: 'מצלמה',     susp: false, shape: (x, y) => `<rect x="${x}" y="${y}" width="40" height="26" rx="3"/><circle cx="${x+20}" cy="${y+13}" r="8"/>` },
  // אסורים
  { id: 'knife',   label: 'סכין',      susp: true,  shape: (x, y) => `<path d="M${x} ${y+6} l44 -4 l-6 8 l-38 4 Z"/><rect x="${x-14}" y="${y+4}" width="16" height="6" rx="2"/>` },
  { id: 'liquid',  label: 'נוזל גדול (>100 מ"ל)', susp: true, shape: (x, y) => `<rect x="${x+6}" y="${y}" width="20" height="48" rx="6"/><rect x="${x+12}" y="${y-8}" width="8" height="10"/>` },
  { id: 'battery', label: 'סוללת ליתיום חשודה',  susp: true, shape: (x, y) => `<rect x="${x}" y="${y}" width="46" height="24" rx="2"/><rect x="${x+46}" y="${y+8}" width="6" height="8"/>` },
  { id: 'wires',   label: 'צרור חוטים חשוד',     susp: true, shape: (x, y) => `<path d="M${x} ${y+20} q12 -20 24 0 q12 20 24 0" fill="none" stroke-width="4"/>` },
];

function buildXray(p) {
  // 3-5 חפצים תמימים
  const benign = XRAY_POOL.filter((i) => !i.susp);
  const shuffled = benign.sort(() => Math.random() - 0.5).slice(0, 3 + Math.floor(Math.random() * 3));
  const items = shuffled.map((i) => ({ ...i }));
  // הזרקת חפץ אסור למבריח/חשוד (או 8% רנדומלי)
  const danger = p.status === 'smuggler' || p.status === 'threat' || Math.random() < 0.08;
  if (danger) {
    const bad = XRAY_POOL.filter((i) => i.susp);
    items.push({ ...bad[Math.floor(Math.random() * bad.length)] });
  }
  // מיקום בתוך התיק (גריד 3 עמודות)
  return items.sort(() => Math.random() - 0.5).map((it, idx) => ({
    ...it, flagged: false,
    x: 60 + (idx % 3) * 120 + Math.random() * 20,
    y: 60 + Math.floor(idx / 3) * 90 + Math.random() * 15,
  }));
}

function buildIntel(p) {
  const shady = p.status === 'smuggler' || p.status === 'threat';
  return {
    history: shady && Math.random() < 0.7 ? '4 טיסות ליעדים רגישים בשנה האחרונה' : 'דפוס נסיעות רגיל, מעט טיסות',
    payment: shady && Math.random() < 0.6 ? 'כרטיס נרכש במזומן, ~90 דק׳ לפני הטיסה' : 'נרכש מראש בכרטיס אשראי',
    lastNight: shady && Math.random() < 0.5 ? 'כתובת לינה לא מאומתת' : 'לן בכתובת מגוריו',
    alert: p.status === 'threat' && Math.random() < 0.6 ? 'סומן בעבר לבדיקה מדגמית' : 'אין התרעות',
  };
}

function buildDocs(p) {
  // forged רק לחשוד; אחרת תקין (תוקף עדיין יכול להיות בעיה אבל זה תפקיד הצ'ק-אין)
  const forged = p.status === 'threat' && Math.random() < 0.5;
  return { forged, photoMatch: !forged, name: p.name };
}

function makeCase() {
  const p = generatePassenger();
  p.xray = buildXray(p);
  p.intel = buildIntel(p);
  p.docs = buildDocs(p);
  p.hasProhibited = p.xray.some((i) => i.susp);
  p.shouldDetain = p.hasProhibited || p.docs.forged || p.status === 'threat';
  p.screened = false; p.docsChecked = false;
  return p;
}

export function startSecurity(caseCount = 6) {
  TARGET = caseCount;
  handled = 0; caught = 0;
  state.queue = [];
  for (let i = 0; i < TARGET; i++) state.queue.push(makeCase());
  renderScreen();
  startClock();
  loadNext();
}

function renderScreen() {
  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="h-full flex flex-col">
    ${statusBarHtml('עמדת ביטחון · סלקציה · מסוע 4')}
    <div class="flex-1 grid grid-cols-5 gap-3 p-3 overflow-hidden">
      <section class="col-span-2 flex flex-col bg-[#0e1726] rounded-xl border border-slate-700 overflow-hidden">
        <div class="px-4 py-2 bg-slate-800/60 text-slate-300 text-sm font-semibold border-b border-slate-700">תשאול נוסע</div>
        <div class="flex-1 flex flex-col p-3 overflow-hidden">
          <div class="flex gap-3 items-start">
            <div class="relative">
              <div id="avatar-frame" class="avatar-frame w-28 h-32 rounded-xl border-2 overflow-hidden bg-black"></div>
              <div id="body-tag" class="body-tag"></div>
            </div>
            <div class="flex-1">
              <div id="id-card" class="id-card"></div>
              <div class="stress-wrap mt-2">
                <div class="stress-label">מד לחץ <span id="stress-val">0%</span></div>
                <div class="stress-bar"><div id="stress-fill" class="stress-fill"></div></div>
              </div>
            </div>
          </div>
          <div id="chat-box" class="chat-box mt-3 flex-1"></div>
          <div id="interim" class="text-xs text-slate-500 h-4 px-1"></div>
          <div class="flex gap-2 mt-1">
            <button id="mic-btn" class="mic-btn" title="תשאל את הנוסע">🎙️<span class="mic-label">דבר</span></button>
            <input id="ask-input" type="text" placeholder="הקלד שאלת תשאול..." class="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
            <button id="ask-send" class="btn-primary px-4">שלח</button>
          </div>
        </div>
      </section>

      <section class="col-span-3 flex flex-col bg-[#02160a] rounded-xl border border-emerald-900/60 overflow-hidden terminal sec-term">
        <div class="terminal-header sec-header"><span>מסוף מודיעין ביטחוני — SECURE·HE</span><span class="text-emerald-500">● מקוון</span></div>
        <div class="flex-1 grid grid-rows-[auto_1fr_auto] overflow-hidden">
          <div class="term-toolbar sec-toolbar">
            <button class="term-btn sec-btn" data-act="profile">פרופיילר מודיעין</button>
            <button class="term-btn sec-btn" data-act="xray">שיקוף תיק (רנטגן)</button>
            <button class="term-btn sec-btn" data-act="docs">בדיקת תעודות</button>
            <button class="term-btn sec-btn" data-act="questions">שאלות תשאול</button>
          </div>
          <div id="sec-body" class="term-body"></div>
          <div id="sec-decision" class="term-decision"></div>
        </div>
      </section>
    </div>
  </div>`;

  document.getElementById('sb-settings').addEventListener('click', () => openSettings());
  const input = document.getElementById('ask-input');
  const send = () => { const t = input.value.trim(); if (!t) return; input.value = ''; handleQuestion(t); };
  document.getElementById('ask-send').addEventListener('click', send);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  setupVoice({ button: document.getElementById('mic-btn'), interimEl: document.getElementById('interim'), onFinal: (t) => handleQuestion(t) });
  if (!isVoiceSupported()) document.getElementById('interim').textContent = 'זיהוי קולי לא נתמך בדפדפן זה — אפשר להקליד';

  app.querySelectorAll('.sec-btn').forEach((b) => b.addEventListener('click', () => doAct(b.dataset.act)));
  renderStatusBar();
}

function loadNext() {
  questionsShown = false;
  clearBubbles();
  if (state.queue.length === 0) return finish();
  const p = state.queue.shift();
  state.current = p;

  const frame = document.getElementById('avatar-frame');
  frame.innerHTML = createAvatarSVG(p.seed, p.gender);
  applyStress(frame, p.stress);
  document.getElementById('body-tag').textContent = bodyLanguageTag(p.stress);
  updateStressBar(p.stress);

  document.getElementById('id-card').innerHTML = `
    <div class="text-white font-bold">${escapeHtml(p.name)}</div>
    <div class="text-slate-400 text-xs">גיל ${p.age} · ${escapeHtml(p.origin)}</div>
    <div class="text-xs text-slate-300 mt-1">יעד: ${escapeHtml(p.dest.city)} · ${p.flight.code}</div>`;

  pushBubble('passenger', greeting(p));
  document.getElementById('sec-body').innerHTML = `<div class="text-emerald-600/80 text-sm">בחר כלי בדיקה מהסרגל למעלה. תשאל את הנוסע, שקף את התיק ובדוק תעודות לפני החלטה.</div>`;
  renderDecision();
}

function greeting(p) {
  if (p.status === 'threat') return 'שלום. יש בעיה כלשהי?';
  if (p.status === 'smuggler') return 'היי, אפשר לעבור? אני קצת ממהר לטיסה.';
  if (p.status === 'nervous') return 'שלום... אני תמיד לחוץ בבידוק, סליחה.';
  return 'בוקר טוב, הכל בסדר.';
}

function doAct(act) {
  const p = state.current;
  if (act === 'profile') return renderProfile(p);
  if (act === 'xray') return renderXray(p);
  if (act === 'docs') return renderDocs(p);
  if (act === 'questions') return toggleQuestions(p);
}

function renderProfile(p) {
  const it = p.intel;
  const row = (label, val, bad) => `<div class="prof-row"><span class="prof-l">${label}</span><span class="${bad ? 'text-red-400' : 'text-emerald-300'}">${val}</span></div>`;
  const badHist = /רגישים/.test(it.history), badPay = /מזומן/.test(it.payment), badNight = /לא מאומתת/.test(it.lastNight), badAlert = it.alert !== 'אין התרעות';
  document.getElementById('sec-body').innerHTML = `
    <div class="profiler">
      <div class="prof-title">▸ דוח מודיעין · רשות שדות התעופה</div>
      ${row('שם', p.name, false)}
      ${row('היסטוריית טיסות', it.history, badHist)}
      ${row('אופן רכישת כרטיס', it.payment, badPay)}
      ${row('לינה אחרונה', it.lastNight, badNight)}
      ${row('התרעות קודמות', it.alert, badAlert)}
    </div>`;
}

function renderXray(p) {
  const items = p.xray.map((it, i) => `
    <g class="xray-item ${it.flagged ? 'flagged' : ''}" data-i="${i}" transform="translate(${it.x},${it.y})">
      <g class="xray-shape">${it.shape(0, 0)}</g>
      <rect class="xray-hit" x="-20" y="-20" width="90" height="80" fill="transparent"/>
    </g>`).join('');
  document.getElementById('sec-body').innerHTML = `
    <div class="text-xs text-emerald-400/80 mb-1">לחץ על חפץ חשוד כדי לסמנו (נוזלים מעל 100 מ"ל, סכינים, סוללות ליתיום, חוטים).</div>
    <div class="xray-screen">
      <svg viewBox="0 0 460 240" class="w-full">
        <rect x="20" y="30" width="420" height="190" rx="16" class="xray-bag"/>
        <g class="xray-items" fill="#86efac">${items}</g>
      </svg>
    </div>
    <div id="xray-legend" class="text-xs mt-1 text-slate-400"></div>`;
  const svg = document.querySelector('.xray-items');
  svg.querySelectorAll('.xray-item').forEach((g) => g.addEventListener('click', () => {
    const i = +g.dataset.i; p.xray[i].flagged = !p.xray[i].flagged;
    g.classList.toggle('flagged');
    const it = p.xray[i];
    document.getElementById('xray-legend').textContent = it.flagged
      ? `סומן: ${it.label}${it.susp ? ' ⚠ חשוד!' : ' (תקין)'}` : '';
  }));
}

function renderDocs(p) {
  p.docsChecked = true;
  const d = p.docs;
  document.getElementById('sec-body').innerHTML = `
    <div class="docs-view">
      <div class="docs-photo ${d.forged ? 'docs-bad' : ''}">
        <div class="text-[10px] text-slate-400 mb-1">תמונת דרכון</div>
        <div class="docs-avatar">${createAvatarSVG(d.forged ? p.seed + 999 : p.seed, p.gender)}</div>
      </div>
      <div class="flex-1 text-sm">
        <div class="prof-row"><span class="prof-l">שם בדרכון</span><span class="text-white">${escapeHtml(p.name)}</span></div>
        <div class="prof-row"><span class="prof-l">התאמת תמונה לפנים</span><span class="${d.photoMatch ? 'text-emerald-300' : 'text-red-400'}">${d.photoMatch ? '✓ תואם' : '⛔ אינה תואמת'}</span></div>
        <div class="prof-row"><span class="prof-l">סימני זיוף</span><span class="${d.forged ? 'text-red-400' : 'text-emerald-300'}">${d.forged ? '⛔ חשד לזיוף (גופן/למינציה)' : '✓ לא נמצאו'}</span></div>
      </div>
    </div>`;
}

function toggleQuestions(p) {
  questionsShown = !questionsShown;
  let menu = document.getElementById('sec-menu');
  if (!questionsShown) { if (menu) menu.remove(); return; }
  if (menu) return;
  menu = document.createElement('div');
  menu.id = 'sec-menu'; menu.className = 'sec-menu';
  menu.innerHTML = SECURITY_QUESTIONS.map((q, i) => `<button class="sec-q" data-q="${i}">${escapeHtml(q)}</button>`).join('');
  document.getElementById('chat-box').after(menu);
  menu.querySelectorAll('.sec-q').forEach((b) => b.addEventListener('click', () => {
    let q = SECURITY_QUESTIONS[+b.dataset.q];
    if (q.includes('מטרת הנסיעה')) q = `מה מטרת הנסיעה שלך ל${p.dest.city}?`;
    handleQuestion(q);
  }));
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
  updateStressBar(p.stress);
}

function updateStressBar(v) {
  const fill = document.getElementById('stress-fill');
  if (!fill) return;
  fill.style.width = `${v}%`;
  fill.style.background = v < 35 ? '#10B981' : v < 65 ? '#F59E0B' : '#EF4444';
  const val = document.getElementById('stress-val');
  if (val) val.textContent = `${Math.round(v)}%`;
}

function renderDecision() {
  const dec = document.getElementById('sec-decision');
  dec.innerHTML = `
    <button class="btn-approve" id="sec-pass">✓ העבר לצ׳ק-אין</button>
    <button class="btn-detain" id="sec-hold">⛔ עכב לחקירה / שיקוף מחמיר</button>`;
  dec.querySelector('#sec-pass').addEventListener('click', () => decide(false));
  dec.querySelector('#sec-hold').addEventListener('click', () => decide(true));
}

function decide(detain) {
  const p = state.current;
  const flaggedRight = p.xray.filter((i) => i.susp && i.flagged).length;
  const flaggedWrong = p.xray.filter((i) => !i.susp && i.flagged).length;

  if (detain) {
    if (p.shouldDetain) {
      caught++; adjustReputation(+5);
      toast(flaggedRight ? 'מצוין! זוהה חפץ אסור והנוסע עוכב ✓' : 'זיהוי נכון — הנוסע עוכב לבדיקה ✓', 'ok');
    } else {
      adjustReputation(-6); adjustQueue(+8);
      toast('עיכבת נוסע תמים — עומס בתור ופגיעה בשירות', 'warn');
    }
  } else {
    if (p.shouldDetain) {
      addFine('מחדל ביטחוני: הועבר נוסע מסוכן/חפץ אסור', RULES.FINE_SECURITY);
      toast(`⛔ מחדל ביטחוני חמור! קנס ₪${RULES.FINE_SECURITY}`, 'err');
    } else {
      adjustReputation(+2); adjustQueue(-10);
      toast('הנוסע עבר את הבידוק ✓', 'ok');
    }
  }
  if (flaggedWrong) adjustReputation(-1);
  state.processed++; handled++;
  const menu = document.getElementById('sec-menu'); if (menu) menu.remove();
  renderStatusBar();
  setTimeout(loadNext, 600);
}

function finish() {
  state.summaryTitle = 'סיכום משמרת ביטחון';
  state.summaryTiles = [
    { num: state.processed, label: 'נוסעים שעברו בידוק' },
    { num: caught, label: 'איומים שנתפסו', cls: 'text-emerald-300' },
  ];
  toast('המשמרת הסתיימה', 'info');
  setTimeout(() => showDebrief(), 800);
}
