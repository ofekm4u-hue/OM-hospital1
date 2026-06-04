"""
main.py — FastAPI server for the LLBG (Ben Gurion) ATC simulator.

Responsibilities
  • Run the 1-second aviation physics loop (sim.World).
  • Stream live world state + comm/alert events to clients over a WebSocket.
  • Receive controller transmissions, hand them to the AI-pilot bridge (llm.py),
    apply the returned tactical commands, and broadcast the spoken readback.

Run:  uvicorn main:app --reload --port 8000
"""
from __future__ import annotations
import asyncio
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

import sim
import llm

world = sim.World()
clients: set[WebSocket] = set()
_loop_task: asyncio.Task | None = None


async def broadcast(message: dict):
    dead = []
    for ws in list(clients):
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        clients.discard(ws)


async def sim_loop():
    """Advance the world once per second and push state to every client."""
    while True:
        try:
            events = world.step()
            await broadcast({"type": "state", **world.state()})
            for ev in events:
                await broadcast({"type": "comm", **ev})
        except Exception as e:
            print(f"[sim_loop] error: {e}")
        await asyncio.sleep(1.0)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _loop_task
    _loop_task = asyncio.create_task(sim_loop())
    yield
    if _loop_task:
        _loop_task.cancel()


app = FastAPI(title="LLBG ATC Simulator", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


@app.get("/")
def health():
    provider = "offline"
    if os.getenv("OPENAI_API_KEY"):
        provider = "openai"
    elif os.getenv("ANTHROPIC_API_KEY"):
        provider = "anthropic"
    return {"status": "ok", "aircraft": len(world.aircraft), "llm": provider}


@app.post("/reset")
def reset():
    global world
    world = sim.World()
    return {"status": "reset"}


async def handle_transmission(text: str, target_id: int | None):
    """Resolve the addressed aircraft, query the AI pilot, apply commands."""
    ac = world.find(ac_id=target_id) if target_id else None
    if ac is None:
        ac = world.find(callsign=text)
    # echo the controller's transmission to the R/T log
    await broadcast({"type": "comm", "who": "atc",
                     "callsign": ac.callsign if ac else None,
                     "text": text, "kind": "comm", "tick": world.tick})
    if ac is None:
        await broadcast({"type": "comm", "who": "system", "callsign": None,
                         "text": "לא זוהה אות קריאה בתשדורת.", "kind": "alert", "tick": world.tick})
        return
    # the LLM call may block on network; run it off the event loop
    result = await asyncio.to_thread(llm.get_pilot_response, ac, world, text)
    world.apply_commands(ac, result["commands"])
    await broadcast({"type": "comm", "who": "pilot", "callsign": ac.callsign,
                     "text": result["radio"], "kind": "alert" if result["concern"] else "comm",
                     "tick": world.tick, "speak": True})


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    global world
    await ws.accept()
    clients.add(ws)
    # send an immediate snapshot so the scope paints right away
    await ws.send_json({"type": "state", **world.state()})
    try:
        while True:
            msg = await ws.receive_json()
            if msg.get("type") == "transmit":
                text = (msg.get("text") or "").strip()
                if text:
                    asyncio.create_task(handle_transmission(text, msg.get("target_id")))
            elif msg.get("type") == "reset":
                world = sim.World()
                await broadcast({"type": "state", **world.state()})
    except WebSocketDisconnect:
        clients.discard(ws)
    except Exception:
        clients.discard(ws)
