import React from "react";
import Glassware from "./Glassware.jsx";

// מיפוי צבע אקסנט → מחלקות Tailwind (טקסט / מסגרת / רקע עדין).
export const ACCENT = {
  mint: { text: "text-mint", ring: "hover:border-mint/40", glow: "group-hover:text-mint", dot: "bg-mint" },
  ruby: { text: "text-ruby", ring: "hover:border-ruby/50", glow: "group-hover:text-ruby", dot: "bg-ruby" },
  gold: { text: "text-gold", ring: "hover:border-gold/50", glow: "group-hover:text-gold", dot: "bg-gold" },
  amber: { text: "text-amber", ring: "hover:border-amber/50", glow: "group-hover:text-amber", dot: "bg-amber" },
};

const BASE_LABELS = {
  whiskey: "וויסקי",
  gin: "ג'ין",
  vodka: "וודקה",
  tequila: "טקילה / מזקאל",
  rum: "רום",
  brandy: "קוניאק / ברנדי",
};

export default function CocktailCard({ cocktail, onOpen }) {
  const accent = ACCENT[cocktail.accentColor] || ACCENT.gold;

  return (
    <button
      onClick={() => onOpen(cocktail)}
      className={`group anim-fade-up text-right w-full rounded-2xl border border-white/10 bg-graphite/80 p-5 shadow-lux transition-all duration-300 hover:-translate-y-1 hover:shadow-gold ${accent.ring} no-tap-highlight`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-2xl font-bold text-cream leading-tight">
            {cocktail.nameHe}
          </h3>
          <p className="mt-0.5 text-sm tracking-wide text-muted">{cocktail.nameEn}</p>
        </div>
        <div className={`shrink-0 ${accent.text} opacity-80 transition-transform duration-300 group-hover:scale-110`}>
          <Glassware type={cocktail.glass} size={52} />
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-cream/70">{cocktail.tagline}</p>

      <div className="mt-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-cream/80">
          <span className={`h-2 w-2 rounded-full ${accent.dot}`} />
          {BASE_LABELS[cocktail.base]}
        </span>
        <span className={`text-xs font-medium ${accent.text} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}>
          לפרטים ←
        </span>
      </div>
    </button>
  );
}
