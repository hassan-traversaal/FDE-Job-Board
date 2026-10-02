"""Zoom export -> data/sessions/<id>/transcript.json

Reads each session's `*.transcript.vtt` (Zoom's own, speaker-attributed) and
writes the cue list the app serves and the bot searches. Run once, or again
whenever the export changes; it overwrites and never appends.

    python scripts/build_transcripts.py
    python scripts/build_transcripts.py --root "D:/somewhere/Course Recording Testing"

The recordings themselves are NOT copied. Drop them into media/ when they are
ready (see README); nothing here depends on them.
"""
from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "sessions"

DEFAULT_LECTURE_ROOT = (r"C:\Users\Areej\Downloads\Course Recording Testing-20260909T112756Z-1-001"
                        r"\Course Recording Testing")

#: session number -> our id. The folder names are inconsistent ("Session 1",
#: "session 3"), so the number is matched, not the name.
SESSION_RE = re.compile(r"session\s*0*(\d+)", re.IGNORECASE)
TS_RE = re.compile(r"(\d+):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d+):(\d{2}):(\d{2})\.(\d{3})")
#: "Hamza Farooq (Instrcutor): text" — Zoom carries the display name, typos and
#: all. The parenthetical is a role tag, not part of the name.
SPEAKER_RE = re.compile(r"^([^:]{1,60}?):\s+(.*)$")


def _ms(h, m, s, ms) -> int:
    return ((int(h) * 60 + int(m)) * 60 + int(s)) * 1000 + int(ms)


def clean_speaker(raw: str) -> str:
    name = re.sub(r"\s*\(.*?\)\s*", " ", raw).strip()
    return re.sub(r"\s+", " ", name)


def parse_vtt(path: Path) -> list[dict]:
    cues: list[dict] = []
    block: list[str] = []

    def flush():
        if not block:
            return
        ts = next((TS_RE.search(l) for l in block if TS_RE.search(l)), None)
        if not ts:
            return
        idx = next(i for i, l in enumerate(block) if TS_RE.search(l))
        text = " ".join(l.strip() for l in block[idx + 1:] if l.strip())
        if not text:
            return
        g = ts.groups()
        speaker = ""
        m = SPEAKER_RE.match(text)
        if m:
            speaker, text = clean_speaker(m.group(1)), m.group(2).strip()
        cues.append({"start_ms": _ms(*g[:4]), "end_ms": _ms(*g[4:]),
                     "speaker": speaker, "text": text})

    for line in path.read_text(encoding="utf-8-sig").splitlines():
        if line.strip() == "":
            flush()
            block = []
        else:
            block.append(line)
    flush()
    return cues


def discover(root: Path) -> dict[int, Path]:
    found: dict[int, Path] = {}
    for d in sorted(root.iterdir()):
        m = SESSION_RE.search(d.name) if d.is_dir() else None
        if not m:
            continue
        vtts = sorted(d.glob("*.transcript.vtt")) or sorted(d.glob("*.vtt"))
        if vtts:
            found[int(m.group(1))] = vtts[0]
    return found


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.getenv("LECTURE_ROOT", DEFAULT_LECTURE_ROOT))
    ap.add_argument("--compact-dir", default="",
                    help="also write a one-line-per-cue .txt per session here (for reading)")
    args = ap.parse_args()

    sessions = discover(Path(args.root))
    if not sessions:
        raise SystemExit(f"no Session N folders with a .vtt under {args.root}")

    for num, vtt in sessions.items():
        cues = parse_vtt(vtt)
        sid = f"s{num}"
        out = DATA / sid
        out.mkdir(parents=True, exist_ok=True)
        speakers: dict[str, int] = {}
        for c in cues:
            if c["speaker"]:
                speakers[c["speaker"]] = speakers.get(c["speaker"], 0) + 1
        doc = {"session": sid, "source": vtt.name,
               "duration_ms": cues[-1]["end_ms"] if cues else 0,
               "speakers": dict(sorted(speakers.items(), key=lambda kv: -kv[1])),
               "cues": cues}
        (out / "transcript.json").write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
        if args.compact_dir:
            cd = Path(args.compact_dir)
            cd.mkdir(parents=True, exist_ok=True)
            lines = []
            for c in cues:
                s = c["start_ms"] // 1000
                lines.append(f"[{s // 3600:d}:{s // 60 % 60:02d}:{s % 60:02d}] "
                             f"{c['speaker'] or '?'}: {c['text']}")
            (cd / f"{sid}.txt").write_text("\n".join(lines), encoding="utf-8")
        top = ", ".join(f"{k} ({v})" for k, v in list(doc["speakers"].items())[:3])
        print(f"{sid}: {len(cues):4d} cues, {doc['duration_ms'] / 60000:6.1f} min  |  {top}")


if __name__ == "__main__":
    main()
