import React from "react";

// גרף רדאר (Taste Profile) ב-SVG טהור — ללא ספריות חיצוניות.
// 5 צירים: חמוץ / מתוק / אלכוהולי / מריר / ארומטי, בסולם 0–5.

const AXES = [
  { key: "sour", label: "חמוץ" },
  { key: "sweet", label: "מתוק" },
  { key: "boozy", label: "אלכוהולי" },
  { key: "bitter", label: "מריר" },
  { key: "aromatic", label: "ארומטי" },
];

const MAX = 5;

// ממיר (ערך-על-ציר, אינדקס) לנקודת x/y סביב המרכז. מתחילים מלמעלה (-90°).
function point(cx, cy, radius, value, index, total) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const r = (value / MAX) * radius;
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

export default function RadarChart({ profile, size = 240, showLabels = true }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.34;
  const total = AXES.length;

  // טבעות רקע (1..5)
  const rings = [1, 2, 3, 4, 5].map((ring) => {
    const pts = AXES.map((_, i) => point(cx, cy, radius, ring, i, total).join(",")).join(" ");
    return (
      <polygon
        key={ring}
        points={pts}
        fill="none"
        stroke="rgba(212,175,55,0.12)"
        strokeWidth="1"
      />
    );
  });

  // קווי הצירים מהמרכז החוצה
  const spokes = AXES.map((_, i) => {
    const [x, y] = point(cx, cy, radius, MAX, i, total);
    return (
      <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(212,175,55,0.18)" strokeWidth="1" />
    );
  });

  // פוליגון הערכים בפועל
  const valuePts = AXES.map((a, i) =>
    point(cx, cy, radius, profile?.[a.key] ?? 0, i, total).join(",")
  ).join(" ");

  // נקודות בקודקודים
  const dots = AXES.map((a, i) => {
    const [x, y] = point(cx, cy, radius, profile?.[a.key] ?? 0, i, total);
    return <circle key={i} cx={x} cy={y} r="3" fill="#FFBF00" />;
  });

  // תוויות סביב הגרף
  const labels =
    showLabels &&
    AXES.map((a, i) => {
      const [x, y] = point(cx, cy, radius + 22, MAX, i, total);
      const value = profile?.[a.key] ?? 0;
      return (
        <text
          key={i}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="12"
          fontWeight="600"
          fill="#EDE6D6"
        >
          <tspan x={x} dy="-4">
            {a.label}
          </tspan>
          <tspan x={x} dy="15" fontSize="10" fill="#D4AF37">
            {value}/5
          </tspan>
        </text>
      );
    });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="פרופיל טעם — גרף רדאר"
    >
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,191,0,0.45)" />
          <stop offset="100%" stopColor="rgba(212,175,55,0.18)" />
        </radialGradient>
      </defs>
      {rings}
      {spokes}
      <polygon
        points={valuePts}
        fill="url(#radarFill)"
        stroke="#D4AF37"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {dots}
      {labels}
    </svg>
  );
}
