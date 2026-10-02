"""The course, its sessions, their chapters and transcripts, loaded once.

data/course.json                  course meta + session order, date, video flag
data/sessions/<id>/content.json   title, chapters, suggested questions (curated)
data/sessions/<id>/transcript.json  cues from the Zoom VTT (scripts/build_transcripts.py)
web/assets/frames/<id>/           cover.jpg + chNN.jpg (scripts/build_frames.py)
media/<id>.mp4|.m4a|...           the recording, when it has been added

A session missing content.json still loads (titled "Session N", no chapters),
so the library never breaks while chapters are being written.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

from . import config, storage

MEDIA_EXTS = (".mp4", ".webm", ".m4v", ".mov", ".m4a", ".mp3")
MEDIA_TYPES = {".mp4": "video/mp4", ".webm": "video/webm", ".m4v": "video/mp4",
               ".mov": "video/quicktime", ".m4a": "audio/mp4", ".mp3": "audio/mpeg"}

#: Chunking for search: ~25s of one speaker, never across a speaker change.
CHUNK_MS = 25_000


def _load(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


@lru_cache(maxsize=1)
def course() -> dict:
    return _load(config.ROOT / "data" / "course.json", {"course": {}, "sessions": []})


def media_file(sid: str) -> Path | None:
    for ext in MEDIA_EXTS:
        p = config.MEDIA_DIR / f"{sid}{ext}"
        if p.is_file():
            return p
    return None


def gcs_key(sid: str) -> str:
    meta = next((s for s in course()["sessions"] if s["id"] == sid), {})
    return meta.get("gcs", "")


def _media(sid: str, meta: dict) -> dict | None:
    """The recording: a file in media/ wins (handy offline), else the bucket."""
    f = media_file(sid)
    if f:
        return {"url": f"/media/{sid}", "type": MEDIA_TYPES.get(f.suffix, "video/mp4"),
                "audio_only": f.suffix in (".m4a", ".mp3"), "source": "local"}
    key = meta.get("gcs", "")
    if key and storage.exists(key):
        return {"url": f"/media/{sid}", "type": "video/mp4", "audio_only": False, "source": "gcs"}
    return None


def _frame_url(sid: str, name: str) -> str | None:
    p = config.WEB_DIR / "assets" / "frames" / sid / name
    return f"/assets/frames/{sid}/{name}" if p.is_file() else None


@lru_cache(maxsize=None)
def transcript(sid: str) -> dict:
    return _load(config.DATA_DIR / sid / "transcript.json", {"cues": [], "duration_ms": 0, "speakers": {}})


@lru_cache(maxsize=None)
def _content(sid: str) -> dict:
    return _load(config.DATA_DIR / sid / "content.json", {})


def _chapters(sid: str, duration_ms: int) -> list[dict]:
    raw = _content(sid).get("chapters") or []
    out = []
    for i, ch in enumerate(raw):
        start_ms = int(ch["start"]) * 1000
        end_ms = int(raw[i + 1]["start"]) * 1000 if i + 1 < len(raw) else duration_ms
        out.append({"n": i + 1, "start_ms": start_ms, "end_ms": end_ms,
                    "title": ch.get("title", ""), "summary": ch.get("summary", ""),
                    "speaker": ch.get("speaker", ""),
                    "thumb": _frame_url(sid, f"ch{i + 1:02d}.jpg")})
    return out


def session(sid: str) -> dict | None:
    meta = next((s for s in course()["sessions"] if s["id"] == sid), None)
    if not meta:
        return None
    c = _content(sid)
    t = transcript(sid)
    num = int(sid.lstrip("s"))
    dur = t.get("duration_ms", 0)
    media = _media(sid, meta)
    return {
        "id": sid, "number": num, "bonus": bool(meta.get("bonus")),
        "kicker": c.get("kicker") or ("Bonus session" if meta.get("bonus") else f"Module {num:02d}"),
        "title": c.get("title") or f"Session {num}",
        "tagline": c.get("tagline", ""), "summary": c.get("summary", ""),
        "lead": c.get("lead") or list(t.get("speakers", {}))[:1],
        "guests": [g for g in c.get("guests", []) if g.get("name")],
        "topics": c.get("topics", []),
        "date": meta.get("date", ""), "duration_ms": dur,
        "has_video": bool(meta.get("video")),
        # one small frame per minute exists for this session (hover previews, moment thumbs)
        "frames": (config.WEB_DIR / "assets" / "frames" / sid / "t").is_dir(),
        "media": media,
        "cover": _frame_url(sid, "cover.jpg"),
        "chapters": _chapters(sid, dur),
        "questions": [q["q"] for q in c.get("questions", [])],
    }


def sessions() -> list[dict]:
    """Library order: the four modules, then the bonus session."""
    out = [session(s["id"]) for s in course()["sessions"]]
    return [s for s in out if s]


def curated(sid: str) -> list[dict]:
    return _content(sid).get("questions") or []


def chapter_at(sid: str, ms: int) -> dict | None:
    """The chapter playing at ms; anything before the first chapter belongs to it."""
    chs = (session(sid) or {}).get("chapters", [])
    hit = chs[0] if chs else None
    for ch in chs:
        if ch["start_ms"] <= ms:
            hit = ch
        else:
            break
    return hit


def nearest_thumb(sid: str, ms: int) -> str | None:
    """A frame from the minute the moment happens, when the recording was sampled;
    else the chapter's picture; else the session cover."""
    minute = _frame_url(sid, f"t/{round(ms / 60000):04d}.jpg")
    if minute:
        return minute
    ch = chapter_at(sid, ms)
    if ch and ch.get("thumb"):
        return ch["thumb"]
    return _frame_url(sid, "cover.jpg")


@lru_cache(maxsize=None)
def chunks(sid: str) -> list[dict]:
    """Cues -> ~25s single-speaker passages, the unit the demo bot searches."""
    out: list[dict] = []
    cur: dict | None = None
    for c in transcript(sid).get("cues", []):
        if (cur is None or c["speaker"] != cur["speaker"]
                or c["end_ms"] - cur["start_ms"] > CHUNK_MS):
            if cur:
                out.append(cur)
            cur = {"start_ms": c["start_ms"], "end_ms": c["end_ms"],
                   "speaker": c["speaker"], "text": c["text"]}
        else:
            cur["end_ms"] = c["end_ms"]
            cur["text"] += " " + c["text"]
    if cur:
        out.append(cur)
    for i, ch in enumerate(out):
        ch["i"] = i
    return out


WORD_RE = re.compile(r"[a-z0-9]+(?:[.'][a-z0-9]+)*")


# --- reviews (data/reviews.json, from scripts/fetch_reviews.py) ------------------

#: Company fields people filled with a placeholder rather than a company.
_NO_COMPANY = {"", "na", "n/a", "-", "none", "self", "immediately available"}


def reviews() -> dict:
    """What the welcome page shows, from the Maven reviews as written:
    a few featured (course.json "featured_reviews", shown in turn) and the rest
    as cards.

    Staff of the course's own company are left off the wall (they still count
    in Maven's average, which is quoted as Maven reports it). One review per
    person, the longest; one-liners are skipped. Nothing is edited.
    """
    d = _load(config.ROOT / "data" / "reviews.json", {"summary": {}, "reviews": []})
    rs = [dict(r) for r in d["reviews"] if "traversaal" not in (r.get("company") or "").lower()]
    for r in rs:
        if (r.get("company") or "").strip().lower() in _NO_COMPANY:
            r["company"] = None
    by_id = {r["id"]: r for r in rs}
    featured = [by_id[i] for i in course().get("featured_reviews", []) if i in by_id]
    if not featured and rs:
        featured = sorted(rs, key=lambda r: -len(r["text"]))[:3]
    taken = {r["id"] for r in featured}
    best: dict[str, dict] = {}
    for r in rs:
        if r["id"] in taken or len(r["text"]) < 45:
            continue
        who = f"{r.get('name') or ''}|{r.get('company') or ''}".lower().strip("|") or r["id"]
        if who not in best or len(r["text"]) > len(best[who]["text"]):
            best[who] = r
    cards = sorted(best.values(), key=lambda r: r["date"], reverse=True)
    return {"summary": d.get("summary", {}), "featured": featured, "cards": cards}
