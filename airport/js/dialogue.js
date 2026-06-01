// dialogue.js — מנוע דיאלוג היברידי לנוסע.
// ברירת מחדל: אם הוגדר מפתח Claude API → קריאה אמיתית למודל. אחרת (או בשגיאה) →
// מנוע מילות-מפתח פנימי בעברית שעובד אופליין לחלוטין.
// בשני המקרים מוחזר אובייקט אחיד: { reply, stressDelta, bodyLanguage }.

import { getApiKey } from './settings.js';
import { bodyLanguageTag } from './avatar.js';

const STATUS_HE = { innocent: 'תמים לחלוטין', nervous: 'תמים אך חרד-טיסה ולחוץ', smuggler: 'מבריח שמנסה להסתיר חבילה שקיבל', threat: 'בעל כוונות נסתרות, מתחמק' };

// ===== נקודת הכניסה =====
export async function askPassenger(p, question) {
  const key = getApiKey();
  if (key) {
    try {
      return await askViaClaude(p, question, key);
    } catch (e) {
      console.warn('Claude API נכשל, נופלים למנוע הפנימי:', e);
      // נמשיך למנוע הפנימי
    }
  }
  return askViaKeywords(p, question);
}

// ===== מנוע Claude API (fetch ישיר מהדפדפן) =====
async function askViaClaude(p, question, key) {
  const system = `אתה משחק דמות של נוסע בדלפק צ'ק-אין בנמל תעופה בישראל. ענה אך ורק בעברית, במשפט אחד או שניים, בגוף ראשון, בצורה טבעית ומציאותית.
פרטי הדמות:
- שם: ${p.name}, גיל: ${p.age}, יעד: ${p.dest.city} (${p.dest.country}), טיסה: ${p.flight.code}.
- אופי נסתר: ${STATUS_HE[p.status]}.
- רמת לחץ נוכחית: ${Math.round(p.stress)} מתוך 100.
${p.oneWay ? '- יש לך רק כרטיס הלוך, בלי חזור, והמזוודה שלך קלה מאוד — זה סותר סיפור של טיול ארוך.' : ''}
${p.status === 'smuggler' ? '- מישהו ביקש ממך להעביר חבילה/מתנה, ואתה מנסה להעלים זאת אך מסתבך כשלוחצים עליך.' : ''}
החזר JSON בלבד במבנה: {"reply":"<תשובת הנוסע>","stress_delta":<מספר שלם בין -10 ל-25 לפי כמה השאלה מלחיצה>,"body_language":"<תגית קצרה בסוגריים מרובעים כמו [מזיע] או ריק>"}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: `הדייל שואל אותך: "${question}"` }],
    }),
  });

  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  const text = (data.content || []).map((c) => c.text || '').join('').trim();
  const parsed = safeParseJson(text);
  if (!parsed) return { reply: text || '...', stressDelta: 4, bodyLanguage: '' };
  return {
    reply: parsed.reply || '...',
    stressDelta: clampNum(parsed.stress_delta, -10, 25, 4),
    bodyLanguage: parsed.body_language || '',
  };
}

function safeParseJson(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function clampNum(v, lo, hi, dflt) {
  const n = Number(v);
  if (Number.isNaN(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}

// ===== מנוע מילות-מפתח פנימי (אופליין) =====
const INTENTS = [
  { id: 'pack',     words: ['ארז', 'אריז', 'מי הכין', 'סגרת את'] },
  { id: 'custody',  words: ['איתך', 'השגח', 'שמרת', 'עזבת את', 'מאז ש', 'כל הזמן'] },
  { id: 'gift',     words: ['מתנה', 'חפץ', 'קיבלת', 'מסר לך', 'להעביר', 'ביקש ממך', 'חבילה'] },
  { id: 'return',   words: ['חזור', 'חזרה', 'כרטיס הלוך', 'מתי חוזר', 'כמה זמן'] },
  { id: 'purpose',  words: ['מטרה', 'למה אתה', 'בשביל מה', 'מה אתה הולך', 'עסקים', 'טיול', 'לבקר', 'נופש'] },
  { id: 'where',    words: ['לאן', 'איזה יעד', 'לאיפה'] },
  { id: 'visa',     words: ['ויזה', 'אשרה', 'אשרת'] },
  { id: 'greet',    words: ['שלום', 'בוקר טוב', 'מה שלומך', 'מה נשמע'] },
];

function detectIntent(q) {
  const text = q.replace(/[?.!,]/g, '');
  for (const it of INTENTS) {
    if (it.words.some((w) => text.includes(w))) return it.id;
  }
  return 'unknown';
}

// בנק תשובות לפי כוונה וסטטוס. כל ערך: [תשובה, שינוי-לחץ].
function keywordReply(p, intent) {
  const calm = p.status === 'innocent';
  const nervous = p.status === 'nervous';
  const bad = p.status === 'smuggler' || p.status === 'threat';

  switch (intent) {
    case 'greet':
      return calm ? ['שלום, הכל טוב, תודה!', -3]
           : nervous ? ['שלום... אני קצת לחוץ מהטיסה, סליחה.', 2]
           : ['שלום. אפשר כבר לסיים? אני ממהר.', 5];
    case 'pack':
      return calm ? ['אני ארזתי לבד אתמול בלילה, הכל שלי.', 0]
           : nervous ? ['אני... כן, אני ארזתי. למה, יש בעיה?', 6]
           : ['אהה... חבר שלי עזר, בעצם אני, אני ארזתי לבד.', 14];
    case 'custody':
      return calm ? ['כן, המזוודה הייתה איתי כל הזמן.', 0]
           : nervous ? ['נראה לי שכן... רגע, כן, כל הזמן.', 7]
           : ['השארתי אותה רגע ליד הדלפק, אבל זה היה ממש קצר.', 16];
    case 'gift':
      return calm ? ['לא, שום דבר. רק הדברים שלי.', -2]
           : nervous ? ['לא, לא קיבלתי כלום... אני חושב שלא.', 8]
           : ['חבר מהעבודה ביקש שאעביר פלאפון לדוד שלו. זה בסדר, נכון?', 22];
    case 'return':
      return p.oneWay ? ['אה... כרטיס חזור עוד לא קניתי, אסגור את זה שם.', 15]
           : calm ? ['הכרטיס חזור שלי לעוד שבועיים.', 0]
           : ['יש לי חזור, רק שאני לא זוכר בדיוק את התאריך.', 6];
    case 'purpose':
      return calm ? [`באתי ל${p.dest.city} לטיול וכמה ימי חופש.`, 0]
           : nervous ? [`נוסע ל${p.dest.city}... לבקר משפחה, כן.`, 5]
           : ['סתם, טיול קצר. למה זה משנה לך?', 12];
    case 'where':
      return [`אני טס ל${p.dest.city}, טיסה ${p.flight.code}.`, calm ? -1 : 3];
    case 'visa':
      return p.dest.requiresVisa && !p.hasVisa
        ? ['ויזה? חשבתי שלא צריך... אין לי כרגע.', 12]
        : ['כן, יש לי הוויזה מסודרת.', -2];
    default:
      return calm ? ['בטח, מה שתצטרך.', 1]
           : nervous ? ['אה... מה זאת אומרת? סליחה, לא הבנתי.', 6]
           : ['אני לא בטוח שאני מבין את השאלה.', 8];
  }
}

function askViaKeywords(p, question) {
  const intent = detectIntent(question);
  let [reply, delta] = keywordReply(p, intent);
  // נוסע לחוץ/חשוד מגיב חזק יותר לתשאול אגרסיבי
  if (/למה|תסביר|איך זה|אתה משקר|תגיד את האמת/.test(question)) delta += 4;
  const newStress = Math.max(0, Math.min(100, p.stress + delta));
  return { reply, stressDelta: delta, bodyLanguage: bodyLanguageTag(newStress) };
}
