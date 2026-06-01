// avatar.js — יצירת אווטאר נוסע פרוצדורלי ב-SVG (ללא תמונות חיצוניות).
// מחזיר מחרוזת SVG. צבעי עור/שיער/בגד נגזרים מ-seed כדי שכל נוסע ייראה שונה אך עקבי.

const SKIN = ['#f1c8a3', '#e0ac80', '#c98d63', '#a86b46', '#8d5524', '#fcdcc0'];
const HAIR = ['#2b2b2b', '#4a3220', '#6b4423', '#1a1a1a', '#5b5b5b', '#3d2b1f', '#a55b2a'];
const SHIRT = ['#2563eb', '#0d9488', '#7c3aed', '#dc2626', '#475569', '#b45309', '#0891b2'];

function pick(arr, n) {
  return arr[Math.abs(n) % arr.length];
}

// יוצר seed מספרי יציב ממחרוזת (שם הנוסע).
export function seedFrom(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}

// gender: 'm' | 'f' — משפיע על אורך השיער.
export function createAvatarSVG(seed, gender) {
  const skin = pick(SKIN, seed);
  const hair = pick(HAIR, seed >> 3);
  const shirt = pick(SHIRT, seed >> 6);
  const longHair = gender === 'f';

  const hairShape = longHair
    ? `<path d="M55 70 Q55 30 100 30 Q145 30 145 70 L145 130 Q140 95 100 95 Q60 95 60 130 Z" fill="${hair}"/>`
    : `<path d="M58 72 Q58 34 100 34 Q142 34 142 72 Q142 60 100 58 Q58 60 58 72 Z" fill="${hair}"/>`;

  return `
<svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" class="w-full h-full">
  <defs>
    <clipPath id="cp${seed}"><rect x="0" y="0" width="200" height="220" rx="14"/></clipPath>
  </defs>
  <g clip-path="url(#cp${seed})">
    <rect width="200" height="220" fill="#0b1220"/>
    <!-- כתפיים/חולצה -->
    <path d="M30 220 Q30 165 100 158 Q170 165 170 220 Z" fill="${shirt}"/>
    <path d="M85 150 h30 v22 h-30 Z" fill="${skin}"/>
    <!-- צוואר -->
    <!-- ראש -->
    <ellipse cx="100" cy="100" rx="44" ry="50" fill="${skin}"/>
    <!-- אוזניים -->
    <circle cx="56" cy="102" r="8" fill="${skin}"/>
    <circle cx="144" cy="102" r="8" fill="${skin}"/>
    <!-- שיער -->
    ${hairShape}
    <!-- גבות -->
    <rect class="av-brow-l" x="74" y="86" width="20" height="5" rx="2.5" fill="${hair}"/>
    <rect class="av-brow-r" x="106" y="86" width="20" height="5" rx="2.5" fill="${hair}"/>
    <!-- עיניים -->
    <g class="av-eyes">
      <ellipse cx="84" cy="98" rx="7" ry="5" fill="#fff"/>
      <ellipse cx="116" cy="98" rx="7" ry="5" fill="#fff"/>
      <circle class="av-pupil" cx="84" cy="98" r="3" fill="#1f2937"/>
      <circle class="av-pupil" cx="116" cy="98" r="3" fill="#1f2937"/>
    </g>
    <!-- אף -->
    <path d="M100 102 l-5 14 h10 Z" fill="${pick(SKIN, seed >> 1)}" opacity="0.5"/>
    <!-- פה -->
    <path class="av-mouth" d="M86 126 Q100 134 114 126" stroke="#7c2d12" stroke-width="3" fill="none" stroke-linecap="round"/>
    <!-- טיפת זיעה (מוסתרת כברירת מחדל) -->
    <path class="av-sweat" d="M140 78 q6 10 0 16 q-6 -6 0 -16 Z" fill="#38bdf8" opacity="0"/>
  </g>
</svg>`;
}

// מד-לחץ: מקבל אלמנט מכיל (.avatar-frame) ורמת לחץ 0..100, ומעדכן glow + שפת גוף.
export function applyStress(frameEl, stress) {
  if (!frameEl) return;
  const lvl = Math.max(0, Math.min(100, stress));
  // צבע ה-glow: ירוק רגוע -> צהוב -> אדום לחוץ
  let color;
  if (lvl < 35) color = '16,185,129';
  else if (lvl < 65) color = '245,158,11';
  else color = '239,68,68';
  const intensity = 8 + (lvl / 100) * 40;
  frameEl.style.boxShadow = `0 0 ${intensity}px rgba(${color},0.75)`;
  frameEl.style.borderColor = `rgb(${color})`;

  // שפת גוף: ככל שהלחץ גבוה, מפעילים אנימציות
  const svg = frameEl.querySelector('svg');
  if (svg) {
    const sweat = svg.querySelector('.av-sweat');
    if (sweat) sweat.style.opacity = lvl > 60 ? '0.9' : '0';
    svg.classList.toggle('av-nervous', lvl > 55);
    svg.classList.toggle('av-shifty', lvl > 70);
  }
}

// בוחר תגית שפת-גוף טקסטואלית לפי הלחץ (להצגה ליד הראש).
export function bodyLanguageTag(stress) {
  if (stress > 75) return pickRand(['[מזיע]', '[מביט הצידה]', '[מגמגם]', '[ידיים רועדות]']);
  if (stress > 55) return pickRand(['[מכחכח בגרונו]', '[ממצמץ הרבה]', '[נע באי-נוחות]']);
  if (stress > 35) return pickRand(['[מחייך במאמץ]', '[מסתכל בשעון]']);
  return '';
}

function pickRand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
