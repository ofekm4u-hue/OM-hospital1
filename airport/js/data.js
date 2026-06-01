// data.js — מאגרי נתונים למשחק: יעדים, טיסות, שמות, חוקי ויזה/תוקף ושאלות ביטחון.
// כל המחרוזות בעברית. אין כאן לוגיקה — רק נתונים גולמיים.

// יעדים אפשריים. requiresVisa = דורש אשרת כניסה. passportMonths = כמה חודשי תוקף
// נדרשים בדרכון מעבר ליום הטיסה (לרוב 6 חודשים ביעדים מסוימים, אחרת 0).
export const DESTINATIONS = [
  { code: 'CDG', city: 'פריז',     country: 'צרפת',     requiresVisa: false, passportMonths: 3 },
  { code: 'BKK', city: 'בנגקוק',   country: 'תאילנד',   requiresVisa: false, passportMonths: 6 },
  { code: 'JFK', city: 'ניו יורק', country: 'ארה"ב',    requiresVisa: true,  passportMonths: 6 },
  { code: 'LHR', city: 'לונדון',   country: 'אנגליה',   requiresVisa: false, passportMonths: 3 },
  { code: 'DXB', city: 'דובאי',    country: 'איחוד האמירויות', requiresVisa: true, passportMonths: 6 },
  { code: 'LCA', city: 'לרנקה',    country: 'קפריסין',  requiresVisa: false, passportMonths: 0 },
  { code: 'BER', city: 'ברלין',    country: 'גרמניה',   requiresVisa: false, passportMonths: 3 },
  { code: 'NRT', city: 'טוקיו',    country: 'יפן',      requiresVisa: false, passportMonths: 6 },
];

// הטיסות של המשמרת. seatsTotal = מספר מושבים; seatsSold יכול לעבור (אוברבוקינג).
export const FLIGHTS = [
  { code: 'LY315', dest: 'CDG', gate: 'B4', boarding: '08:40', seatsTotal: 150, seatsSold: 150 },
  { code: 'LY402', dest: 'BKK', gate: 'C2', boarding: '09:15', seatsTotal: 180, seatsSold: 182 }, // אוברבוקינג
  { code: 'LY008', dest: 'JFK', gate: 'D1', boarding: '10:05', seatsTotal: 220, seatsSold: 220 },
  { code: 'LY316', dest: 'LCA', gate: 'A7', boarding: '07:55', seatsTotal: 90,  seatsSold: 78  },
];

// מאגר שמות ישראליים לייצור נוסעים רנדומליים.
export const FIRST_NAMES_M = ['ישראל', 'דוד', 'יוסי', 'אבי', 'משה', 'איתי', 'עומר', 'רון', 'ניר', 'גיא', 'אורי', 'תומר'];
export const FIRST_NAMES_F = ['נועה', 'מאיה', 'שירה', 'תמר', 'יעל', 'דנה', 'רותם', 'ליאת', 'הדס', 'מיכל', 'אורית', 'גלית'];
export const LAST_NAMES = ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'אברהם', 'פרידמן', 'אזולאי', 'דהן', 'שפירא', 'גבאי', 'אוחיון'];

// ארצות מוצא להצגה בת"ז הקטנה (כמעט תמיד ישראל, לפעמים תייר).
export const ORIGINS = ['ישראל', 'ישראל', 'ישראל', 'ישראל', 'צרפת', 'ארה"ב', 'גרמניה'];

// שאלות הביטחון מתוך תפריט (לחיצה על כפתור = שאלה מהירה).
export const SECURITY_QUESTIONS = [
  'שלום, מי ארז לך את המזוודה?',
  'האם המזוודה הייתה איתך לאורך כל הזמן מאז האריזה?',
  'האם קיבלת חפץ או מתנה ממישהו להעביר בטיסה?',
  'מה מטרת הנסיעה שלך?',
];

// סטטוס נסתר אפשרי של נוסע. weight = הסתברות יחסית.
export const PASSENGER_STATUSES = [
  { id: 'innocent', label: 'תמים',     weight: 70 },
  { id: 'nervous',  label: 'לחוץ',     weight: 18 },
  { id: 'smuggler', label: 'מבריח',    weight: 8  },
  { id: 'threat',   label: 'חשוד ביטחוני', weight: 4 },
];

// קבועים כלכליים/חוקיים של המשחק (בשקלים).
export const RULES = {
  BAG_LIMIT_KG: 23,         // משקל מותר
  BAG_MINOR_KG: 25,         // עד כאן חריגה "קלה"
  EXCESS_FEE: 250,          // דמי חריגת משקל
  GATE_BAG_FEE: 180,        // דמי טרולי בגייט
  FINE_NO_VISA: 1000,       // קנס אישור ללא ויזה
  FINE_PASSPORT: 5000,      // קנס אישור דרכון לא-תקין
  FINE_SECURITY: 8000,      // קנס מחדל ביטחוני (אישור מבריח/חשוד)
  SHIFT_BUDGET: 5000,       // תקציב פתיחה
  REP_START: 80,            // מוניטין/שביעות רצון התחלתי (%)
};

// ===== בחירת משמרת =====
// זמני משמרת אפשריים (שעת התחלה בדקות מחצות) + תיאור.
export const SHIFTS = [
  { id: 'morning', label: 'משמרת בוקר', sub: '06:00 — שיא עומס יציאות', start: 6 * 60,  loadStart: 35 },
  { id: 'noon',    label: 'משמרת צהריים', sub: '13:00 — קצב מתון', start: 13 * 60, loadStart: 20 },
  { id: 'evening', label: 'משמרת ערב',  sub: '18:00 — גל טיסות שני', start: 18 * 60, loadStart: 30 },
  { id: 'night',   label: 'משמרת לילה', sub: '23:00 — טיסות בודדות, צוות מצומצם', start: 23 * 60, loadStart: 15 },
];

// דרגות קושי: משפיעות על מספר הנוסעים/המקרים, קצב התור והעונשים.
export const DIFFICULTIES = [
  { id: 'trainee', label: 'מתלמד',  cases: 4, queueRate: 0.4, fineMult: 0.5, sub: 'קצב נינוח, קנסות מופחתים' },
  { id: 'regular', label: 'דייל מן המניין', cases: 6, queueRate: 0.7, fineMult: 1, sub: 'הקצב הסטנדרטי' },
  { id: 'rush',    label: 'שעת עומס', cases: 9, queueRate: 1.1, fineMult: 1.3, sub: 'תור מתמלא מהר, לחץ גבוה' },
  { id: 'chaos',   label: 'כאוס מבצעי', cases: 12, queueRate: 1.5, fineMult: 1.6, sub: 'לב חזק בלבד' },
];

// ===== בנק שאלות מורחב (תשאול + שירות) =====
export const QUESTION_BANK = {
  'מסמכים ויעד': [
    'לאן אתה טס היום?',
    'מה מטרת הנסיעה שלך?',
    'כמה זמן בכוונתך לשהות ביעד?',
    'יש לך כרטיס חזור?',
    'יש לך ויזה ליעד?',
    'היכן תשהה במהלך הביקור?',
  ],
  'ביטחון': [
    'מי ארז לך את המזוודה?',
    'האם המזוודה הייתה איתך כל הזמן מאז האריזה?',
    'האם קיבלת חפץ או מתנה ממישהו להעביר?',
    'האם אתה נושא נוזלים, חדים או סוללות בכבודת היד?',
    'האם מישהו ביקש ממך להעביר משהו בטיסה?',
  ],
  'שירות': [
    'האם תרצה מושב חלון או מעבר?',
    'האם יש לך כבודה נוספת לשלוח?',
    'האם תרצה הזמנת ארוחה מיוחדת?',
    'האם אתה זקוק לסיוע מיוחד (כיסא גלגלים)?',
  ],
};

// קודי SSR (בקשות שירות מיוחדות) לבחירה במערכת.
export const SSR_CODES = [
  { code: '—',    label: 'ללא' },
  { code: 'WCHR', label: 'כיסא גלגלים (WCHR)' },
  { code: 'UMNR', label: 'קטין ללא ליווי (UMNR)' },
  { code: 'INFT', label: 'תינוק על הברכיים (INFT)' },
  { code: 'PETC', label: 'חיית מחמד בתא (PETC)' },
  { code: 'BLND', label: 'נוסע עיוור (BLND)' },
];

export const MEAL_OPTIONS = [
  { code: 'STD',  label: 'רגילה' },
  { code: 'KSML', label: 'כשרה (KSML)' },
  { code: 'VGML', label: 'צמחונית (VGML)' },
  { code: 'MOML', label: 'מוסלמית (MOML)' },
  { code: 'CHML', label: 'ילדים (CHML)' },
];

export const DOC_TYPES = [
  { code: 'P',  label: 'דרכון (P)' },
  { code: 'ID', label: 'תעודת זהות (ID)' },
  { code: 'PD', label: 'דרכון דיפלומטי (PD)' },
];

export const CABIN_CLASSES = [
  { code: 'Y', label: 'תיירים (Y)' },
  { code: 'W', label: 'פרימיום (W)' },
  { code: 'C', label: 'עסקים (C)' },
];

// יעד -> אובייקט יעד מלא.
export function destByCode(code) {
  return DESTINATIONS.find((d) => d.code === code);
}

export function flightByCode(code) {
  return FLIGHTS.find((f) => f.code === code);
}
