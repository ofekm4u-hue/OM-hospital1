import React, { useEffect } from "react";
import Glassware from "./Glassware.jsx";
import RadarChart from "./RadarChart.jsx";
import { ACCENT } from "./CocktailCard.jsx";

// תצוגה מורחבת של קוקטייל קלאסי — כל 7 שדות האפיון + גרף רדאר.

function Spec({ label, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gold/70">{label}</div>
      <div className="mt-1 text-sm leading-relaxed text-cream/90">{children}</div>
    </div>
  );
}

export default function CocktailModal({ cocktail, onClose }) {
  const accent = ACCENT[cocktail?.accentColor] || ACCENT.gold;

  // סגירה ב-Escape
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!cocktail) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="anim-pour relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-gold/20 bg-graphite shadow-lux sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* כותרת */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-graphite/95 px-6 py-5 backdrop-blur">
          <div className="flex items-center gap-4">
            <div className={accent.text}>
              <Glassware type={cocktail.glass} size={56} />
            </div>
            <div>
              <h2 className="font-display text-3xl font-bold text-cream leading-tight">
                {cocktail.nameHe}
              </h2>
              <p className="text-sm tracking-wide text-muted">{cocktail.nameEn}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="סגירה"
            className="shrink-0 rounded-full border border-white/15 p-2 text-cream/70 transition hover:border-gold/50 hover:text-gold"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-5">
          {/* רכיבים + מותג */}
          <div className="md:col-span-3 space-y-5">
            <div>
              <h3 className="mb-3 font-display text-lg font-bold text-gold">רכיבים (במ"ל)</h3>
              <ul className="space-y-2">
                {cocktail.ingredients.map((ing, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-white/8 bg-black/20 px-4 py-2.5"
                  >
                    <span className="text-cream/90">{ing.name}</span>
                    <span className="font-mono text-sm font-semibold text-amber">{ing.ml} מ"ל</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-gold/20 bg-gradient-to-l from-gold/8 to-transparent p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gold">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l2.4 7.4H22l-6 4.4 2.3 7.2L12 16.6 5.7 21l2.3-7.2-6-4.4h7.6z" strokeLinejoin="round" />
                </svg>
                המלצת מותג (Brand Spec)
              </div>
              <p className="mt-2 text-sm leading-relaxed text-cream/85">{cocktail.brandSpec}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Spec label="כוס">{cocktail.glassName}</Spec>
              <Spec label="תוכנית קרח">{cocktail.iceName}</Spec>
              <Spec label="שיטת הכנה">{cocktail.methodName}</Spec>
              <Spec label="עיטור">{cocktail.garnish}</Spec>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
                </svg>
                הערות ברמן
              </div>
              <p className="mt-2 text-sm leading-relaxed text-cream/85">{cocktail.notes}</p>
            </div>
          </div>

          {/* גרף רדאר */}
          <div className="md:col-span-2">
            <div className="sticky top-24 rounded-2xl border border-white/10 bg-black/30 p-4">
              <h3 className="mb-1 text-center font-display text-lg font-bold text-gold">פרופיל טעם</h3>
              <div className="flex justify-center">
                <RadarChart profile={cocktail.tasteProfile} size={240} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
