import React, { useMemo, useState } from "react";
import { BASES, COCKTAILS } from "../data/cocktails.js";
import CocktailCard from "./CocktailCard.jsx";
import CocktailModal from "./CocktailModal.jsx";

// אנציקלופדיית הקלאסיקות — Filter Pills לפי בסיס + חיפוש חופשי + רשת כרטיסים.

export default function ClassicBible() {
  const [activeBase, setActiveBase] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COCKTAILS.filter((c) => {
      const baseOk = activeBase === "all" || c.base === activeBase;
      if (!baseOk) return false;
      if (!q) return true;
      const haystack = [
        c.nameHe,
        c.nameEn,
        ...c.ingredients.map((i) => i.name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [activeBase, query]);

  return (
    <section className="anim-fade-up">
      {/* כותרת קטגוריה */}
      <div className="mb-6 text-center">
        <h2 className="font-display text-3xl font-bold text-cream sm:text-4xl">אנציקלופדיית הקלאסיקות</h2>
        <p className="mt-2 text-sm text-muted">בסיס הנתונים הקשיח — מתכונים מדויקים במ"ל, מותגים וטכניקה.</p>
      </div>

      {/* חיפוש */}
      <div className="mx-auto mb-5 max-w-md">
        <div className="flex items-center gap-2 rounded-full border border-white/12 bg-black/30 px-4 py-2.5 focus-within:border-gold/50">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש קוקטייל או רכיב…"
            className="w-full bg-transparent text-sm text-cream placeholder:text-muted focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted hover:text-cream" aria-label="ניקוי">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filter Pills */}
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {BASES.map((b) => {
          const active = activeBase === b.id;
          return (
            <button
              key={b.id}
              onClick={() => setActiveBase(b.id)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all no-tap-highlight ${
                active
                  ? "border-gold bg-gold/15 text-gold shadow-gold"
                  : "border-white/12 bg-graphite/60 text-cream/70 hover:border-gold/40 hover:text-cream"
              }`}
            >
              {b.label}
            </button>
          );
        })}
      </div>

      {/* רשת כרטיסים */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CocktailCard key={c.id} cocktail={c} onOpen={setSelected} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-muted">לא נמצאו קוקטיילים תואמים. נסו חיפוש אחר.</p>
      )}

      {selected && <CocktailModal cocktail={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
