"""The session bot, in demo mode.

Speaks the SAME Server-Sent Events contract as demo/hamza's /ask_stream, so the
page does not change when the real MomentSearch pipeline is plugged in:

    {"stage": "guard"|"retrieve"|"citations"|"answer", "status": "running"|"done", "ms": .., "detail": {..}}
    {"stage": "delta", "text": "..."}               answer text, streamed
    {"stage": "blocked"|"error", "detail": {"message": ".."}}
    {"stage": "end", "status": "done"}

`citations` carries the moments: {n, session, title, chapter, start_ms, end_ms,
speaker, text, thumb, match_pct}. The answer cites them inline as [n].

Two paths, both grounded in the real transcripts on this machine:

  1. curated   the session's suggested questions have hand-checked answers
               (data/sessions/<id>/content.json) with real timestamps.
  2. search    anything else: BM25 over ~25s transcript passages, and an
               extractive answer quoting what was actually said.

No model is called in either path. That is the point of demo mode: the UI and
the contract are real, the cost is zero, and nothing is made up.
"""
from __future__ import annotations

import json
import math
import re
import time
from collections import Counter
from functools import lru_cache
from typing import Iterator

import logging

from . import catalog, hamza

log = logging.getLogger("academy.bot")

MAX_Q = 400
TOP_K = 4

STOP = set("""a an the and or but if then so of to in on at by for with from as is are was were be been being
it its this that these those there here i you he she we they me my your our their them his her
do does did doing done have has had having can could should would will shall may might must
what which who whom whose when where why how about into over under again further once
not no nor only own same too very just also than more most some any each few other such
s t don doesn didn isn aren wasn weren hasn haven hadn won wouldn shouldn couldn
like yeah okay ok um uh so right gonna wanna kind sort really actually basically thing things
get got go going say said tell talk talked talks session sessions class hamza aishwarya
many much lot lots one two three know think want need make makes way see look mean well good great
everyone everybody guys folks people someone something anything everything stuff little bit
able let lets maybe sure yes please thank thanks today now still even back first next""".split())

#: Passages shorter than this many content words are interjections ("Loop mode.")
#: that win on term frequency and say nothing.
MIN_DOC_TOKENS = 6

#: Zoom captions mishear the vocabulary of this course in a few consistent ways.
#: Folding them on BOTH sides lets "CLAUDE.md" find "cloud.md".
ALIASES = {
    "cloud": "claude", "clod": "claude", "claud": "claude", "clawed": "claude",
    "md": "md", "claude.md": "claudemd", "cloud.md": "claudemd", "claudemd": "claudemd",
    "subagents": "subagent", "sub-agent": "subagent", "sub-agents": "subagent",
    "mcb": "mcp", "mcps": "mcp", "evals": "eval", "e-vals": "eval", "evaluations": "eval",
    "evaluation": "eval", "llms": "llm", "agents": "agent", "agentic": "agent",
    "skills": "skill", "hooks": "hook", "prompts": "prompt", "prompting": "prompt",
}

TOKEN_RE = re.compile(r"[a-z0-9]+(?:[.\-][a-z0-9]+)*")


def _stem(w: str) -> str:
    for suf in ("ingly", "ing", "edly", "ed", "es", "s"):
        if len(w) > len(suf) + 3 and w.endswith(suf):
            return w[: -len(suf)]
    return w


def tokens(text: str) -> list[str]:
    out = []
    raw = TOKEN_RE.findall((text or "").lower())
    for i, w in enumerate(raw):
        # "sub agent" -> "subagent", spoken as two words more often than one
        if w == "sub" and i + 1 < len(raw) and raw[i + 1].startswith("agent"):
            continue
        if w.startswith("agent") and i > 0 and raw[i - 1] == "sub":
            w = "subagent"
        w = ALIASES.get(w, w)
        if w in STOP or len(w) < 2:
            continue
        out.append(_stem(w))
    return out


class _Index:
    """BM25 over one session's passages."""

    def __init__(self, sid: str):
        self.sid = sid
        self.docs = catalog.chunks(sid)
        self.seq = [tokens(d["text"]) for d in self.docs]
        self.tf = [Counter(t) for t in self.seq]
        self.pairs = [set(zip(t, t[1:])) for t in self.seq]
        self.len = [sum(t.values()) for t in self.tf]
        self.avg = (sum(self.len) / len(self.len)) if self.len else 1
        df: Counter = Counter()
        for t in self.tf:
            df.update(t.keys())
        n = len(self.docs) or 1
        self.idf = {w: math.log(1 + (n - f + 0.5) / (f + 0.5)) for w, f in df.items()}

    def search(self, q: list[str], k1=1.4, b=0.72) -> list[tuple[float, dict]]:
        qs, qpairs = set(q), set(zip(q, q[1:]))
        scored = []
        for d, tf, ln, pairs in zip(self.docs, self.tf, self.len, self.pairs):
            if ln < MIN_DOC_TOKENS:
                continue
            s, hit = 0.0, 0
            for w in qs:
                f = tf.get(w)
                if f:
                    hit += 1
                    s += self.idf.get(w, 0) * f * (k1 + 1) / (f + k1 * (1 - b + b * ln / self.avg))
            if s <= 0:
                continue
            # Saying more of the question beats saying one word of it often, and
            # saying it as a phrase ("plan mode") beats saying the words apart.
            s *= 1 + 0.6 * (hit / len(qs)) ** 2
            if qpairs & pairs:
                s *= 1.6
            scored.append((s, d))
        scored.sort(key=lambda x: -x[0])
        return scored


@lru_cache(maxsize=None)
def index(sid: str) -> _Index:
    return _Index(sid)


# --- answer assembly -------------------------------------------------------------

def _best_sentence(text: str, q: set[str], limit: int = 210) -> str:
    """The stretch of a passage that carries the most query words."""
    sents = [s.strip() for s in re.split(r"(?<=[.?!])\s+", text) if s.strip()]
    if not sents:
        return text[:limit]
    best_i = max(range(len(sents)), key=lambda i: (len(q & set(tokens(sents[i]))), len(sents[i]) > 40))
    out = sents[best_i]
    if len(out) < 90 and best_i + 1 < len(sents):
        out += " " + sents[best_i + 1]
    if len(out) > limit:
        out = out[: limit].rsplit(" ", 1)[0] + "…"
    return out


def _fmt(ms: int) -> str:
    s = ms // 1000
    return f"{s // 3600}:{s // 60 % 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60}:{s % 60:02d}"


def _cite(n: int, sid: str, start_ms: int, end_ms: int, speaker: str, text: str, pct: int) -> dict:
    s = catalog.session(sid) or {}
    ch = catalog.chapter_at(sid, start_ms)
    return {"n": n, "session": sid, "video_id": sid, "session_number": s.get("number"),
            "title": s.get("title", sid), "chapter": (ch or {}).get("title", ""),
            "start_ms": start_ms, "end_ms": end_ms, "speaker": speaker, "text": text,
            "thumb": catalog.nearest_thumb(sid, start_ms), "match_pct": pct}


def _norm(q: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", "", q.lower()).strip()


def match_curated(q: str, sids: list[str]) -> tuple[str, dict] | None:
    qn, qt = _norm(q), set(tokens(q))
    best, best_score = None, 0.0
    for sid in sids:
        for item in catalog.curated(sid):
            if _norm(item["q"]) == qn:
                return sid, item
            it = set(tokens(item["q"]))
            if not qt or not it:
                continue
            jac = len(qt & it) / len(qt | it)
            if jac > best_score:
                best, best_score = (sid, item), jac
    return best if best_score >= 0.62 else None


def search(q: str, sids: list[str]) -> list[dict]:
    qt = tokens(q)
    if not qt:
        return []
    hits: list[tuple[float, str, dict]] = []
    for sid in sids:
        for score, d in index(sid).search(qt)[:12]:
            hits.append((score, sid, d))
    hits.sort(key=lambda x: -x[0])
    if not hits:
        return []
    top = hits[0][0]
    picked: list[tuple[float, str, dict]] = []
    for score, sid, d in hits:
        if score < top * 0.38:
            break
        # One moment per minute of talk: neighbours say the same thing twice.
        if any(sid == ps and abs(d["start_ms"] - pd["start_ms"]) < 75_000 for _, ps, pd in picked):
            continue
        picked.append((score, sid, d))
        if len(picked) == TOP_K:
            break
    qs = set(qt)
    return [_cite(i + 1, sid, d["start_ms"], d["end_ms"], d["speaker"],
                  _best_sentence(d["text"], qs), max(1, round(100 * score / top)))
            for i, (score, sid, d) in enumerate(picked)]


def extractive_answer(q: str, cites: list[dict], multi: bool) -> str:
    first = cites[0]
    who = sorted({c["speaker"] for c in cites if c["speaker"]})
    where = (f"across {len({c['session'] for c in cites})} sessions" if multi
             else f"in **{first['title']}**")
    lines = [f"This comes up {where}, mostly from {', '.join(who[:2]) or 'the instructors'}. "
             f"Here is what was said, in their words:", ""]
    for c in cites:
        ctx = f"*{c['chapter']}*" if c["chapter"] else (f"Session {c['session_number']}" if multi else "")
        lead = f"**{c['speaker'] or 'Speaker'}**, {_fmt(c['start_ms'])}" + (f" in {ctx}" if ctx else "")
        lines.append(f"- {lead}: “{c['text']}” [{c['n']}]")
    lines += ["", "Play any moment to hear it in context; the transcript follows along."]
    return "\n".join(lines)


# --- the stream ------------------------------------------------------------------

def _sse(payload: dict) -> str:
    return "data: " + json.dumps(payload, ensure_ascii=False) + "\n\n"


def _stage(stage: str, status: str, ms: float | None = None, detail: dict | None = None) -> str:
    p: dict = {"stage": stage, "status": status}
    if ms is not None:
        p["ms"] = round(ms, 1)
    if detail is not None:
        p["detail"] = detail
    return _sse(p)


def _pieces(text: str) -> Iterator[str]:
    """Word-sized deltas, the way a model streams. Citations stay whole."""
    for m in re.finditer(r"\[\d+\]|\S+\s*|\s+", text):
        yield m.group(0)


def _demo_stream(q: str, scope: str) -> Iterator[str]:
    q = (q or "").strip()[:MAX_Q]
    all_ids = [s["id"] for s in catalog.sessions()]
    sids = all_ids if scope in ("", "all") else [scope] if scope in all_ids else []
    multi = len(sids) > 1
    t0 = time.perf_counter()
    yield _stage("guard", "running")
    time.sleep(0.18)
    if len(tokens(q)) == 0 or not sids:
        yield _stage("guard", "done", (time.perf_counter() - t0) * 1000, {"allow": False})
        yield _sse({"stage": "blocked", "detail": {"message":
              "Ask about something taught in the session, like a tool, a technique or a demo."}})
        yield _stage("end", "done")
        return
    yield _stage("guard", "done", (time.perf_counter() - t0) * 1000, {"allow": True})

    t1 = time.perf_counter()
    yield _stage("retrieve", "running")
    time.sleep(0.32)
    hit = match_curated(q, sids)
    if hit:
        sid, item = hit
        cites = [_cite(i + 1, sid, int(c["start"]) * 1000, int(c["end"]) * 1000,
                       c.get("speaker", ""), c.get("quote", ""), max(60, 98 - 7 * i))
                 for i, c in enumerate(item.get("citations", []))]
        answer, mode = item["answer"], "curated"
    else:
        cites = search(q, sids)
        answer, mode = (extractive_answer(q, cites, multi) if cites else ""), "search"
    yield _stage("retrieve", "done", (time.perf_counter() - t1) * 1000,
                 {"mode": mode, "total": len(cites)})

    if not cites:
        where = "these sessions" if multi else "this session"
        yield _sse({"stage": "error", "detail": {"message":
              f"Nothing in {where} matches that yet. Try naming a tool or idea from the chapters, "
              f"or pick one of the suggested questions."}})
        yield _stage("end", "done")
        return

    yield _stage("citations", "done", 40.0, {"citations": cites, "mode": mode})
    t2 = time.perf_counter()
    yield _stage("answer", "running")
    for piece in _pieces(answer):
        yield _sse({"stage": "delta", "text": piece})
        time.sleep(0.016 if not piece.isspace() else 0)
    yield _stage("answer", "done", (time.perf_counter() - t2) * 1000)
    yield _stage("end", "done")


# --- which bot answers ------------------------------------------------------------

def mode() -> str:
    """"live" when the Hamza API is configured, else "demo"."""
    return "live" if hamza.configured() else "demo"


def ask_stream(q: str, scope: str) -> Iterator[str]:
    """The live Hamza bot for a session, falling back to the demo bot when Hamza
    cannot answer at all (unreachable, a bad key, an error before any text).
    The fallback says so in one line, so a quoted-transcript answer is never
    passed off as the real one."""
    q = (q or "").strip()[:MAX_Q]
    if mode() == "live" and (scope in ("", "all") or catalog.session(scope)):
        gen = hamza.ask_stream(q, scope)
        try:
            first = next(gen)
        except StopIteration:
            return
        except hamza.Unavailable as exc:
            log.warning("live bot unavailable, using the demo bot: %s", exc)
            yield _sse({"stage": "notice", "detail": {"message":
                "The live bot is unreachable right now, so this answer quotes the transcript directly."}})
        else:
            yield first
            yield from gen
            return
    yield from _demo_stream(q, scope)
