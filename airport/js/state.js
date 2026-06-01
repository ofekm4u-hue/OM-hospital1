// state.js — מצב המשחק הגלובלי + פעולות לעדכונו. מודול יחיד שמשמש כ"מקור אמת".
// מסכים אחרים קוראים ומעדכנים דרך הפונקציות כאן, ומאזינים לשינויים דרך subscribe().

import { RULES } from './data.js';

const listeners = new Set();

export const state = {
  screen: 'lobby',     // lobby | setup | briefing | game | debrief
  role: null,          // checkin | security | ramp | manager
  phase: 'checkin',    // checkin | gate (בתוך מסך המשחק)
  shift: { time: 'morning', difficulty: 'regular' }, // בחירת השחקן בהגדרת המשמרת

  // נתוני משמרת
  budget: RULES.SHIFT_BUDGET,   // ₪ בקופת החברה (יורד מקנסות, עולה מאגרות)
  reputation: RULES.REP_START,  // שביעות רצון/מוניטין באחוזים
  queueLoad: 20,                // עומס תור באחוזים (0=ריק, 100=קריסה)
  clock: 6 * 60,                // שעון משמרת בדקות מאז חצות
  clockTimer: null,
  queueRate: 0.7,               // קצב התמלאות התור לדקה (לפי דרגת קושי)
  fineMult: 1,                  // מכפיל קנסות (לפי דרגת קושי)

  // מונים לסיכום
  processed: 0,                 // פריטים שטופלו בהצלחה (נוסעים/מטוסים/אירועים)
  errors: [],                   // [{text, fine}]
  feesCollected: 0,             // אגרות/הכנסות שנגבו
  summaryTiles: null,           // אריחי סיכום ספציפיים לתפקיד (נקבע ע"י המודול)
  summaryTitle: null,           // כותרת מסך הסיכום

  // נוסע נוכחי + תור
  current: null,                // אובייקט הנוסע שמטופל כרגע
  queue: [],                    // נוסעים שממתינים
  dialogue: [],                 // [{who:'agent'|'passenger', text}]
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit() {
  for (const fn of listeners) fn(state);
}

// ----- פעולות עדכון -----

export function setScreen(screen) {
  state.screen = screen;
  emit();
}

export function addFine(text, amount) {
  state.budget -= amount;
  state.reputation = Math.max(0, state.reputation - 8);
  state.errors.push({ text, fine: amount });
  emit();
}

export function addFee(text, amount) {
  state.budget += amount;
  state.feesCollected += amount;
  emit();
}

export function adjustReputation(delta) {
  state.reputation = Math.max(0, Math.min(100, state.reputation + delta));
  emit();
}

export function adjustQueue(delta) {
  state.queueLoad = Math.max(0, Math.min(100, state.queueLoad + delta));
  emit();
}

// פורמט שעון מדקות מאז חצות -> "HH:MM"
export function formatClock(mins = state.clock) {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// מחיל את בחירת המשמרת (זמן + קושי) על שעון/קצב/קנסות.
export function applyShiftConfig(shifts, diffs, shift) {
  const s = shifts.find((x) => x.id === shift.time) || shifts[0];
  const d = diffs.find((x) => x.id === shift.difficulty) || diffs[1];
  state.clock = s.start;
  state.queueLoad = s.loadStart;
  state.queueRate = d.queueRate;
  state.fineMult = d.fineMult;
  return { shift: s, diff: d };
}

// השעון רץ: כל שנייה אמיתית = דקת משחק. גם מעלה לאט את עומס התור.
export function startClock() {
  stopClock();
  state.clockTimer = setInterval(() => {
    state.clock += 1;
    // התור מתמלא לאט מעצמו; טיפול בנוסעים מורידו (בקוד התפקיד).
    state.queueLoad = Math.min(100, state.queueLoad + state.queueRate);
    emit();
  }, 1000);
}

export function stopClock() {
  if (state.clockTimer) {
    clearInterval(state.clockTimer);
    state.clockTimer = null;
  }
}

// איפוס מלא לתחילת משמרת חדשה.
export function resetShift() {
  stopClock();
  state.phase = 'checkin';
  state.budget = RULES.SHIFT_BUDGET;
  state.reputation = RULES.REP_START;
  state.queueLoad = 20;
  state.clock = 7 * 60 + 30;
  state.processed = 0;
  state.errors = [];
  state.feesCollected = 0;
  state.summaryTiles = null;
  state.summaryTitle = null;
  state.gateStats = null;
  state.current = null;
  state.queue = [];
  state.dialogue = [];
}
