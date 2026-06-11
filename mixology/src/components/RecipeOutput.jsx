import React from "react";
import Glassware from "./Glassware.jsx";
import RadarChart from "./RadarChart.jsx";
import { ITEM_LABELS } from "../data/inventory.js";

// כרטיסיית ה-Masterpiece — הפלט של מנוע הרקיחה.
// תומך בשלושה מצבים: ok (מתכון מלא), almost (חסר רכיב אחד), none/empty (הודעות).

function Pill({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-gold/70">{label}</div>
      <div className="mt-0.5 text-sm text-cream/90">{value}</div>
    </div>
  );
}

export default function RecipeOutput({ result }) {
  if (!result) return null;

  if (result.status === "empty") {
    return (
      <Notice
        title="המלאי ריק"
        body="סמנו לפחות בקבוק בסיס אחד במלאי כדי שנוכל לרקוח לכם קוקטייל."
      />
    );
  }

  if (result.status === "none") {
    return (
      <Notice
        title="עוד לא הצלחנו לרקוח"
        body="עם המלאי הנוכחי אין התאמה מספקת. נסו להוסיף מיץ הדרים טרי, סירופ סוכר או ורמוט — אלה פותחים עשרות אפשרויות."
      />
    );
  }

  const r = result.recipe;
  const missing = (result.missingIds || []).map((id) => ITEM_LABELS[id] || id);

  return (
    <div className="anim-pour overflow-hidden rounded-3xl border border-gold/25 bg-graphite shadow-gold">
      {/* כותרת בר-קראפט */}
      <div className="border-b border-white/10 bg-gradient-to-l from-gold/10 to-transparent px-6 py-5">
        {result.status === "almost" && (
          <span className="mb-2 inline-block rounded-full border border-amber/40 bg-amber/10 px-3 py-0.5 text-xs font-medium text-amber">
            כמעט שם — חסר רק רכיב אחד
          </span>
        )}
        <div className="flex items-center gap-4">
          <div className="text-gold">
            <Glassware type={r.glass} size={56} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-gold/70">יצירת מופת</div>
            <h3 className="font-display text-3xl font-bold text-cream leading-tight">{r.name}</h3>
          </div>
        </div>
      </div>

      {/* הצעת רכישה במצב almost */}
      {result.status === "almost" && missing.length > 0 && (
        <div className="border-b border-white/10 bg-amber/5 px-6 py-3 text-sm text-cream/85">
          כדי להכין אותו צריך עוד:{" "}
          <span className="font-semibold text-amber">{missing.join(", ")}</span>. שווה לקנות — זה פותח מתכון נהדר.
        </div>
      )}

      <div className="grid gap-6 p-6 md:grid-cols-5">
        {/* רכיבים + מפרט */}
        <div className="md:col-span-3 space-y-5">
          <div>
            <h4 className="mb-3 font-display text-lg font-bold text-gold">רכיבים (במ"ל)</h4>
            <ul className="space-y-2">
              {r.ingredients.map((ing, i) => (
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

          <div className="grid grid-cols-2 gap-3">
            <Pill label="כוס" value={r.glassName} />
            <Pill label="קרח" value={r.iceName} />
            <Pill label="שיטה" value={r.methodName} />
            <Pill label="עיטור" value={r.garnish} />
          </div>
        </div>

        {/* רדאר */}
        <div className="md:col-span-2">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <h4 className="mb-1 text-center font-display text-lg font-bold text-gold">פרופיל טעם</h4>
            <div className="flex justify-center">
              <RadarChart profile={r.profile} size={230} />
            </div>
          </div>
        </div>
      </div>

      {/* אלכימיה + הערות */}
      <div className="grid gap-4 px-6 pb-6 md:grid-cols-2">
        <div className="rounded-xl border border-gold/20 bg-gradient-to-l from-gold/8 to-transparent p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 3h6M10 3v5l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3" strokeLinejoin="round" />
            </svg>
            הסבר האלכימיה
          </div>
          <p className="mt-2 text-sm leading-relaxed text-cream/85">{r.why}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/25 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
            </svg>
            הערות ברמן מקצועיות
          </div>
          <p className="mt-2 text-sm leading-relaxed text-cream/85">{r.notes}</p>
        </div>
      </div>
    </div>
  );
}

function Notice({ title, body }) {
  return (
    <div className="anim-fade-up rounded-3xl border border-white/12 bg-graphite/70 p-8 text-center shadow-lux">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 text-gold">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M8 2h8M9 2v4.5L5 16a2.5 2.5 0 002.3 3.5h9.4A2.5 2.5 0 0019 16l-4-9.5V2" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="font-display text-xl font-bold text-cream">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-cream/70">{body}</p>
    </div>
  );
}
