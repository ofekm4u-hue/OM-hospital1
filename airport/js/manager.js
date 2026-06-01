// manager.js — תפקיד מנהל משמרת שדה (Duty Manager) — "God Mode".
// לוח טיסות מרכזי (FIDS), ניהול תקציב וכוח אדם, וקבלת החלטות במשברים בזמן אמת.

import { state, startClock, stopClock, adjustReputation, addFine, emit } from './state.js';
import { statusBarHtml, renderStatusBar, toast, escapeHtml } from './ui.js';
import { openSettings } from './settings.js';
import { showDebrief } from './main.js';

function spend(amount) { state.budget -= amount; emit(); }

let staff = 8, desksOpen = 2, goodCalls = 0, evIdx = 0;

const FIDS = [
  { code: 'LY315', dest: 'פריז',     status: 'צ׳ק-אין', load: 40 },
  { code: 'LY402', dest: 'בנגקוק',   status: 'בורדינג', load: 65 },
  { code: 'LY008', dest: 'ניו יורק', status: 'צ׳ק-אין', load: 80 },
  { code: 'LY316', dest: 'לרנקה',    status: 'מעוכבת',  load: 20 },
  { code: 'LY221', dest: 'לונדון',   status: 'בורדינג', load: 55 },
];

// אירועי משבר. כל אופציה: השפעות על תקציב/מוניטין + האם זו ההחלטה הנכונה.
const EVENTS = [
  {
    title: 'תקלת מסועי מזוודות — טרמינל 3',
    text: 'מערכת המסועים הושבתה. התורים מתארכים במהירות. מה עושים?',
    opts: [
      { label: 'מעבר לעבודה ידנית (קצב -50%)', rep: -4, cost: 1200, good: true, msg: 'עברתם לעבודה ידנית — איטי אך הטיסות ממשיכות.' },
      { label: 'עצירת כל הטיסות עד תיקון', rep: -12, cost: 0, good: false, msg: 'עצרת הכל — עיכובים מסיביים וכעס.' },
      { label: 'להתעלם ולקוות לטוב', rep: -18, cost: 0, good: false, msg: 'התעלמת — התורים קרסו.' },
    ],
  },
  {
    title: 'נוסע משתולל בשער B3',
    text: 'נוסע בטיסה ללונדון התפרע. הטיסה מתעכבת. תגובה?',
    opts: [
      { label: 'הזמן משטרה ופרק את מזוודתו (+20 דק׳)', rep: +6, cost: 0, good: true, msg: 'הנוסע סולק בבטחה, מזוודתו פורקה. נוהל תקין.' },
      { label: 'נסה להרגיע ולהעלות אותו', rep: -10, cost: 0, good: false, msg: 'המצב הסלים — סיכון בטיחותי.' },
    ],
  },
  {
    title: 'ערפל כבד — מגדל סגר את המסלול',
    text: '5 טיסות מעוכבות, ~1000 נוסעים תקועים בטרמינל. כיצד תנהל את ההמון?',
    opts: [
      { label: 'חלוקת שוברי אוכל', rep: +5, cost: 1500, good: true, msg: 'השוברים הרגיעו את ההמון.' },
      { label: 'אוטובוסים ומלונות לכולם', rep: +8, cost: 6000, good: true, msg: 'יקר מאוד אך שביעות הרצון זינקה.' },
      { label: 'שיישנו על הרצפה', rep: -15, cost: 0, good: false, msg: 'מחאה זועמת התפרצה בטרמינל.' },
    ],
  },
  {
    title: 'תיק ללא בעלים ליד שער B3',
    text: 'התקבלה התראה על חפץ חשוד. כל שנייה קריטית.',
    opts: [
      { label: 'סגור אזור B והזעק חבלן', rep: +7, cost: 0, good: true, msg: 'האזור פונה, החבלן בדק — אזעקת שווא. פעלת נכון.' },
      { label: 'שלח מאבטח לבדוק לבד', rep: -8, cost: 0, good: false, msg: 'סיכנת חיי אדם — נוהל שגוי.' },
      { label: 'להתעלם, בטח שכחו תיק', rep: -25, cost: 4000, good: false, msg: 'מחדל ביטחוני חמור! פינוי חירום של הטרמינל.' },
    ],
  },
  {
    title: 'עומס קיצוני בטיסת ניו יורק',
    text: 'התור לטיסת LY008 מתפוצץ. הטיסה ממריאה בקרוב.',
    opts: [
      { label: 'העבר דיילים מטיסת לרנקה הריקה', rep: +6, cost: 0, good: true, msg: 'הקצאת כוח אדם חכמה — התור התקצר.' },
      { label: 'פתח 2 עמדות נוספות (₪1,000)', rep: +4, cost: 1000, good: true, msg: 'פתחת עמדות — עלה כסף אך עזר.' },
      { label: 'אל תעשה כלום', rep: -10, cost: 0, good: false, msg: 'נוסעים פספסו את הטיסה.' },
    ],
  },
];

export function startManager() {
  staff = 8; desksOpen = 2; goodCalls = 0; evIdx = 0;
  renderScreen();
  startClock();
  showEvent();
}

function renderScreen() {
  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="h-full flex flex-col">
    ${statusBarHtml('מנהל משמרת · חדר בקרה ראשי')}
    <div class="flex-1 grid grid-cols-5 gap-3 p-3 overflow-hidden">
      <section class="col-span-3 flex flex-col bg-[#03142b] rounded-xl border border-cyan-900/60 overflow-hidden">
        <div class="terminal-header"><span>לוח טיסות מרכזי — FIDS</span><span class="text-cyan-500">● זמן אמת</span></div>
        <div class="fids">
          <div class="fids-row fids-head"><span>טיסה</span><span>יעד</span><span>סטטוס</span><span>עומס תור</span></div>
          <div id="fids-rows"></div>
        </div>
        <div class="px-3 py-2 border-t border-cyan-900/60">
          <div class="text-xs text-slate-400 mb-1">פעולות ניהול מהירות:</div>
          <div class="flex gap-2 flex-wrap">
            <button class="term-btn" id="act-desk">פתח עמדת צ׳ק-אין (₪500)</button>
            <button class="term-btn" id="act-clean">צוות ניקיון דחוף (₪300)</button>
            <button class="term-btn" id="act-info">עדכון כריזה לנוסעים</button>
          </div>
        </div>
      </section>
      <section class="col-span-2 flex flex-col bg-[#0e1726] rounded-xl border border-slate-700 overflow-hidden">
        <div class="px-4 py-2 bg-slate-800/60 text-slate-300 text-sm font-semibold border-b border-slate-700">מרכז שליטה</div>
        <div class="p-3 flex flex-col gap-3 flex-1 overflow-y-auto">
          <div class="grid grid-cols-2 gap-2">
            <div class="stat-pill"><div class="stat-num" id="m-staff">${staff}</div><div class="stat-lbl">דיילים זמינים</div></div>
            <div class="stat-pill"><div class="stat-num" id="m-desks">${desksOpen}</div><div class="stat-lbl">עמדות פתוחות</div></div>
          </div>
          <div id="event-host" class="event-host flex-1"></div>
        </div>
      </section>
    </div>
  </div>`;
  document.getElementById('sb-settings').addEventListener('click', () => openSettings());
  document.getElementById('act-desk').addEventListener('click', () => { if (state.budget < 500) return toast('אין מספיק תקציב', 'err'); spend(500); desksOpen++; document.getElementById('m-desks').textContent = desksOpen; lowerLoads(12); adjustReputation(+2); toast('עמדה נוספת נפתחה', 'ok'); });
  document.getElementById('act-clean').addEventListener('click', () => { if (state.budget < 300) return toast('אין מספיק תקציב', 'err'); spend(300); adjustReputation(+2); toast('צוות ניקיון נשלח — שב"ר עלה', 'ok'); });
  document.getElementById('act-info').addEventListener('click', () => { adjustReputation(+1); toast('📢 כריזת עדכון לנוסעים', 'info'); });
  renderFids();
  renderStatusBar();
}

function renderFids() {
  document.getElementById('fids-rows').innerHTML = FIDS.map((f) => {
    const c = f.load > 75 ? 'bg-red-500' : f.load > 45 ? 'bg-amber-400' : 'bg-emerald-500';
    const sc = f.status === 'מעוכבת' ? 'text-red-400' : f.status === 'בורדינג' ? 'text-emerald-300' : 'text-cyan-300';
    return `<div class="fids-row"><span class="ltr">${f.code}</span><span>${f.dest}</span><span class="${sc}">${f.status}</span>
      <span class="fids-load"><span class="fids-fill ${c}" style="width:${f.load}%"></span></span></div>`;
  }).join('');
}
function lowerLoads(n) { FIDS.forEach((f) => { if (f.status === 'צ׳ק-אין') f.load = Math.max(5, f.load - n); }); renderFids(); }

function showEvent() {
  const host = document.getElementById('event-host');
  if (evIdx >= EVENTS.length) {
    host.innerHTML = `<div class="alert alert-ok">✓ כל המשברים טופלו. המשמרת הסתיימה.</div>`;
    return setTimeout(finish, 1200);
  }
  const ev = EVENTS[evIdx];
  host.innerHTML = `
    <div class="event-card">
      <div class="event-badge">⚠ משבר ${evIdx + 1}/${EVENTS.length}</div>
      <div class="event-title">${escapeHtml(ev.title)}</div>
      <div class="event-text">${escapeHtml(ev.text)}</div>
      <div class="event-opts">${ev.opts.map((o, i) => `<button class="event-opt" data-i="${i}">${escapeHtml(o.label)}</button>`).join('')}</div>
      <div id="event-msg" class="stage-msg"></div>
    </div>`;
  host.querySelectorAll('.event-opt').forEach((b) => b.addEventListener('click', () => choose(ev, +b.dataset.i, host)));
  // עומסים עולים בזמן שמתלבטים
  FIDS.forEach((f) => { if (f.status === 'צ׳ק-אין') f.load = Math.min(100, f.load + 6); }); renderFids();
}

function choose(ev, i, host) {
  const o = ev.opts[i];
  if (o.cost) spend(o.cost);
  adjustReputation(o.rep);
  if (o.rep <= -15) addFine('החלטת ניהול כושלת', 0);
  if (o.good) goodCalls++;
  state.processed++;
  host.querySelectorAll('.event-opt').forEach((b) => b.disabled = true);
  document.getElementById('event-msg').innerHTML = `<span class="${o.good ? 'ok' : 'err'}">${o.good ? '✓' : '⛔'} ${escapeHtml(o.msg)}</span>`;
  toast(o.msg, o.good ? 'ok' : 'warn');
  renderStatusBar();
  evIdx++;
  setTimeout(showEvent, 1400);
}

function finish() {
  stopClock();
  state.summaryTitle = 'סיכום משמרת ניהול';
  state.summaryTiles = [
    { num: `${goodCalls}/${EVENTS.length}`, label: 'החלטות נכונות', cls: 'text-emerald-300' },
    { num: desksOpen, label: 'עמדות שהופעלו' },
  ];
  showDebrief();
}
