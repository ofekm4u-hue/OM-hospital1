import React, { useEffect, useMemo, useState } from "react";
import { INVENTORY_GROUPS, VIBES, TEXTURES } from "../data/inventory.js";
import { craftCocktail } from "../data/labEngine.js";
import { COCKTAILS } from "../data/cocktails.js";
import RecipeOutput from "./RecipeOutput.jsx";
import CocktailModal from "./CocktailModal.jsx";
import CocktailCard from "./CocktailCard.jsx";

const STORAGE_KEY = "mixology.inventory.v1";

// אילו פריטי מלאי נחשבים "בסיס אלכוהולי" — צריך לפחות אחד כדי לרקוח.
const BASE_SPIRIT_IDS = INVENTORY_GROUPS.find((g) => g.id === "spirits").items.map((i) => i.id);

// מיפוי בסיס קוקטייל קלאסי → פריטי מלאי שמספיקים כדי "להחזיק" את הבסיס.
const BASE_TO_INVENTORY = {
  whiskey: ["bourbon", "scotch"],
  gin: ["gin"],
  vodka: ["vodka"],
  tequila: ["tequila_blanco", "tequila_reposado", "mezcal"],
  rum: ["white_rum", "dark_rum"],
  brandy: ["cognac"],
};

// אייקוני קבוצות מלאי (SVG מינימליסטי)
const GROUP_ICONS = {
  bottle: <path d="M10 2h4v4l2 4v12H8V10l2-4z" />,
  drop: <path d="M12 3s6 7 6 11a6 6 0 11-12 0c0-4 6-11 6-11z" />,
  citrus: <><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" /></>,
  flask: <path d="M9 2h6M10 2v6l-5 10a2 2 0 002 3h10a2 2 0 002-3l-5-10V2" />,
  leaf: <path d="M5 21c0-9 7-16 16-16 0 9-7 16-16 16zM5 21c4-4 8-6 12-7" />,
};

function loadInventory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export default function MixologyLab() {
  const [inventory, setInventory] = useState(loadInventory);
  const [vibe, setVibe] = useState(null);
  const [texture, setTexture] = useState("any");
  const [allowInfusions, setAllowInfusions] = useState(false);
  const [allowAdvanced, setAllowAdvanced] = useState(false);
  const [result, setResult] = useState(null);
  const [crafting, setCrafting] = useState(false);
  const [selectedClassic, setSelectedClassic] = useState(null);

  // שמירת המלאי ב-localStorage בכל שינוי
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...inventory]));
    } catch {
      /* localStorage לא זמין — ממשיכים בלי שמירה */
    }
  }, [inventory]);

  const toggleItem = (id) => {
    setInventory((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const hasBase = useMemo(
    () => BASE_SPIRIT_IDS.some((id) => inventory.has(id)),
    [inventory]
  );

  const selectedCount = inventory.size;

  // קלאסיקות שאפשר לנסות לפי הבסיסים שבמלאי
  const suggestedClassics = useMemo(() => {
    if (!hasBase) return [];
    return COCKTAILS.filter((c) =>
      (BASE_TO_INVENTORY[c.base] || []).some((id) => inventory.has(id))
    ).slice(0, 6);
  }, [inventory, hasBase]);

  const handleCraft = () => {
    setCrafting(true);
    setResult(null);
    // השהיה קצרה ל"דרמה" של רקיחה (מכובד גם תחת reduced-motion)
    setTimeout(() => {
      const res = craftCocktail([...inventory], {
        vibe,
        texture,
        allowInfusions,
        allowAdvanced,
      });
      setResult(res);
      setCrafting(false);
    }, 650);
  };

  const clearAll = () => {
    setInventory(new Set());
    setResult(null);
  };

  return (
    <section className="anim-fade-up">
      <div className="mb-6 text-center">
        <h2 className="font-display text-3xl font-bold text-cream sm:text-4xl">מעבדת האלכימיה</h2>
        <p className="mt-2 text-sm text-muted">סמנו מה יש בבר, כווננו את החוויה — ותנו למנוע לרקוח.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── עמודת המלאי + הגדרות ── */}
        <div className="lg:col-span-3 space-y-6">
          {/* שלב א': מלאי */}
          <div className="rounded-2xl border border-white/10 bg-graphite/70 p-5 shadow-lux">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-gold">שלב א' · המלאי שלי</h3>
              <div className="flex items-center gap-3 text-xs text-muted">
                <span>{selectedCount} נבחרו</span>
                {selectedCount > 0 && (
                  <button onClick={clearAll} className="text-cream/60 underline-offset-2 hover:text-cream hover:underline">
                    נקה
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-5">
              {INVENTORY_GROUPS.map((group) => (
                <div key={group.id}>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cream/80">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-gold/70" strokeLinejoin="round" strokeLinecap="round">
                      {GROUP_ICONS[group.icon]}
                    </svg>
                    {group.title}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((item) => {
                      const on = inventory.has(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleItem(item.id)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all no-tap-highlight ${
                            on
                              ? "border-gold bg-gold/15 text-gold"
                              : "border-white/12 bg-black/25 text-cream/65 hover:border-gold/40 hover:text-cream"
                          }`}
                        >
                          {on && <span className="ml-1">✓</span>}
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* שלב ב': הגדרות מתקדמות */}
          <div className="rounded-2xl border border-white/10 bg-graphite/70 p-5 shadow-lux">
            <h3 className="mb-4 font-display text-xl font-bold text-gold">שלב ב' · כיוונון החוויה</h3>

            {/* Vibe */}
            <div className="mb-5">
              <div className="mb-2 text-sm font-semibold text-cream/80">פרופיל חוויה וטעם</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {VIBES.map((v) => {
                  const on = vibe === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setVibe(on ? null : v.id)}
                      className={`rounded-xl border p-3 text-right transition-all no-tap-highlight ${
                        on ? "border-gold bg-gold/12 shadow-gold" : "border-white/12 bg-black/25 hover:border-gold/40"
                      }`}
                    >
                      <div className={`text-sm font-semibold ${on ? "text-gold" : "text-cream/85"}`}>{v.label}</div>
                      <div className="mt-0.5 text-[10px] text-muted">{v.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Texture */}
            <div className="mb-5">
              <div className="mb-2 text-sm font-semibold text-cream/80">מרקם</div>
              <div className="flex flex-wrap gap-2">
                {TEXTURES.map((t) => {
                  const on = texture === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTexture(t.id)}
                      className={`rounded-full border px-4 py-2 text-sm transition-all no-tap-highlight ${
                        on ? "border-gold bg-gold/15 text-gold" : "border-white/12 bg-black/25 text-cream/70 hover:border-gold/40"
                      }`}
                    >
                      {t.label}
                      <span className="mr-1.5 text-[10px] text-muted">{t.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <Toggle
                label="סירופים ואינפוזיות ביתיות"
                sub="המנוע יציע שדרוגים לחומרי גלם (כתישת בזיליקום, דבש-ג'ינג'ר ביתי ועוד)"
                on={allowInfusions}
                onChange={() => setAllowInfusions((v) => !v)}
              />
              <Toggle
                label="טכניקות מתקדמות"
                sub="שטיפת שומן (Fat Washing) והבהרה בחלב (Clarification) לקוקטייל צלול וקטיפתי"
                on={allowAdvanced}
                onChange={() => setAllowAdvanced((v) => !v)}
              />
            </div>
          </div>

          {/* כפתור רקיחה */}
          <button
            onClick={handleCraft}
            disabled={!hasBase || crafting}
            className={`group relative w-full overflow-hidden rounded-2xl px-6 py-4 text-lg font-bold transition-all no-tap-highlight ${
              hasBase && !crafting
                ? "bg-gradient-to-l from-gold to-amber text-black shadow-gold hover:brightness-110"
                : "cursor-not-allowed border border-white/10 bg-black/30 text-muted"
            }`}
          >
            {crafting ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="anim-spin-slow" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3a9 9 0 109 9" strokeLinecap="round" />
                </svg>
                רוקח קוקטייל…
              </span>
            ) : hasBase ? (
              "🍸 רקח לי קוקטייל"
            ) : (
              "בחרו לפחות בקבוק בסיס אחד"
            )}
          </button>
        </div>

        {/* ── עמודת הפלט ── */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-6 space-y-6">
            {result ? (
              <RecipeOutput result={result} />
            ) : (
              <div className="rounded-3xl border border-dashed border-white/15 bg-black/20 p-10 text-center">
                <div className="mx-auto mb-3 text-4xl">🥃</div>
                <h3 className="font-display text-xl font-bold text-cream/90">הבר מוכן</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
                  סמנו את המלאי, כווננו את החוויה ולחצו "רקח לי קוקטייל" — יצירת המופת תופיע כאן.
                </p>
              </div>
            )}

            {/* קלאסיקות שאפשר לנסות */}
            {suggestedClassics.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-graphite/60 p-4">
                <h4 className="mb-3 font-display text-base font-bold text-gold">קלאסיקות עם המלאי שלך</h4>
                <div className="flex flex-wrap gap-2">
                  {suggestedClassics.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClassic(c)}
                      className="rounded-full border border-white/12 bg-black/25 px-3 py-1.5 text-xs text-cream/75 transition hover:border-gold/40 hover:text-cream"
                    >
                      {c.nameHe}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedClassic && <CocktailModal cocktail={selectedClassic} onClose={() => setSelectedClassic(null)} />}
    </section>
  );
}

function Toggle({ label, sub, on, onChange }) {
  return (
    <button
      onClick={onChange}
      className={`flex w-full items-center justify-between gap-4 rounded-xl border p-3 text-right transition-all no-tap-highlight ${
        on ? "border-gold/50 bg-gold/8" : "border-white/12 bg-black/25 hover:border-white/25"
      }`}
    >
      <div>
        <div className={`text-sm font-semibold ${on ? "text-gold" : "text-cream/85"}`}>{label}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-muted">{sub}</div>
      </div>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-gold" : "bg-white/15"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-black transition-all ${on ? "right-0.5" : "right-[22px]"}`}
        />
      </span>
    </button>
  );
}
