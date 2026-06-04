"""
llm.py — the AI-pilot roleplay bridge.

Given a controller transmission and an aircraft's live state, ask an LLM (OpenAI
or Anthropic) to roleplay an Israeli airline pilot. The model returns STRICT JSON
with two parts:
  • "radio"    – the spoken Hebrew radio readback (for text-to-speech)
  • "commands" – a structured tactical command the backend applies to the aircraft

If no API key is configured the module falls back to a deterministic, rule-based
Hebrew pilot so the whole simulator still runs offline.
"""
from __future__ import annotations
import os
import re
import json
from typing import Optional

PROVIDER = os.getenv("LLM_PROVIDER", "auto").lower()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest")

SYSTEM_PROMPT = """אתה טייס ישראלי מנוסה בתעופה אזרחית, הטס במרחב הפיקוח של נמל התעופה בן גוריון (נתב"ג).
עליך לענות אך ורק בנדב"ר (נוהל דיבור ברדיו) מקצועי ורציני בעברית תעופתית, קצר ומדויק כמו בקשר רדיו אמיתי.
עליך לנתח אם פקודת הפקח בטוחה וברת-ביצוע. אם הפקח שכח לתת אישור נחיתה לפני המסלול, מפנה אותך לכיוון
מסוכן או לשטח גבוה, או מבקש משהו בלתי אפשרי — עליך להגיב בריאליסטיות, להביע חשש בקשר, ובמקרה הצורך
לבצע הליכה סביב (Go-Around) עצמאית.

החזר אך ורק אובייקט JSON תקין יחיד, ללא טקסט נוסף ובלי גדרות קוד, במבנה הבא:
{
  "radio": "<מחרוזת התשובה הקולית בעברית>",
  "concern": <true אם אתה מביע חשש/מסרב, אחרת false>,
  "commands": {
    "heading": <מעלות 1-360 או null>,
    "turn_direction": <"left" / "right" / null>,
    "altitude": <גובה ברגל או null>,
    "speed": <מהירות בקשר או null>,
    "action": <"cleared_ils" / "cleared_to_land" / "go_around" / "line_up" /
               "cleared_takeoff" / "hold_short" / "taxi" / "handoff" / "none">,
    "runway": <"30"/"26"/"12"/"08" או null>
  }
}
שדות שאינם רלוונטיים לפקודה הנוכחית יקבלו null (או "none" עבור action).
ה-"radio" חייב לכלול את אות הקריאה שלך ולשקף בדיוק את מה שתבצע."""


def _context(ac, world) -> str:
    nearby = []
    for o in world.aircraft:
        if o.id == ac.id:
            continue
        from sim import dist
        dd = dist(ac.to_dict(), o.to_dict())
        if dd < 8:
            nearby.append(f"{o.callsign} במרחק {dd:.1f} מייל בגובה {int(o.alt)}")
    rng = f"{(ac.x**2 + ac.y**2) ** 0.5:.1f}"
    return (
        f"מצב המטוס שלך כעת:\n{ac.profile_text()}\n"
        f"מרחק משדה התעופה: {rng} מייל ימי. גובה מוקצה: {int(ac.target_alt)}. "
        f"כיוון מוקצה: {int(ac.target_hdg)}. מהירות מוקצית: {int(ac.target_spd)}.\n"
        f"אישור ILS: {ac.cleared_ils or 'אין'}. אישור נחיתה: {'כן' if ac.cleared_to_land else 'לא'}. "
        f"מסלול פעיל: {', '.join(world_active(world))}.\n"
        f"דלק שנותר (שניות): {int(ac.fuel) if ac.fuel < 9000 else 'תקין'}.\n"
        + ("תנועה סמוכה: " + "; ".join(nearby) if nearby else "אין תנועה סמוכה מיידית.")
    )


def world_active(world):
    from sim import ACTIVE_RWYS
    return ACTIVE_RWYS


def _extract_json(text: str) -> Optional[dict]:
    if not text:
        return None
    # strip code fences if present
    text = re.sub(r"```(?:json)?", "", text).strip()
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


# ── provider calls ──────────────────────────────────────────────────────────
def _has_openai():  return bool(os.getenv("OPENAI_API_KEY"))
def _has_anthropic(): return bool(os.getenv("ANTHROPIC_API_KEY"))


def _call_openai(system, user):
    from openai import OpenAI
    client = OpenAI()
    resp = client.chat.completions.create(
        model=OPENAI_MODEL,
        temperature=0.6,
        response_format={"type": "json_object"},
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": user}],
    )
    return resp.choices[0].message.content


def _call_anthropic(system, user):
    import anthropic
    client = anthropic.Anthropic()
    resp = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=400,
        temperature=0.6,
        system=system,
        messages=[{"role": "user", "content": user + "\n\nהחזר JSON תקין בלבד."}],
    )
    return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")


def get_pilot_response(ac, world, controller_text: str) -> dict:
    """Returns {'radio': str, 'commands': dict, 'concern': bool}."""
    user = f"{_context(ac, world)}\n\nהפקח אומר לך: \"{controller_text}\"\nהשב כעת."
    raw = None
    try:
        use = PROVIDER
        if use == "auto":
            use = "openai" if _has_openai() else "anthropic" if _has_anthropic() else "offline"
        if use == "openai" and _has_openai():
            raw = _call_openai(SYSTEM_PROMPT, user)
        elif use == "anthropic" and _has_anthropic():
            raw = _call_anthropic(SYSTEM_PROMPT, user)
    except Exception as e:  # network / auth / quota -> graceful fallback
        raw = None
        print(f"[llm] provider error, using offline pilot: {e}")

    data = _extract_json(raw) if raw else None
    if not data:
        return offline_pilot(ac, controller_text)

    cmds = data.get("commands") or {}
    return dict(
        radio=str(data.get("radio") or f"{ac.callsign}").strip(),
        concern=bool(data.get("concern", False)),
        commands={
            "heading": _num(cmds.get("heading")),
            "turn_direction": cmds.get("turn_direction") if cmds.get("turn_direction") in ("left", "right") else None,
            "altitude": _num(cmds.get("altitude")),
            "speed": _num(cmds.get("speed")),
            "action": cmds.get("action") or "none",
            "runway": cmds.get("runway"),
        },
    )


def _num(v):
    try:
        return None if v is None else float(v)
    except Exception:
        return None


# ── OFFLINE rule-based Hebrew pilot (no API key needed) ──────────────────────
HEB_RWY = {"30": "30", "26": "26", "12": "12", "08": "08", "8": "08"}

def offline_pilot(ac, text: str) -> dict:
    t = text.strip()
    # remove the callsign so its digits (e.g. "001") don't pollute number parsing
    low = t.replace(ac.callsign, " ").replace("־", " ")
    digits_in_cs = "".join(ch for ch in ac.callsign if ch.isdigit())
    if digits_in_cs:
        low = low.replace(digits_in_cs, " ")
    cmds = {"heading": None, "turn_direction": None, "altitude": None,
            "speed": None, "action": "none", "runway": None}
    say = []

    nums = [int(n) for n in re.findall(r"\d{2,5}", low)]
    rwy_m = re.search(r"מסלול\s*(30|26|12|08|8)", low)
    rwy = HEB_RWY.get(rwy_m.group(1)) if rwy_m else None

    def has(*words): return any(w in low for w in words)

    if has("הליכה סביב", "גו אראונד", "go around"):
        cmds["action"] = "go_around"; say.append("מבצע הליכה סביב")
    elif has("רשאי לנחות", "אשר נחיתה", "אישור נחיתה", "רשאי נחיתה"):
        cmds["action"] = "cleared_to_land"; cmds["runway"] = rwy
        say.append(f"רשאי לנחות מסלול {rwy or ac.assigned_runway or ''}".strip())
    elif has("רשאי להמריא", "אשר המראה", "המראה"):
        cmds["action"] = "cleared_takeoff"; cmds["runway"] = rwy or ac.assigned_runway
        say.append(f"רשאי להמריא מסלול {rwy or ac.assigned_runway or ''}".strip())
    elif has("היערך והמתן", "קו והמתן", "היכון והמתן"):
        cmds["action"] = "line_up"; say.append("נערך והמתן")
    elif has("המתן לפני", "עצור לפני", "המתן בנקודת"):
        cmds["action"] = "hold_short"; say.append("ממתין לפני המסלול")
    elif has("הסע", "פנה לשער", "פנה את המסלול", "טקסי", "נסיעה לשער"):
        cmds["action"] = "taxi"; say.append("מפנה את המסלול ונוסע לשער")
    elif has("עבור לתדר", "צור קשר עם מרכז", "הנדאוף", "להתראות"):
        cmds["action"] = "handoff"; say.append("עובר תדר, להתראות")
    elif has("גישה", "ils", "אי אל אס"):
        cmds["action"] = "cleared_ils"; cmds["runway"] = rwy or ac.assigned_runway
        if has("מהירות", "קשר") and nums:
            cmds["speed"] = max(n for n in nums)
        say.append(f"מאושר לגישת ILS מסלול {rwy or ac.assigned_runway or ''}".strip())

    if has("ימינה"): cmds["turn_direction"] = "right"
    if has("שמאלה"): cmds["turn_direction"] = "left"
    if has("כיוון", "פנה", "הדינג") and nums:
        h = next((n for n in nums if 1 <= n <= 360), None)
        if h is not None:
            cmds["heading"] = h
            say.append(f"פונה לכיוון {h:03d}")
    if has("טפס", "עלה") and nums:
        a = max(nums); cmds["altitude"] = a if a >= 1000 else a * 100
        say.append(f"מטפס ל-{int(cmds['altitude'])} רגל")
    elif has("רד", "הנמך", "הנמכה") and nums:
        a = max(nums); cmds["altitude"] = a if a >= 1000 else a * 100
        say.append(f"יורד ל-{int(cmds['altitude'])} רגל")
    elif has("גובה", "רגל") and nums:
        a = max(nums); cmds["altitude"] = a if a >= 1000 else a * 100
        say.append(f"גובה {int(cmds['altitude'])} רגל")
    if has("מהירות", "קשר", "האט", "הגדל מהירות") and nums and cmds["speed"] is None:
        s = next((n for n in nums if 70 <= n <= 360), None)
        if s is not None:
            cmds["speed"] = s; say.append(f"מהירות {s} קשר")

    radio = (", ".join(say) + f", {ac.callsign}") if say else f"{ac.callsign}, לא הבנתי, חזור בבקשה."
    concern = not say
    return dict(radio=radio, concern=concern, commands=cmds)
