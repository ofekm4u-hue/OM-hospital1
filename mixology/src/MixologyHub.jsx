import React, { useState } from "react";
import ClassicBible from "./components/ClassicBible.jsx";
import MixologyLab from "./components/MixologyLab.jsx";

// שורש האפליקציה — Header יוקרתי + ניווט בין שתי הקטגוריות הראשיות.

const TABS = [
  { id: "classics", label: "אנציקלופדיית הקלאסיקות", sub: "Classic Bible" },
  { id: "lab", label: "מעבדת האלכימיה", sub: "AI Mixology Lab" },
];

export default function MixologyHub() {
  const [tab, setTab] = useState("classics");

  return (
    <div className="min-h-full">
      {/* Header */}
      <header className="border-b border-white/10 bg-charcoal/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="flex flex-col items-center text-center">
            <div className="mb-1 flex items-center gap-2 text-gold">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                <path d="M5 4h14l-7 8v6M9 18h6" strokeLinecap="round" />
                <path d="M5 4l7 8 7-8" />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-[0.3em]">Ultimate Mixology Hub</span>
            </div>
            <h1 className="font-display text-4xl font-black tracking-tight sm:text-5xl">
              <span className="gold-shimmer">בר האלכימיה</span>
            </h1>
            <p className="mt-2 max-w-lg text-sm text-muted">
              מערכת מיקסולוגיה מתקדמת — אנציקלופדיית קלאסיקות מקצועית ומעבדה שרוקחת לכם קוקטייל ממה שיש בבית.
            </p>
          </div>

          {/* Tabs */}
          <nav className="mt-6 flex justify-center">
            <div className="inline-flex rounded-full border border-white/12 bg-black/30 p-1">
              {TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`relative rounded-full px-5 py-2.5 text-sm font-semibold transition-all no-tap-highlight sm:px-7 ${
                      active ? "text-black" : "text-cream/70 hover:text-cream"
                    }`}
                  >
                    {active && (
                      <span className="absolute inset-0 rounded-full bg-gradient-to-l from-gold to-amber shadow-gold" />
                    )}
                    <span className="relative flex flex-col items-center leading-tight">
                      <span>{t.label}</span>
                      <span className={`text-[10px] font-normal tracking-wide ${active ? "text-black/60" : "text-muted"}`}>
                        {t.sub}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {tab === "classics" ? <ClassicBible /> : <MixologyLab />}
      </main>

      <footer className="border-t border-white/10 py-6 text-center text-xs text-muted">
        רקחו באחריות · לשתות במתינות 🥃 · Ultimate Mixology Hub
      </footer>
    </div>
  );
}
