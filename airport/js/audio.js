// audio.js — אפקטים קוליים (Web Audio, נוצרים בקוד ללא קבצים) וכריזות בקול
// (Web Speech Synthesis בעברית). הכל מובנה בדפדפן — חינמי וללא תלות ברשת.

let ctx = null;
let muted = false;
try { muted = localStorage.getItem('airport_muted') === '1'; } catch { /* */ }

function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function setMuted(m) { muted = m; try { localStorage.setItem('airport_muted', m ? '1' : '0'); } catch { /* */ } if (m) try { speechSynthesis.cancel(); } catch { /* */ } }
export function isMuted() { return muted; }

function tone(freq, dur, type = 'sine', vol = 0.18, when = 0) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.value = freq; o.connect(g); g.connect(c.destination);
  const t = c.currentTime + when;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.02);
}

// אפקט קולי לפי סוג אירוע.
export function sfx(kind) {
  if (muted) return;
  try {
    switch (kind) {
      case 'beep':  tone(920, 0.08, 'square', 0.12); break;                       // סריקה
      case 'ok':    tone(620, 0.09, 'sine', 0.18); tone(940, 0.13, 'sine', 0.18, 0.08); break; // אישור
      case 'err':   tone(220, 0.18, 'sawtooth', 0.18); tone(160, 0.22, 'sawtooth', 0.18, 0.13); break; // שגיאה
      case 'warn':  tone(440, 0.12, 'triangle', 0.16); break;
      case 'print': tone(130, 0.18, 'square', 0.07); tone(110, 0.18, 'square', 0.07, 0.06); break; // מדפסת
      case 'click': tone(560, 0.04, 'square', 0.08); break;
      case 'alarm': tone(760, 0.16, 'square', 0.2); tone(540, 0.16, 'square', 0.2, 0.2); break;
      default: break;
    }
  } catch { /* */ }
}

// כריזה קולית בעברית.
export function announce(text) {
  if (muted) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'he-IL'; u.rate = 0.96; u.pitch = 1;
    const voices = speechSynthesis.getVoices();
    const he = voices.find((v) => /he|iw/i.test(v.lang));
    if (he) u.voice = he;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { /* */ }
}
