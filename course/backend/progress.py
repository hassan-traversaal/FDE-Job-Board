"""Each learner's progress, tied to their account.

The pages never talk to the store directly. They call this app:

    GET /api/progress           -> {"enabled": true, "sessions": {"s1": {...}, ...}}
    PUT /api/progress  {"sessions": {"s2": {...}}}   merged with what is stored

and the user is whoever the verified sign-in says they are (auth.user_id).
One session's record, as the browser keeps it:

    {"t": 754000,              last position, ms
     "at": 1759332000000,      when it was last watched, ms
     "m": 1759332100000,       when a chapter was last ticked or unticked, ms
     "ch": {"3": 0.62},        how far into each chapter, 0..1
     "done": {"3": true}}      chapters marked done (false = unticked by hand)

STORE. Today: the Clerk user's private metadata, under "academy" (server
side only, never sent to the browser by Clerk, no database to run). Clerk
caps metadata at a few KB, so it is stored compactly (seconds, whole
percents) and checked for size. To move to a database, or off Clerk to plain
OAuth, replace ClerkStore with anything that has get(user_id) / put(user_id,
data): the API, the merge and the browser side stay exactly as they are.

MERGE (here and in assets/js/academy.js, the same rules): how far into a
chapter is the furthest any device got; the resume point comes from the
record watched most recently; chapter marks come from the record ticked most
recently, keeping older marks for chapters it never touched. Two devices can
only ever add progress, except a hand untick, which wins when it is newest.
"""
from __future__ import annotations

import json
import logging
import threading
import time
from typing import Any

from . import auth, catalog

log = logging.getLogger("academy.progress")

META_KEY = "academy"
MAX_BYTES = 7000            # Clerk allows 8 KB of private metadata; keep headroom
CACHE_S = 15                # a fresh read within this window is served from memory


# --- the shape --------------------------------------------------------------------

def clean_session(sid: str, rec: Any) -> dict | None:
    """Validate one incoming record against the real session; None if unusable."""
    s = catalog.session(sid)
    if not s or not isinstance(rec, dict):
        return None
    n_ch = len(s["chapters"])
    num = lambda v, lo, hi: max(lo, min(hi, float(v))) if isinstance(v, (int, float)) else None
    out: dict = {"t": int(num(rec.get("t"), 0, s["duration_ms"]) or 0),
                 "at": int(num(rec.get("at"), 0, 4e12) or 0),
                 "m": int(num(rec.get("m"), 0, 4e12) or 0), "ch": {}, "done": {}}
    for k, v in (rec.get("ch") or {}).items():
        if str(k).isdigit() and 1 <= int(k) <= n_ch and (f := num(v, 0, 1)) is not None:
            out["ch"][str(int(k))] = round(f, 2)
    for k, v in (rec.get("done") or {}).items():
        if str(k).isdigit() and 1 <= int(k) <= n_ch and isinstance(v, bool):
            out["done"][str(int(k))] = v
    return out


def merge_session(a: dict | None, b: dict | None) -> dict | None:
    if not a or not b:
        return a or b
    watched = a if a.get("at", 0) >= b.get("at", 0) else b
    marked, other = (a, b) if a.get("m", 0) >= b.get("m", 0) else (b, a)
    ch = {k: max(a.get("ch", {}).get(k, 0), b.get("ch", {}).get(k, 0))
          for k in {*a.get("ch", {}), *b.get("ch", {})}}
    return {"t": watched.get("t", 0), "at": watched.get("at", 0),
            "m": max(a.get("m", 0), b.get("m", 0)),
            "ch": ch, "done": {**other.get("done", {}), **marked.get("done", {})}}


def merge(a: dict, b: dict) -> dict:
    return {sid: merge_session(a.get(sid), b.get(sid)) for sid in {*a, *b}}


# Stored compactly: seconds, whole percents, 1/0 marks.
def _pack(sessions: dict) -> dict:
    return {"v": 1, "s": {sid: {"t": r["t"] // 1000, "at": r["at"] // 1000, "m": r["m"] // 1000,
                                "ch": {k: round(v * 100) for k, v in r["ch"].items() if v > 0},
                                "d": {k: int(v) for k, v in r["done"].items()}}
                          for sid, r in sessions.items() if r}}


def _unpack(meta: Any) -> dict:
    if not isinstance(meta, dict) or not isinstance(meta.get("s"), dict):
        return {}
    out = {}
    for sid, r in meta["s"].items():
        if not isinstance(r, dict):
            continue
        out[sid] = {"t": int(r.get("t", 0)) * 1000, "at": int(r.get("at", 0)) * 1000,
                    "m": int(r.get("m", 0)) * 1000,
                    "ch": {k: v / 100 for k, v in (r.get("ch") or {}).items()},
                    "done": {k: bool(v) for k, v in (r.get("d") or {}).items()}}
    return out


# --- the store --------------------------------------------------------------------

class ClerkStore:
    """Progress in the Clerk user's private metadata."""

    def get(self, user_id: str) -> dict:
        user = auth.clerk().users.get(user_id=user_id)
        return _unpack((user.private_metadata or {}).get(META_KEY))

    def put(self, user_id: str, sessions: dict) -> None:
        packed = _pack(sessions)
        if len(json.dumps(packed)) > MAX_BYTES:
            # Never expected (five sessions are ~2 KB), but never fail a save
            # over it: keep the marks and resume points, drop chapter fractions.
            for r in packed["s"].values():
                r["ch"] = {}
            log.warning("progress for %s trimmed to fit Clerk's metadata limit", user_id)
        auth.clerk().users.update_metadata(user_id=user_id, private_metadata={META_KEY: packed})


STORE = ClerkStore()
_cache: dict[str, tuple[float, dict]] = {}
_locks: dict[str, threading.Lock] = {}


def _lock(uid: str) -> threading.Lock:
    return _locks.setdefault(uid, threading.Lock())


def read(uid: str) -> dict:
    hit = _cache.get(uid)
    if hit and time.time() - hit[0] < CACHE_S:
        return hit[1]
    data = STORE.get(uid)
    _cache[uid] = (time.time(), data)
    return data


def write(uid: str, incoming: dict) -> dict:
    """Merge what the browser sent into what is stored, save, return the result."""
    clean = {sid: r for sid, r in ((sid, clean_session(sid, rec)) for sid, rec in (incoming or {}).items()) if r}
    with _lock(uid):                       # one write per user at a time, read-merge-write
        _cache.pop(uid, None)
        merged = merge(read(uid), clean)
        STORE.put(uid, merged)
        _cache[uid] = (time.time(), merged)
    return merged
