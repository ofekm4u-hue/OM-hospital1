// interview.js — שלב א': ראיון קבלה לרשות שדות התעופה (מוצג מעל סצנת המשרד התלת-ממדית).
// שאלות נוהל אמיתיות; מעבר הראיון פותח את הכניסה לטרמינל (שלב ב').

const QUESTIONS = [
  {
    q: 'נוסע מגיע עם דרכון שתוקפו פג בעוד חודש, לטיסה לתאילנד. מה תעשה?',
    opts: [
      { t: 'אסרב — תאילנד דורשת תוקף של 6 חודשים', ok: true },
      { t: 'אאשר, חודש זה מספיק', ok: false },
      { t: 'אתעלם, זה לא תפקידי', ok: false },
    ],
  },
  {
    q: 'מצאת בכבודה רשומה סוללת ליתיום נשלפת (מטען נייד). הנוהל?',
    opts: [
      { t: 'לבקש להעביר אותה לכבודת היד בתא הנוסעים', ok: true },
      { t: 'להטעין כרגיל בבטן המטוס', ok: false },
      { t: 'להחרים ולזרוק', ok: false },
    ],
  },
  {
    q: 'נוסע מבקש להעביר חבילה שקיבל ממישהו שאינו מכיר. מה תעשה?',
    opts: [
      { t: 'אעכב לבדיקה ביטחונית — זו התראה אדומה', ok: true },
      { t: 'אאשר אם הוא נראה אמין', ok: false },
      { t: 'אבקש ממנו לפתוח ואסתכל לבד', ok: false },
    ],
  },
  {
    q: 'משקל מזוודה 27 ק"ג (מותר 23). הנוסע מסרב לשלם. מה הפעולה התקינה?',
    opts: [
      { t: 'לחייב דמי חריגה או לבקש להוציא פריטים', ok: true },
      { t: 'להעביר בשקט, לא נורא', ok: false },
      { t: 'לסרב לטוס לחלוטין', ok: false },
    ],
  },
  {
    q: 'קטין בן 9 מגיע לטוס לבדו. מה נדרש?',
    opts: [
      { t: 'נוהל קטין ללא ליווי (UMNR) + מלווה ופרטי איש קשר', ok: true },
      { t: 'כרטיס רגיל, הוא מספיק גדול', ok: false },
      { t: 'לסרב לחלוטין', ok: false },
    ],
  },
];

export function startInterview(host, onPass) {
  if (!host) return;
  let idx = 0, correct = 0, locked = false;
  const render = () => {
    if (idx >= QUESTIONS.length) {
      const pass = correct >= 4;
      host.innerHTML = `
        <div class="iv-panel">
          <div class="iv-badge ${pass ? 'ok' : 'fail'}">${pass ? '✓ התקבלת!' : '✗ לא עברת'}</div>
          <h2 class="iv-title">תוצאות הראיון</h2>
          <p class="iv-text">ענית נכון על ${correct} מתוך ${QUESTIONS.length} שאלות הנוהל.</p>
          <p class="iv-text">${pass ? 'ברוך הבא לרשות שדות התעופה! קח את תג העובד וגש לעמדה.' : 'נדרש מינימום 4 תשובות נכונות. נסה שוב.'}</p>
          <button id="iv-go" class="btn-primary text-base px-6 py-2.5">${pass ? 'כניסה לטרמינל ▸' : 'לראיון חוזר'}</button>
        </div>`;
      host.querySelector('#iv-go').addEventListener('click', () => { if (pass) onPass(); else { idx = 0; correct = 0; render(); } });
      return;
    }
    const item = QUESTIONS[idx];
    host.innerHTML = `
      <div class="iv-panel">
        <div class="iv-badge">שאלה ${idx + 1}/${QUESTIONS.length} · ראיון קבלה</div>
        <h2 class="iv-title">${item.q}</h2>
        <div class="iv-opts">${item.opts.map((o, i) => `<button class="iv-opt" data-i="${i}">${o.t}</button>`).join('')}</div>
        <div id="iv-fb" class="iv-fb"></div>
      </div>`;
    host.querySelectorAll('.iv-opt').forEach((b) => b.addEventListener('click', () => {
      if (locked) return; locked = true;
      const o = item.opts[+b.dataset.i];
      if (o.ok) correct++;
      b.classList.add(o.ok ? 'right' : 'wrong');
      host.querySelector('#iv-fb').innerHTML = `<span class="${o.ok ? 'ok' : 'err'}">${o.ok ? '✓ תשובה נכונה' : '✗ לא מדויק — הנוהל הנכון מסומן'}</span>`;
      if (!o.ok) host.querySelectorAll('.iv-opt').forEach((x, i) => { if (item.opts[i].ok) x.classList.add('right'); });
      setTimeout(() => { idx++; locked = false; render(); }, 1100);
    }));
  };
  render();
}
