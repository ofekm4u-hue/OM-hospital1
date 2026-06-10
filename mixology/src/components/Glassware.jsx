import React from "react";

// אייקוני כוסות SVG — ייצוג ויזואלי לסוג ה-Glassware של כל קוקטייל.
// כל אייקון משורטט בקו זהב דק לשמירה על האסתטיקה היוקרתית.

const GLASSES = {
  // כוס רוקס / לואובול — נמוכה ורחבה
  rocks: (
    <>
      <path d="M16 14 L48 14 L44 50 L20 50 Z" />
      <line x1="22" y1="44" x2="42" y2="44" />
    </>
  ),
  // כוס קופה — גביע רדוד על רגל
  coupe: (
    <>
      <path d="M14 16 C14 30 24 36 32 36 C40 36 50 30 50 16 Z" />
      <line x1="32" y1="36" x2="32" y2="52" />
      <line x1="22" y1="54" x2="42" y2="54" />
    </>
  ),
  // ניק ונורה — גביע מעט עמוק יותר
  "nick-nora": (
    <>
      <path d="M18 14 C18 30 26 36 32 36 C38 36 46 30 46 14 Z" />
      <line x1="32" y1="36" x2="32" y2="52" />
      <line x1="23" y1="54" x2="41" y2="54" />
    </>
  ),
  // הייבול — גבוהה וצרה
  highball: (
    <>
      <path d="M22 8 L42 8 L40 54 L24 54 Z" />
      <line x1="26" y1="16" x2="38" y2="16" />
    </>
  ),
  // כוס יין — לאפרול שפריץ
  wine: (
    <>
      <path d="M18 10 C18 28 26 34 32 34 C38 34 46 28 46 10 Z" />
      <line x1="32" y1="34" x2="32" y2="50" />
      <line x1="22" y1="52" x2="42" y2="52" />
    </>
  ),
};

export default function Glassware({ type = "rocks", size = 56, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {GLASSES[type] || GLASSES.rocks}
    </svg>
  );
}
