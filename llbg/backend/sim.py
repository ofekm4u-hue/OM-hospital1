"""
sim.py — Aviation physics engine + world state for the LLBG ATC simulator.

All positions are kept in nautical miles (NM) on a screen-style frame centred on
Ben Gurion airport:  +x = East,  +y = South.  Updated once per simulated second.
"""
from __future__ import annotations
import math
import random
import itertools
from dataclasses import dataclass, field, asdict
from typing import Optional

# ── constants ───────────────────────────────────────────────────────────────
TURN_RATE = 3.0            # degrees / second (standard rate)
AIRSPACE_NM = 40.0
ILS_RANGE_NM = 15.0
GS_FT_PER_NM = 318.0       # 3° glideslope
DECISION_HEIGHT = 200      # ft — no automatic landing below this
SEP_HORIZ_NM = 3.0
SEP_VERT_FT = 1000

# performance per weight category — values are PER 1-SECOND TICK
PERF = {
    "heavy":  dict(climb=25, desc=25, max_spd=290, min_spd=150, spd_rate=2, wake="H"),
    "medium": dict(climb=41, desc=30, max_spd=280, min_spd=140, spd_rate=2, wake="M"),
    "light":  dict(climb=11, desc=8,  max_spd=120, min_spd=70,  spd_rate=4, wake="L"),
}

# ── geometry helpers ────────────────────────────────────────────────────────
def norm360(h: float) -> float: return h % 360.0
def norm180(d: float) -> float: return (d + 180.0) % 360.0 - 180.0
def clamp(v, lo, hi): return max(lo, min(hi, v))
def vec(h: float, length: float): return (math.sin(math.radians(h)) * length,
                                          -math.cos(math.radians(h)) * length)
def brg_pos(brg: float, d: float): return vec(brg, d)
def hdg_to(dx, dy): return norm360(math.degrees(math.atan2(dx, -dy)))
def dist(a, b): return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


# ── Ben Gurion (LLBG) runways ───────────────────────────────────────────────
def _build_runways():
    half = 1.3  # half length NM (~ runway 12/30 is ~3.6 km)

    def mk(rid, course, cy, axis):
        dx, dy = vec(axis, 1.0)
        cx, cyy = 0.0, cy
        thr = {"x": cx + dx * half, "y": cyy + dy * half}
        fdx, fdy = (-math.sin(math.radians(course)), math.cos(math.radians(course)))
        return dict(id=rid, course=course, thr=thr, feather=(fdx, fdy),
                    center={"x": cx, "y": cyy}, axis=axis, half=half)

    return [
        mk("30", 300, -0.5, 120), mk("12", 120, -0.5, 300),   # runway 12/30
        mk("26", 260,  0.6,  80), mk("08",  80,  0.6, 260),   # runway 08/26
    ]

RUNWAYS = _build_runways()
def get_rwy(rid): return next((r for r in RUNWAYS if r["id"] == rid), None)
ACTIVE_RWYS = ["30", "26"]   # landing/departing direction for the scenario

# real LLBG reporting points (schematic bearings on the boundary)
WAYPOINTS = [
    dict(name="SUGGI", brg=200), dict(name="SOLIN", brg=320),
    dict(name="VELOX", brg=90),  dict(name="PASAL", brg=150),
]

# ── aircraft profile pools (Hebrew) ─────────────────────────────────────────
ARR_PROFILES = [
    ("אל על 001", "B777", "heavy",  "ניו יורק JFK"),
    ("אל על 008", "B789", "heavy",  "בנגקוק"),
    ("ישראייר 211", "A320", "medium", "אילת"),
    ("ארקיע 162", "AT75", "medium", "אילת"),
    ("ויזאייר 1842", "A321", "medium", "בודפשט"),
    ("טוס 154", "A20N", "medium", "איסטנבול"),
]
DEP_PROFILES = [
    ("ארקיע 803", "E195", "medium", "רודוס"),
    ("אל על 385", "B788", "heavy",  "הונג קונג"),
    ("ישראייר 517", "A320", "medium", "לרנקה"),
    ("נובל 4XCAB", "C172", "light",  "הרצליה"),
    ("בלולין 692", "BCS3", "medium", "אתונה"),
]


@dataclass
class Aircraft:
    id: int
    callsign: str
    type: str
    cat: str
    wake: str
    flight: str                 # 'arrival' | 'departure'
    origin: str
    dest: str
    x: float
    y: float
    alt: float
    spd: float
    hdg: float
    target_alt: float
    target_spd: float
    target_hdg: float
    status: str                 # enroute|localizer|goaround|holdshort|lineup|takeoff|climbout|departing|rollout|vacating|handoff
    forced_turn: Optional[str] = None
    cleared_ils: Optional[str] = None
    cleared_to_land: bool = False
    cleared_takeoff: bool = False
    cleared_lineup: bool = False
    assigned_runway: Optional[str] = None
    fuel: float = 9999
    low_fuel_called: bool = False
    conflict: bool = False
    conflict_timer: int = 0
    msaw: bool = False
    trail: list = field(default_factory=list)

    @property
    def perf(self): return PERF[self.cat]

    def profile_text(self) -> str:
        kind = "נחיתה" if self.flight == "arrival" else "המראה"
        route = f"מ{self.origin}" if self.flight == "arrival" else f"ל{self.dest}"
        return (f"{self.callsign}, מטוס מסוג {self.type} ({self.cat}), טיסת {kind} {route}. "
                f"גובה נוכחי {int(self.alt)} רגל, כיוון {int(self.hdg)}, מהירות {int(self.spd)} קשר.")

    def to_dict(self):
        d = asdict(self)
        d["alt"] = round(self.alt)
        d["spd"] = round(self.spd)
        d["hdg"] = round(self.hdg, 1)
        d["x"] = round(self.x, 4)
        d["y"] = round(self.y, 4)
        return d


class World:
    def __init__(self):
        self._ids = itertools.count(1)
        self.aircraft: list[Aircraft] = []
        self.tick = 0
        self.score = dict(arrivals=0, departures=0, infractions=0,
                          violations=0, reputation=100)
        self.events: list[dict] = []        # comm / alert events produced this tick
        # seed traffic
        self.spawn_arrival(); self.spawn_arrival(); self.spawn_departure()

    # ── spawning ────────────────────────────────────────────────────────────
    def spawn_arrival(self):
        wp = random.choice(WAYPOINTS)
        cs, typ, cat, origin = random.choice(ARR_PROFILES)
        x, y = brg_pos(wp["brg"], AIRSPACE_NM - 2)
        ac = Aircraft(
            id=next(self._ids), callsign=cs, type=typ, cat=cat, wake=PERF[cat]["wake"],
            flight="arrival", origin=origin, dest="נתב\"ג",
            x=x, y=y, alt=11000, spd=250, hdg=hdg_to(-x, -y),
            target_alt=11000, target_spd=250, target_hdg=hdg_to(-x, -y),
            status="enroute", fuel=random.randint(320, 520),
        )
        self.aircraft.append(ac)
        self._emit("system", None, f"{cs} בכניסה דרך {wp['name']}, גובה 11,000.")
        return ac

    def spawn_departure(self):
        rwy = get_rwy(random.choice(ACTIVE_RWYS))
        cs, typ, cat, dest = random.choice(DEP_PROFILES)
        ac = Aircraft(
            id=next(self._ids), callsign=cs, type=typ, cat=cat, wake=PERF[cat]["wake"],
            flight="departure", origin="נתב\"ג", dest=dest,
            x=rwy["thr"]["x"], y=rwy["thr"]["y"], alt=0, spd=0, hdg=rwy["course"],
            target_alt=0, target_spd=0, target_hdg=rwy["course"],
            status="holdshort", assigned_runway=rwy["id"], fuel=9999,
        )
        self.aircraft.append(ac)
        self._emit("system", None, f"{cs} ממתין לפני מסלול {rwy['id']}, מוכן להמראה ל{dest}.")
        return ac

    def maybe_spawn(self):
        if len(self.aircraft) >= 8:
            return
        arr = sum(1 for a in self.aircraft if a.flight == "arrival")
        dep = sum(1 for a in self.aircraft if a.flight == "departure")
        if arr <= dep:
            self.spawn_arrival()
        else:
            self.spawn_departure()

    # ── events ────────────────────────────────────────────────────────────────
    def _emit(self, who, callsign, text, kind="comm"):
        self.events.append(dict(who=who, callsign=callsign, text=text, kind=kind,
                                tick=self.tick))

    def find(self, ac_id=None, callsign=None) -> Optional[Aircraft]:
        for a in self.aircraft:
            if ac_id is not None and a.id == ac_id:
                return a
        if callsign:
            cl = callsign.strip()
            for a in self.aircraft:
                if a.callsign == cl or cl in a.callsign:
                    return a
            # match on the numeric part (e.g. "001")
            num = "".join(ch for ch in cl if ch.isdigit())
            if num:
                for a in self.aircraft:
                    if num and num in a.callsign:
                        return a
        return None

    # ── apply structured commands coming back from the AI pilot ──────────────
    def apply_commands(self, ac: Aircraft, cmd: dict):
        if cmd.get("heading") is not None:
            ac.target_hdg = norm360(float(cmd["heading"]))
            td = cmd.get("turn_direction")
            ac.forced_turn = "L" if td == "left" else "R" if td == "right" else None
            if ac.status == "localizer":
                ac.status = "enroute"; ac.cleared_ils = None
        if cmd.get("altitude") is not None:
            ac.target_alt = float(cmd["altitude"])
        if cmd.get("speed") is not None:
            ac.target_spd = float(cmd["speed"])
        action = cmd.get("action")
        rwy = cmd.get("runway") or ac.assigned_runway or ACTIVE_RWYS[0]
        if action == "cleared_ils":
            ac.cleared_ils = rwy; ac.assigned_runway = rwy
        elif action == "cleared_to_land":
            ac.cleared_to_land = True
            if not ac.cleared_ils:
                ac.cleared_ils = rwy
        elif action == "go_around":
            self._go_around(ac, voice=False)
        elif action == "line_up":
            ac.cleared_lineup = True; ac.status = "lineup"
            r = get_rwy(ac.assigned_runway)
            ac.x, ac.y, ac.hdg = r["thr"]["x"], r["thr"]["y"], r["course"]
        elif action == "cleared_takeoff":
            ac.cleared_takeoff = True; ac.cleared_lineup = True; ac.status = "takeoff"
            ac.target_spd = 160; ac.target_alt = 5000
            r = get_rwy(ac.assigned_runway)
            ac.x, ac.y, ac.hdg = r["thr"]["x"], r["thr"]["y"], r["course"]
        elif action == "hold_short":
            ac.cleared_lineup = False; ac.cleared_takeoff = False
            if ac.status == "lineup":
                ac.status = "holdshort"
        elif action == "taxi":
            ac.status = "vacating"
        elif action == "handoff":
            ac.status = "handoff"

    def _go_around(self, ac: Aircraft, voice=True):
        ac.cleared_to_land = False; ac.cleared_ils = None
        ac.status = "goaround"; ac.target_alt = 3000; ac.target_spd = 200
        ac.forced_turn = None
        if voice:
            self._emit("pilot", ac.callsign, f"{ac.callsign}, אין אישור נחיתה, מבצע הליכה סביב!",
                       kind="alert")

    # ── physics for one aircraft ─────────────────────────────────────────────
    def _step_ac(self, ac: Aircraft):
        p = ac.perf
        # ground states wait for manual clearance
        if ac.status == "holdshort":
            ac.spd = 0; return None
        if ac.status == "lineup":
            ac.spd = 0
            if ac.cleared_takeoff:
                ac.status = "takeoff"
            return None

        # turn (standard rate, shortest unless forced)
        if ac.status != "localizer":
            diff = norm180(ac.target_hdg - ac.hdg)
            if ac.forced_turn:
                sgn = -1 if ac.forced_turn == "L" else 1
                if abs(diff) <= TURN_RATE:
                    ac.hdg = ac.target_hdg; ac.forced_turn = None
                else:
                    ac.hdg = norm360(ac.hdg + sgn * TURN_RATE)
            else:
                ac.hdg = ac.target_hdg if abs(diff) <= TURN_RATE \
                    else norm360(ac.hdg + (1 if diff > 0 else -1) * TURN_RATE)

        # speed inertia
        max_s = p["max_spd"]
        if ac.alt < 10000:
            max_s = min(max_s, 250)
        floor = 0 if ac.status in ("rollout", "vacating") else p["min_spd"]
        tgt = clamp(ac.target_spd, floor, max_s)
        d = tgt - ac.spd
        ac.spd = tgt if abs(d) <= p["spd_rate"] else ac.spd + (1 if d > 0 else -1) * p["spd_rate"]

        # altitude
        da = ac.target_alt - ac.alt
        if da > 0:
            ac.alt = min(ac.target_alt, ac.alt + p["climb"])
        elif da < 0:
            ac.alt = max(ac.target_alt, ac.alt - p["desc"])

        # ILS capture
        if ac.flight == "arrival" and ac.cleared_ils and ac.status not in ("localizer", "rollout"):
            r = get_rwy(ac.cleared_ils)
            rx, ry = ac.x - r["thr"]["x"], ac.y - r["thr"]["y"]
            fdx, fdy = r["feather"]
            along = rx * fdx + ry * fdy
            lat = rx * -fdy + ry * fdx
            inter = abs(norm180(ac.hdg - r["course"]))
            if 0.3 < along <= ILS_RANGE_NM and abs(lat) < 1.6 and inter < 30 and ac.alt <= 3000:
                ac.status = "localizer"; ac.forced_turn = None
                self._emit("pilot", ac.callsign, f"{ac.callsign} מיוצב על ה-ILS למסלול {r['id']}.")

        # localizer tracking + glideslope + MANUAL landing gate
        if ac.status == "localizer":
            r = get_rwy(ac.cleared_ils)
            rx, ry = ac.x - r["thr"]["x"], ac.y - r["thr"]["y"]
            fdx, fdy = r["feather"]
            along = rx * fdx + ry * fdy
            cx, cy = r["thr"]["x"] + fdx * max(along, 0), r["thr"]["y"] + fdy * max(along, 0)
            ac.x += (cx - ac.x) * 0.25; ac.y += (cy - ac.y) * 0.25
            ac.hdg = r["course"]; ac.target_hdg = r["course"]
            gs = max(0.0, along * GS_FT_PER_NM)
            ac.target_alt = min(ac.target_alt, gs); ac.alt = max(0.0, min(ac.alt, gs))
            ac.target_spd = max(p["min_spd"], 140)
            if ac.alt <= DECISION_HEIGHT + 5 and along < 0.9 and not ac.cleared_to_land:
                self._go_around(ac, voice=True)
                return None
            if along <= 0.12 and ac.alt <= 35 and ac.cleared_to_land:
                ac.status = "rollout"; ac.alt = 0; ac.target_spd = 0
                ac.x, ac.y = r["thr"]["x"], r["thr"]["y"]
                self._emit("pilot", ac.callsign, f"{ac.callsign} נחת, מפנה את המסלול.")
            return None

        if ac.status == "rollout":
            ac.spd = max(0, ac.spd - 6); return None
        if ac.status == "vacating":
            r = get_rwy(ac.assigned_runway or ac.cleared_ils)
            ac.spd = 15
            ox, oy = vec(norm360(r["course"] - 90), ac.spd / 3600)
            ac.x += ox; ac.y += oy
            if dist(ac.to_dict(), r["thr"]) > 0.4:
                return "arrived"
            return None

        # departure phases
        if ac.flight == "departure":
            if ac.status == "takeoff" and ac.spd >= 140:
                ac.status = "climbout"; ac.alt = max(ac.alt, 1)
            if ac.status == "climbout" and ac.alt >= 5000:
                ac.status = "departing"

        # position integration
        airborne = (ac.spd > 0 and ac.alt > 0) or ac.status in ("takeoff", "climbout")
        if airborne:
            nm = ac.spd / 3600.0
            ac.x += math.sin(math.radians(ac.hdg)) * nm
            ac.y += -math.cos(math.radians(ac.hdg)) * nm

        # trail (last 4 positions)
        ac.trail.append({"x": round(ac.x, 3), "y": round(ac.y, 3)})
        if len(ac.trail) > 4:
            ac.trail.pop(0)

        # MSAW (low altitude outside approach)
        on_app = ac.status == "localizer"
        dep_climb = ac.flight == "departure" and ac.status in ("takeoff", "climbout")
        was = ac.msaw
        ac.msaw = 60 < ac.alt < 2500 and not on_app and not dep_climb
        if ac.msaw and not was:
            self._emit("system", ac.callsign, f"MSAW — {ac.callsign}, בדוק גובה, מתחת לגובה מינימלי!",
                       kind="alert")

        # fuel
        if ac.flight == "arrival" and ac.fuel < 9000:
            ac.fuel -= 1
            if ac.fuel == 100 and not ac.low_fuel_called:
                ac.low_fuel_called = True
                self._emit("pilot", ac.callsign,
                           f"{ac.callsign}, מתחיל להיות נמוך בדלק, מבקש עדיפות לנחיתה.", kind="alert")
            if ac.fuel <= 0:
                return "fuelcrash"
        return None

    # ── one simulation tick ──────────────────────────────────────────────────
    def step(self):
        self.tick += 1
        self.events = []
        removals = []
        for ac in self.aircraft:
            res = self._step_ac(ac)
            if res == "arrived":
                removals.append(ac); self.score["arrivals"] += 1
            elif res == "fuelcrash":
                removals.append(ac); self.score["reputation"] = max(0, self.score["reputation"] - 25)
                self._emit("system", ac.callsign, f"{ac.callsign} אזל לו הדלק — אובדן הפרדה חמור!", kind="alert")
            if ac.status == "handoff":
                removals.append(ac); self.score["departures"] += 1
            if dist(ac.to_dict(), {"x": 0, "y": 0}) > AIRSPACE_NM + 8 and ac.alt > 0:
                if ac not in removals:
                    removals.append(ac)

        # runway occupancy collision
        occ = {}
        for ac in self.aircraft:
            on_rwy = ac.status in ("rollout", "lineup") or (ac.status == "takeoff" and ac.alt < 50)
            if on_rwy:
                occ.setdefault(ac.assigned_runway or ac.cleared_ils, []).append(ac)
        for rid, lst in occ.items():
            if len(lst) >= 2:
                self._emit("system", None,
                           f"התנגשות מסלול ב-{rid}: {' ו'.join(a.callsign for a in lst)}!", kind="alert")
                self.score["reputation"] = 0

        # separation + wake
        for ac in self.aircraft:
            ac.conflict = False
        for a, b in itertools.combinations(self.aircraft, 2):
            if a.alt < 60 or b.alt < 60:
                continue
            d = dist(a.to_dict(), b.to_dict())
            if d < SEP_HORIZ_NM and abs(a.alt - b.alt) < SEP_VERT_FT:
                a.conflict = b.conflict = True
        for ac in self.aircraft:
            if ac.conflict:
                ac.conflict_timer += 1
                if ac.conflict_timer == 5:
                    self.score["infractions"] += 1
                    self.score["reputation"] = max(0, round(self.score["reputation"] * 0.8))
                    self._emit("system", ac.callsign, f"חריגת הפרדה — {ac.callsign}!", kind="alert")
            else:
                ac.conflict_timer = 0

        for ac in removals:
            if ac in self.aircraft:
                self.aircraft.remove(ac)

        if self.tick % 15 == 0:
            self.maybe_spawn()
        return self.events

    def state(self):
        return dict(
            tick=self.tick,
            aircraft=[a.to_dict() for a in self.aircraft],
            score=self.score,
            runways=[dict(id=r["id"], course=r["course"], thr=r["thr"],
                          axis=r["axis"], half=r["half"]) for r in RUNWAYS],
            waypoints=[dict(name=w["name"],
                            pos=dict(zip(("x", "y"), brg_pos(w["brg"], AIRSPACE_NM - 2))))
                       for w in WAYPOINTS],
            active=ACTIVE_RWYS,
        )
