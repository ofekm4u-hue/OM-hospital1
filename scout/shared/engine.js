/* ============================================================
   שו"ב צופים — Cross-System Engine
   ScoutDB · Bus · Audio · DMS · SOS · Geo · Toast · Modal · UI helpers
   ============================================================ */
(function (global) {
  'use strict';

  // ---------- Constants ----------

  const NS = 'scout:';
  const SCHEMA_VERSION = 5;

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
        { id: 's1', name: 'רס״ל ניר אלון',     role: 'kabat',    active: true },
        { id: 's2', name: 'רס״ל יוסי גולן',    role: 'achmash',  active: true },
        { id: 's3', name: 'אחראי חמ״ל — עידו', role: 'hq-shift', active: true },
        { id: 's4', name: 'מערכת חמ״ל (תחנה)', role: 'hq-op',    active: true },
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
        urgency: payload.urgency || 'routine', // routine | complex | critical
        externalForces: { police: false, mda: false, fire: false },
        fieldUpdates: [],
      };
      activeEvent = ev;
      ScoutDB.set('activeSOS', ev);
      ScoutDB.appendAudit({ action: 'SOS-TRIGGER', channel: 'sos', details: `${ev.label} — ${ev.who}` });
      Bus.emit('sos:trigger', ev);
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
    function setUrgency(level) {
      const ev = ScoutDB.get('activeSOS', null);
      if (!ev) return null;
      const oldLevel = ev.urgency;
      ev.urgency = level;
      ScoutDB.set('activeSOS', ev);
      const labelMap = { routine: 'חריג שגרתי', complex: 'אירוע מורכב', critical: 'סכנת חיים קריטית' };
      ScoutDB.appendAudit({
        action: 'SOS-URGENCY', channel: 'sos',
        details: `דחיפות שונתה ל-${labelMap[level] || level}${oldLevel !== level ? ' (היה ' + (labelMap[oldLevel] || oldLevel) + ')' : ''}`,
      });
      Bus.emit('sos:updated', ev);
      return ev;
    }
    function setExternalForce(force, present) {
      const ev = ScoutDB.get('activeSOS', null);
      if (!ev) return null;
      ev.externalForces = ev.externalForces || { police: false, mda: false, fire: false };
      ev.externalForces[force] = !!present;
      ScoutDB.set('activeSOS', ev);
      const labels = { police: 'משטרה', mda: 'מד״א (נט״ן)', fire: 'כיבוי אש' };
      ScoutDB.appendAudit({
        action: 'SOS-FORCE', channel: 'sos',
        details: `${labels[force] || force} ${present ? 'הגיע ליער' : 'הוסר'}`,
      });
      Bus.emit('sos:updated', ev);
      return ev;
    }
    function addFieldUpdate(text) {
      const ev = ScoutDB.get('activeSOS', null);
      if (!ev || !text) return null;
      ev.fieldUpdates = ev.fieldUpdates || [];
      const u = { ts: nowMs(), text: String(text).slice(0, 500), by: UI.currentPersona().name };
      ev.fieldUpdates.push(u);
      ScoutDB.set('activeSOS', ev);
      ScoutDB.appendAudit({ action: 'SOS-FIELD-UPDATE', channel: 'sos', details: u.text });
      Bus.emit('sos:updated', ev);
      return u;
    }
    function clear(debriefText) {
      const text = String(debriefText || '').trim();
      if (text.length < 10) {
        return { ok: false, error: 'יש להזין תחקיר מינימלי (לפחות 10 תווים) לפני סגירת האירוע.' };
      }
      const ev = ScoutDB.get('activeSOS', null);
      if (ev) {
        ev.closed = true;
        ev.closedTs = nowMs();
        ev.closedBy = UI.currentPersona().name;
        ev.debrief = text;
        // Persist to permanent log of closed events
        ScoutDB.patch('sosArchive', l => (l || []).concat([ev]));
      }
      ScoutDB.set('activeSOS', null);
      ScoutDB.appendAudit({
        action: 'SOS-CLOSE', channel: 'sos',
        details: `אירוע נסגר ע״י ${UI.currentPersona().name}. תחקיר: ${text.slice(0, 200)}`,
      });
      Bus.emit('sos:clear', { debrief: text });
      if (escalationTimer) clearTimeout(escalationTimer);
      return { ok: true };
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

    return { trigger, escalate, ack, clear, current, setUrgency, setExternalForce, addFieldUpdate };
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
      'guard':         'מאבטח',
      'patrol':        'מאבטח',
      'tribe':         'מרכז שבט',
      'clinic-chief':  'אחראי מרפאה',
      'medic':         'חובש שטח',
      'first-aid':     'מע״ר',
      'paramedic':     'פאראמדיק',
      'doctor':        'רופא מחנה',
      'sanitation':    'תברואן',
      'safety':        'אחראי בטיחות',
      'provisions':    'מנהל אקונומיה',
      'camp-director': 'מנהל מחנה',
      'national':      'מנהל ארצי',
    };

    // Unified security role — display includes current mission if known
    const SECURITY_ROLES = ['guard', 'patrol'];
    function isSecurityRole(role) { return SECURITY_ROLES.includes(role); }
    function getMission(staffId) {
      const m = ScoutDB.get('missions', {}) || {};
      return staffId ? (m[staffId] || null) : null;
    }
    function setMission(staffId, mission) {
      if (!staffId) return;
      const m = ScoutDB.get('missions', {}) || {};
      const old = m[staffId];
      m[staffId] = mission; // 'gate' | 'patrol'
      ScoutDB.set('missions', m);
      ScoutDB.appendAudit({
        action: 'MISSION-SWITCH', channel: 'auth',
        details: `מאבטח עבר ל-${mission === 'gate' ? 'ש״ג' : 'סיור'}${old ? ' (היה ' + (old === 'gate' ? 'ש״ג' : 'סיור') + ')' : ''}`,
      });
      Bus.emit('mission:changed', { staffId, mission });
    }

    function currentPersona() {
      const stored = ScoutDB.get('currentPersona', null);
      const def = { name: 'אורח דמו', role: 'national', roleLabel: ROLE_LABELS['national'], staffId: null };
      const p = stored || def;
      p.roleLabel = ROLE_LABELS[p.role] || p.role;
      if (p.staffId === undefined) p.staffId = null;
      return p;
    }
    function setPersona(p) {
      const role = p.role;
      ScoutDB.set('currentPersona', {
        name: p.name || 'משתמש',
        role,
        roleLabel: ROLE_LABELS[role],
        staffId: p.staffId || null,
      });
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
      b.style.cssText = `position:fixed; top: calc(var(--header-h)); left: 0; right: 0; background: var(--danger); color: #fff; padding: 10px 18px; font-weight: 700; font-family: var(--font-ui); display:flex; align-items:center; gap:14px; z-index: 1300; animation: blink-danger 0.9s infinite;`;
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
      const urgencyLabel = { routine: 'חריג שגרתי', complex: 'אירוע מורכב', critical: 'סכנת חיים קריטית' }[ev.urgency || 'routine'];
      const urgencyColor = { routine: 'var(--warn)', complex: 'var(--danger)', critical: '#ff1a2e' }[ev.urgency || 'routine'];
      const hud = document.createElement('div');
      hud.dataset.sos = 'lockdown';
      hud.style.cssText = `
        position: fixed; top: calc(var(--header-h) + 14px); right: 14px;
        width: min(380px, calc(100vw - 28px));
        background: linear-gradient(180deg, rgba(40,8,12,0.96), rgba(15,5,8,0.96));
        border: 2px solid var(--danger);
        border-radius: var(--r-lg);
        padding: 16px 18px;
        z-index: 1400;
        box-shadow: 0 16px 60px rgba(255,71,87,0.35), 0 0 0 4px rgba(255,71,87,0.12);
        animation: blink-danger 1.6s infinite;
        pointer-events: auto;
      `;
      hud.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--danger); font-family: var(--font-ui); font-weight: 800; letter-spacing:.14em; font-size: 11px; text-transform: uppercase;">⚠ אירוע חירום פעיל</span>
          <span style="flex:1;"></span>
          <span style="font-family: var(--font-mono); color: var(--text-mid); font-size: 11px;">${fmtTime(ev.ts)}</span>
        </div>
        <h3 style="font-size: 17px; margin: 8px 0 2px;">${escapeHtml(ev.label)}</h3>
        <div style="color: var(--text-mid); font-size: 12px;">מאת ${escapeHtml(ev.who)}</div>
        <div style="margin-top: 10px; padding: 6px 10px; background: rgba(255,71,87,0.12); border-radius: var(--r-sm); display: flex; gap: 8px; align-items: center; font-size: 12px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: ${urgencyColor}; display: inline-block;"></span>
          <span style="color: ${urgencyColor}; font-weight: 700;" data-urgency-lbl>${urgencyLabel}</span>
          ${ev.gps ? `<span style="flex:1;"></span><span style="color: var(--text-mid); font-family: var(--font-mono); font-size: 11px;">📍 ${ev.gps.lat.toFixed(4)},${ev.gps.lng.toFixed(4)}</span>` : ''}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 10px;">
          <button class="btn btn--ok btn--sm" data-action="ack">✓ אישור טיפול</button>
          <button class="btn btn--sm" data-action="manage">🛠 ניהול אירוע</button>
          <button class="btn btn--sm" data-action="page">📢 כריזה</button>
          <button class="btn btn--danger btn--sm" data-action="close">✕ סגור אירוע</button>
        </div>
        <div style="margin-top: 8px; font-size: 10px; color: var(--text-low); text-align: center;">המפה והכוחות עדיין נראים — תיעוד תחקיר חובה לסגירה</div>
      `;
      document.body.appendChild(hud);
      hud.addEventListener('click', e => {
        const btn = e.target.closest('[data-action]'); if (!btn) return;
        const a = btn.dataset.action;
        if (a === 'ack')    { SOS.ack(); }
        if (a === 'page')   { Audio.play('voice-prompt', { text: 'התראת חירום, בדוק מסך' }); Toast.show('כריזה נשלחה לכלל המכשירים', { kind: 'warn' }); }
        if (a === 'manage') { openEventManagement(ev); }
        if (a === 'close')  { openDebriefModal(ev); }
      });
    }

    function openEventManagement(ev) {
      const host = document.createElement('div');
      host.className = 'modal-host';
      host.innerHTML = `
        <div class="modal" style="width: min(560px, 92vw);">
          <h3>🛠 ניהול אירוע: ${escapeHtml(ev.label)}</h3>
          <p style="color: var(--text-mid); margin: 0 0 16px;">פאנל אינטראקטיבי לעדכוני שטח וניווט.</p>
          <div style="display: grid; gap: 10px;">
            <button class="btn" data-mng="navigate">📍 נווט למקום האירוע</button>
            <button class="btn" data-mng="update">📝 הוסף עדכון שטח</button>
            <button class="btn" data-mng="show-log">📋 הצג יומן אירוע</button>
            <button class="btn btn--ghost" data-mng="ack">✓ אישור טיפול</button>
          </div>
          <div style="display:flex; gap:10px; justify-content:flex-end; margin-top: 16px;">
            <button class="btn btn--ghost" data-close>סגור</button>
          </div>
        </div>
      `;
      document.body.appendChild(host);
      host.addEventListener('click', e => {
        if (e.target.dataset.close || e.target === host) { host.remove(); return; }
        const btn = e.target.closest('[data-mng]'); if (!btn) return;
        const a = btn.dataset.mng;
        if (a === 'navigate') {
          if (ev.gps && global.kabatMap && global.kabatMap.setView) {
            global.kabatMap.setView([ev.gps.lat, ev.gps.lng], 17);
            Toast.show('המפה התמקדה במקום האירוע.', { kind: 'ok' });
          } else {
            Toast.show('אין מיקום GPS לאירוע (או שהמפה לא נטענה).', { kind: 'warn' });
          }
          host.remove();
        }
        if (a === 'update') {
          const txt = prompt('הזן עדכון שטח (יישלח ליומן האירוע):');
          if (txt && txt.trim()) {
            SOS.addFieldUpdate(txt.trim());
            Toast.show('העדכון נרשם ביומן.', { kind: 'ok' });
          }
          host.remove();
        }
        if (a === 'show-log') {
          host.remove();
          const cur = SOS.current();
          const updates = (cur && cur.fieldUpdates) || [];
          const logHost = document.createElement('div');
          logHost.className = 'modal-host';
          logHost.innerHTML = `
            <div class="modal">
              <h3>📋 יומן אירוע</h3>
              <div style="max-height: 360px; overflow-y: auto; background: var(--bg-deep); padding: 12px; border-radius: var(--r-sm); font-family: var(--font-mono); font-size: 12px;">
                ${updates.length ? updates.map(u => `<div style="padding: 6px 0; border-bottom: 1px solid var(--border-soft);"><span style="color: #66c2d6;">${fmtTime(u.ts)}</span> · <span style="color: var(--accent);">${escapeHtml(u.by)}</span><br>${escapeHtml(u.text)}</div>`).join('') : '<div style="color: var(--text-low); text-align: center; padding: 14px;">אין עדכוני שטח עדיין</div>'}
              </div>
              <div style="display:flex; gap:10px; justify-content:flex-end; margin-top: 12px;">
                <button class="btn btn--ghost" data-close>סגור</button>
              </div>
            </div>
          `;
          document.body.appendChild(logHost);
          logHost.addEventListener('click', e => { if (e.target.dataset.close || e.target === logHost) logHost.remove(); });
        }
        if (a === 'ack') { SOS.ack(); host.remove(); }
      });
    }

    function openDebriefModal(ev) {
      const host = document.createElement('div');
      host.className = 'modal-host';
      host.innerHTML = `
        <div class="modal" style="width: min(560px, 92vw);">
          <div style="color: var(--danger); font-family: var(--font-ui); font-weight: 800; letter-spacing:.16em; text-transform: uppercase; font-size: 11px;">🔒 תחקיר חובה</div>
          <h3 style="margin: 6px 0 4px;">סגירת אירוע: ${escapeHtml(ev.label)}</h3>
          <p style="color: var(--text-mid); margin: 0 0 14px; font-size: 13px;">לפני שניתן לסגור את האירוע, יש לתעד תחקיר משפטי קצר ("סיבת הפעלה וסיכום טיפול"). הטקסט יישמר באופן בלתי הפיך בלוג.</p>
          <textarea class="textarea" id="debrief-text" rows="6" placeholder="לדוגמה: התראת SOS הופעלה ע״י סייר 2 לאחר חשד לפריצה בגדר. בדיקה הראתה ענף שנפל ושיבר את הגדר. הצוות תיקן בשטח. אין נפגעים." style="width:100%; resize: vertical;"></textarea>
          <div style="margin-top: 6px; font-size: 11px; color: var(--text-low);">מינימום 10 תווים. הטקסט יישלח ללוג המשפטי ולא ניתן יהיה לערוך אותו.</div>
          <div style="display:flex; gap:10px; justify-content:flex-end; margin-top: 16px;">
            <button type="button" class="btn btn--ghost" data-cancel>ביטול</button>
            <button type="button" class="btn btn--danger" data-confirm>סגור אירוע סופית</button>
          </div>
        </div>
      `;
      document.body.appendChild(host);
      const ta = host.querySelector('#debrief-text');
      ta.focus();
      host.querySelector('[data-cancel]').addEventListener('click', () => host.remove());
      host.querySelector('[data-confirm]').addEventListener('click', () => {
        const result = SOS.clear(ta.value);
        if (!result.ok) { Toast.show(result.error, { kind: 'warn' }); return; }
        Toast.show('האירוע נסגר ותועד בלוג המשפטי.', { kind: 'ok' });
        host.remove();
      });
      host.addEventListener('click', e => { if (e.target === host) {/* don't close — mandatory */} });
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
      isSecurityRole, getMission, setMission,
    };
  })();

  // ---------- Auth ----------

  const Auth = (function () {
    // Default seed credentials — copied to DB on first run so they can be edited live
    const CREDS_VERSION = 2; // bump to force reseed when CREDS_VERSION changes
    const DEFAULT_CREDENTIALS = {
      'national': { role: 'national',     name: 'אורי שדה — מנהל ארצי',  password: '1234', isDemo: true, status: 'active' },
      'kabat':    { role: 'kabat',        name: 'קב״ט ניר אלון',          password: '1234', isDemo: true, status: 'active', staffId: 's1' },
      'operator': { role: 'hq-shift',     name: 'אחראי חמ״ל — עידו',      password: '1234', isDemo: true, status: 'active', staffId: 's3' },
      'system':   { role: 'hq-op',        name: 'מערכת חמ״ל (תחנה)',      password: '1234', isDemo: true, status: 'active', staffId: 's4' },
      'guard':    { role: 'guard',        name: 'מאבטח אופיר',           password: '1234', isDemo: true, status: 'active', staffId: 's8' },
      'tribe':    { role: 'tribe',        name: 'מרכז שבט נחל',           password: '1234', isDemo: true, status: 'active' },
      'clinic':   { role: 'clinic-chief', name: 'ד״ר נועה לוי',           password: '1234', isDemo: true, status: 'active', staffId: 's5' },
    };

    const ROUTES = {
      'national':     'home.html',
      'kabat':        'kabat.html',
      'hq-op':        'hq-operator.html',
      'guard':        'gate-guard.html',
      'tribe':        'tribe.html',
      'clinic-chief': 'clinic.html',
      'achmash':      'gate-guard.html',
      'patrol':       'gate-guard.html',
      'medic':        'clinic.html',
      'first-aid':    'clinic.html',
      'doctor':       'clinic.html',
      'hq-shift':     'hq-operator.html',
      'sanitation':   'home.html',
      'safety':       'home.html',
      'camp-director':'home.html',
    };

    function ensureCredsSeed() {
      const v = ScoutDB.get('credsVersion', 0);
      if (v >= CREDS_VERSION && ScoutDB.get('credentials', null)) return;
      // Force fresh seed when version bumps (e.g., renamed/added users)
      ScoutDB.set('credentials', DEFAULT_CREDENTIALS);
      ScoutDB.set('credsVersion', CREDS_VERSION);
      // If a session is logged in under an old/renamed username, kick to login
      const cur = ScoutDB.get('loginUser', null);
      if (cur && !DEFAULT_CREDENTIALS[cur]) {
        ScoutDB.set('loggedIn', false);
        ScoutDB.remove('currentPersona');
        ScoutDB.remove('loginUser');
      }
    }
    ensureCredsSeed();

    function getCreds() { return ScoutDB.get('credentials', {}) || {}; }
    function setCreds(c) { ScoutDB.set('credentials', c); }

    function generateTempPassword() {
      const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
      let s = '';
      for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
      return s;
    }

    function findCred(username) {
      const creds = getCreds();
      const trimmed = String(username || '').trim();
      if (creds[trimmed]) return { user: trimmed, cred: creds[trimmed] };
      const lower = trimmed.toLowerCase();
      if (creds[lower]) return { user: lower, cred: creds[lower] };
      return null;
    }

    function login(username, password) {
      const found = findCred(username);
      if (!found) return { ok: false, error: 'שם משתמש לא קיים במערכת' };
      const { user, cred } = found;
      if (cred.password !== password) return { ok: false, error: 'סיסמה שגויה' };
      UI.setPersona({ name: cred.name, role: cred.role, staffId: cred.staffId, username: user });
      ScoutDB.set('loggedIn', true);
      ScoutDB.set('loginTs', nowMs());
      ScoutDB.set('loginUser', user);
      const isPendingNow = cred.status === 'pending';
      if (isPendingNow) {
        ScoutDB.appendAudit({
          action: 'LOGIN-PENDING', channel: 'auth',
          details: 'משתמש זמני התחבר לראשונה: ' + user,
          actor: user + ' / ' + (UI.ROLE_LABELS[cred.role] || cred.role),
        });
      } else {
        ScoutDB.appendAudit({
          action: 'LOGIN', channel: 'auth',
          details: 'התחבר בתור ' + user,
          actor: cred.name + ' / ' + (UI.ROLE_LABELS[cred.role] || cred.role),
        });
      }
      return { ok: true, persona: { name: cred.name, role: cred.role, staffId: cred.staffId }, pending: isPendingNow };
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

    function isPending() {
      if (!isLoggedIn()) return false;
      const u = ScoutDB.get('loginUser', null);
      if (!u) return false;
      const cred = getCreds()[u];
      return !!(cred && cred.status === 'pending');
    }

    function requireLogin() {
      if (!isLoggedIn()) { location.replace('index.html'); return false; }
      if (isPending()) { location.replace('onboarding.html'); return false; }
      return true;
    }

    function routeForRole(role) {
      return ROUTES[role] || 'home.html';
    }

    function listDemoUsers() {
      return Object.entries(getCreds())
        .filter(([_, c]) => c.isDemo)
        .map(([user, c]) => ({
          user, role: c.role, name: c.name,
          roleLabel: UI.ROLE_LABELS[c.role] || c.role,
        }));
    }

    function issueTempUser(role) {
      if (!role) throw new Error('role required');
      const creds = getCreds();
      let tempUsername = 'temp_user_' + (100 + Math.floor(Math.random() * 900));
      while (creds[tempUsername]) tempUsername = 'temp_user_' + (100 + Math.floor(Math.random() * 900));
      const tempPassword = generateTempPassword();
      const staffId = 'st-' + uuid().slice(0, 6);

      ScoutDB.patch('staff', l => (l || []).concat([{
        id: staffId,
        name: tempUsername,
        role,
        active: true,
        pendingOnboarding: true,
        tempUsername,
        createdByKabat: true,
        createdAt: nowMs(),
      }]));
      ScoutDB.set('personnelTelemetry', null);

      creds[tempUsername] = {
        role, name: tempUsername, password: tempPassword,
        staffId, status: 'pending', createdAt: nowMs(),
      };
      setCreds(creds);

      const roleLabel = UI.ROLE_LABELS[role] || role;
      ScoutDB.appendAudit({
        action: 'USER-INVITE', channel: 'auth',
        details: `הונפק משתמש זמני "${tempUsername}" בתפקיד ${roleLabel} — ממתין להפעלה`,
      });
      Bus.emit('auth:user-invited', { tempUsername, role, staffId });
      Bus.emit('personnel:update', { staffId, invited: true });
      return { tempUsername, tempPassword, role, staffId };
    }

    function completeOnboarding(profile) {
      profile = profile || {};
      const fullName = String(profile.fullName || '').trim();
      const phone = String(profile.phone || '').trim();
      const newPassword = String(profile.password || '');
      if (!fullName) return { ok: false, error: 'שם מלא נדרש' };
      if (!phone)    return { ok: false, error: 'טלפון נדרש' };
      if (newPassword.length < 6) return { ok: false, error: 'הסיסמה חייבת להיות לפחות 6 תווים' };

      const u = ScoutDB.get('loginUser', null);
      const creds = getCreds();
      const cred = u && creds[u];
      if (!cred || cred.status !== 'pending') return { ok: false, error: 'אין onboarding ממתין' };

      let credKey = fullName;
      let suffix = 1;
      while (creds[credKey] && credKey !== u) {
        credKey = fullName + ' (' + (++suffix) + ')';
      }

      ScoutDB.patch('staff', l => l.map(s =>
        s.id === cred.staffId ? Object.assign({}, s, {
          name: credKey,
          phone,
          pendingOnboarding: false,
          tempUsername: null,
          onboardedAt: nowMs(),
        }) : s
      ));
      ScoutDB.set('personnelTelemetry', null);

      delete creds[u];
      creds[credKey] = {
        role: cred.role,
        name: credKey,
        password: newPassword,
        staffId: cred.staffId,
        status: 'active',
        phone,
        onboardedAt: nowMs(),
      };
      setCreds(creds);

      UI.setPersona({ name: credKey, role: cred.role, staffId: cred.staffId, username: credKey });
      ScoutDB.set('loginUser', credKey);

      const roleLabel = UI.ROLE_LABELS[cred.role] || cred.role;
      ScoutDB.appendAudit({
        action: 'USER-ACTIVATED',
        channel: 'auth',
        details: `[SYSTEM]: המשתמש ${credKey} הפעיל את חשבונו בהצלחה ונכנס לרשת בתפקיד ${roleLabel}`,
        actor: credKey + ' / ' + roleLabel,
      });
      Bus.emit('auth:onboarded', { username: credKey, role: cred.role, staffId: cred.staffId });
      Bus.emit('personnel:update', { staffId: cred.staffId, onboarded: true });

      return { ok: true, persona: { name: credKey, role: cred.role, staffId: cred.staffId } };
    }

    function getPendingUsers() {
      return Object.entries(getCreds())
        .filter(([_, c]) => c.status === 'pending')
        .map(([user, c]) => ({ user, ...c }));
    }

    function revokePendingUser(username) {
      const creds = getCreds();
      const cred = creds[username];
      if (!cred || cred.status !== 'pending') return false;
      delete creds[username];
      setCreds(creds);
      if (cred.staffId) {
        ScoutDB.patch('staff', l => (l || []).filter(s => s.id !== cred.staffId));
        ScoutDB.set('personnelTelemetry', null);
      }
      ScoutDB.appendAudit({ action: 'USER-INVITE-REVOKE', channel: 'auth', details: username });
      Bus.emit('personnel:update', { staffId: cred.staffId, revoked: true });
      return true;
    }

    function deleteUser(staffId) {
      // Hard-delete: remove staff record + any credential that points to it
      if (!staffId) return { ok: false, error: 'staffId required' };
      const staff = ScoutDB.get('staff', []) || [];
      const target = staff.find(s => s.id === staffId);
      if (!target) return { ok: false, error: 'משתמש לא נמצא' };
      // Cannot delete self
      const currentStaff = (UI.currentPersona() || {}).staffId;
      if (currentStaff === staffId) return { ok: false, error: 'אי אפשר למחוק את החשבון המחובר כעת' };
      // Remove credentials pointing to this staffId
      const creds = getCreds();
      let removedCred = null;
      Object.keys(creds).forEach(k => {
        if (creds[k].staffId === staffId) { removedCred = k; delete creds[k]; }
      });
      setCreds(creds);
      // Remove staff
      ScoutDB.patch('staff', l => (l || []).filter(s => s.id !== staffId));
      ScoutDB.set('personnelTelemetry', null);
      // Clean up mission state
      const missions = ScoutDB.get('missions', {}) || {};
      if (missions[staffId]) { delete missions[staffId]; ScoutDB.set('missions', missions); }
      ScoutDB.appendAudit({
        action: 'USER-DELETE', channel: 'auth',
        details: `נמחק: ${target.name} (${UI.ROLE_LABELS[target.role] || target.role})${removedCred ? ' · cred ' + removedCred : ''}`,
      });
      Bus.emit('personnel:update', { staffId, deleted: true });
      return { ok: true };
    }

    // National-only maintenance: purge ALL users except the national super-admin.
    // Keeps system config/rules/data; wipes only user identities.
    function purgeUsers() {
      const persona = UI.currentPersona();
      if (persona.role !== 'national') return { ok: false, error: 'רק מנהל ארצי מורשה לבצע איפוס משתמשים' };
      const creds = getCreds();
      // Keep ONLY the national account(s)
      const fresh = {};
      Object.entries(creds).forEach(([user, c]) => {
        if (c.role === 'national') fresh[user] = c;
      });
      setCreds(fresh);
      // Wipe staff identities + runtime personnel state (NOT rules/architecture)
      ScoutDB.set('staff', []);
      ScoutDB.set('personnelTelemetry', null);
      ScoutDB.remove('missions');
      ScoutDB.appendAudit({
        action: 'USER-PURGE', channel: 'auth',
        details: `מנהל ארצי ביצע איפוס משתמשים גורף — נשמר רק מנהל ארצי. הגדרות, חוקים ומטריצת הרשאות נותרו ללא שינוי.`,
      });
      Bus.emit('auth:purge', { ts: nowMs(), by: persona.name });
      return { ok: true };
    }

    return {
      login, logout, isLoggedIn, isPending, requireLogin, routeForRole,
      listDemoUsers, issueTempUser, completeOnboarding,
      getPendingUsers, revokePendingUser, deleteUser, purgeUsers,
    };
  })();

  // ---------- Drone (Module 18 — Restricted) ----------

  const Drone = (function () {
    function state() {
      return ScoutDB.get('drone', {
        active: false, streamUrl: null, mission: null,
        startedAt: null, flightLog: [],
      });
    }
    function takeoff(url, mission) {
      const cur = state();
      const ev = { ts: nowMs(), event: 'TAKEOFF', mission: mission || 'general' };
      const next = {
        active: true, streamUrl: url || null,
        mission: mission || 'general', startedAt: nowMs(),
        flightLog: (cur.flightLog || []).concat([ev]),
      };
      ScoutDB.set('drone', next);
      ScoutDB.appendAudit({ action: 'DRONE-TAKEOFF', channel: 'drone', details: 'משימה: ' + (mission || 'general') });
      Bus.emit('drone:update', next);
      return next;
    }
    function land() {
      const cur = state();
      if (!cur.active) return cur;
      const dur = nowMs() - (cur.startedAt || nowMs());
      const ev = { ts: nowMs(), event: 'LANDING', durationMs: dur, mission: cur.mission };
      const next = {
        active: false, streamUrl: null, mission: null, startedAt: null,
        flightLog: (cur.flightLog || []).concat([ev]),
      };
      ScoutDB.set('drone', next);
      ScoutDB.appendAudit({ action: 'DRONE-LANDING', channel: 'drone', details: 'משך טיסה: ' + Math.round(dur / 1000) + ' שניות' });
      Bus.emit('drone:update', next);
      return next;
    }
    function switchMission(mission) {
      const cur = state();
      if (!cur.active) return cur;
      cur.mission = mission;
      cur.flightLog = (cur.flightLog || []).concat([{ ts: nowMs(), event: 'MISSION-CHANGE', mission }]);
      ScoutDB.set('drone', cur);
      ScoutDB.appendAudit({ action: 'DRONE-MISSION', channel: 'drone', details: 'משימה הוחלפה ל-' + mission });
      Bus.emit('drone:update', cur);
      return cur;
    }
    return { state, takeoff, land, switchMission };
  })();

  // ---------- Operational Chat ----------

  const Chat = (function () {
    const CHANNELS = [
      { id: 'emergency',  name: 'ערוץ חירום מרכזי', locked: true,  roles: ['kabat','hq-shift','hq-op','national'] },
      { id: 'security',   name: 'צ׳אט אבטחה',       locked: false, roles: ['kabat','achmash','guard','patrol','national'] },
      { id: 'management', name: 'הנהלה ותפעול',     locked: false, roles: ['camp-director','hq-shift','hq-op','tribe','national','kabat'] },
    ];

    function ensureSeed() {
      if (!ScoutDB.get('chatSeeded', false)) {
        const t = nowMs();
        const seed = {
          emergency: [
            { from: 'מערכת', role: 'system', text: '🔒 ערוץ נעול — רק חמ"ל/קב"ט יכולים להפיץ הנחיות.', ts: t - 1000 * 60 * 90 },
            { from: 'קב״ט ניר אלון', role: 'kabat', text: 'סבב פתיחה הסתיים. כל הצוותים בעמדה. ערנות מלאה.', ts: t - 1000 * 60 * 70 },
          ],
          security: [
            { from: 'אחמ״ש יוסי גולן', role: 'achmash', text: 'סיור 1 התחיל מסלול דרום.', ts: t - 1000 * 60 * 22 },
            { from: 'מאבטח אופיר',     role: 'guard',   text: 'שער ראשי תקין. 0 חריגים בשעה האחרונה.', ts: t - 1000 * 60 * 18 },
            { from: 'סייר 3 — תומר',   role: 'patrol',  text: 'גדר היקפית — סבב הושלם. הכל תקין.', ts: t - 1000 * 60 * 8 },
          ],
          management: [
            { from: 'מנהל מחנה גלית', role: 'camp-director', text: 'תזכורת — סבב אכילה ב-19:00. אקונומיה מוכן?', ts: t - 1000 * 60 * 35 },
            { from: 'אקונומיה',        role: 'staff',         text: 'כן. סבב חלוקה מתחיל ב-18:30.', ts: t - 1000 * 60 * 28 },
          ],
        };
        ScoutDB.set('chats', seed);
        ScoutDB.set('chatSeeded', true);
      }
      if (!ScoutDB.get('customChannels', null)) ScoutDB.set('customChannels', []);
      if (!ScoutDB.get('dmChannels', null)) ScoutDB.set('dmChannels', []);
    }
    ensureSeed();

    function channels() { return CHANNELS; }

    function visibleChannels(role, staffId) {
      const stat = CHANNELS.filter(c => c.roles.includes(role));
      const custom = (ScoutDB.get('customChannels', []) || [])
        .filter(c => !staffId || c.members.includes(staffId) || c.createdBy === staffId);
      const staff = ScoutDB.get('staff', []) || [];
      const dms = (ScoutDB.get('dmChannels', []) || [])
        .filter(c => !staffId || c.participants.includes(staffId))
        .map(c => {
          const otherId = c.participants.find(p => p !== staffId) || c.participants[0];
          const other = staff.find(s => s.id === otherId);
          return Object.assign({}, c, {
            name: other ? other.name : 'DM',
            otherRole: other ? other.role : null,
            isDM: true,
          });
        });
      return stat.concat(custom).concat(dms);
    }

    function messages(channelId) {
      return ScoutDB.get('chats', {})[channelId] || [];
    }
    function send(channelId, text) {
      const all = ScoutDB.get('chats', {});
      all[channelId] = all[channelId] || [];
      const p = UI.currentPersona();
      const msg = { from: p.name, role: p.role, text: String(text || '').slice(0, 500), ts: nowMs() };
      all[channelId].push(msg);
      if (all[channelId].length > 200) all[channelId] = all[channelId].slice(-200);
      ScoutDB.set('chats', all);
      Bus.emit('chat:new', { channelId, msg });
      ScoutDB.appendAudit({ action: 'CHAT-MSG', channel: 'comms', details: `${channelId}: ${msg.text.slice(0, 60)}` });
      return msg;
    }
    function broadcast(text) {
      Bus.emit('bus:broadcast', { text, from: UI.currentPersona().name, ts: nowMs() });
      ScoutDB.appendAudit({ action: 'BROADCAST', channel: 'comms', details: text });
    }

    function createGroup(name, memberIds, createdBy) {
      const id = 'grp-' + uuid().slice(0, 8);
      const grp = {
        id, name, members: memberIds || [], createdBy: createdBy || null,
        createdAt: nowMs(), custom: true, locked: false, roles: [],
      };
      ScoutDB.patch('customChannels', l => (l || []).concat([grp]));
      // Seed welcome message
      const all = ScoutDB.get('chats', {});
      all[id] = [{
        from: 'מערכת', role: 'system',
        text: `📢 הקבוצה "${name}" נוצרה. ${(memberIds || []).length} חברים צורפו.`,
        ts: nowMs(),
      }];
      ScoutDB.set('chats', all);
      ScoutDB.appendAudit({ action: 'CHAT-GROUP-CREATE', channel: 'comms', details: `${name} (${(memberIds || []).length} חברים)` });
      Bus.emit('chat:groups-updated', grp);
      return grp;
    }

    function openDM(myStaffId, otherStaffId) {
      const sorted = [myStaffId, otherStaffId].sort();
      const id = `dm-${sorted[0]}-${sorted[1]}`;
      const dms = ScoutDB.get('dmChannels', []) || [];
      let dm = dms.find(d => d.id === id);
      if (!dm) {
        dm = { id, participants: sorted, createdAt: nowMs(), isDM: true };
        ScoutDB.patch('dmChannels', l => (l || []).concat([dm]));
        ScoutDB.appendAudit({ action: 'CHAT-DM-OPEN', channel: 'comms', details: id });
        Bus.emit('chat:groups-updated', dm);
      }
      return dm;
    }

    function deleteChannel(channelId) {
      if (channelId.startsWith('grp-')) {
        ScoutDB.patch('customChannels', l => (l || []).filter(c => c.id !== channelId));
      } else if (channelId.startsWith('dm-')) {
        ScoutDB.patch('dmChannels', l => (l || []).filter(c => c.id !== channelId));
      } else {
        return;
      }
      const all = ScoutDB.get('chats', {});
      delete all[channelId];
      ScoutDB.set('chats', all);
      ScoutDB.appendAudit({ action: 'CHAT-DELETE', channel: 'comms', details: channelId });
      Bus.emit('chat:groups-updated', { deleted: channelId });
    }

    return { channels, visibleChannels, messages, send, broadcast, createGroup, openDM, deleteChannel };
  })();

  // ---------- Personnel device telemetry (mock) ----------

  const Personnel = (function () {
    function devices() {
      // Generate deterministic mock telemetry per staff member
      const staff = ScoutDB.get('staff', []);
      const cur = ScoutDB.get('personnelTelemetry', null);
      if (cur && cur.ts && (nowMs() - cur.ts) < 60_000) return cur.list;
      const list = staff.map((s, i) => {
        const battery = clamp(20 + ((i * 23 + Math.floor(nowMs() / 90_000)) % 80), 5, 100);
        const lastSeenAgoSec = ((i * 17) % 240); // 0..240s
        return {
          id: s.id, name: s.name, role: s.role, active: s.active,
          battery,
          lastSeenTs: nowMs() - lastSeenAgoSec * 1000,
          location: ['שער ראשי','גדר היקפית','שבט נחל','שבט אפיק','חמ"ל','מחסן','מרפאה','שטח רחב'][i % 8],
        };
      });
      ScoutDB.set('personnelTelemetry', { ts: nowMs(), list });
      return list;
    }
    function setRole(staffId, newRole) {
      ScoutDB.patch('staff', l => l.map(s => s.id === staffId ? Object.assign({}, s, { role: newRole }) : s));
      ScoutDB.set('personnelTelemetry', null);
      ScoutDB.appendAudit({ action: 'ROLE-CHANGE', channel: 'auth', details: `${staffId} → ${newRole}` });
      Bus.emit('personnel:update', { staffId, newRole });
    }
    function setActive(staffId, active) {
      ScoutDB.patch('staff', l => l.map(s => s.id === staffId ? Object.assign({}, s, { active }) : s));
      ScoutDB.set('personnelTelemetry', null);
      ScoutDB.appendAudit({ action: active ? 'USER-UNBLOCK' : 'USER-BLOCK', channel: 'auth', details: staffId });
      Bus.emit('personnel:update', { staffId, active });
    }
    function addEmergencyUser(name, role) {
      const id = 'st-' + uuid().slice(0, 5);
      ScoutDB.patch('staff', l => l.concat([{ id, name, role, active: true, emergency: true }]));
      ScoutDB.set('personnelTelemetry', null);
      ScoutDB.appendAudit({ action: 'USER-EMERGENCY-ADD', channel: 'auth', details: name + ' / ' + role });
      Bus.emit('personnel:update', { staffId: id, added: true });
      return id;
    }
    return { devices, setRole, setActive, addEmergencyUser };
  })();

  // ---------- Gate permission matrix ----------

  const Gate = (function () {
    const ADD_PERMISSIONS = {
      bus:      ['hq-shift', 'camp-director', 'national'],
      guest:    ['hq-shift', 'hq-op', 'kabat', 'camp-director', 'national'],
      supplier: ['hq-shift', 'hq-op', 'kabat', 'camp-director', 'national', 'provisions', 'sanitation'],
    };
    // Roles that should receive routed exception alerts from the gate
    const EXCEPTION_RECIPIENTS_GENERAL = ['hq-shift', 'hq-op', 'kabat', 'camp-director'];
    const SUPPLIER_DEPT_RECIPIENT = {
      economy:    'provisions',
      sanitation: 'sanitation',
      logistics:  'camp-director',
    };

    function canAdd(role, category) {
      return (ADD_PERMISSIONS[category] || []).includes(role);
    }
    function exceptionRecipients(item) {
      const base = EXCEPTION_RECIPIENTS_GENERAL.slice();
      if (item && item.entityType === 'supplier' && item.data && item.data.destination) {
        const extra = SUPPLIER_DEPT_RECIPIENT[item.data.destination];
        if (extra && !base.includes(extra)) base.push(extra);
      }
      return base;
    }
    return { canAdd, exceptionRecipients };
  })();

  // ---------- Hanich Checkout protocol ----------

  const Checkout = (function () {
    function approveByHQ(hanichId, opts) {
      opts = opts || {};
      const h = (ScoutDB.get('hanichim', []) || []).find(x => x.id === hanichId);
      if (!h) return { ok: false, error: 'חניך לא נמצא' };
      ScoutDB.patch('hanichim', l => l.map(x => x.id === hanichId
        ? Object.assign({}, x, {
            checkoutApproved: true,
            checkoutApprovedAt: nowMs(),
            checkoutApprovedBy: UI.currentPersona().name,
            checkoutReason: opts.reason || 'אישור שגרתי חמ״ל',
            checkoutPaperRef: opts.paperRef || ('פתק-' + Math.floor(1000 + Math.random() * 9000)),
          })
        : x));
      ScoutDB.appendAudit({
        action: 'CHECKOUT-HQ-APPROVE', channel: 'tribe',
        details: `אושר ע״י חמ״ל: ${h.name} (סיבה: ${opts.reason || 'שגרתי'}, טופס: פיזי)`,
      });
      Bus.emit('checkout:approved', { hanichId, hanichName: h.name });
      return { ok: true };
    }

    function confirmAtGate(hanichId) {
      const h = (ScoutDB.get('hanichim', []) || []).find(x => x.id === hanichId);
      if (!h) return { ok: false, error: 'חניך לא נמצא' };
      if (!h.checkoutApproved) return { ok: false, error: 'אין אישור חמ״ל' };
      ScoutDB.patch('hanichim', l => l.map(x => x.id === hanichId
        ? Object.assign({}, x, {
            status: 'released',
            checkoutCompletedAt: nowMs(),
            checkoutCompletedBy: UI.currentPersona().name,
          })
        : x));
      ScoutDB.appendAudit({
        action: 'CHECKOUT-GATE-RELEASE', channel: 'gate',
        details: `שוחרר בש״ג ע״י ${UI.currentPersona().name}: ${h.name} (טופס פיזי אומת)`,
      });
      Bus.emit('checkout:released', { hanichId, hanichName: h.name });
      return { ok: true };
    }

    function revokeApproval(hanichId) {
      ScoutDB.patch('hanichim', l => l.map(x => x.id === hanichId
        ? Object.assign({}, x, {
            checkoutApproved: false, checkoutApprovedAt: null,
            checkoutApprovedBy: null, checkoutReason: null, checkoutPaperRef: null,
          })
        : x));
      ScoutDB.appendAudit({ action: 'CHECKOUT-REVOKE', channel: 'tribe', details: 'אישור יציאה בוטל ל-' + hanichId });
      Bus.emit('checkout:revoked', { hanichId });
    }

    // Track B — Gate-initiated verification request
    function requestGateVerification(hanichName, reason) {
      const id = 'cvr-' + uuid().slice(0, 6);
      const req = {
        id, hanichName, reason: reason || 'חניך הגיע עם טופס נייר ללא סנכרון דיגיטלי',
        requestedBy: UI.currentPersona().name,
        ts: nowMs(),
        status: 'pending', // pending | approved | denied
      };
      ScoutDB.patch('checkoutVerifications', l => (l || []).concat([req]));
      ScoutDB.appendAudit({ action: 'CHECKOUT-VERIFY-REQ', channel: 'gate', details: `בקשת אימות חניך ${hanichName}: ${req.reason}` });
      Bus.emit('checkout:verify-request', req);
      return req;
    }
    function resolveGateVerification(id, decision) {
      ScoutDB.patch('checkoutVerifications', l => (l || []).map(r =>
        r.id === id ? Object.assign({}, r, {
          status: decision, resolvedAt: nowMs(), resolvedBy: UI.currentPersona().name,
        }) : r));
      ScoutDB.appendAudit({
        action: 'CHECKOUT-VERIFY-RESOLVE', channel: 'tribe',
        details: `אימות חניך ${id} ${decision === 'approved' ? 'אושר' : 'נדחה'} ע״י ${UI.currentPersona().name}`,
      });
      Bus.emit('checkout:verify-resolved', { id, decision });
    }

    return { approveByHQ, confirmAtGate, revokeApproval, requestGateVerification, resolveGateVerification };
  })();

  // ---------- Parent Pickup protocol ----------

  const ParentPickup = (function () {
    function requestAtGate({ parentName, parentPhone, hanichId }) {
      const h = (ScoutDB.get('hanichim', []) || []).find(x => x.id === hanichId);
      if (!h) return { ok: false, error: 'חניך לא נמצא' };
      const id = 'pp-' + uuid().slice(0, 6);
      const req = {
        id,
        parentName, parentPhone,
        hanichId, hanichName: h.name, tribeId: h.tribeId,
        guardName: UI.currentPersona().name,
        ts: nowMs(),
        stage: 'hq-pending', // hq-pending | hq-routed | tribe-pending | tribe-approved | tribe-denied
      };
      ScoutDB.patch('parentPickups', l => (l || []).concat([req]));
      ScoutDB.appendAudit({
        action: 'PARENT-PICKUP-REQ', channel: 'gate',
        details: `הורה ${parentName} (${parentPhone}) הגיע לאסוף ${h.name} — ממתין לחמ״ל`,
      });
      Bus.emit('parentPickup:request', req);
      return { ok: true, req };
    }

    function routeToTribe(id) {
      ScoutDB.patch('parentPickups', l => (l || []).map(r =>
        r.id === id ? Object.assign({}, r, {
          stage: 'tribe-pending',
          routedToTribeAt: nowMs(),
          routedBy: UI.currentPersona().name,
        }) : r));
      const updated = (ScoutDB.get('parentPickups', []) || []).find(r => r.id === id);
      ScoutDB.appendAudit({
        action: 'PARENT-PICKUP-ROUTE', channel: 'tribe',
        details: `חמ״ל ניתב אימות איסוף ${updated && updated.hanichName} למרכז שבט`,
      });
      Bus.emit('parentPickup:routed', updated);
      return updated;
    }

    function tribeDecision(id, decision, reason) {
      ScoutDB.patch('parentPickups', l => (l || []).map(r =>
        r.id === id ? Object.assign({}, r, {
          stage: decision === 'approved' ? 'tribe-approved' : 'tribe-denied',
          tribeReason: reason || null,
          tribeDecidedAt: nowMs(),
          tribeDecidedBy: UI.currentPersona().name,
        }) : r));
      const updated = (ScoutDB.get('parentPickups', []) || []).find(r => r.id === id);
      ScoutDB.appendAudit({
        action: 'PARENT-PICKUP-DECISION', channel: 'tribe',
        details: `מרכז שבט ${decision === 'approved' ? 'אישר' : 'דחה'} איסוף ${updated && updated.hanichName} ע״י ${updated && updated.parentName}${reason ? ' — ' + reason : ''}`,
      });
      Bus.emit('parentPickup:decision', updated);
      // If approved, mark hanich as checkoutApproved for gate-release flow
      if (decision === 'approved' && updated) {
        Checkout.approveByHQ(updated.hanichId, {
          reason: `איסוף ע״י ${updated.parentName}`,
          paperRef: 'אימות-שבט-' + id.slice(-4),
        });
      }
      return updated;
    }

    function listPending() {
      return (ScoutDB.get('parentPickups', []) || [])
        .filter(r => r.stage === 'hq-pending' || r.stage === 'tribe-pending');
    }
    function listForTribe(tribeId) {
      return (ScoutDB.get('parentPickups', []) || [])
        .filter(r => r.tribeId === tribeId && r.stage === 'tribe-pending');
    }

    return { requestAtGate, routeToTribe, tribeDecision, listPending, listForTribe };
  })();

  // ---------- Adults & Parents (seeded once) ----------

  (function ensureAdultsSeed() {
    if (ScoutDB.get('adultsSeeded', false)) return;
    const adults = [
      { id: 'a1', name: 'נטע אבירם — אם של נועם',     role: 'parent',     tribeId: 'tribe-1', present: true },
      { id: 'a2', name: 'דורון לוי — אב של דניאל',     role: 'parent',     tribeId: 'tribe-2', present: false },
      { id: 'a3', name: 'יעל גרשון — סייעת רפואית',    role: 'leadership', tribeId: null,      present: true },
      { id: 'a4', name: 'אלון פרי — מנהל לוגיסטיקה',   role: 'leadership', tribeId: null,      present: true },
      { id: 'a5', name: 'רחלי כהן — מדריכה ראשית',     role: 'staff',      tribeId: 'tribe-3', present: true },
      { id: 'a6', name: 'דני שלום — אב של איתי',       role: 'parent',     tribeId: 'tribe-1', present: true },
      { id: 'a7', name: 'מיכל אזולאי — אם של שירה',    role: 'parent',     tribeId: 'tribe-4', present: false },
    ];
    ScoutDB.set('adults', adults);
    ScoutDB.set('adultsSeeded', true);
  })();

  // ---------- Incidents (master incident table + debrief protocol) ----------

  const Incidents = (function () {
    const TYPE_LABELS = {
      'medical':        '🚑 רפואי',
      'hazard':         '⚠ מפגע',
      'security':       '🛡 אבטחה',
      'sos':            '🚨 SOS',
      'gate-exception': '⛩ חריג שער',
      'parent-pickup':  '👨‍👧 איסוף הורה',
      'patrol-report':  '🚶 דיווח סיור',
      'other':          '📋 אחר',
    };
    const PRIORITY_LABELS = {
      high:   '🟥 גבוהה (קריטי)',
      medium: '🟨 בינונית',
      low:    '🟦 נמוכה',
    };
    const STATUS_LABELS = {
      pending:     '❌ לא בוצע',
      'in-progress': '⏳ בטיפול',
      resolved:    '✅ בוצע וסגור',
    };

    function list(filter) {
      let arr = ScoutDB.get('incidents', []) || [];
      if (filter && filter.status)   arr = arr.filter(i => i.status === filter.status);
      if (filter && filter.priority) arr = arr.filter(i => i.priority === filter.priority);
      if (filter && filter.type)     arr = arr.filter(i => i.type === filter.type);
      return arr.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
    }
    function get(id) { return (ScoutDB.get('incidents', []) || []).find(i => i.id === id); }

    function create(payload) {
      payload = payload || {};
      const persona = UI.currentPersona();
      const inc = {
        id: 'inc-' + uuid().slice(0, 8),
        type: payload.type || 'other',
        title: payload.title || 'אירוע חריג',
        details: payload.details || '',
        reporter: payload.reporter || persona.name,
        reporterRole: payload.reporterRole || persona.role,
        ts: nowMs(),
        gps: payload.gps || null,
        priority: payload.priority || 'medium',
        status: 'pending',
        notes: [],
        debrief: null,
        acknowledgedBy: null,
        acknowledgedAt: null,
        locked: false,
      };
      ScoutDB.patch('incidents', l => (l || []).concat([inc]));
      ScoutDB.appendAudit({
        action: 'INCIDENT-CREATE', channel: 'sos',
        details: `${inc.id} · ${TYPE_LABELS[inc.type] || inc.type}: ${inc.title} — דווח ע״י ${inc.reporter}`,
      });
      Bus.emit('incident:new', inc);
      return inc;
    }

    function acknowledge(id) {
      const cur = get(id);
      if (!cur || cur.acknowledgedBy) return;
      ScoutDB.patch('incidents', l => (l || []).map(i =>
        i.id === id ? Object.assign({}, i, { acknowledgedBy: UI.currentPersona().name, acknowledgedAt: nowMs() }) : i));
      Bus.emit('incident:updated', { id, acknowledgedBy: UI.currentPersona().name });
    }

    function setPriority(id, level) {
      const cur = get(id);
      if (!cur || cur.locked) return { ok: false, error: 'אירוע נעול' };
      ScoutDB.patch('incidents', l => (l || []).map(i => i.id === id ? Object.assign({}, i, { priority: level }) : i));
      ScoutDB.appendAudit({ action: 'INCIDENT-PRIORITY', channel: 'sos', details: `${id} → ${PRIORITY_LABELS[level] || level}` });
      Bus.emit('incident:updated', { id, priority: level });
      return { ok: true };
    }

    function setStatus(id, status) {
      const cur = get(id);
      if (!cur || cur.locked) return { ok: false, error: 'אירוע נעול' };
      if (status === 'resolved') {
        return { ok: false, error: 'יש לסגור אירוע דרך מודאל התחקיר (close)' };
      }
      ScoutDB.patch('incidents', l => (l || []).map(i => i.id === id ? Object.assign({}, i, { status }) : i));
      ScoutDB.appendAudit({ action: 'INCIDENT-STATUS', channel: 'sos', details: `${id} → ${STATUS_LABELS[status] || status}` });
      Bus.emit('incident:updated', { id, status });
      return { ok: true };
    }

    function addNote(id, text) {
      const cur = get(id);
      if (!cur || cur.locked) return { ok: false, error: 'אירוע נעול' };
      const note = { ts: nowMs(), by: UI.currentPersona().name, text: String(text || '').trim() };
      if (!note.text) return { ok: false, error: 'אין תוכן' };
      ScoutDB.patch('incidents', l => (l || []).map(i =>
        i.id === id ? Object.assign({}, i, { notes: (i.notes || []).concat([note]) }) : i));
      ScoutDB.appendAudit({ action: 'INCIDENT-NOTE', channel: 'sos', details: `${id}: ${note.text.slice(0, 80)}` });
      Bus.emit('incident:updated', { id, note });
      return { ok: true };
    }

    function close(id, debriefText) {
      const cur = get(id);
      if (!cur) return { ok: false, error: 'לא נמצא' };
      if (cur.locked) return { ok: false, error: 'אירוע כבר נעול' };
      const text = String(debriefText || '').trim();
      if (text.length < 10) return { ok: false, error: 'תחקיר מינימלי 10 תווים' };
      ScoutDB.patch('incidents', l => (l || []).map(i => i.id === id
        ? Object.assign({}, i, {
            status: 'resolved',
            debrief: text,
            locked: true,
            resolvedAt: nowMs(),
            resolvedBy: UI.currentPersona().name,
          })
        : i));
      ScoutDB.appendAudit({
        action: 'INCIDENT-CLOSE', channel: 'sos',
        details: `${id} ננעל ע״י ${UI.currentPersona().name}. תחקיר: ${text.slice(0, 200)}`,
      });
      Bus.emit('incident:closed', { id, debrief: text });
      return { ok: true };
    }

    return { list, get, create, acknowledge, setPriority, setStatus, addNote, close, TYPE_LABELS, PRIORITY_LABELS, STATUS_LABELS };
  })();

  // Hook: SOS triggers ALSO create an incident
  (function hookSOSToIncidents() {
    Bus.on('sos:trigger', ev => {
      // Avoid duplicate incidents for the same SOS event
      const existing = Incidents.list().find(i => i.type === 'sos' && i.title.includes(ev.id));
      if (existing) return;
      Incidents.create({
        type: 'sos',
        title: ev.label + ' [' + ev.id.slice(0, 8) + ']',
        details: 'אירוע SOS שודר מהשטח. מטופל במסלול מהיר ע״י קב״ט.',
        reporter: ev.who,
        gps: ev.gps,
        priority: ev.urgency === 'critical' ? 'high' : (ev.urgency === 'complex' ? 'high' : 'medium'),
      });
    });
  })();

  // ---------- Forests (multi-tenancy registry, national-managed) ----------

  const Forests = (function () {
    function listSeeded() { return FORESTS.slice(); }
    function listCustom() { return ScoutDB.get('customForests', []) || []; }
    function list() {
      return listSeeded().concat(listCustom());
    }
    function get(id) {
      return list().find(f => f.id === id) || null;
    }
    function create({ name, region, lat, lng }) {
      if (!name || !String(name).trim()) return { ok: false, error: 'שם יער נדרש' };
      const all = list();
      if (all.find(f => f.name === name)) return { ok: false, error: 'יער בשם זה כבר קיים' };
      const id = 'f-' + uuid().slice(0, 6);
      const forest = {
        id, name: String(name).trim(),
        region: region || 'אזור חדש',
        lat: lat || (31 + Math.random() * 2.5),
        lng: lng || (34.5 + Math.random() * 2),
        hanichim: 0, staff: 0, status: 'ok',
        custom: true,
        createdBy: UI.currentPersona().name,
        createdByRole: UI.currentPersona().role,
        createdAt: nowMs(),
      };
      ScoutDB.patch('customForests', l => (l || []).concat([forest]));
      ScoutDB.appendAudit({
        action: 'FOREST-CREATE', channel: 'auth',
        details: `הוקם יער "${forest.name}" (${forest.region}) ע"י ${forest.createdBy}`,
      });
      Bus.emit('forests:updated', { kind: 'created', forest });
      return { ok: true, forest };
    }
    function remove(id) {
      const cur = listCustom();
      const f = cur.find(x => x.id === id);
      if (!f) return { ok: false, error: 'יער לא נמצא או שמדובר ביער מערכת קבוע' };
      ScoutDB.patch('customForests', l => (l || []).filter(x => x.id !== id));
      ScoutDB.appendAudit({ action: 'FOREST-DELETE', channel: 'auth', details: `יער ${f.name} (${id}) נמחק` });
      Bus.emit('forests:updated', { kind: 'deleted', id });
      return { ok: true };
    }
    return { list, listSeeded, listCustom, get, create, remove };
  })();

  // ---------- Role-creation permission matrix ----------

  const RoleProvisioning = (function () {
    // Who can create which role:
    // - national: ANY role, in ANY forest
    // - kabat:    ANY role, but only in their assigned forest
    // - camp-director: only leadership/staff/tribe-coordinator/sanitation/safety/provisions
    //                  (NOT security or medical roles)
    const PROVISIONING_RULES = {
      'national':      { allowed: '*', scope: 'any-forest' },
      'kabat':         { allowed: '*', scope: 'own-forest' },
      'camp-director': {
        allowed: ['camp-director', 'safety', 'sanitation', 'tribe', 'provisions', 'staff'],
        scope:   'own-forest',
      },
    };
    const SECURITY_ROLES = ['kabat', 'achmash', 'guard', 'patrol'];
    const MEDICAL_ROLES  = ['doctor', 'paramedic', 'medic', 'first-aid', 'clinic-chief'];

    function canIssue(byRole, targetRole) {
      const rule = PROVISIONING_RULES[byRole];
      if (!rule) return false;
      if (rule.allowed === '*') return true;
      return rule.allowed.includes(targetRole);
    }
    function blockedRolesFor(byRole) {
      const rule = PROVISIONING_RULES[byRole];
      if (!rule) return [];
      if (rule.allowed === '*') return [];
      // Whatever isn't in allowed
      const all = Object.keys(UI.ROLE_LABELS);
      return all.filter(r => !rule.allowed.includes(r));
    }
    function explanation(byRole) {
      if (byRole === 'national') return 'מנהל ארצי — סמכות מוחלטת על כל המשתמשים בכל היערות בארץ.';
      if (byRole === 'kabat')    return 'קב"ט יער — סמכות מלאה על כל סוגי המשתמשים, אך רק בגזרת היער שלו.';
      if (byRole === 'camp-director') return 'מנהל מחנה — חסום מהקמת משתמשי אבטחה ורפואה. רק הנהגה / צוות / מרכזי שבטים.';
      return 'אין הרשאה להקים משתמשים מסוג זה.';
    }
    return { canIssue, blockedRolesFor, explanation, SECURITY_ROLES, MEDICAL_ROLES };
  })();

  // ---------- Debrief / Analytics aggregator ----------

  const Debrief = (function () {
    function within(range) {
      // range: { from: ms, to: ms } or { lastHours: N }
      const now = nowMs();
      if (range.lastHours)  return { from: now - range.lastHours * 3600_000, to: now };
      if (range.lastDays)   return { from: now - range.lastDays * 86_400_000, to: now };
      return { from: range.from || 0, to: range.to || now };
    }
    function inRange(ts, r) { return ts >= r.from && ts <= r.to; }

    function generate(range, shiftFilter) {
      const r = within(range);

      // 1. Incidents analytics
      const incidents = (ScoutDB.get('incidents', []) || []).filter(i => inRange(i.ts, r));
      const closed    = incidents.filter(i => i.locked);
      const open      = incidents.filter(i => !i.locked);
      const byPriority = {
        high:   incidents.filter(i => i.priority === 'high').length,
        medium: incidents.filter(i => i.priority === 'medium').length,
        low:    incidents.filter(i => i.priority === 'low').length,
      };
      const debriefs = closed.map(i => ({
        id: i.id, title: i.title, type: i.type, priority: i.priority,
        closedAt: i.resolvedAt, closedBy: i.resolvedBy, debrief: i.debrief,
      }));

      // 2. Logistics: buses
      const audit = (ScoutDB.get('audit', []) || []).filter(a => inRange(a.ts, r));
      const busAudit = audit.filter(a => a.action.startsWith('BUS-'));
      const busIn  = busAudit.filter(a => a.action === 'BUS-IN' || a.action === 'BUS-CLEAR').length;
      const busOut = busAudit.filter(a => a.action === 'BUS-OUT').length;
      const busAdded = busAudit.filter(a => a.action.endsWith('-ADD-KABAT') || a.action.endsWith('-ADD-HQ')).length;

      // Manual gate approvals (kabat/HQ overrides)
      const gateApprove = audit.filter(a => a.action === 'GATE-APPROVE').length;
      const gateDeny    = audit.filter(a => a.action === 'GATE-DENY').length;
      const vehAdd = audit.filter(a => a.action.startsWith('VEH-ADD')).length;
      const guestAdd = audit.filter(a => a.action.startsWith('GUEST-PASS-ISSUE') || a.action === 'GUEST-CHECKIN').length;

      // 3. Patrol performance
      const waypoints = ScoutDB.get('patrolWaypoints', []) || [];
      const checklist = ScoutDB.get('patrolChecklist', []) || [];
      const wpVisited = waypoints.filter(w => w.visited).length;
      const wpTotal = waypoints.length;
      const taskDone = checklist.filter(c => c.done).length;
      const taskTotal = checklist.length;
      const patrolAudit = audit.filter(a => a.action === 'PATROL-WP' || a.action === 'PATROL-TASK');
      const hazards = (ScoutDB.get('hazards', []) || []).filter(h => inRange(h.ts, r));
      const openHazards = incidents.filter(i => i.type === 'hazard' && !i.locked);

      return {
        range: r,
        shiftFilter: shiftFilter || null,
        incidents: {
          total: incidents.length, open: open.length, closed: closed.length,
          byPriority, debriefs,
        },
        logistics: {
          busesIn: busIn, busesOut: busOut, busesAdded: busAdded,
          gateApprovals: gateApprove, gateDenials: gateDeny,
          vehiclesAdded: vehAdd, guestsAdded: guestAdd,
        },
        patrol: {
          waypointsCompleted: wpVisited, waypointsTotal: wpTotal,
          tasksCompleted: taskDone, tasksTotal: taskTotal,
          patrolActions: patrolAudit.length,
          hazardsReported: hazards.length,
          hazardsStillOpen: openHazards.length,
          openHazardsList: openHazards.map(h => ({ id: h.id, title: h.title, gps: h.gps, priority: h.priority })),
        },
        meta: {
          generatedAt: nowMs(),
          generatedBy: UI.currentPersona().name,
          generatedByRole: UI.currentPersona().role,
        },
      };
    }
    return { generate, within };
  })();

  const HQPermissions = (function () {
    const DEFAULT_RESTRICTIONS = {
      'gate-exception-approve': true,
      'guest-add':              true,
      'supplier-add':           true,
      'checkout-approve':       true,
      'broadcast':              true,
      'roster-broadcast':       true,
      'route-pickup':           true,
    };
    const LABELS = {
      'gate-exception-approve': 'אישור בקשות חריגות מהשער',
      'guest-add':              'הוספת אורחים מאושרים',
      'supplier-add':           'הוספת ספקים מאושרים',
      'checkout-approve':       'אישור יציאות חניכים',
      'broadcast':              'כריזה המונית',
      'roster-broadcast':       'דרישת עדכון מצבה מהשבטים',
      'route-pickup':           'ניתוב בקשות איסוף הורים',
    };
    function get() {
      return Object.assign({}, DEFAULT_RESTRICTIONS, ScoutDB.get('hqStationPerms', {}) || {});
    }
    function set(key, allowed) {
      const cur = ScoutDB.get('hqStationPerms', {}) || {};
      cur[key] = !!allowed;
      ScoutDB.set('hqStationPerms', cur);
      ScoutDB.appendAudit({
        action: 'HQ-PERM-TOGGLE', channel: 'auth',
        details: `${LABELS[key] || key} — ${allowed ? 'הופעל' : 'נחסם'} עבור משתמש "מערכת חמ"ל"`,
      });
      Bus.emit('hq-perms:update', { key, allowed });
    }
    function can(role, key) {
      if (role !== 'hq-op') return true; // only HQ Station is restricted
      return get()[key] !== false;
    }
    function labels() { return LABELS; }
    return { get, set, can, labels };
  })();

  // ---------- Roster Broadcast (HQ → tribes) ----------

  const Roster = (function () {
    function gdud(age) {
      if (age <= 11) return { code: 'jr', label: 'גדוד צעיר (ד׳-ו׳)' };
      if (age <= 13) return { code: 'mid', label: 'גדוד אמצעי (ז׳-ח׳)' };
      if (age <= 15) return { code: 'sr', label: 'גדוד בוגר (ט׳)' };
      return { code: 'shakbag', label: 'שכב״ג (י׳-י״ב)' };
    }
    function layer(age) {
      if (age <= 9)  return 'כיתה ד׳';
      if (age <= 10) return 'כיתה ה׳';
      if (age <= 11) return 'כיתה ו׳';
      if (age <= 12) return 'כיתה ז׳';
      if (age <= 13) return 'כיתה ח׳';
      if (age <= 14) return 'כיתה ט׳';
      if (age <= 15) return 'כיתה י׳';
      if (age <= 16) return 'כיתה י״א';
      return 'כיתה י״ב';
    }
    function broadcastUpdateRequest() {
      const persona = UI.currentPersona();
      const msg = {
        id: 'rb-' + uuid().slice(0, 6),
        from: persona.name,
        fromRole: persona.role,
        text: 'הודעה מהחמ"ל: נא לשלוח מספרי חניכים מדויקים',
        ts: nowMs(),
      };
      ScoutDB.appendAudit({ action: 'ROSTER-BROADCAST', channel: 'comms', details: `${persona.name} שלח דרישת עדכון מצבה לכלל מרכזי השבטים` });
      Bus.emit('roster:update-request', msg);
      return msg;
    }
    return { gdud, layer, broadcastUpdateRequest };
  })();

  // ---------- Global force-logout on user purge ----------
  // When the national super-admin purges users, every connected tab whose
  // logged-in user no longer exists is bounced back to the login screen.
  Bus.on('auth:purge', () => {
    if (!ScoutDB.get('loggedIn', false)) return;
    const u = ScoutDB.get('loginUser', null);
    const creds = ScoutDB.get('credentials', {}) || {};
    if (u && !creds[u]) {
      ScoutDB.set('loggedIn', false);
      ScoutDB.remove('currentPersona');
      ScoutDB.remove('loginUser');
      // Avoid redirect loop on the login page itself
      if (!/index\.html$|\/$/.test(global.location.pathname)) {
        global.location.replace('index.html');
      }
    }
  });

  // ---------- Export ----------

  global.Scout = {
    ScoutDB, Bus, Audio, DMS, SOS, Geo, Toast, Modal, UI, Auth, Drone, Chat, Personnel,
    Gate, Checkout, ParentPickup, Incidents, HQPermissions, Roster, Debrief,
    Forests, RoleProvisioning,
    util: { uuid, nowMs, fmtTime, fmtDate, pick, clamp, escapeHtml, getParam },
    FORESTS,
  };

})(window);
