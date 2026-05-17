/* ============================================================
   שו"ב צופים — Cross-System Engine
   ScoutDB · Bus · Audio · DMS · SOS · Geo · Toast · Modal · UI helpers
   ============================================================ */
(function (global) {
  'use strict';

  // ---------- Constants ----------

  const NS = 'scout:';
  const SCHEMA_VERSION = 4;

  const FORESTS = [
    { id: 'ben-shemen',   name: 'יער בן שמן',     lat: 31.957, lng: 34.951, region: 'מרכז',  hanichim: 412, staff: 78, status: 'ok' },
    { id: 'haruvit',      name: 'יער חרובית',     lat: 31.7333, lng: 34.876, region: 'שפלה',  hanichim: 268, staff: 54, status: 'warn' },
    { id: 'jerusalem',    name: 'יערות ירושלים',  lat: 31.770, lng: 35.130, region: 'הרים',  hanichim: 198, staff: 44, status: 'ok' },
    { id: 'horeshat-tal', name: 'יער חורשת טל',  lat: 33.245, lng: 35.628, region: 'גליל',  hanichim: 322, staff: 64, status: 'ok' },
  ];

  const TRIBES_BY_FOREST = {
    'ben-shemen':   ['נחל', 'אפיק', 'גלעד', 'יעלים'],
    'haruvit':      ['חרמון', 'תבור', 'גלבוע'],
    'jerusalem':    ['ארבל', 'מירון', 'כרמל'],
    'horeshat-tal': ['חולתא', 'דן', 'הירמוך'],
  };

  const HANICH_FIRST = ['יונתן','דניאל','איתי','נועם','גלעד','עומר','אלעד','יוסי','מיכל','שירה','תמר','רוני','ליאור','עידן','איה','שני','הילה','אורי','אלון','שלי','מיה','נועה','אדם','ארי','גיא','דור','אביב','אופק'];
  const HANICH_LAST  = ['כהן','לוי','אברהמי','בנדה','שמיר','חזן','דהן','אזולאי','גרינברג','בן-דוד','פרץ','שטרן','גולן','ארז','עמית','חדד','ברק','שוורץ','ניר','מזרחי'];
  const COMPLAINTS = ['שריטה ביד','חבלה בקרסול','עקיצה','חום קל','שלשול','כאב ראש','דהידרציה','חתך שטחי'];
  const TREATMENTS = ['חבישה ופלסטר','קומפרס קר','נוטל אקמול','שתיית מים מבוקרת','מנוחה במרפאה','חיטוי + פלסטר'];

  // ---------- Utilities ----------

  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Math.random().toString(36).slice(2) + '-' + Date.now();
  }
  function nowMs() { return Date.now(); }
  function fmtTime(d) {
    d = (typeof d === 'number') ? new Date(d) : (d || new Date());
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }
  function fmtDate(d) {
    d = (typeof d === 'number') ? new Date(d) : (d || new Date());
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function on(target, ev, cb) { target.addEventListener(ev, cb); }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function getParam(name) {
    return new URLSearchParams(global.location.search).get(name);
  }

  // ---------- ScoutDB (localStorage wrapper) ----------

  const ScoutDB = (function () {
    function get(key, dflt) {
      try {
        const raw = localStorage.getItem(NS + key);
        return raw == null ? dflt : JSON.parse(raw);
      } catch (e) { return dflt; }
    }
    function set(key, value) {
      try { localStorage.setItem(NS + key, JSON.stringify(value)); }
      catch (e) { console.warn('ScoutDB set failed', e); }
    }
    function remove(key) {
      try { localStorage.removeItem(NS + key); } catch (e) {}
    }
    function listKeys() {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(NS)) out.push(k.slice(NS.length));
      }
      return out;
    }

    function maybeSeed() {
      const ver = get('schemaVersion', 0);
      if (ver >= SCHEMA_VERSION) return;
      // Wipe scout-namespaced keys (preserve cross-session audit only on first run)
      const prevAudit = get('audit', []);
      listKeys().forEach(remove);

      const tribes = [];
      const hanichim = [];
      let tribeId = 1;
      let hanichId = 1;
      FORESTS.forEach(f => {
        (TRIBES_BY_FOREST[f.id] || []).forEach(name => {
          const tId = 'tribe-' + tribeId++;
          tribes.push({ id: tId, name, forestId: f.id });
          // 12-14 hanichim per tribe
          const count = 12 + Math.floor(Math.random() * 3);
          for (let i = 0; i < count; i++) {
            hanichim.push({
              id: 'h-' + hanichId++,
              tribeId: tId,
              forestId: f.id,
              name: pick(HANICH_FIRST) + ' ' + pick(HANICH_LAST),
              age: 12 + Math.floor(Math.random() * 5),
              status: 'present', // present | released | clinic | evacuated
              allergy: Math.random() < 0.18 ? pick(['בוטנים','פניצילין','עוקץ דבורים','אגוזים']) : null,
            });
          }
        });
      });

      set('forests', FORESTS);
      set('tribes', tribes);
      set('hanichim', hanichim);
      set('vehicles', seedVehicles());
      set('buses', seedBuses());
      set('blacklist', [{ kind: 'id', value: '034567891', reason: 'הוגדר ע״י קב״ט – חשד פלילי' }]);
      set('staff', seedStaff());
      set('patients', []);
      set('audit', Array.isArray(prevAudit) ? prevAudit.slice(-50) : []);
      set('permissions', seedPermissions());
      set('dmsInterval', 15); // minutes
      set('audioProfile', 'pulse-alert');
      set('schemaVersion', SCHEMA_VERSION);
    }

    function seedVehicles() {
      return [
        { id: 'v1', plate: '12-345-67', driver: 'משה כהן',     vendor: 'אקונומיה', cleared: true,  arrived: false },
        { id: 'v2', plate: '98-765-43', driver: 'אבי דהן',     vendor: 'מנופי נווה', cleared: true,  arrived: false },
        { id: 'v3', plate: '55-444-33', driver: 'יוסי לוי',    vendor: 'תברואה',    cleared: true,  arrived: false },
        { id: 'v4', plate: '77-888-99', driver: 'דני כהן',     vendor: 'קרח אקונומיה', cleared: true, arrived: true },
      ];
    }
    function seedBuses() {
      return [
        { id: 'b1', plate: '70-201-30', driver: 'אבישי בנימין', driverPhone: '050-1234567', escort: 'נטע אפרת', escortPhone: '052-7654321', tribeId: 'tribe-1', battalion: 'גדוד ב', hanichim: 38, status: 'planned' },
        { id: 'b2', plate: '70-415-22', driver: 'דורון מזרחי',  driverPhone: '050-2345678', escort: 'אלה כהן',    escortPhone: '052-8765432', tribeId: 'tribe-2', battalion: 'גדוד א', hanichim: 42, status: 'waiting' },
        { id: 'b3', plate: '70-892-11', driver: 'אלברט נחמיאס', driverPhone: '050-3456789', escort: 'עומרי שני',  escortPhone: '052-9876543', tribeId: 'tribe-3', battalion: 'גדוד ג', hanichim: 35, status: 'cleared' },
        { id: 'b4', plate: '70-664-87', driver: 'שמעון פרץ',    driverPhone: '050-4567890', escort: 'הילה אזולאי', escortPhone: '052-1098765', tribeId: 'tribe-4', battalion: 'גדוד ב', hanichim: 40, status: 'inside' },
      ];
    }
    function seedStaff() {
      return [
        { id: 's1', name: 'רס״ל ניר אלון',  role: 'kabat',   active: true },
        { id: 's2', name: 'רס״ל יוסי גולן', role: 'achmash', active: true },
        { id: 's3', name: 'אחראי חמ״ל רחל', role: 'hq-shift', active: true },
        { id: 's4', name: 'תורן עידו',      role: 'hq-op',   active: true },
        { id: 's5', name: 'ד״ר נועה לוי',   role: 'doctor',  active: true },
        { id: 's6', name: 'פאר חובש שדה',   role: 'medic',   active: true },
        { id: 's7', name: 'יואב מע״ר',      role: 'first-aid', active: true },
        { id: 's8', name: 'מאבטח 1 - אופיר', role: 'guard', active: true },
        { id: 's9', name: 'מאבטח 2 - אסף',   role: 'guard', active: true },
        { id: 's10', name: 'סייר 3 - תומר',  role: 'patrol', active: true },
        { id: 's11', name: 'תברואן - איציק', role: 'sanitation', active: true },
        { id: 's12', name: 'מנהל מחנה גלית', role: 'camp-director', active: true },
      ];
    }
    function seedPermissions() {
      return {
        's1': { sosOverride: true, blacklistEdit: true, dmsConfig: true, auditView: true, broadcast: true },
        's2': { sosOverride: false, blacklistEdit: false, dmsConfig: false, auditView: true, broadcast: true },
        's3': { sosOverride: true, blacklistEdit: false, dmsConfig: false, auditView: true, broadcast: true },
        's4': { sosOverride: false, blacklistEdit: false, dmsConfig: false, auditView: false, broadcast: false },
      };
    }

    function appendAudit(entry) {
      const log = get('audit', []);
      log.push({
        id: uuid(),
        ts: nowMs(),
        actor: entry.actor || (UI.currentPersona().name + ' / ' + UI.currentPersona().roleLabel),
        action: entry.action,
        channel: entry.channel || '-',
        details: entry.details || '',
      });
      // append-only with a soft cap
      if (log.length > 2000) log.splice(0, log.length - 2000);
      set('audit', log);
      Bus.emit('audit:append', { tail: log.slice(-1)[0] });
    }

    function patch(key, mapper) {
      const cur = get(key, []);
      const next = mapper(cur);
      set(key, next);
      return next;
    }

    maybeSeed();

    return { get, set, remove, listKeys, appendAudit, patch };
  })();

  // ---------- Cross-Tab Bus ----------

  const Bus = (function () {
    const CHANNEL_KEY = NS + 'bus';
    const handlers = Object.create(null);
    let seq = 0;

    function emit(channel, payload) {
      seq++;
      const msg = { channel, payload, seq, ts: nowMs(), src: UI.tabId };
      try {
        localStorage.setItem(CHANNEL_KEY, JSON.stringify(msg));
      } catch (e) { /* quota */ }
      // Same-tab fanout (storage event won't fire here)
      dispatch(msg);
    }

    function on(channel, cb) {
      (handlers[channel] || (handlers[channel] = [])).push(cb);
      return () => off(channel, cb);
    }
    function off(channel, cb) {
      const arr = handlers[channel]; if (!arr) return;
      const idx = arr.indexOf(cb); if (idx >= 0) arr.splice(idx, 1);
    }
    function dispatch(msg) {
      if (!msg || !msg.channel) return;
      const arr = handlers[msg.channel];
      if (arr) arr.slice().forEach(cb => { try { cb(msg.payload, msg); } catch (e) { console.error(e); } });
    }

    global.addEventListener('storage', e => {
      if (e.key !== CHANNEL_KEY || !e.newValue) return;
      let msg = null;
      try { msg = JSON.parse(e.newValue); } catch (err) { return; }
      dispatch(msg);
    });

    return { emit, on, off };
  })();

  // ---------- Audio Engine ----------

  const Audio = (function () {
    let ctx = null;
    let armed = false;
    let activeNodes = [];
    let prefVoice = null;

    function context() {
      if (!ctx) {
        const AC = global.AudioContext || global.webkitAudioContext;
        if (AC) ctx = new AC();
      }
      return ctx;
    }

    function arm() {
      const c = context();
      if (c && c.state === 'suspended') c.resume();
      // Prime SpeechSynthesis
      if (global.speechSynthesis) {
        try {
          const u = new SpeechSynthesisUtterance('');
          u.volume = 0; speechSynthesis.speak(u);
        } catch (e) {}
        const updateVoice = () => {
          const voices = speechSynthesis.getVoices();
          prefVoice = voices.find(v => /^he/i.test(v.lang)) ||
                      voices.find(v => /Hebrew/i.test(v.name)) || null;
        };
        updateVoice();
        speechSynthesis.onvoiceschanged = updateVoice;
      }
      armed = true;
      try { localStorage.setItem(NS + 'audioArmed', '1'); } catch (e) {}
      return true;
    }

    function isArmed() {
      return armed || localStorage.getItem(NS + 'audioArmed') === '1';
    }

    function stopAll() {
      activeNodes.forEach(n => { try { n.stop ? n.stop() : n.disconnect(); } catch (e) {} });
      activeNodes = [];
      if (global.speechSynthesis) speechSynthesis.cancel();
    }

    function play(profile, opts) {
      opts = opts || {};
      if (!isArmed()) return; // silent until armed
      const c = context();
      if (!c) return;
      switch (profile) {
        case 'tactical-siren':  return playSiren(c, opts.durationMs || 3500);
        case 'pulse-alert':     return playPulse(c, opts.pulses || 3);
        case 'echo-bell':       return playBell(c, opts.echoes || 4);
        case 'voice-prompt':    return playVoice(opts.text || 'התראת חירום, בדוק מסך');
        case 'tactical-vibration': return playVibration();
        case 'ambulance':       return playAmbulance(c, opts.durationMs || 3000);
        case 'blip':            return playBlip(c);
        default: return;
      }
    }

    function playSiren(c, durationMs) {
      const t0 = c.currentTime;
      const o1 = c.createOscillator(); o1.type = 'sawtooth';
      const o2 = c.createOscillator(); o2.type = 'sawtooth';
      const g = c.createGain(); g.gain.value = 0.0;
      const lfo = c.createOscillator(); lfo.frequency.value = 1.6;
      const lfoGain = c.createGain(); lfoGain.gain.value = 250;
      lfo.connect(lfoGain);
      lfoGain.connect(o1.frequency); lfoGain.connect(o2.frequency);
      o1.frequency.value = 620; o2.frequency.value = 640; // slight detune
      o1.connect(g); o2.connect(g);
      g.connect(c.destination);
      g.gain.linearRampToValueAtTime(0.18, t0 + 0.05);
      g.gain.linearRampToValueAtTime(0.0, t0 + durationMs / 1000);
      const stopAt = t0 + durationMs / 1000 + 0.05;
      o1.start(t0); o2.start(t0); lfo.start(t0);
      o1.stop(stopAt); o2.stop(stopAt); lfo.stop(stopAt);
      activeNodes.push(o1, o2, lfo);
    }
    function playPulse(c, pulses) {
      const t0 = c.currentTime;
      for (let i = 0; i < pulses; i++) {
        const o = c.createOscillator(); o.type = 'square';
        const g = c.createGain();
        o.frequency.value = 1050;
        o.connect(g); g.connect(c.destination);
        const ts = t0 + i * 0.32;
        g.gain.setValueAtTime(0, ts);
        g.gain.linearRampToValueAtTime(0.12, ts + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.22);
        o.start(ts); o.stop(ts + 0.25);
        activeNodes.push(o);
      }
    }
    function playBell(c, echoes) {
      const t0 = c.currentTime;
      for (let i = 0; i < echoes; i++) {
        const o = c.createOscillator(); o.type = 'triangle';
        const g = c.createGain();
        o.frequency.value = i % 2 === 0 ? 880 : 660;
        o.connect(g); g.connect(c.destination);
        const ts = t0 + i * 0.42;
        g.gain.setValueAtTime(0, ts);
        g.gain.linearRampToValueAtTime(0.14, ts + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.6);
        o.start(ts); o.stop(ts + 0.7);
        activeNodes.push(o);
      }
    }
    function playAmbulance(c, durationMs) {
      const t0 = c.currentTime;
      const o = c.createOscillator(); o.type = 'sine';
      const g = c.createGain(); g.gain.value = 0;
      o.connect(g); g.connect(c.destination);
      const steps = Math.floor(durationMs / 250);
      for (let i = 0; i < steps; i++) {
        const f = i % 2 === 0 ? 780 : 1040;
        o.frequency.setValueAtTime(f, t0 + i * 0.25);
      }
      g.gain.linearRampToValueAtTime(0.16, t0 + 0.04);
      g.gain.linearRampToValueAtTime(0.0, t0 + durationMs / 1000);
      o.start(t0); o.stop(t0 + durationMs / 1000 + 0.05);
      activeNodes.push(o);
    }
    function playBlip(c) {
      const t0 = c.currentTime;
      const o = c.createOscillator(); o.type = 'sine';
      const g = c.createGain();
      o.frequency.value = 1400;
      o.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.08, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      o.start(t0); o.stop(t0 + 0.15);
      activeNodes.push(o);
    }
    function playVoice(text) {
      if (!global.speechSynthesis) return;
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        if (prefVoice) u.voice = prefVoice;
        u.lang = prefVoice ? prefVoice.lang : 'he-IL';
        u.rate = 1.05; u.pitch = 1.0; u.volume = 1.0;
        speechSynthesis.speak(u);
      } catch (e) {}
    }
    function playVibration() {
      if (navigator.vibrate) {
        try { navigator.vibrate([200, 100, 200, 100, 400]); }
        catch (e) {}
      } else {
        // visual fallback
        const el = document.createElement('div');
        el.className = 'sos-overlay';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 900);
      }
    }

    return { arm, isArmed, play, stopAll };
  })();

  // ---------- Toast & Modal ----------

  const Toast = (function () {
    let host = null;
    function ensure() {
      if (host) return host;
      host = document.querySelector('.toast-host');
      if (!host) {
        host = document.createElement('div');
        host.className = 'toast-host';
        document.body.appendChild(host);
      }
      return host;
    }
    function show(text, opts) {
      opts = opts || {};
      const h = ensure();
      const t = document.createElement('div');
      t.className = 'toast' + (opts.kind ? ` toast--${opts.kind}` : '');
      t.textContent = text;
      h.appendChild(t);
      setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 220ms'; }, (opts.duration || 2800));
      setTimeout(() => t.remove(), (opts.duration || 2800) + 250);
    }
    return { show };
  })();

  const Modal = (function () {
    function open({ title, body, actions, sound, kind }) {
      const host = document.createElement('div');
      host.className = 'modal-host';
      const m = document.createElement('div');
      m.className = 'modal' + (kind ? ` modal--${kind}` : '');
      const acts = (actions || [{ label: 'סגור', kind: 'primary', value: 'ok' }]);
      m.innerHTML = `
        <h3>${escapeHtml(title || '')}</h3>
        <div class="modal__body">${body || ''}</div>
        <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:18px;">
          ${acts.map((a, i) => `<button class="btn ${a.kind ? 'btn--' + a.kind : ''}" data-i="${i}">${escapeHtml(a.label)}</button>`).join('')}
        </div>
      `;
      host.appendChild(m);
      document.body.appendChild(host);
      if (sound) Audio.play(sound);
      return new Promise(resolve => {
        m.addEventListener('click', e => {
          const btn = e.target.closest('button[data-i]');
          if (!btn) return;
          const a = acts[+btn.dataset.i];
          host.remove();
          resolve({ action: a, dom: m });
        });
      });
    }
    return { open };
  })();

  // ---------- Mock GPS ----------

  const Geo = (function () {
    // 8 entities, mock positions inside a small forest area
    const center = { lat: 31.957, lng: 34.951 };
    const radius = 0.012; // ~1.2km bounding
    let entities = null;
    let ticker = null;

    function seed(forestId) {
      const f = (FORESTS.find(x => x.id === forestId) || FORESTS[0]);
      const cx = f.lat, cy = f.lng;
      entities = [
        { id: 'g1', label: 'סייר 1',  role: 'patrol',  lat: cx + 0.004, lng: cy + 0.001, heading: 1.2, speed: 0.00010 },
        { id: 'g2', label: 'סייר 2',  role: 'patrol',  lat: cx - 0.003, lng: cy + 0.005, heading: 3.4, speed: 0.00012 },
        { id: 'g3', label: 'סייר 3',  role: 'patrol',  lat: cx + 0.002, lng: cy - 0.006, heading: 5.1, speed: 0.00009 },
        { id: 'm1', label: 'חובש פאר', role: 'medic',  lat: cx + 0.001, lng: cy - 0.001, heading: 2.0, speed: 0.00008 },
        { id: 'm2', label: 'חובש יואב', role: 'medic',  lat: cx + 0.005, lng: cy + 0.004, heading: 4.5, speed: 0.00007 },
        { id: 'l1', label: 'אקונומיה רכב 1', role: 'logistics', lat: cx - 0.002, lng: cy - 0.003, heading: 0.5, speed: 0.00006 },
        { id: 's1', label: 'אחמ״ש',  role: 'commander', lat: cx, lng: cy, heading: 0, speed: 0 },
        { id: 'g0', label: 'ש״ג שער ראשי', role: 'gate', lat: cx - 0.008, lng: cy, heading: 0, speed: 0 },
      ];
    }

    function tick() {
      if (document.hidden) return;
      entities.forEach(ent => {
        if (ent.speed === 0) return;
        ent.heading += (Math.random() - 0.5) * 0.6;
        const dLat = Math.cos(ent.heading) * ent.speed;
        const dLng = Math.sin(ent.heading) * ent.speed;
        ent.lat = clamp(ent.lat + dLat, center.lat - radius, center.lat + radius);
        ent.lng = clamp(ent.lng + dLng, center.lng - radius, center.lng + radius);
      });
      Bus.emit('geo:tick', { entities: snapshot() });
    }
    function snapshot() { return entities ? entities.map(e => Object.assign({}, e)) : []; }

    function start(forestId) {
      if (!entities) seed(forestId);
      if (ticker) return;
      ticker = setInterval(tick, 2000);
    }
    function stop() { if (ticker) clearInterval(ticker); ticker = null; }

    return { start, stop, snapshot, seed };
  })();

  // ---------- Dead-Man Switch ----------

  const DMS = (function () {
    let timer = null;
    let popupOpen = false;

    function intervalMin() { return ScoutDB.get('dmsInterval', 15); }
    function isNightHours() {
      const h = new Date().getHours();
      return h >= 22 || h < 6;
    }

    function schedule(forceNow) {
      stop();
      const delay = forceNow ? 4000 : Math.max(15000, intervalMin() * 60 * 1000);
      timer = setTimeout(prompt, delay);
    }
    function stop() { if (timer) { clearTimeout(timer); timer = null; } }

    function prompt() {
      if (popupOpen) return;
      popupOpen = true;
      Audio.play('pulse-alert');
      const start = nowMs();
      const dur = 60_000;

      const host = document.createElement('div');
      host.className = 'modal-host';
      host.innerHTML = `
        <div class="modal" style="border-color: var(--warn); text-align:center;">
          <div style="font-size:13px; color: var(--warn); letter-spacing:.18em; font-weight:700;">DEAD-MAN SWITCH</div>
          <h3 style="margin: 8px 0 6px;">בדיקת ערנות</h3>
          <p>לחץ "אני ער!" תוך <span data-rem style="color: var(--warn); font-weight: 700;">60</span> שניות, אחרת תופעל הסלמה.</p>
          <div data-bar style="height:6px; background: var(--bg-elev); border-radius:4px; overflow:hidden; margin: 18px 0;">
            <div data-fill style="height:100%; width:100%; background: var(--warn); transition: width 0.5s linear;"></div>
          </div>
          <button class="btn btn--primary btn--lg btn--block" data-ack>אני ער!</button>
        </div>
      `;
      document.body.appendChild(host);

      const remEl = host.querySelector('[data-rem]');
      const fill = host.querySelector('[data-fill]');
      const ackBtn = host.querySelector('[data-ack]');
      const ticker = setInterval(() => {
        const elapsed = nowMs() - start;
        const remain = Math.max(0, dur - elapsed);
        remEl.textContent = Math.ceil(remain / 1000);
        fill.style.width = (remain / dur * 100) + '%';
        if (remain <= 0) {
          clearInterval(ticker);
          host.remove();
          popupOpen = false;
          ScoutDB.appendAudit({ action: 'DMS-FAIL', channel: 'dms', details: 'לא הייתה תגובה תוך 60 שניות' });
          SOS.trigger({ source: 'dms-failure', label: 'כשל בדיקת ערנות', who: UI.currentPersona().name });
        }
      }, 500);
      on(ackBtn, 'click', () => {
        clearInterval(ticker);
        host.remove();
        popupOpen = false;
        ScoutDB.appendAudit({ action: 'DMS-ACK', channel: 'dms', details: 'אישור ערנות נשלח בזמן' });
        Toast.show('ערנות אושרה. הטיימר אופס.', { kind: 'ok' });
        schedule(false);
      });
    }

    function start(opts) {
      opts = opts || {};
      if (opts.force) { schedule(true); return; }
      if (!isNightHours() && !opts.alwaysOn) return;
      schedule(false);
    }

    return { start, stop, prompt };
  })();

  // ---------- SOS / Escalation ----------

  const SOS = (function () {
    let activeEvent = null;
    let escalationTimer = null;

    function trigger(payload) {
      payload = payload || {};
      const ev = {
        id: uuid(),
        ts: nowMs(),
        source: payload.source || 'manual',
        label: payload.label || 'אירוע SOS',
        who: payload.who || UI.currentPersona().name,
        forestId: payload.forestId || ScoutDB.get('currentForest', 'ben-shemen'),
        gps: payload.gps || lastKnownPos(payload.entityId),
        acked: false,
        escalated: false,
      };
      activeEvent = ev;
      ScoutDB.set('activeSOS', ev);
      ScoutDB.appendAudit({ action: 'SOS-TRIGGER', channel: 'sos', details: `${ev.label} — ${ev.who}` });
      Bus.emit('sos:trigger', ev);
      // Escalate after 2 minutes if no ack
      if (escalationTimer) clearTimeout(escalationTimer);
      escalationTimer = setTimeout(() => escalate(ev.id), 2 * 60 * 1000);
      return ev;
    }
    function escalate(id) {
      const ev = ScoutDB.get('activeSOS', null);
      if (!ev || ev.id !== id || ev.acked) return;
      ev.escalated = true;
      ScoutDB.set('activeSOS', ev);
      ScoutDB.appendAudit({ action: 'SOS-ESCALATE', channel: 'sos', details: 'הסלמה לקב״ט' });
      Bus.emit('sos:escalated', ev);
    }
    function ack(by) {
      const ev = ScoutDB.get('activeSOS', null);
      if (!ev) return;
      ev.acked = true; ev.ackedBy = by || UI.currentPersona().name; ev.ackTs = nowMs();
      ScoutDB.set('activeSOS', ev);
      if (escalationTimer) clearTimeout(escalationTimer);
      ScoutDB.appendAudit({ action: 'SOS-ACK', channel: 'sos', details: 'אושר ע״י ' + ev.ackedBy });
      Bus.emit('sos:ack', ev);
    }
    function clear() {
      ScoutDB.set('activeSOS', null);
      ScoutDB.appendAudit({ action: 'SOS-CLEAR', channel: 'sos', details: 'אירוע נסגר' });
      Bus.emit('sos:clear', {});
      if (escalationTimer) clearTimeout(escalationTimer);
    }
    function current() { return ScoutDB.get('activeSOS', null); }
    function lastKnownPos(entityId) {
      const snap = Geo.snapshot();
      if (entityId) {
        const e = snap.find(x => x.id === entityId);
        if (e) return { lat: e.lat, lng: e.lng };
      }
      return snap.length ? { lat: snap[0].lat, lng: snap[0].lng } : null;
    }

    return { trigger, escalate, ack, clear, current };
  })();

  // ---------- UI helpers ----------

  const UI = (function () {
    const tabId = uuid();
    let clockTimer = null;

    const ROLE_LABELS = {
      'hq-op':         'תורן חמ״ל',
      'hq-shift':      'אחראי חמ״ל',
      'kabat':         'קב״ט',
      'achmash':       'אחמ״ש',
      'guard':         'מאבטח ש״ג',
      'patrol':        'סייר',
      'tribe':         'מרכז שבט',
      'clinic-chief':  'אחראי מרפאה',
      'medic':         'חובש שטח',
      'first-aid':     'מע״ר',
      'doctor':        'רופא המחנה',
      'sanitation':    'תברואן',
      'safety':        'אחראי בטיחות',
      'camp-director': 'מנהל מחנה',
      'national':      'מנהל ארצי',
    };

    function currentPersona() {
      const stored = ScoutDB.get('currentPersona', null);
      const def = { name: 'אורח דמו', role: 'national', roleLabel: ROLE_LABELS['national'] };
      const p = stored || def;
      p.roleLabel = ROLE_LABELS[p.role] || p.role;
      return p;
    }
    function setPersona(p) {
      const role = p.role;
      ScoutDB.set('currentPersona', { name: p.name || 'משתמש', role, roleLabel: ROLE_LABELS[role] });
    }

    function header({ title, subtitle, persona, showArm = true }) {
      const p = persona || currentPersona();
      return `
        <header class="header">
          <div class="brand">
            <div class="brand-mark"></div>
            <div>
              <div style="font-size:14px; line-height:1;">שו״ב | תנועת הצופים</div>
              <div style="font-size:11px; color: var(--text-mid); letter-spacing:.05em; margin-top:3px;">${escapeHtml(title || '')}</div>
            </div>
          </div>
          <span class="chip chip--info" data-online>מקוון</span>
          ${subtitle ? `<span class="chip">${escapeHtml(subtitle)}</span>` : ''}
          <div class="spacer"></div>
          <span class="persona-pill"><span>${escapeHtml(p.name)}</span><span class="role">${escapeHtml(p.roleLabel)}</span></span>
          <span class="clock" data-clock>--:--:--</span>
          ${showArm ? `<button class="arm-pill" data-arm>🔊 הפעל התראות</button>` : ''}
          <a href="home.html" class="btn btn--sm btn--ghost" title="חזרה למסך הבית הלאומי">⌂ ראשי</a>
          <button class="btn btn--sm btn--ghost" data-logout title="התנתקות מהמערכת">⤴ יציאה</button>
        </header>
      `;
    }

    function bindHeader(root) {
      const clockEl = root.querySelector('[data-clock]');
      if (clockEl) {
        const tick = () => { clockEl.textContent = fmtTime(); };
        tick();
        if (clockTimer) clearInterval(clockTimer);
        clockTimer = setInterval(tick, 1000);
      }
      const armBtn = root.querySelector('[data-arm]');
      if (armBtn) {
        if (Audio.isArmed()) {
          armBtn.classList.add('arm-pill--armed');
          armBtn.innerHTML = '🔊 התראות פעילות';
        }
        armBtn.addEventListener('click', () => {
          Audio.arm();
          armBtn.classList.add('arm-pill--armed');
          armBtn.innerHTML = '🔊 התראות פעילות';
          Audio.play('blip');
          Toast.show('מנוע השמע הופעל. ניתן להשמיע התראות חירום.', { kind: 'ok' });
        });
      }
      const onlineEl = root.querySelector('[data-online]');
      if (onlineEl) {
        const updateOnline = () => {
          if (navigator.onLine) { onlineEl.textContent = 'מקוון'; onlineEl.className = 'chip chip--ok'; }
          else { onlineEl.textContent = 'אופליין • סנכרון מקומי'; onlineEl.className = 'chip chip--warn'; }
        };
        updateOnline();
        global.addEventListener('online', updateOnline);
        global.addEventListener('offline', updateOnline);
      }
      const logoutBtn = root.querySelector('[data-logout]');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          if (confirm('להתנתק מהמערכת?')) Auth.logout();
        });
      }
    }

    function mockBadge(text) {
      const el = document.createElement('div');
      el.className = 'mock-badge';
      el.textContent = '📌 ' + (text || 'דמו: ללא backend חי');
      document.body.appendChild(el);
    }

    // Global SOS responder — every page reacts visually unless it's the "owner"
    function bindGlobalSOS(rolePolicy) {
      rolePolicy = rolePolicy || {};
      Bus.on('sos:trigger', ev => {
        if (rolePolicy.ignore) return;
        if (rolePolicy.lock) {
          // Heavy lockdown for HQ
          showSOSLockdown(ev);
        } else {
          // Light visual banner + sound
          Audio.play('tactical-siren');
          showSOSBanner(ev);
        }
      });
      Bus.on('sos:ack', () => clearSOSUI());
      Bus.on('sos:clear', () => clearSOSUI());
      // On page load, re-render if there's an active unacked event
      const ev = SOS.current();
      if (ev && !ev.acked) {
        if (rolePolicy.lock) showSOSLockdown(ev);
        else showSOSBanner(ev);
      }
    }
    function showSOSBanner(ev) {
      clearSOSUI();
      const b = document.createElement('div');
      b.dataset.sos = 'banner';
      b.style.cssText = `position:fixed; top: calc(var(--header-h)); left: 0; right: 0; background: var(--danger); color: #fff; padding: 10px 18px; font-weight: 700; font-family: var(--font-ui); display:flex; align-items:center; gap:14px; z-index: 220; animation: blink-danger 0.9s infinite;`;
      b.innerHTML = `
        <span style="font-size:18px;">⚠</span>
        <span>אירוע SOS פעיל — ${escapeHtml(ev.label)} | מאת ${escapeHtml(ev.who)}</span>
        <span style="opacity:.85; font-size:12px;">${fmtTime(ev.ts)}</span>
        <span style="flex:1"></span>
      `;
      document.body.appendChild(b);
    }
    function showSOSLockdown(ev) {
      clearSOSUI();
      const overlay = document.createElement('div');
      overlay.dataset.sos = 'lockdown';
      overlay.style.cssText = `position:fixed; inset:0; background: rgba(120,0,8,0.62); z-index: 240; display:flex; align-items:flex-start; justify-content:center; padding-top: 80px;`;
      overlay.innerHTML = `
        <div style="background: var(--bg-panel); border: 2px solid var(--danger); border-radius: var(--r-lg); padding: 28px; width: min(640px, 92vw); box-shadow: 0 30px 80px rgba(0,0,0,.6);">
          <div style="color: var(--danger); font-family: var(--font-ui); font-weight: 800; letter-spacing:.16em; text-transform: uppercase;">⚠ אירוע חירום פעיל</div>
          <h2 style="margin: 10px 0 6px;">${escapeHtml(ev.label)}</h2>
          <div style="color: var(--text-mid); font-size: 14px;">מאת ${escapeHtml(ev.who)} • זמן: ${fmtTime(ev.ts)}</div>
          ${ev.gps ? `<div style="margin-top:10px; font-family: var(--font-mono); color: var(--text-mid);">📍 GPS: ${ev.gps.lat.toFixed(5)}, ${ev.gps.lng.toFixed(5)}</div>` : ''}
          <hr style="border:0; border-top: 1px solid var(--border); margin: 18px 0;">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <button class="btn btn--ok btn--lg" data-action="ack">אישור טיפול</button>
            <button class="btn btn--lg" data-action="page">כריזה למחנה</button>
            <button class="btn btn--lg" data-action="open">פתח אירוע</button>
            <button class="btn btn--danger btn--lg" data-action="close">סגור אירוע</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', e => {
        const btn = e.target.closest('[data-action]'); if (!btn) return;
        const a = btn.dataset.action;
        if (a === 'ack')   { SOS.ack(); }
        if (a === 'page')  { Audio.play('voice-prompt', { text: 'התראת חירום, בדוק מסך' }); Toast.show('כריזה נשלחה לכלל המכשירים', { kind: 'warn' }); }
        if (a === 'open')  { Toast.show('יומן אירוע נפתח (דמו)'); }
        if (a === 'close') { SOS.clear(); }
      });
    }
    function clearSOSUI() {
      document.querySelectorAll('[data-sos]').forEach(el => el.remove());
      Audio.stopAll();
    }

    return {
      tabId,
      header, bindHeader, mockBadge,
      currentPersona, setPersona,
      bindGlobalSOS,
      showSOSBanner, showSOSLockdown, clearSOSUI,
      ROLE_LABELS,
    };
  })();

  // ---------- Auth ----------

  const Auth = (function () {
    // Demo credentials: username → { role, name, password }
    const CREDENTIALS = {
      'national': { role: 'national',     name: 'אורי שדה — מנהל ארצי', password: '1234' },
      'kabat':    { role: 'kabat',        name: 'קב״ט ניר אלון',         password: '1234' },
      'operator': { role: 'hq-op',        name: 'תורן עידו',              password: '1234' },
      'guard':    { role: 'guard',        name: 'מאבטח אופיר',           password: '1234' },
      'tribe':    { role: 'tribe',        name: 'מרכז שבט נחל',           password: '1234' },
      'clinic':   { role: 'clinic-chief', name: 'ד״ר נועה לוי',           password: '1234' },
    };

    const ROUTES = {
      'national':     'home.html',
      'kabat':        'kabat.html',
      'hq-op':        'hq-operator.html',
      'guard':        'gate-guard.html',
      'tribe':        'tribe.html',
      'clinic-chief': 'clinic.html',
    };

    function login(username, password) {
      const u = String(username || '').trim().toLowerCase();
      const cred = CREDENTIALS[u];
      if (!cred) return { ok: false, error: 'שם משתמש לא קיים במערכת' };
      if (cred.password !== password) return { ok: false, error: 'סיסמה שגויה' };
      UI.setPersona({ name: cred.name, role: cred.role });
      ScoutDB.set('loggedIn', true);
      ScoutDB.set('loginTs', nowMs());
      ScoutDB.set('loginUser', u);
      ScoutDB.appendAudit({
        action: 'LOGIN', channel: 'auth',
        details: 'התחבר בתור ' + u,
        actor: cred.name + ' / ' + (UI.ROLE_LABELS[cred.role] || cred.role),
      });
      return { ok: true, persona: { name: cred.name, role: cred.role } };
    }

    function logout() {
      const p = UI.currentPersona();
      ScoutDB.appendAudit({
        action: 'LOGOUT', channel: 'auth',
        details: 'התנתק מהמערכת',
        actor: p.name + ' / ' + p.roleLabel,
      });
      ScoutDB.set('loggedIn', false);
      ScoutDB.remove('rememberMe');
      Bus.emit('auth:logout', {});
      location.replace('index.html');
    }

    function isLoggedIn() {
      return !!ScoutDB.get('loggedIn', false);
    }

    function requireLogin() {
      if (!isLoggedIn()) {
        location.replace('index.html');
        return false;
      }
      return true;
    }

    function routeForRole(role) {
      return ROUTES[role] || 'home.html';
    }

    function listDemoUsers() {
      return Object.entries(CREDENTIALS).map(([user, c]) => ({
        user, role: c.role, name: c.name,
        roleLabel: UI.ROLE_LABELS[c.role] || c.role,
      }));
    }

    return { login, logout, isLoggedIn, requireLogin, routeForRole, listDemoUsers };
  })();

  // ---------- Export ----------

  global.Scout = {
    ScoutDB, Bus, Audio, DMS, SOS, Geo, Toast, Modal, UI, Auth,
    util: { uuid, nowMs, fmtTime, fmtDate, pick, clamp, escapeHtml, getParam },
    FORESTS,
  };

})(window);
