// ui.js — עזרי ממשק משותפים: הודעות צפות (toast), בועות דיבור, ואנימציות הדפסה
// של תג כבודה וכרטיס טיסה. אין כאן לוגיקת משחק — רק תצוגה.

import { state, formatClock } from './state.js';

// הודעה צפה קצרה. type: 'info' | 'ok' | 'warn' | 'err'
export function toast(text, type = 'info') {
  const colors = {
    info: 'bg-slate-700 border-slate-500',
    ok: 'bg-emerald-700 border-emerald-400',
    warn: 'bg-amber-600 border-amber-300',
    err: 'bg-red-700 border-red-400',
  };
  const el = document.createElement('div');
  el.className = `toast ${colors[type] || colors.info}`;
  el.textContent = text;
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    document.body.appendChild(host);
  }
  host.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3200);
}

// מוסיף שורה ללוג בועת הדיבור (תיבת השיחה מעל הנוסע).
export function pushBubble(who, text) {
  state.dialogue.push({ who, text });
  renderBubbles();
}

export function renderBubbles() {
  const box = document.getElementById('chat-box');
  if (!box) return;
  box.innerHTML = state.dialogue.map((m) => {
    const mine = m.who === 'agent';
    return `<div class="bubble ${mine ? 'bubble-agent' : 'bubble-pax'}">
      <span class="bubble-who">${mine ? 'אתה' : 'נוסע'}</span>${escapeHtml(m.text)}
    </div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

export function clearBubbles() {
  state.dialogue = [];
  renderBubbles();
}

// אנימציית הדפסה: יוצר אלמנט שמחליק החוצה מהמדפסת, וניתן לגרור אותו ליעד.
// kind: 'tag' | 'boarding'. onDropDone נקרא כשגוררים אותו אל dropTarget.
export function printSlip(kind, html, dropTargetSelector, onDropDone) {
  const slip = document.createElement('div');
  slip.className = `printed-slip ${kind === 'tag' ? 'slip-tag' : 'slip-boarding'}`;
  slip.innerHTML = html;
  slip.draggable = true;

  const tray = document.getElementById('printer-tray');
  if (!tray) return;
  tray.appendChild(slip);
  requestAnimationFrame(() => slip.classList.add('ejected'));

  slip.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', kind);
    slip.classList.add('dragging');
  });
  slip.addEventListener('dragend', () => slip.classList.remove('dragging'));

  const target = document.querySelector(dropTargetSelector);
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    target && target.classList.remove('drop-hover');
    slip.classList.add('placed');
    slip.draggable = false;
    onDropDone && onDropDone(slip);
  };
  if (target) {
    const over = (e) => { e.preventDefault(); target.classList.add('drop-hover'); };
    const leave = () => target.classList.remove('drop-hover');
    const drop = (e) => { e.preventDefault(); finish(); };
    target.addEventListener('dragover', over);
    target.addEventListener('dragleave', leave);
    target.addEventListener('drop', drop);
  }
  // נגישות/גיבוי: לחיצה על הפתק מצמידה אותו (למי שלא משתמש בגרירה)
  slip.title = 'גרור אל הנוסע — או לחץ להצמדה';
  slip.addEventListener('click', finish);
  return slip;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// מחזיר את ה-HTML של סרגל הסטטוס העליון (לוגו+תפקיד | שעון+תור | תקציב+מוניטין).
export function statusBarHtml(roleLabel) {
  return `
  <div id="status-bar" class="flex items-center gap-4 px-4 h-14 bg-[#0b1220] border-b border-slate-700 text-sm shrink-0">
    <div class="flex items-center gap-2 min-w-[220px]">
      <span class="text-amber-400 text-lg font-black">✈</span>
      <span class="font-bold text-white">נתב"ג · נמל תעופה</span>
      <span class="text-slate-500">|</span>
      <span class="text-slate-300">${escapeHtml(roleLabel)}</span>
    </div>
    <div class="flex items-center gap-3 flex-1 justify-center">
      <span class="text-slate-400">משמרת</span>
      <span id="sb-clock" class="font-mono text-emerald-300 text-base">07:30</span>
      <span class="text-slate-500 mr-3">עומס תור</span>
      <div class="w-40 h-2.5 bg-slate-800 rounded overflow-hidden border border-slate-700">
        <div id="sb-queue-fill" class="h-full rounded bg-emerald-500 transition-all duration-500" style="width:20%"></div>
      </div>
    </div>
    <div class="flex items-center gap-4 min-w-[220px] justify-end">
      <span>תקציב <b id="sb-budget" class="text-white">₪5,000</b></span>
      <span>שביעות רצון <b id="sb-rep" class="text-amber-300">80%</b></span>
      <button id="sb-settings" class="btn-ghost px-2 py-1" title="הגדרות">⚙</button>
    </div>
  </div>`;
}

// מעדכן את סרגל הסטטוס העליון לפי ה-state.
export function renderStatusBar() {
  const bar = document.getElementById('status-bar');
  if (!bar) return;
  const qColor = state.queueLoad > 75 ? 'bg-red-500' : state.queueLoad > 45 ? 'bg-amber-400' : 'bg-emerald-500';
  bar.querySelector('#sb-clock').textContent = formatClock();
  bar.querySelector('#sb-budget').textContent = `₪${state.budget.toLocaleString('he-IL')}`;
  bar.querySelector('#sb-rep').textContent = `${Math.round(state.reputation)}%`;
  const fill = bar.querySelector('#sb-queue-fill');
  fill.style.width = `${state.queueLoad}%`;
  fill.className = `h-full rounded transition-all duration-500 ${qColor}`;
}
