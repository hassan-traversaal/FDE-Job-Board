"""The real bot: the deployed Hamza MomentSearch API.

    HAMZA_API_URL=https://claude.traversaal.ai
    HAMZA_API_KEY=<the "academy" key from that app's API_KEYS>

This module is a pass-through for its streamed answer, GET /ask_stream?q=&session=N
(moment-search-internal/demo/hamza/app/app.py). The key stays on this server;
the browser only ever talks to /api/ask_stream here, which is gated by this
site's own sign-in and metered per signed-in user. The Hamza side does not
meter the academy key (API_KEY_LIMITS=academy:0), on purpose: this side does.

Hamza's events are translated, not rewritten:
  * its pipeline stages (guard, self_query, decompose, retrieve, rerank,
    citations, answer) fold onto the four this page draws;
  * each citation gains what this site knows and Hamza does not: the chapter it
    falls in, the session id this site uses (s2, not hamza-s2), and a picture.
    The picture is Hamza's own matched frame, fetched through /api/frame/... so
    the key never reaches the browser;
  * the answer text (markdown, citing moments as [n] or [1,3]) passes through.

If Hamza cannot be reached, or answers with an error before writing anything,
the caller falls back to the local demo bot (see bot.ask_stream).
"""
from __future__ import annotations

import json
import logging
import ssl
import time
from collections import OrderedDict
from functools import lru_cache
from typing import Iterator

from . import catalog, config

log = logging.getLogger("academy.hamza")

#: Hamza takes ~10-20 s for a full answer; the first event comes in well under 2 s.
CONNECT_S, READ_S = 10.0, 120.0


class Unavailable(Exception):
    """Hamza could not answer at all, so nothing has been sent to the browser yet."""


def configured() -> bool:
    return bool(config.get("HAMZA_API_URL") and config.get("HAMZA_API_KEY")) and \
        config.get("BOT", "live").lower() != "demo"


@lru_cache(maxsize=1)
def _client():
    import certifi
    import httpx
    # An explicit CA bundle: a stray SSL_CERT_FILE in the environment (conda sets
    # one) would otherwise break every request with a missing-file error.
    ctx = ssl.create_default_context(cafile=certifi.where())
    return httpx.Client(base_url=config.get("HAMZA_API_URL").rstrip("/"), verify=ctx,
                        timeout=httpx.Timeout(CONNECT_S, read=READ_S),
                        headers={"Authorization": "Bearer " + config.get("HAMZA_API_KEY")})


def _sse(payload: dict) -> str:
    return "data: " + json.dumps(payload, ensure_ascii=False) + "\n\n"


def _sid(c: dict) -> str | None:
    vid = str(c.get("video_id") or "")
    if vid.startswith("hamza-s"):
        return "s" + vid[len("hamza-s"):]
    return f"s{c['session']}" if c.get("session") is not None else None


def _citation(c: dict) -> dict:
    """Hamza's citation -> this page's moment card."""
    sid = _sid(c) or ""
    s = catalog.session(sid) or {}
    start = int(c.get("start_ms") or 0)
    ch = catalog.chapter_at(sid, start) if s else None
    onscreen = c.get("attribution") == "onscreen"
    thumb = c.get("thumb") or ""                      # "frame/hamza-s2/544"
    return {
        "n": c.get("n"),
        "session": sid, "video_id": sid, "session_number": s.get("number"),
        "title": s.get("title") or c.get("title") or sid,
        "chapter": (ch or {}).get("title", ""),
        "start_ms": start, "end_ms": int(c.get("end_ms") or start + 20_000),
        "speaker": c.get("speaker") or c.get("talking") or ("On screen" if onscreen else ""),
        "text": (c.get("text") or "").strip() or ("Shown on screen at this moment." if onscreen else ""),
        "thumb": ("/api/" + thumb) if thumb.startswith("frame/") else catalog.nearest_thumb(sid, start),
        "match_pct": c.get("match_pct") or 0,
        "onscreen": onscreen,
    }


# Hamza's stages -> the four pills this page draws.
_RETRIEVE = {"self_query", "decompose", "retrieve", "rerank"}


def ask_stream(q: str, sid: str) -> Iterator[str]:
    """Stream Hamza's answer for one session of this site ("s2"), or for the
    whole course ("all"). Raises Unavailable (before yielding anything) when
    Hamza cannot answer at all."""
    params = {"q": q}
    if sid not in ("", "all"):
        s = catalog.session(sid)
        if not s:
            raise Unavailable(f"unknown session {sid!r}")
        params["session"] = str(s["number"])
    import httpx
    t0 = time.perf_counter()
    try:
        cm = _client().stream("GET", "/ask_stream", params=params)
        r = cm.__enter__()
    except httpx.HTTPError as exc:
        raise Unavailable(f"{type(exc).__name__}: {exc}") from exc
    try:
        if r.status_code != 200:
            body = r.read().decode("utf-8", "replace")[:300]
            raise Unavailable(f"HTTP {r.status_code}: {body}")
        sent_any, retrieving, retrieved = False, False, False
        lines = r.iter_lines()
        try:
            for line in lines:
                if not line.startswith("data: "):
                    continue
                try:
                    m = json.loads(line[6:])
                except ValueError:
                    continue
                stage = m.get("stage")
                if stage == "delta":
                    out = _sse({"stage": "delta", "text": m.get("text", "")})
                elif stage in _RETRIEVE:
                    if m.get("status") == "running" and not retrieving:
                        retrieving, out = True, _sse({"stage": "retrieve", "status": "running"})
                    elif stage in ("retrieve", "rerank") and m.get("status") == "done" and not retrieved:
                        retrieved, out = True, _sse({"stage": "retrieve", "status": "done", "ms": m.get("ms")})
                    else:
                        continue
                elif stage == "citations":
                    cites = [_citation(c) for c in (m.get("detail") or {}).get("citations", [])]
                    out = _sse({"stage": "citations", "status": "done", "ms": m.get("ms"),
                                "detail": {"citations": cites, "mode": "live"}})
                elif stage == "error" and not sent_any:
                    # An error before any answer: let the demo bot try instead.
                    raise Unavailable((m.get("detail") or {}).get("message", "error"))
                else:                                   # guard, answer, blocked, error, end
                    out = _sse(m)
                sent_any = True
                yield out
        except httpx.HTTPError as exc:
            if not sent_any:
                raise Unavailable(f"{type(exc).__name__}: {exc}") from exc
            log.warning("hamza stream broke after %.1fs: %s", time.perf_counter() - t0, exc)
            yield _sse({"stage": "error", "detail": {"message": "The answer was cut off. Ask again?"}})
            yield _sse({"stage": "end", "status": "done"})
    finally:
        cm.__exit__(None, None, None)


# --- the matched frame behind a citation, fetched with the key -------------------

_frames: "OrderedDict[str, bytes]" = OrderedDict()
_FRAMES_KEPT = 400                      # ~25 KB each: ~10 MB of memory at most


def frame(video_id: str, idx: int) -> bytes | None:
    key = f"{video_id}/{idx}"
    if key in _frames:
        _frames.move_to_end(key)
        return _frames[key]
    if not configured():
        return None
    try:
        r = _client().get(f"/frame/{video_id}/{idx}")
    except Exception as exc:
        log.warning("frame %s: %s", key, exc)
        return None
    if r.status_code != 200 or not r.headers.get("content-type", "").startswith("image/"):
        return None
    _frames[key] = r.content
    while len(_frames) > _FRAMES_KEPT:
        _frames.popitem(last=False)
    return r.content
