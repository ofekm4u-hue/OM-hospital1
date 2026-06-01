// main.js — נקודת הכניסה: ניתוב המסכים (לובי → תדריך → משחק → סיכום) ובניית
// המסכים שאינם מסכי-משחק. מסכי המשחק עצמם נבנים ב-checkin.js / gate.js.

import { state, resetShift, stopClock, subscribe } from './state.js';
import { renderStatusBar } from './ui.js';
import { openSettings } from './settings.js';
import { startCheckin } from './checkin.js';
import { FLIGHTS, RULES, destByCode } from './data.js';

const app = () => document.getElementById('app');

// כל שינוי ב-state שמשפיע על הסרגל -> רענון הסרגל (אם הוא קיים על המסך).
subscribe(() => { if (document.getElementById('status-bar')) renderStatusBar(); });

// ===== לובי: בחירת תפקיד =====
function showLobby() {
  state.screen = 'lobby';
  stopClock();
  const roles = [
    { id: 'security', name: 'בודק ביטחוני', icon: '🛡️', diff: 'קושי גבוה', desc: 'זיהוי פלילי, תשאול ושפת גוף — סינון נוסעים חשודים.', soon: true },
    { id: 'checkin', name: 'דייל קרקע', icon: '🧑‍✈️', diff: 'קושי בינוני', desc: 'צ׳ק-אין מלא: דרכונים, ויזות, שקילת כבודה, הנפקת כרטיסים ושלב הגייט.', soon: false },
    { id: 'ramp', name: 'פקח רחבה', icon: '🦺', diff: 'קושי גבוה', desc: 'תדלוק, חלוקת משקלים, בדיקה היקפית ואישור דחיפה.', soon: true },
    { id: 'manager', name: 'מנהל משמרת', icon: '👔', diff: 'קושי קיצוני', desc: 'ניהול כל הטרמינל, משאבים, תקציב ומשברים.', soon: true },
  ];
  app().innerHTML = `
  <div class="min-h-full flex flex-col items-center justify-center p-6 lobby-bg">
    <div class="text-center mb-8">
      <div class="text-amber-400 text-5xl mb-2">✈</div>
      <h1 class="text-4xl font-black text-white tracking-tight">סימולטור נמל תעופה</h1>
      <p class="text-slate-400 mt-2">בחר את תפקידך במשמרת. כל תפקיד — סגנון משחק אחר.</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl w-full">
      ${roles.map((r) => `
        <button class="role-card ${r.soon ? 'role-soon' : ''}" data-role="${r.id}" ${r.soon ? 'disabled' : ''}>
          <div class="text-4xl mb-2">${r.icon}</div>
          <div class="text-lg font-bold text-white">${r.name}</div>
          <div class="text-xs text-amber-300/80 mb-2">${r.diff}</div>
          <div class="text-sm text-slate-400 leading-snug">${r.desc}</div>
          ${r.soon ? '<div class="soon-badge">בקרוב</div>' : '<div class="play-badge">שחק עכשיו ▸</div>'}
        </button>`).join('')}
    </div>
    <button id="lobby-settings" class="btn-ghost mt-8">⚙ הגדרות (מפתח Claude / מנוע שיחה)</button>
  </div>`;

  app().querySelectorAll('.role-card:not([disabled])').forEach((b) =>
    b.addEventListener('click', () => { state.role = b.dataset.role; showBriefing(); }));
  document.getElementById('lobby-settings').addEventListener('click', () => openSettings());
}

// ===== תדריך =====
function showBriefing() {
  state.screen = 'briefing';
  const flightsList = FLIGHTS.map((f) => {
    const d = destByCode(f.dest);
    const ob = f.seatsSold > f.seatsTotal ? ' <span class="text-red-400">(אוברבוקינג!)</span>' : '';
    const visa = d.requiresVisa ? ' <span class="text-amber-300">· דורש ויזה</span>' : '';
    return `<li class="flex justify-between border-b border-slate-700/60 py-1.5">
      <span><b class="text-amber-300">${f.code}</b> ← ${d.city} (${d.country})${visa}${ob}</span>
      <span class="text-slate-400">שער ${f.gate} · ${f.boarding}</span></li>`;
  }).join('');
  app().innerHTML = `
  <div class="min-h-full flex items-center justify-center p-6">
    <div class="brief-box">
      <div class="text-amber-400 text-sm font-bold mb-1">תדריך משמרת · 01/06/2026</div>
      <h2 class="text-2xl font-black text-white mb-4">דייל קרקע — דלפק 4</h2>
      <p class="text-slate-300 mb-4 leading-relaxed">
        בוקר טוב. היום משמרת עמוסה עם ${FLIGHTS.length} טיסות. שים לב לדרכונים שפג תוקפם,
        ליעדים שדורשים ויזה, ולמשקל הכבודה. כל טעות עולה לחברה כסף ומוניטין.
        בסוף שלב הצ׳ק-אין תעבור לנהל את הבורדינג בשער.
      </p>
      <div class="grid grid-cols-3 gap-3 mb-4">
        <div class="stat-pill"><div class="stat-num">₪${RULES.SHIFT_BUDGET.toLocaleString('he-IL')}</div><div class="stat-lbl">תקציב משמרת</div></div>
        <div class="stat-pill"><div class="stat-num">${RULES.REP_START}%</div><div class="stat-lbl">שביעות רצון</div></div>
        <div class="stat-pill"><div class="stat-num">${RULES.BAG_LIMIT_KG} ק"ג</div><div class="stat-lbl">משקל כבודה מותר</div></div>
      </div>
      <div class="text-sm text-slate-400 mb-2 font-semibold">לוח הטיסות:</div>
      <ul class="text-sm mb-6">${flightsList}</ul>
      <div class="flex gap-2">
        <button id="brief-start" class="btn-primary text-base px-6 py-2.5">התחל משמרת ▸</button>
        <button id="brief-back" class="btn-ghost">חזרה ללובי</button>
      </div>
    </div>
  </div>`;
  document.getElementById('brief-start').addEventListener('click', () => { resetShift(); state.screen = 'game'; startCheckin(); });
  document.getElementById('brief-back').addEventListener('click', showLobby);
}

// ===== סיכום יום (Debrief) =====
export function showDebrief() {
  state.screen = 'debrief';
  stopClock();
  const fines = state.errors.reduce((s, e) => s + e.fine, 0);
  const net = state.budget - RULES.SHIFT_BUDGET;
  const rank = state.reputation >= 90 && state.errors.length === 0 ? 'מנהל דלפק ⭐⭐⭐'
    : state.reputation >= 70 ? 'דייל בכיר ⭐⭐'
    : state.reputation >= 50 ? 'דייל מן המניין ⭐'
    : 'בהשגחה — נדרש שיפור';
  const promoted = state.reputation >= 70 && state.errors.length <= 1;
  const gate = state.gateStats || { boarded: 0, denied: 0 };

  app().innerHTML = `
  <div class="min-h-full flex items-center justify-center p-6">
    <div class="brief-box">
      <div class="text-amber-400 text-sm font-bold mb-1">סיכום משמרת</div>
      <h2 class="text-2xl font-black text-white mb-4">${promoted ? '🎉 עלית בדרגה!' : 'תום המשמרת'}</h2>
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="stat-pill"><div class="stat-num">${state.processed}</div><div class="stat-lbl">נוסעים בצ׳ק-אין</div></div>
        <div class="stat-pill"><div class="stat-num">${gate.boarded}</div><div class="stat-lbl">עלו למטוס בגייט</div></div>
        <div class="stat-pill"><div class="stat-num text-emerald-300">₪${state.feesCollected.toLocaleString('he-IL')}</div><div class="stat-lbl">אגרות שנגבו</div></div>
        <div class="stat-pill"><div class="stat-num text-red-400">₪${fines.toLocaleString('he-IL')}</div><div class="stat-lbl">קנסות על טעויות</div></div>
        <div class="stat-pill"><div class="stat-num ${net >= 0 ? 'text-emerald-300' : 'text-red-400'}">₪${net.toLocaleString('he-IL')}</div><div class="stat-lbl">רווח/הפסד נטו</div></div>
        <div class="stat-pill"><div class="stat-num text-amber-300">${Math.round(state.reputation)}%</div><div class="stat-lbl">שביעות רצון</div></div>
      </div>
      <div class="mb-4">
        <div class="text-sm text-slate-400 font-semibold mb-1">דירוג: <span class="text-white">${rank}</span></div>
        ${state.errors.length
          ? `<div class="text-sm text-red-300 font-semibold mb-1">טעויות:</div><ul class="text-xs text-red-300/90 list-disc pr-5 space-y-0.5">${state.errors.map((e) => `<li>${e.text} — ₪${e.fine.toLocaleString('he-IL')}</li>`).join('')}</ul>`
          : '<div class="text-sm text-emerald-300">ללא טעויות — משמרת מושלמת! 👏</div>'}
      </div>
      <div class="flex gap-2">
        <button id="db-again" class="btn-primary px-6">משמרת חדשה ▸</button>
        <button id="db-lobby" class="btn-ghost">ללובי</button>
      </div>
    </div>
  </div>`;
  document.getElementById('db-again').addEventListener('click', () => { resetShift(); state.screen = 'game'; startCheckin(); });
  document.getElementById('db-lobby').addEventListener('click', showLobby);
}

// ===== Boot =====
showLobby();
