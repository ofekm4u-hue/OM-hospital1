// state.js — מצב המשחק הגלובלי + פעולות לעדכונו. מודול יחיד שמשמש כ"מקור אמת".
// מסכים אחרים קוראים ומעדכנים דרך הפונקציות כאן, ומאזינים לשינויים דרך subscribe().

import { RULES } from './data.js';

const listeners = new Set();

export const state = {
  screen: 'lobby',     // lobby | briefing | game | debrief
  role: null,          // 'checkin' בגרסה זו
  phase: 'checkin',    // checkin | gate (בתוך מסך המשחק)

  // נתוני משמרת
  budget: RULES.SHIFT_BUDGET,   // ₪ בקופת החברה (יורד מקנסות, עולה מאגרות)
  reputation: RULES.REP_START,  // שביעות רצון/מוניטין באחוזים
  queueLoad: 20,                // עומס תור באחוזים (0=ריק, 100=קריסה)
  clock: 7 * 60 + 30,           // שעון משמרת בדקות מאז חצות (07:30)
  clockTimer: null,

  // מונים לסיכום
  processed: 0,                 // נוסעים שטופלו בהצלחה
  errors: [],                   // [{text, fine}]
  feesCollected: 0,             // אגרות שנגבו

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

// השעון רץ: כל שנייה אמיתית = דקת משחק. גם מעלה לאט את עומס התור.
export function startClock() {
  stopClock();
  state.clockTimer = setInterval(() => {
    state.clock += 1;
    // התור מתמלא לאט מעצמו; טיפול בנוסעים מורידו (בקוד הצ'ק-אין).
    state.queueLoad = Math.min(100, state.queueLoad + 0.6);
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
  state.current = null;
  state.queue = [];
  state.dialogue = [];
}
