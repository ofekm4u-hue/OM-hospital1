// settings.js — פאנל הגדרות + ניהול מפתח Claude API.
// המפתח נשמר ב-localStorage בדפדפן של המשתמש בלבד; לעולם לא נשלח לשום מקום חוץ
// מ-api.anthropic.com, ולא נכתב לקוד או לריפו.

const LS_KEY = 'airport_sim_claude_key';

export function getApiKey() {
  try { return localStorage.getItem(LS_KEY) || ''; } catch { return ''; }
}

export function setApiKey(key) {
  try {
    if (key) localStorage.setItem(LS_KEY, key.trim());
    else localStorage.removeItem(LS_KEY);
  } catch { /* localStorage חסום */ }
}

export function hasApiKey() {
  return !!getApiKey();
}

// פותח חלון הגדרות מודאלי. onClose נקרא אחרי שמירה/סגירה.
export function openSettings(onClose) {
  const existing = getApiKey();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" dir="rtl">
      <h2 class="text-xl font-bold text-white mb-1">הגדרות</h2>
      <p class="text-sm text-slate-400 mb-4">מנוע השיחה של הנוסעים</p>

      <label class="block text-sm text-slate-300 mb-1">מפתח Claude API (אופציונלי)</label>
      <input id="set-key" type="password" value="${existing}" placeholder="sk-ant-..."
        class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm mb-2 ltr-input" />
      <div class="text-xs text-slate-400 leading-relaxed bg-slate-900/60 rounded-lg p-3 mb-4">
        🔒 המפתח נשמר <b>מקומית בדפדפן שלך בלבד</b> ולא נשלח לשום שרת חוץ מ-Anthropic.
        אל תזין מפתח במחשב ציבורי. <br/>
        ללא מפתח — הנוסעים עונים באמצעות <b>מנוע השיחה הפנימי</b> של המשחק (עובד אופליין).
      </div>

      <div class="flex gap-2 justify-start">
        <button id="set-save" class="btn-primary">שמור</button>
        <button id="set-clear" class="btn-ghost">מחק מפתח</button>
        <button id="set-cancel" class="btn-ghost mr-auto">סגור</button>
      </div>
      <div id="set-status" class="text-xs mt-3 ${existing ? 'text-emerald-400' : 'text-slate-500'}">
        ${existing ? '✓ מפתח מוגדר — הנוסעים מדברים דרך Claude' : 'אין מפתח — מנוע פנימי פעיל'}
      </div>
    </div>`;

  const close = () => { overlay.remove(); onClose && onClose(); };

  overlay.querySelector('#set-save').addEventListener('click', () => {
    setApiKey(overlay.querySelector('#set-key').value);
    close();
  });
  overlay.querySelector('#set-clear').addEventListener('click', () => {
    setApiKey('');
    overlay.querySelector('#set-key').value = '';
    overlay.querySelector('#set-status').textContent = 'אין מפתח — מנוע פנימי פעיל';
  });
  overlay.querySelector('#set-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.body.appendChild(overlay);
}
