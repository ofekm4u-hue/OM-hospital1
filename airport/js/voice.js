// voice.js — זיהוי דיבור בעברית באמצעות Web Speech API.
// מספק כפתור מיקרופון עם מצבי "כבוי/מקשיב", תמלול חי, ו-callback עם הטקסט הסופי.
// אם הדפדפן לא תומך — מסתיר את הכפתור והמשחק נשאר שמיש דרך הקלדה.

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export function isVoiceSupported() {
  return !!SR;
}

let recognition = null;
let listening = false;

// מאתחל ומחבר את כפתור המיקרופון.
// opts: { button, interimEl, onFinal(text), onInterim(text), onStateChange(listening) }
export function setupVoice({ button, interimEl, onFinal, onInterim, onStateChange }) {
  if (!SR) {
    if (button) button.style.display = 'none';
    return { supported: false };
  }

  recognition = new SR();
  recognition.lang = 'he-IL';
  recognition.continuous = false;
  recognition.interimResults = true; // מציגים תמלול חי גם אם התוצאה הסופית אחת

  recognition.onstart = () => {
    listening = true;
    button.classList.add('listening');
    button.setAttribute('aria-pressed', 'true');
    onStateChange && onStateChange(true);
  };

  recognition.onend = () => {
    listening = false;
    button.classList.remove('listening');
    button.setAttribute('aria-pressed', 'false');
    onStateChange && onStateChange(false);
    if (interimEl) interimEl.textContent = '';
  };

  recognition.onerror = (e) => {
    listening = false;
    button.classList.remove('listening');
    onStateChange && onStateChange(false);
    if (interimEl) {
      interimEl.textContent = e.error === 'not-allowed'
        ? 'אין הרשאת מיקרופון — אפשר להקליד במקום'
        : 'שגיאת זיהוי קולי — נסה שוב או הקלד';
    }
  };

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) final += t;
      else interim += t;
    }
    if (interim && interimEl) {
      interimEl.textContent = interim;
      onInterim && onInterim(interim);
    }
    if (final) {
      if (interimEl) interimEl.textContent = '';
      onFinal && onFinal(final.trim());
    }
  };

  button.addEventListener('click', () => {
    if (listening) {
      recognition.stop();
    } else {
      try { recognition.start(); } catch { /* כבר פעיל */ }
    }
  });

  return { supported: true };
}

export function stopVoice() {
  if (recognition && listening) {
    try { recognition.stop(); } catch { /* ignore */ }
  }
}
