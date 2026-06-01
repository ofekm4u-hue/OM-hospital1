// dialogue.js — מנוע דיאלוג היברידי לנוסע.
// אם הוגדר מפתח Claude API → קריאה אמיתית למודל. אחרת (או בשגיאה) → מנוע פנימי
// עשיר בעברית עם "פרסונה" עקבית לכל נוסע, זיכרון שיחה, וריאציות, וסיפורי כיסוי
// שמתפרקים תחת לחץ. בשני המקרים מוחזר: { reply, stressDelta, bodyLanguage }.

import { getApiKey } from './settings.js';
import { bodyLanguageTag } from './avatar.js';

const STATUS_HE = {
  innocent: 'תמים לחלוטין, רגוע ומשתף פעולה',
  nervous: 'תמים אך סובל מחרדת טיסה — לחוץ, מגמגם, אך אין לו מה להסתיר',
  smuggler: 'מבריח: מישהו נתן לו חבילה להעביר, מנסה להסתיר זאת אך נשבר תחת לחץ',
  threat: 'בעל כוונות נסתרות — מתחמק, עוין מעט, נמנע מתשובות ישירות',
};

// ===== נקודת כניסה =====
export async function askPassenger(p, question) {
  const key = getApiKey();
  if (key) {
    try { return await askViaClaude(p, question, key); }
    catch (e) { console.warn('Claude API נכשל, נופלים למנוע הפנימי:', e); }
  }
  return askInternal(p, question);
}

// ===== Claude API =====
async function askViaClaude(p, question, key) {
  const pr = persona(p);
  const system = `אתה משחק דמות של נוסע בדלפק בנמל תעופה בישראל. ענה אך ורק בעברית, משפט-שניים, בגוף ראשון, טבעי ומציאותי.
דמות: ${p.name}, גיל ${p.age}, יעד ${p.dest.city} (${p.dest.country}), טיסה ${p.flight.code}.
מטרת הנסיעה: ${pr.purpose}. משך שהייה: ${pr.stayText}. לן/יגור: ${pr.stayPlace}. עיסוק: ${pr.job}. מלווים: ${pr.companions}.
אופי: ${STATUS_HE[p.status]}. רמת לחץ נוכחית: ${Math.round(p.stress)}/100.
${p.oneWay ? 'יש לך רק כרטיס הלוך בלי חזור, והמזוודה קלה — זה סותר סיפור של טיול ארוך.' : ''}
${p.status === 'smuggler' ? 'מישהו ביקש שתעביר חבילה/מתנה. בהתחלה תכחיש, אך אם לוחצים עליך בשאלות חוזרות תיסדק ותודה בהיסוס.' : ''}
החזר JSON בלבד: {"reply":"<תשובה>","stress_delta":<מספר שלם -10..25>,"body_language":"<תגית קצרה בסוגריים מרובעים או ריק>"}`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 320, system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: `הדייל שואל: "${question}"` }] }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  const text = (data.content || []).map((c) => c.text || '').join('').trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { reply: text || '...', stressDelta: 4, bodyLanguage: '' };
  try { const j = JSON.parse(m[0]); return { reply: j.reply || '...', stressDelta: clamp(+j.stress_delta, -10, 25, 4), bodyLanguage: j.body_language || '' }; }
  catch { return { reply: text, stressDelta: 4, bodyLanguage: '' }; }
}
function clamp(n, lo, hi, d) { return Number.isNaN(n) ? d : Math.max(lo, Math.min(hi, n)); }

// ===================== מנוע פנימי =====================
const r = (arr) => arr[Math.floor(Math.random() * arr.length)];

const PURPOSES = ['חופשה ונופש', 'ביקור משפחה', 'כנס עבודה', 'ירח דבש', 'טיול תרמילאים', 'לימודים בחו"ל', 'ביקור חברים'];
const JOBS = ['מהנדס תוכנה', 'מורה', 'רואה חשבון', 'אחות', 'סטודנט', 'בעל עסק קטן', 'גמלאי', 'אמן'];
const STAYS = ['חמישה ימים', 'שבוע', 'שבועיים', 'עשרה ימים', 'שלושה שבועות', 'חודש'];
const PLACES = ['במלון במרכז העיר', 'אצל בני משפחה', 'בדירת Airbnb', 'אצל חברים', 'בהוסטל'];

// בונה פרסונה עקבית לנוסע (פעם אחת).
function persona(p) {
  if (p._p) return p._p;
  const smug = p.status === 'smuggler';
  const threat = p.status === 'threat';
  p._p = {
    first: p.first,
    purpose: threat ? 'עניינים אישיים' : smug ? 'טיול קצר' : r(PURPOSES),
    stayText: p.oneWay ? 'עדיין לא סגור' : r(STAYS),
    stayPlace: threat ? 'עדיין לא החלטתי' : r(PLACES),
    job: r(JOBS),
    companions: r(['אני נוסע לבד', 'אני עם בן/בת הזוג', 'עם המשפחה', 'עם חבר']),
    packed: smug ? null : 'אני ארזתי לבד',
    asked: {},          // ספירת שאלות לפי כוונה
    pressure: 0,        // לחץ מצטבר משאלות חוקרניות
    cracked: false,     // האם המבריח כבר נסדק
    last: {},           // תשובה אחרונה לפי כוונה (למניעת חזרה)
  };
  return p._p;
}

const INTENTS = [
  ['gift', ['מתנה', 'חפץ', 'קיבלת', 'מסר', 'להעביר', 'ביקש ממך', 'חבילה', 'מישהו נתן', 'נתן לך', 'להביא למישהו']],
  ['liquids', ['נוזל', 'חד', 'סכין', 'סוללה', 'מסוכן', 'אסור', 'נשק', 'מצית', 'חומר']],
  ['pack', ['ארז', 'אריז', 'מי הכין', 'מי סגר', 'סגרת את', 'ארזת לבד']],
  ['custody', ['איתך', 'השגח', 'שמרת', 'עזבת', 'השארת', 'מאז ש', 'כל הזמן', 'ביד']],
  ['return', ['חזור', 'חזרה', 'כרטיס הלוך', 'מתי חוזר', 'הלוך ושוב', 'טיסת חזור', 'חוזר ארצה']],
  ['duration', ['כמה זמן', 'כמה ימים', 'כמה שבועות', 'משך', 'שוהה', 'נשאר']],
  ['stayplace', ['איפה תגור', 'איפה תשהה', 'מלון', 'לינה', 'כתובת', 'אצל מי', 'איפה תישן', 'איפה אתה גר שם']],
  ['purpose', ['מטר', 'נסיע', 'למה אתה', 'בשביל מה', 'מה אתה הולך', 'עסקים', 'טיול', 'לבקר', 'נופש', 'מה תעשה', 'מה מביא אותך']],
  ['where', ['לאן', 'איזה יעד', 'לאיפה', 'איזה מדינה', 'לאן אתה טס']],
  ['visa', ['ויזה', 'אשרה', 'אשרת']],
  ['job', ['עבודה', 'מקצוע', 'עיסוק', 'מה אתה עושה בחיים', 'במה אתה עוסק']],
  ['companions', ['לבד', 'מי איתך', 'מי נוסע', 'משפחה', 'חברים', 'מלווים']],
  ['feeling', ['מה שלומך', 'מה נשמע', 'איך אתה מרגיש', 'הכל בסדר', 'מה קורה']],
  ['greet', ['שלום', 'בוקר טוב', 'ערב טוב', 'היי', 'אהלן']],
  ['docs', ['דרכון', 'תעודה', 'מסמך']],
  ['name', ['שמך', 'קוראים לך', 'השם שלך', 'מי אתה']],
];

function detect(q) {
  const t = q.replace(/[?.!,'"]/g, ' ');
  for (const [id, words] of INTENTS) if (words.some((w) => t.includes(w))) return id;
  return 'unknown';
}

// בוחר תשובה שונה מהקודמת לאותה כוונה.
function vary(pr, intent, arr) {
  if (arr.length === 1) return arr[0];
  let pick; let guard = 0;
  do { pick = r(arr); } while (pick === pr.last[intent] && guard++ < 5);
  pr.last[intent] = pick;
  return pick;
}

function askInternal(p, question) {
  const pr = persona(p);
  const intent = detect(question);
  pr.asked[intent] = (pr.asked[intent] || 0) + 1;
  const probing = /למה|תסביר|בטוח|אמת|משקר|שוב|תחזור|איך ית|תגיד לי את|אל תשקר|אני לא מאמין/.test(question);
  if (probing) pr.pressure += 1;

  const calm = p.status === 'innocent';
  const nervous = p.status === 'nervous';
  const smug = p.status === 'smuggler';
  const threat = p.status === 'threat';
  let delta = 0; let text;

  switch (intent) {
    case 'greet':
      text = calm ? vary(pr, intent, ['שלום, בוקר טוב!', 'היי, נעים מאוד.', 'שלום, תודה רבה.'])
        : nervous ? vary(pr, intent, ['שלום... סליחה, אני קצת לחוץ מהטיסה.', 'היי... אני תמיד מתרגש בנמל תעופה.'])
        : threat ? vary(pr, intent, ['שלום.', 'כן, שלום. אפשר להתקדם?'])
        : vary(pr, intent, ['היי, אפשר מהר? אני קצת ממהר.', 'שלום, בוא נזדרז אם אפשר.']);
      delta = calm ? -3 : 2; break;

    case 'feeling':
      text = calm ? vary(pr, intent, ['מצוין, תודה ששאלת!', 'הכל טוב, מתרגש לטוס.'])
        : nervous ? vary(pr, intent, ['האמת? קצת בלחץ, אני פוחד מטיסות.', 'ככה ככה, תמיד לחוץ לפני טיסה.'])
        : vary(pr, intent, ['בסדר. אפשר להתקדם?', 'בסדר גמור, למה?']);
      delta = calm ? -2 : 3; break;

    case 'name':
      text = vary(pr, intent, [`קוראים לי ${p.name}.`, `${p.name}, כמו בדרכון.`]);
      delta = 1; break;

    case 'where':
      text = vary(pr, intent, [`אני טס ל${p.dest.city}, טיסה ${p.flight.code}.`, `ל${p.dest.city}. הנה הכרטיס.`]);
      delta = calm ? -1 : 3; break;

    case 'purpose':
      text = threat ? vary(pr, intent, ['עניינים אישיים. זה משנה?', 'סתם, צריך לנסוע.'])
        : smug ? vary(pr, intent, [`${pr.purpose}, כמה ימים וזהו.`, 'טיול קצר, כלום מיוחד.'])
        : nervous ? vary(pr, intent, [`${pr.purpose}... כן, ${pr.purpose}.`, `נוסע בשביל ${pr.purpose}.`])
        : vary(pr, intent, [`${pr.purpose}, מחכה לזה מזמן!`, `הגעתי בשביל ${pr.purpose}.`, `${pr.purpose} ל${pr.stayText}.`]);
      delta = threat ? 8 : smug ? 5 : 0; break;

    case 'duration':
      text = p.oneWay ? vary(pr, intent, ['עדיין לא סגרתי בדיוק כמה זמן.', 'תלוי... אולי אשאר יותר.'])
        : vary(pr, intent, [`${pr.stayText}.`, `בערך ${pr.stayText}, ואז חוזר.`]);
      delta = p.oneWay ? 10 : (calm ? -1 : 3); break;

    case 'return':
      text = p.oneWay ? vary(pr, intent, ['כרטיס חזור... עוד לא קניתי, אסדר את זה שם.', 'אין לי חזור כרגע, אקנה בהמשך.'])
        : calm ? vary(pr, intent, [`כן, החזור שלי בעוד ${pr.stayText}.`, 'בטח, יש לי כרטיס הלוך-חזור.'])
        : vary(pr, intent, ['יש לי חזור, רק לא זוכר את התאריך המדויק.', 'כן... חזור, אני חושב.']);
      delta = p.oneWay ? 16 : (calm ? 0 : 5); break;

    case 'pack':
      text = smug ? (pr.cracked ? vary(pr, intent, ['אמרתי שאני, אבל... החבר עזר לי קצת באריזה.', 'טוב, מישהו עזר לי, אבל זה בסדר!'])
                                : vary(pr, intent, ['אני ארזתי לבד, ברור.', 'בעצמי, אתמול בלילה.']))
        : nervous ? vary(pr, intent, ['אני ארזתי... כן, לבד. יש בעיה?', 'בעצמי, למה? עשיתי משהו לא בסדר?'])
        : threat ? vary(pr, intent, ['אני. למה זה חשוב?', 'לבד. הבא שאלה.'])
        : vary(pr, intent, ['אני ארזתי לבד אתמול בערב.', 'הכל שלי, ארזתי לבד.', 'בעצמי, בדקתי הכל.']);
      delta = smug ? 12 : nervous ? 6 : threat ? 7 : 0; break;

    case 'custody':
      text = smug ? vary(pr, intent, ['השארתי אותה רגע ליד הכניסה, אבל ממש לרגע.', 'רוב הזמן... חוץ מכשנכנסתי לשירותים.'])
        : nervous ? vary(pr, intent, ['נראה לי שכן... רגע, כן, כל הזמן איתי.', 'כן, כן, לא עזבתי אותה.'])
        : vary(pr, intent, ['כן, המזוודה הייתה איתי לאורך כל הזמן.', 'בהחלט, לא עזבתי אותה לרגע.']);
      delta = smug ? 15 : nervous ? 7 : 0; break;

    case 'gift': {
      if (smug) {
        const crack = pr.cracked || pr.asked.gift >= 2 || pr.pressure >= 2;
        if (crack) {
          pr.cracked = true;
          text = vary(pr, intent, [
            'טוב... חבר מהעבודה ביקש שאעביר חבילה קטנה לדוד שלו. הוא אמר שזה רק ממתקים.',
            'בסדר, האמת שכן — מישהו נתן לי שקית להעביר, אבל אמרו לי שזה לא משהו מיוחד.',
          ]);
          delta = 22;
        } else { text = vary(pr, intent, ['לא, שום דבר. רק הדברים שלי.', 'לא קיבלתי כלום, למה?']); delta = 12; }
      } else if (threat) { text = vary(pr, intent, ['למה אתה שואל אותי את זה?', 'לא. סיימנו?']); delta = 14; }
      else if (nervous) { text = vary(pr, intent, ['לא, לא קיבלתי כלום... נראה לי שלא.', 'לא, הכל שלי, אני נשבע.']); delta = 8; }
      else { text = vary(pr, intent, ['לא, שום דבר. הכל שלי.', 'לא קיבלתי שום חפץ ממישהו.']); delta = -2; }
      break;
    }

    case 'liquids':
      text = (smug || threat) ? vary(pr, intent, ['לא נראה לי... אולי בושם קטן.', 'לא, כלום כזה.'])
        : vary(pr, intent, ['לא, שום נוזלים או חפצים אסורים.', 'רק בקבוק מים קטן, זרקתי אותו.']);
      delta = (smug || threat) ? 10 : 0; break;

    case 'stayplace':
      text = threat ? vary(pr, intent, ['עוד לא סגרתי איפה אשהה.', 'אסתדר משהו כשאגיע.'])
        : vary(pr, intent, [`אשהה ${pr.stayPlace}.`, `${pr.stayPlace}, כבר הזמנתי.`]);
      delta = threat ? 9 : 0; break;

    case 'job':
      text = vary(pr, intent, [`אני ${pr.job}.`, `עובד כ${pr.job}.`]);
      delta = threat ? 5 : 0; break;

    case 'companions':
      text = vary(pr, intent, [`${pr.companions}.`]);
      delta = calm ? -1 : 3; break;

    case 'visa':
      text = (p.dest.requiresVisa && !p.hasVisa) ? vary(pr, intent, ['ויזה? חשבתי שלא צריך... אין לי כרגע.', 'אה, לא הוצאתי ויזה. זו בעיה?'])
        : p.dest.requiresVisa ? vary(pr, intent, ['כן, הוויזה שלי מסודרת, הנה.', 'יש לי ויזה תקפה.'])
        : vary(pr, intent, ['לא צריך ויזה ליעד הזה, נכון?', 'למיטב ידיעתי לא נדרשת ויזה.']);
      delta = (p.dest.requiresVisa && !p.hasVisa) ? 12 : -1; break;

    case 'docs':
      text = vary(pr, intent, ['הנה הדרכון שלי.', 'בטח, הנה כל המסמכים.']);
      delta = calm ? -1 : 2; break;

    default:
      text = calm ? vary(pr, intent, ['בטח, מה שתצטרך.', 'אין בעיה, תשאל.', 'כן?'])
        : nervous ? vary(pr, intent, ['אה... סליחה, לא הבנתי בדיוק.', 'מה זאת אומרת? אני קצת מבולבל.'])
        : threat ? vary(pr, intent, ['אני לא מבין למה אתה שואל את זה.', 'אפשר כבר להתקדם?'])
        : vary(pr, intent, ['לא בטוח שהבנתי את השאלה.', 'אפשר לחזור על זה?']);
      delta = threat ? 6 : nervous ? 5 : 1;
  }

  if (probing) delta += 4;
  const newStress = Math.max(0, Math.min(100, p.stress + delta));
  return { reply: text, stressDelta: delta, bodyLanguage: bodyLanguageTag(newStress) };
}
