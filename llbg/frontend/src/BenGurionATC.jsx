/*
 * BenGurionATC.jsx — עמדת פקח מכ"ם גישה לנתב"ג (LLBG)
 * ---------------------------------------------------------------------------
 * קומפוננטת React מלאה: לולאת מכ"ם על Canvas, חיבור WebSocket לשרת הפייתון,
 * רצועות טיסה, יומן קשר VHF, וקשר קולי דו-כיווני (PTT + הקראת תשובות הטייס).
 */
import React, { useEffect, useRef, useState, useCallback } from "react";

const WS_URL =
  (typeof window !== "undefined" && window.__LLBG_WS__) || "ws://localhost:8000/ws";

const C = {
  bg: "#030712", grid: "#14532d", gridDim: "#0c3320", green: "#16a34a",
  greenHi: "#22c55e", target: "#34d399", txt: "#7f9e8c", txtDim: "#46604f",
  amber: "#d97706", red: "#dc2626", redHi: "#ef4444", white: "#e2e8f0", sky: "#38bdf8",
};
const RING_NM = [5, 10, 20, 40];
const AIRSPACE_NM = 40;
const ILS_RANGE_NM = 15;

const rad = (d) => (d * Math.PI) / 180;

/* ── radio static click (VHF squelch) ─────────────────────────────────────── */
let AC = null;
function ensureAudio() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  return AC;
}
function radioClick(dur = 0.09) {
  try {
    const ctx = ensureAudio();
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800;
    const g = ctx.createGain(); g.gain.value = 0.18;
    src.connect(bp); bp.connect(g); g.connect(ctx.destination);
    src.start();
  } catch (e) {}
}

/* ── Hebrew text-to-speech with radio squelch around it ───────────────────── */
function speakHebrew(text) {
  if (!("speechSynthesis" in window)) return;
  radioClick();
  setTimeout(() => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "he-IL"; u.rate = 1.06; u.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const hv = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("he"));
    if (hv) u.voice = hv;
    u.onend = () => radioClick(0.07);
    window.speechSynthesis.speak(u);
  }, 110);
}

export default function BenGurionATC() {
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const snapRef = useRef({ aircraft: [], runways: [], waypoints: [], active: [], score: {} });
  const snapTimeRef = useRef(performance.now());
  const sweepRef = useRef(0);
  const recRef = useRef(null);
  const pttRef = useRef(false);
  const logEndRef = useRef(null);

  const [, force] = useState(0);
  const [log, setLog] = useState([]);
  const [selected, setSelected] = useState(null);    // aircraft id
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [ptt, setPtt] = useState(false);
  const [score, setScore] = useState({ arrivals: 0, departures: 0, infractions: 0, reputation: 100 });

  const rerender = useCallback(() => force((n) => n + 1), []);

  /* ── WebSocket ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    let stop = false;
    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => { setConnected(false); if (!stop) setTimeout(connect, 1500); };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.type === "state") {
          snapRef.current = m; snapTimeRef.current = performance.now();
          if (m.score) setScore(m.score);
        } else if (m.type === "comm") {
          setLog((L) => {
            const n = [...L, m]; return n.length > 200 ? n.slice(-200) : n;
          });
          if (m.who === "pilot" && m.speak) speakHebrew(m.text);
          if (m.kind === "alert") radioClick(0.12);
        }
      };
    }
    connect();
    return () => { stop = true; wsRef.current && wsRef.current.close(); };
  }, []);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [log]);

  /* ── transmit a controller instruction ─────────────────────────────────── */
  const transmit = useCallback((text) => {
    const t = (text || "").trim(); if (!t) return;
    const ws = wsRef.current; if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: "transmit", text: t, target_id: selected }));
    radioClick(0.06);
    setInput("");
  }, [selected]);

  /* ── Push-To-Talk via Web Speech API (he-IL) ───────────────────────────── */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "he-IL"; rec.interimResults = true; rec.continuous = true;
    rec.onresult = (e) => {
      let s = "";
      for (let i = e.resultIndex; i < e.results.length; i++) s += e.results[i][0].transcript;
      setInput(s);
    };
    rec.onerror = () => {};
    recRef.current = rec;
    return () => { try { rec.stop(); } catch (e) {} };
  }, []);

  const startPTT = useCallback(() => {
    if (pttRef.current) return;
    pttRef.current = true; setPtt(true); ensureAudio(); radioClick(0.05);
    try { recRef.current && recRef.current.start(); } catch (e) {}
  }, []);
  const stopPTT = useCallback(() => {
    if (!pttRef.current) return;
    pttRef.current = false; setPtt(false);
    try { recRef.current && recRef.current.stop(); } catch (e) {}
    setInput((cur) => { if (cur.trim()) transmit(cur); return cur; });
  }, [transmit]);

  useEffect(() => {
    const down = (e) => {
      if (e.code === "Space" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault(); startPTT();
      }
    };
    const up = (e) => { if (e.code === "Space") { e.preventDefault(); stopPTT(); } };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [startPTT, stopPTT]);

  /* ── Canvas radar render loop (rAF + dead-reckoning between server ticks) ── */
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    let raf;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const r = cv.getBoundingClientRect();
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(cv);

    const draw = () => {
      const W = cv.clientWidth, H = cv.clientHeight;
      const cx = W / 2, cy = H / 2;
      const pxNM = (Math.min(W, H) / 2 * 0.92) / AIRSPACE_NM;
      const snap = snapRef.current;
      const dt = (performance.now() - snapTimeRef.current) / 1000;
      sweepRef.current = (sweepRef.current + 0.6) % 360;

      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.textBaseline = "middle";

      const toPx = (x, y) => [cx + x * pxNM, cy + y * pxNM];

      // range rings
      RING_NM.forEach((nm) => {
        ctx.beginPath(); ctx.arc(cx, cy, nm * pxNM, 0, 2 * Math.PI);
        ctx.strokeStyle = C.gridDim; ctx.lineWidth = 1; ctx.setLineDash([2, 7]); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = C.gridDim; ctx.fillText(`${nm} NM`, cx + 3, cy - nm * pxNM - 8);
      });

      // compass rose
      for (let a = 0; a < 360; a += 5) {
        const big = a % 30 === 0;
        const r0 = AIRSPACE_NM * pxNM, r1 = r0 - (big ? 14 : 7);
        ctx.beginPath();
        ctx.moveTo(cx + Math.sin(rad(a)) * r0, cy - Math.cos(rad(a)) * r0);
        ctx.lineTo(cx + Math.sin(rad(a)) * r1, cy - Math.cos(rad(a)) * r1);
        ctx.strokeStyle = big ? C.grid : C.gridDim; ctx.lineWidth = big ? 1 : 0.5; ctx.stroke();
        if (big) {
          ctx.fillStyle = C.grid; ctx.textAlign = "center";
          const rl = r0 - 26;
          ctx.fillText(String(a / 10).padStart(2, "0"),
            cx + Math.sin(rad(a)) * rl, cy - Math.cos(rad(a)) * rl);
          ctx.textAlign = "left";
        }
      }

      // sweep
      const sw = sweepRef.current;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(rad(sw)) * AIRSPACE_NM * pxNM, cy - Math.cos(rad(sw)) * AIRSPACE_NM * pxNM);
      ctx.strokeStyle = "rgba(34,197,94,0.10)"; ctx.lineWidth = 2; ctx.stroke();

      // runways + ILS feathers
      (snap.runways || []).forEach((r) => {
        const ax = Math.sin(rad(r.axis)), ay = -Math.cos(rad(r.axis));
        const [x1, y1] = toPx(r.center.x + ax * r.half, r.center.y + ay * r.half);
        const [x2, y2] = toPx(r.center.x - ax * r.half, r.center.y - ay * r.half);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 2.5; ctx.stroke();
        // feather
        const fdx = -Math.sin(rad(r.course)), fdy = Math.cos(rad(r.course));
        const act = (snap.active || []).includes(r.id);
        const [tx, ty] = toPx(r.thr.x, r.thr.y);
        const [fx, fy] = toPx(r.thr.x + fdx * ILS_RANGE_NM, r.thr.y + fdy * ILS_RANGE_NM);
        const px = -fdy, py = fdx, w = 1.2;
        const [e1x, e1y] = toPx(r.thr.x + fdx * ILS_RANGE_NM + px * w, r.thr.y + fdy * ILS_RANGE_NM + py * w);
        const [e2x, e2y] = toPx(r.thr.x + fdx * ILS_RANGE_NM - px * w, r.thr.y + fdy * ILS_RANGE_NM - py * w);
        ctx.strokeStyle = act ? C.green : C.gridDim; ctx.lineWidth = 0.8; ctx.setLineDash([3, 5]);
        [[fx, fy], [e1x, e1y], [e2x, e2y]].forEach(([ex, ey]) => {
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(ex, ey); ctx.stroke();
        });
        ctx.setLineDash([]);
        ctx.fillStyle = act ? C.green : C.gridDim; ctx.fillText(r.id, fx + 4, fy);
      });

      // waypoints
      (snap.waypoints || []).forEach((w) => {
        const [x, y] = toPx(w.pos.x, w.pos.y);
        ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 5, y); ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = C.green; ctx.fillText(w.name, x + 8, y);
      });

      // airport centre
      ctx.fillStyle = "#cbd5e1"; ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, 2 * Math.PI); ctx.fill();

      // aircraft
      (snap.aircraft || []).forEach((p) => {
        const ground = ["holdshort", "lineup", "rollout", "vacating"].includes(p.status);
        // dead-reckon for smooth motion
        let dx = p.x, dy = p.y;
        if (!ground && p.spd > 0 && p.alt > 0) {
          const nm = (p.spd / 3600) * dt;
          dx += Math.sin(rad(p.hdg)) * nm; dy += -Math.cos(rad(p.hdg)) * nm;
        }
        const [sx, sy] = toPx(dx, dy);
        const alert = p.msaw || p.conflict || (p.low_fuel_called && p.fuel < 100);
        const blink = alert && Math.floor(performance.now() / 400) % 2 === 0;
        let col = p.flight === "arrival" ? C.sky : C.greenHi;
        if (p.status === "localizer") col = C.greenHi;
        if (p.status === "goaround") col = C.amber;
        if (ground) col = "#a3b3bf";
        if (alert) col = blink ? C.redHi : "#fca5a5";

        // phosphor trail
        if (!ground && p.trail) p.trail.forEach((t, i) => {
          const [tx, ty] = toPx(t.x, t.y);
          ctx.fillStyle = col; ctx.globalAlpha = 0.12 + i * 0.13;
          ctx.beginPath(); ctx.arc(tx, ty, 1.7 - i * 0.18, 0, 2 * Math.PI); ctx.fill();
        });
        ctx.globalAlpha = 1;

        // 1-minute velocity vector
        if (!ground && p.spd > 30) {
          const vl = (p.spd / 60) * pxNM;
          ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath();
          ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.sin(rad(p.hdg)) * vl, sy - Math.cos(rad(p.hdg)) * vl);
          ctx.stroke();
        }

        // selection brackets
        if (selected === p.id) {
          ctx.strokeStyle = C.white; ctx.lineWidth = 1;
          ctx.strokeRect(sx - 9, sy - 9, 18, 18);
        }

        // target crosshair
        ctx.strokeStyle = col; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(sx - 4, sy); ctx.lineTo(sx + 4, sy);
        ctx.moveTo(sx, sy - 4); ctx.lineTo(sx, sy + 4); ctx.stroke();
        if (ground) { ctx.fillStyle = col; ctx.fillRect(sx - 2.5, sy - 2.5, 5, 5); }

        // data block
        const cur = String(Math.round(p.alt / 100)).padStart(3, "0");
        const asn = String(Math.round(p.target_alt / 100)).padStart(3, "0");
        const tr = p.target_alt > p.alt + 20 ? "↑" : p.target_alt < p.alt - 20 ? "↓" : "→";
        ctx.fillStyle = col;
        const bx = sx + 10, by = sy - 26;
        ctx.fillText(p.callsign, bx, by);
        ctx.fillText(`${cur} ${tr} ${asn}`, bx, by + 12);
        ctx.fillText(`${String(Math.round(p.spd / 10)).padStart(2, "0")} ${p.type} ${p.wake}`, bx, by + 24);
        if (p.msaw) { ctx.fillStyle = C.redHi; ctx.fillText("LOW ALT / MSAW", bx, by + 36); }
        else if (p.status === "rollout") { ctx.fillStyle = C.amber; ctx.fillText("מסלול תפוס", bx, by + 36); }
      });

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [selected]);

  /* click to select an aircraft on the scope */
  const onCanvasClick = (e) => {
    const cv = canvasRef.current; const r = cv.getBoundingClientRect();
    const W = r.width, H = r.height, cx = W / 2, cy = H / 2;
    const pxNM = (Math.min(W, H) / 2 * 0.92) / AIRSPACE_NM;
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = null, bestD = 22;
    (snapRef.current.aircraft || []).forEach((p) => {
      const sx = cx + p.x * pxNM, sy = cy + p.y * pxNM;
      const d = Math.hypot(mx - sx, my - sy);
      if (d < bestD) { bestD = d; best = p; }
    });
    if (best) { setSelected(best.id); setInput((s) => (s ? s : best.callsign + " ")); }
  };

  const planes = snapRef.current.aircraft || [];
  const sel = planes.find((p) => p.id === selected);

  /* ── UI ────────────────────────────────────────────────────────────────── */
  return (
    <div dir="rtl" className="h-full w-full flex flex-col"
      style={{ background: C.bg, color: C.txt, fontFamily: "'Heebo','JetBrains Mono',monospace", fontSize: 13 }}>
      {/* top status */}
      <header className="flex items-center gap-3 px-3 py-1.5 border-b" style={{ borderColor: "#0c2118", background: "#05090f" }}>
        <span className="font-bold tracking-widest" style={{ color: C.greenHi }}>נתב"ג · מכ"ם גישה</span>
        <span style={{ color: C.txtDim }}>LLBG · TWR/APP</span>
        <span style={{ color: C.green }}>תדר 118.1</span>
        <span className="mr-auto flex items-center gap-3 text-[12px]">
          <span>מסלול פעיל <b style={{ color: C.greenHi }}>{(snapRef.current.active || []).join(" / ")}</b></span>
          <span style={{ color: connected ? C.greenHi : C.red }}>{connected ? "● מקוון" : "○ מנותק"}</span>
        </span>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* radar */}
        <div className="relative" style={{ width: "66%" }}>
          <canvas ref={canvasRef} onClick={onCanvasClick} className="w-full h-full block" style={{ cursor: "crosshair" }} />
          <div className="absolute bottom-2 right-3 text-[11px]" style={{ color: C.txtDim }}>
            טווח {AIRSPACE_NM} מייל ימי · {planes.length} מטרות
          </div>
          {ptt && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 border text-[12px] flash"
              style={{ borderColor: C.red, color: C.redHi, background: "#1a0606" }}>● משדר… (PTT)</div>
          )}
        </div>

        {/* sidebar */}
        <aside className="flex flex-col border-r min-w-0" style={{ width: "34%", borderColor: "#0c2118", background: "#05090f" }}>
          <div className="grid grid-cols-4 text-center border-b" style={{ borderColor: "#0c2118" }}>
            <Stat label="נחיתות" v={score.arrivals} c={C.sky} />
            <Stat label="המראות" v={score.departures} c={C.greenHi} />
            <Stat label="חריגות" v={score.infractions} c={C.red} />
            <Stat label="מדד בטיחות" v={score.reputation + "%"} c={score.reputation > 60 ? C.greenHi : C.amber} />
          </div>

          <div className="flex-1 min-h-0 flex flex-col border-b" style={{ borderColor: "#0c2118" }}>
            <Title text="רצועות טיסה" />
            <div className="flex-1 overflow-y-auto">
              {planes.length === 0 && <div className="p-2 text-[12px]" style={{ color: C.txtDim }}>אין תנועה</div>}
              {planes.map((p) => <Strip key={p.id} p={p} selected={selected === p.id}
                onClick={() => { setSelected(p.id); setInput(p.callsign + " "); }} />)}
            </div>
          </div>

          <div className="h-[34%] min-h-[140px] flex flex-col">
            <Title text="יומן קשר · תדר 118.1" />
            <div className="flex-1 overflow-y-auto px-2 py-1 text-[12px] leading-tight">
              {log.map((e, i) => (
                <div key={i} style={{ background: e.kind === "alert" ? "#1a0606" : "transparent" }}>
                  <span style={{ color: e.who === "atc" ? C.white : e.who === "pilot" ? C.greenHi
                    : e.kind === "alert" ? C.redHi : C.txtDim }}>
                    {e.who === "atc" ? "פקח" : e.who === "pilot" ? (e.callsign || "טייס") : "מערכת"}:
                  </span>{" "}
                  <span style={{ color: e.kind === "alert" ? "#fecaca" : C.txt }}>{e.text}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </aside>
      </div>

      {/* comms input + quick phrases */}
      <footer className="border-t px-2 py-1.5" style={{ borderColor: "#0c2118", background: "#05090f" }}>
        <div className="flex items-center gap-2">
          <button onMouseDown={startPTT} onMouseUp={stopPTT} onMouseLeave={stopPTT}
            className="px-3 py-1 border text-[12px]"
            style={{ borderColor: ptt ? C.red : C.grid, color: ptt ? C.redHi : C.greenHi, background: "#04130c" }}>
            🎙 דבר (רווח)
          </button>
          <span style={{ color: C.green }}>{sel ? sel.callsign : "בחר מטוס"} »</span>
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") transmit(input); }}
            placeholder='לדוגמה: "אל על 001, פנה ימינה לכיוון 280, רד וייצב 3,000"'
            className="flex-1 px-2 py-1 outline-none border text-[13px]"
            style={{ background: "#02060c", color: C.greenHi, borderColor: C.grid }} />
          <button onClick={() => transmit(input)} className="px-3 py-1 border text-[12px]"
            style={{ borderColor: C.grid, color: C.greenHi, background: "#04130c" }}>שדר</button>
        </div>
        <div className="mt-1 flex flex-wrap gap-1 text-[11px]" style={{ color: C.txtDim }}>
          {["רד וייצב 3,000", "פנה ימינה לכיוון 280", "מאושר לגישת ILS מסלול 30 מהירות 180",
            "רשאי לנחות מסלול 30", "היערך והמתן מסלול 26", "רשאי להמריא מסלול 26",
            "בצע הליכה סביב", "הסע לשער"].map((q) => (
            <button key={q} onClick={() => sel && transmit(`${sel.callsign} ${q}`)}
              className="px-1.5 py-0.5 border" style={{ borderColor: "#0c2118", color: C.txt }}>{q}</button>
          ))}
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, v, c }) {
  return (
    <div className="py-1 border-l last:border-l-0" style={{ borderColor: "#0c2118" }}>
      <div className="text-base font-bold" style={{ color: c }}>{v}</div>
      <div className="text-[10px]" style={{ color: C.txtDim }}>{label}</div>
    </div>
  );
}
function Title({ text }) {
  return <div className="px-2 py-1 border-b text-[11px] tracking-widest"
    style={{ borderColor: "#0c2118", color: C.green, background: "#040a08" }}>{text}</div>;
}
function Strip({ p, selected, onClick }) {
  const arr = p.flight === "arrival";
  const alert = p.msaw || p.conflict || p.low_fuel_called || p.status === "goaround";
  const accent = alert ? C.red : arr ? "#0ea5e9" : "#22c55e";
  const cur = String(Math.round(p.alt / 100)).padStart(3, "0");
  const asn = String(Math.round(p.target_alt / 100)).padStart(3, "0");
  const statusHe = {
    enroute: "בדרך", localizer: "על ה-ILS", goaround: "הליכה סביב", holdshort: "ממתין לפני מסלול",
    lineup: "נערך במסלול", takeoff: "המראה", climbout: "טיפוס", departing: "יוצא", rollout: "נחת",
    vacating: "מפנה מסלול", handoff: "מסירה",
  }[p.status] || p.status;
  return (
    <div onClick={onClick} className="px-2 py-1 border-b cursor-pointer"
      style={{ borderColor: "#0c2118", borderRight: `3px solid ${selected ? "#e2e8f0" : accent}`,
        background: alert ? "#1a0606" : selected ? "#08130e" : "#04090e" }}>
      <div className="flex justify-between">
        <span className="font-bold" style={{ color: alert ? C.redHi : C.white }}>{p.callsign}</span>
        <span className="text-[11px]" style={{ color: C.txtDim }}>{p.type} {p.wake} · {arr ? p.origin : p.dest}</span>
      </div>
      <div className="flex justify-between text-[11px]" style={{ color: C.txt }}>
        <span>{cur}{p.target_alt > p.alt + 20 ? "↑" : p.target_alt < p.alt - 20 ? "↓" : "→"}{asn}</span>
        <span>{Math.round(p.spd)} קשר</span>
        <span>{String(Math.round(p.hdg)).padStart(3, "0")}°</span>
        <span style={{ color: C.amber }}>{statusHe}</span>
      </div>
    </div>
  );
}
