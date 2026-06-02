# TRACON — Approach Control Radar Simulator

A high-fidelity Terminal Radar Approach Control (TRACON) / ATC training
simulator built as a **single self-contained React component**
(`tracon/index.html`). No build step — React, Babel, Tailwind and Lucide all
load from CDNs, matching the rest of this repo.

## Run it

```bash
python3 -m http.server 8000
# then open http://localhost:8000/tracon/
```

Or just open `tracon/index.html` directly in a browser.

## What it does

A live KLAX approach-control scope. Sequence arrivals onto the ILS, launch and
climb departures out through the fixes, and keep everyone separated — all under
real aviation physics with an authentic pilot-readback radio loop.

### Module 1 — Physics engine (1-second tick)
- **Standard-rate turns** at 3°/sec, shortest direction unless forced
  (`090 → 270` takes exactly 60 s — verified).
- Per-type **climb/descent profiles** (jets 2500/1800 fpm, heavies 1500/1500,
  props 700/500) applied per tick.
- **Speed inertia**: 2 kt/s for jets & heavies, 4 kt/s for props, with the
  250 kt-below-10,000 ft cap and per-type min/max speeds.
- Position integrated trigonometrically in nautical miles
  (`Δx = V·sinθ·Δt`, `Δy = −V·cosθ·Δt`).

### Module 2 — Radar scope
Circular Eurocat-style scope (`#0a0f1d`), 40 NM range rings, compass spokes,
two runways (24R/06L, 25L/07R) with dashed 15 NM ILS feathers, four fixes
(`BASAL`, `LUCKY`, `SADDE`, `SEALB`), and full target data blocks (callsign +
type / `alt C assigned` / `speed wake`) with leader lines and 3-dot history
trails. Zoom and layer toggles included.

### Module 3 — Pilot/controller comms
Every clearance runs a **readback state machine**: ATC transmission → 2.5 s
pilot delay → pilot readback → *then* the aircraft targets update. The CLI
parses:

| Command | Meaning |
|---|---|
| `DAL422 H 270` (`… L`/`… R`) | Heading (optional forced turn direction) |
| `UAL88 A 030` | Altitude (hundreds of feet) |
| `AAL55 S 160` | Speed (knots) |
| `DAL422 C ILS 24R` | Cleared ILS approach |
| `DAL422 L` | Cleared to land |
| `SWA10 HO` | Handoff to center (departures) |
| `SWA10 TO` | Cleared for takeoff (ground op) |

A click-macro dashboard (turn L/R, heading/altitude/speed/ILS selectors,
land/takeoff/handoff) builds the same commands.

### Module 4 — Operations
Arrivals spawn at the fixes (12,000 ft / 240 kt); vector them to intercept the
localizer (< 30° intercept, ≤ 3,000 ft) and they auto-track the centerline and
3° glideslope. Departures run the gate → taxi → hold → takeoff → climbout flow,
then you vector and hand them off.

### Module 5 — Chaos engine
- **Loss of separation** (< 3 NM and < 1,000 ft): flashing red blocks; sustained
  5 s logs an infraction and drops reputation 20%.
- **Wake turbulence**: a M/L within 5 NM behind a Heavy on the ILS = instant
  game over.
- **Fuel**: hidden 300–500 s timer per arrival; priority call at 100 s, crash at 0.
- **Go-around** when reaching 500 ft over an occupied runway (or not cleared to land).

### Module 6 — UI
65% radar / 35% sidebar (scoreboard · interactive flight-strip bay · auto-scroll
radio log) with a bottom CLI + macro bar.

## Tech notes
Self-contained: React 18 UMD + Babel standalone (in-browser JSX), Tailwind Play
CDN, Lucide icons via a small SVG wrapper. The simulation runs on a robust
1-second `setInterval`; comms delays use precise `setTimeout`s.
