// passenger.js — ייצור נוסע רנדומלי עם מסמכים (דרכון) ומצב נסתר (סטטוס, לחץ, אמינות).
// כל נוסע מקושר לטיסה ויעד, ויכול לשאת "מלכודות" שהשחקן צריך לזהות (דרכון פג, חוסר ויזה).

import {
  FIRST_NAMES_M, FIRST_NAMES_F, LAST_NAMES, ORIGINS,
  PASSENGER_STATUSES, FLIGHTS, destByCode,
} from './data.js';
import { seedFrom } from './avatar.js';

let counter = 0;

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function weightedStatus() {
  const total = PASSENGER_STATUSES.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const s of PASSENGER_STATUSES) {
    if ((r -= s.weight) <= 0) return s.id;
  }
  return 'innocent';
}

// מתאריך שעון המשחק (07:30 ב-2026-06-01) מחשבים תאריך תוקף לדרכון.
// monthsAhead = כמה חודשים קדימה מהיום תוקף הדרכון.
function passportExpiry(monthsAhead) {
  const base = new Date(2026, 5, 1); // יוני 2026
  const d = new Date(base.getFullYear(), base.getMonth() + monthsAhead, rand(1, 28));
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// מייצר נוסע. אפשר לכפות flightCode; אחרת נבחר רנדומלית.
export function generatePassenger(flightCode = null) {
  counter++;
  const gender = Math.random() < 0.5 ? 'm' : 'f';
  const first = gender === 'm'
    ? FIRST_NAMES_M[rand(0, FIRST_NAMES_M.length - 1)]
    : FIRST_NAMES_F[rand(0, FIRST_NAMES_F.length - 1)];
  const last = LAST_NAMES[rand(0, LAST_NAMES.length - 1)];
  const name = `${first} ${last}`;

  const flight = flightCode
    ? FLIGHTS.find((f) => f.code === flightCode)
    : FLIGHTS[rand(0, FLIGHTS.length - 1)];
  const dest = destByCode(flight.dest);

  const status = weightedStatus();

  // מלכודת דרכון: ~20% מהנוסעים מקבלים דרכון "גבולי" שעלול להיפסל לפי חוק החודשים.
  const trapPassport = Math.random() < 0.2;
  // אם trap: נותנים תוקף של 1-2 חודשים בלבד -> ייפסל ביעד שדורש 6.
  const monthsAhead = trapPassport ? rand(1, 2) : rand(7, 60);
  const passportValid = monthsAhead >= dest.passportMonths;

  // ויזה: אם היעד דורש ויזה, ~35% מהנוסעים "שכחו" אותה (לא מציגים).
  const hasVisa = dest.requiresVisa ? Math.random() > 0.35 : true;

  // משקל מזוודה: רוב תקין, חלק חורג.
  const roll = Math.random();
  let bagKg;
  if (roll < 0.55) bagKg = +(rand(140, 229) / 10).toFixed(1);      // 14.0–22.9
  else if (roll < 0.75) bagKg = +(rand(231, 250) / 10).toFixed(1); // חריגה קלה
  else bagKg = +(rand(252, 320) / 10).toFixed(1);                  // חריגה גסה

  // נוסע "מבריח" עם סיפור כיסוי סותר: כרטיס הלוך בלבד + מזוודה קלה.
  const oneWay = status === 'smuggler' && Math.random() < 0.7;
  if (oneWay) bagKg = +(rand(35, 60) / 10).toFixed(1);

  return {
    id: counter,
    name, first, last, gender,
    age: rand(19, 74),
    origin: ORIGINS[rand(0, ORIGINS.length - 1)],
    seed: seedFrom(name + counter),
    flight,
    dest,
    passport: {
      number: `${rand(10, 39)}${rand(1000000, 9999999)}`,
      expiry: passportExpiry(monthsAhead),
      valid: passportValid,
      monthsAhead,
    },
    hasVisa,
    oneWay,
    bag: { kg: bagKg, tagged: false, repacked: false },

    // מצב נסתר לדיאלוג ולשפת גוף
    status,                              // innocent | nervous | smuggler | threat
    stress: status === 'innocent' ? rand(8, 25)
          : status === 'nervous' ? rand(45, 70)
          : rand(35, 60),
    credibility: status === 'innocent' ? rand(80, 100) : rand(20, 60),

    // התקדמות בטיפול
    scanned: false,
    visaChecked: false,
    boardingIssued: false,
    seat: null,
  };
}

// בונה תור של n נוסעים.
export function buildQueue(n = 6) {
  const q = [];
  for (let i = 0; i < n; i++) q.push(generatePassenger());
  return q;
}

// קובע אם אישור הנוסע צריך לגרור קנס (להערכת השחקן בעת לחיצה על "אשר").
// מחזיר {ok, fines:[{text,amount}]}.
export function evaluateApproval(p) {
  const fines = [];
  if (!p.passport.valid) {
    fines.push({ text: `אושר דרכון לא-תקין (פג ביחס לחוק ${p.dest.passportMonths} החודשים של ${p.dest.country})`, amount: 5000 });
  }
  if (p.dest.requiresVisa && !p.hasVisa) {
    fines.push({ text: `אושר נוסע ללא ויזה ל${p.dest.country}`, amount: 1000 });
  }
  if (p.status === 'smuggler' || p.status === 'threat') {
    fines.push({ text: `מחדל ביטחוני: אושר נוסע בסטטוס "${p.status === 'smuggler' ? 'מבריח' : 'חשוד'}"`, amount: 8000 });
  }
  return { ok: fines.length === 0, fines };
}
