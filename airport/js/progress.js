// progress.js — קריירה מתמשכת בין משמרות: XP, דרגות, סטטיסטיקות מצטברות.
// נשמר ב-localStorage בדפדפן בלבד.

const KEY = 'airport_career';

const RANKS = [
  { xp: 0,    name: 'מתלמד' },
  { xp: 120,  name: 'דייל זוטר' },
  { xp: 350,  name: 'דייל מן המניין' },
  { xp: 700,  name: 'דייל בכיר' },
  { xp: 1200, name: 'ראש משמרת' },
  { xp: 2000, name: 'מנהל תפעול' },
  { xp: 3200, name: 'מנהל נמל התעופה' },
];

function def() { return { xp: 0, shifts: 0, earnings: 0, perfect: 0 }; }

export function load() {
  try { return Object.assign(def(), JSON.parse(localStorage.getItem(KEY)) || {}); }
  catch { return def(); }
}
function persist(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* */ } }

export function rankFor(xp) { let r = RANKS[0]; for (const x of RANKS) if (xp >= x.xp) r = x; return r; }
export function nextRank(xp) { return RANKS.find((x) => x.xp > xp) || null; }

// פרס XP בסוף משמרת. stats: {processed, reputation, net, errors}
export function award(stats) {
  const c = load();
  let gain = stats.processed * 12 + Math.round(stats.reputation / 2) + Math.max(0, Math.round(stats.net / 80));
  if (stats.errors === 0) gain += 60;
  gain = Math.max(5, gain);
  const before = rankFor(c.xp);
  c.xp += gain; c.shifts += 1; c.earnings += stats.net;
  if (stats.errors === 0) c.perfect += 1;
  const after = rankFor(c.xp);
  persist(c);
  return { gain, rankUp: after.name !== before.name, rank: after, next: nextRank(c.xp), career: c };
}

export function resetCareer() { persist(def()); }

// אחוז התקדמות לדרגה הבאה (0..100)
export function progressPct(xp) {
  const cur = rankFor(xp); const nxt = nextRank(xp);
  if (!nxt) return 100;
  return Math.round(((xp - cur.xp) / (nxt.xp - cur.xp)) * 100);
}
