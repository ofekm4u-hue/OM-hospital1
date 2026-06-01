// main.js — ניתוב מסכים: לובי → הגדרת משמרת → תדריך → משחק → סיכום.
// מסכי המשחק נבנים במודולים של כל תפקיד. כאן: לובי, בחירת משמרת, תדריך וסיכום גנריים.

import { state, resetShift, stopClock, subscribe, applyShiftConfig } from './state.js';
import { renderStatusBar } from './ui.js';
import { openSettings } from './settings.js';
import { startCheckin } from './checkin.js';
import { startSecurity } from './security.js';
import { startRamp } from './ramp.js';
import { startManager } from './manager.js';
import { SHIFTS, DIFFICULTIES, RULES, FLIGHTS, destByCode } from './data.js';

const app = () => document.getElementById('app');

subscribe(() => { if (document.getElementById('status-bar')) renderStatusBar(); });

const ROLES = {
  checkin:  { name: 'דייל קרקע', icon: '🧑‍✈️', diff: 'קושי בינוני', desc: 'מסוף קבלה מלא: הקלדת נתוני נוסע, דרכון, טיסה, ויזה, שקילה, הושבה והנפקת כרטיסים — ושלב הגייט.', start: (c) => startCheckin(c) },
  security: { name: 'בודק ביטחוני', icon: '🛡️', diff: 'קושי גבוה', desc: 'תשאול, שיקוף רנטגן של כבודה, פרופיילר מודיעין ובדיקת תעודות — סינון נוסעים חשודים.', start: (c) => startSecurity(c) },
  ramp:     { name: 'פקח רחבה', icon: '🦺', diff: 'קושי גבוה', desc: 'תדלוק מדויק, חלוקת משקלים ומרכז כובד, בדיקה היקפית ואישור דחיפה של המטוס.', start: (c) => startRamp(c) },
  manager:  { name: 'מנהל משמרת', icon: '👔', diff: 'קושי קיצוני', desc: 'לוח טיסות מרכזי, ניהול תקציב וכוח אדם, וקבלת החלטות במשברים בזמן אמת.', start: () => startManager() },
};

// ===== לובי =====
function showLobby() {
  state.screen = 'lobby';
  stopClock();
  app().innerHTML = `
  <div class="min-h-full flex flex-col items-center justify-center p-6 lobby-bg">
    <div class="text-center mb-8">
      <div class="text-amber-400 text-5xl mb-2">✈</div>
      <h1 class="text-4xl font-black text-white tracking-tight">סימולטור נמל תעופה</h1>
      <p class="text-slate-400 mt-2">בחר את תפקידך. כל תפקיד — מערכת וסגנון משחק שונים לחלוטין.</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl w-full">
      ${Object.entries(ROLES).map(([id, r]) => `
        <button class="role-card" data-role="${id}">
          <div class="text-4xl mb-2">${r.icon}</div>
          <div class="text-lg font-bold text-white">${r.name}</div>
          <div class="text-xs text-amber-300/80 mb-2">${r.diff}</div>
          <div class="text-sm text-slate-400 leading-snug">${r.desc}</div>
          <div class="play-badge">שחק ▸</div>
        </button>`).join('')}
    </div>
    <button id="lobby-settings" class="btn-ghost mt-8">⚙ הגדרות (מפתח Claude / מנוע שיחה)</button>
  </div>`;
  app().querySelectorAll('.role-card').forEach((b) =>
    b.addEventListener('click', () => { state.role = b.dataset.role; showShiftSetup(); }));
  document.getElementById('lobby-settings').addEventListener('click', () => openSettings());
}

// ===== הגדרת משמרת: זמן + קושי =====
function showShiftSetup() {
  state.screen = 'setup';
  const r = ROLES[state.role];
  app().innerHTML = `
  <div class="min-h-full flex items-center justify-center p-6">
    <div class="brief-box">
      <div class="text-amber-400 text-sm font-bold mb-1">הגדרת משמרת · ${r.icon} ${r.name}</div>
      <h2 class="text-2xl font-black text-white mb-4">בחר זמן וקושי</h2>

      <div class="text-sm text-slate-400 font-semibold mb-2">זמן המשמרת:</div>
      <div class="grid grid-cols-2 gap-2 mb-4" id="shift-times">
        ${SHIFTS.map((s) => `<button class="opt-card ${s.id === state.shift.time ? 'sel' : ''}" data-time="${s.id}">
          <div class="font-bold text-white">${s.label}</div><div class="text-xs text-slate-400">${s.sub}</div></button>`).join('')}
      </div>

      <div class="text-sm text-slate-400 font-semibold mb-2">דרגת קושי:</div>
      <div class="grid grid-cols-2 gap-2 mb-5" id="shift-diffs">
        ${DIFFICULTIES.map((d) => `<button class="opt-card ${d.id === state.shift.difficulty ? 'sel' : ''}" data-diff="${d.id}">
          <div class="font-bold text-white">${d.label}</div><div class="text-xs text-slate-400">${d.cases} מקרים · ${d.sub}</div></button>`).join('')}
      </div>

      <div class="flex gap-2">
        <button id="setup-go" class="btn-primary text-base px-6 py-2.5">המשך לתדריך ▸</button>
        <button id="setup-back" class="btn-ghost">חזרה</button>
      </div>
    </div>
  </div>`;
  app().querySelectorAll('[data-time]').forEach((b) => b.addEventListener('click', () => {
    state.shift.time = b.dataset.time;
    app().querySelectorAll('[data-time]').forEach((x) => x.classList.toggle('sel', x === b));
  }));
  app().querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => {
    state.shift.difficulty = b.dataset.diff;
    app().querySelectorAll('[data-diff]').forEach((x) => x.classList.toggle('sel', x === b));
  }));
  document.getElementById('setup-go').addEventListener('click', showBriefing);
  document.getElementById('setup-back').addEventListener('click', showLobby);
}

// ===== תדריך =====
function showBriefing() {
  state.screen = 'briefing';
  const r = ROLES[state.role];
  const shift = SHIFTS.find((s) => s.id === state.shift.time);
  const diff = DIFFICULTIES.find((d) => d.id === state.shift.difficulty);
  const flightsList = FLIGHTS.map((f) => {
    const d = destByCode(f.dest);
    const ob = f.seatsSold > f.seatsTotal ? ' <span class="text-red-400">(אוברבוקינג!)</span>' : '';
    const visa = d.requiresVisa ? ' <span class="text-amber-300">· דורש ויזה</span>' : '';
    return `<li class="flex justify-between border-b border-slate-700/60 py-1.5">
      <span><b class="text-amber-300 ltr">${f.code}</b> ← ${d.city} (${d.country})${visa}${ob}</span>
      <span class="text-slate-400">שער ${f.gate} · ${f.boarding}</span></li>`;
  }).join('');
  app().innerHTML = `
  <div class="min-h-full flex items-center justify-center p-6">
    <div class="brief-box">
      <div class="text-amber-400 text-sm font-bold mb-1">תדריך · ${shift.label} · ${diff.label}</div>
      <h2 class="text-2xl font-black text-white mb-3">${r.icon} ${r.name}</h2>
      <p class="text-slate-300 mb-4 leading-relaxed">${r.desc} כל טעות עולה לחברה כסף ומוניטין.</p>
      <div class="grid grid-cols-3 gap-3 mb-4">
        <div class="stat-pill"><div class="stat-num">₪${RULES.SHIFT_BUDGET.toLocaleString('he-IL')}</div><div class="stat-lbl">תקציב משמרת</div></div>
        <div class="stat-pill"><div class="stat-num">${RULES.REP_START}%</div><div class="stat-lbl">שביעות רצון</div></div>
        <div class="stat-pill"><div class="stat-num">${diff.cases}</div><div class="stat-lbl">מקרים במשמרת</div></div>
      </div>
      ${state.role === 'checkin' || state.role === 'manager'
        ? `<div class="text-sm text-slate-400 mb-2 font-semibold">לוח הטיסות:</div><ul class="text-sm mb-6">${flightsList}</ul>`
        : '<div class="mb-4"></div>'}
      <div class="flex gap-2">
        <button id="brief-start" class="btn-primary text-base px-6 py-2.5">התחל משמרת ▸</button>
        <button id="brief-back" class="btn-ghost">חזרה</button>
      </div>
    </div>
  </div>`;
  document.getElementById('brief-start').addEventListener('click', startShift);
  document.getElementById('brief-back').addEventListener('click', showShiftSetup);
}

function startShift() {
  resetShift();
  applyShiftConfig(SHIFTS, DIFFICULTIES, state.shift);
  state.screen = 'game';
  const diff = DIFFICULTIES.find((d) => d.id === state.shift.difficulty);
  ROLES[state.role].start(diff.cases);
}

// ===== סיכום =====
export function showDebrief() {
  state.screen = 'debrief';
  stopClock();
  const fines = state.errors.reduce((s, e) => s + e.fine, 0);
  const net = state.budget - RULES.SHIFT_BUDGET;
  const rank = state.reputation >= 90 && state.errors.length === 0 ? '⭐⭐⭐ מצטיין'
    : state.reputation >= 70 ? '⭐⭐ בכיר'
    : state.reputation >= 50 ? '⭐ מן המניין' : 'בהשגחה — נדרש שיפור';
  const promoted = state.reputation >= 70 && state.errors.length <= 1;

  const roleTiles = (state.summaryTiles || [{ num: state.processed, label: 'מקרים שטופלו' }])
    .map((t) => `<div class="stat-pill"><div class="stat-num ${t.cls || ''}">${t.num}</div><div class="stat-lbl">${t.label}</div></div>`).join('');

  app().innerHTML = `
  <div class="min-h-full flex items-center justify-center p-6">
    <div class="brief-box">
      <div class="text-amber-400 text-sm font-bold mb-1">${state.summaryTitle || 'סיכום משמרת'}</div>
      <h2 class="text-2xl font-black text-white mb-4">${promoted ? '🎉 עלית בדרגה!' : 'תום המשמרת'}</h2>
      <div class="grid grid-cols-2 gap-3 mb-4">
        ${roleTiles}
        <div class="stat-pill"><div class="stat-num text-red-400">₪${fines.toLocaleString('he-IL')}</div><div class="stat-lbl">קנסות</div></div>
        <div class="stat-pill"><div class="stat-num ${net >= 0 ? 'text-emerald-300' : 'text-red-400'}">₪${net.toLocaleString('he-IL')}</div><div class="stat-lbl">רווח/הפסד נטו</div></div>
        <div class="stat-pill"><div class="stat-num text-amber-300">${Math.round(state.reputation)}%</div><div class="stat-lbl">שביעות רצון</div></div>
      </div>
      <div class="mb-4">
        <div class="text-sm text-slate-400 font-semibold mb-1">דירוג: <span class="text-white">${rank}</span></div>
        ${state.errors.length
          ? `<div class="text-sm text-red-300 font-semibold mb-1">טעויות:</div><ul class="text-xs text-red-300/90 list-disc pr-5 space-y-0.5">${state.errors.map((e) => `<li>${e.text}${e.fine ? ' — ₪' + e.fine.toLocaleString('he-IL') : ''}</li>`).join('')}</ul>`
          : '<div class="text-sm text-emerald-300">ללא טעויות — משמרת מושלמת! 👏</div>'}
      </div>
      <div class="flex gap-2">
        <button id="db-again" class="btn-primary px-6">משמרת חדשה ▸</button>
        <button id="db-lobby" class="btn-ghost">ללובי</button>
      </div>
    </div>
  </div>`;
  document.getElementById('db-again').addEventListener('click', startShift);
  document.getElementById('db-lobby').addEventListener('click', showLobby);
}

showLobby();
