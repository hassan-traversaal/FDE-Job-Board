"""Recordings -> the pictures the site shows.  Needs ffmpeg on PATH.

    python scripts/build_frames.py              everything
    python scripts/build_frames.py --minutes    one small frame per minute (moment thumbnails,
                                                scrubber hover previews)
    python scripts/build_frames.py --chapters   one frame per chapter + the session cover

Writes under web/assets/frames/<id>/:  t/MMMM.jpg (640w), chNN.jpg (960w), cover.jpg.

Recordings are read from the Zoom export (LECTURE_ROOT), not copied. A session
with no video (session 3 is audio only) takes its chapter pictures from the
module deck instead: content.json names a slide per chapter.

Zoom exports come in odd shapes (3440x1440 ultrawide, 1842x956), so every frame
is centre-cropped to 16:9 before scaling. The shared screen sits in the middle;
the sides are black bars or a gallery strip.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "assets" / "frames"
DATA = ROOT / "data" / "sessions"
LECTURE_ROOT = Path(os.getenv("LECTURE_ROOT", r"C:\Users\Areej\Downloads\Course Recording Testing-20260909T112756Z-1-001"
                                              r"\Course Recording Testing"))
DECKS = Path(os.getenv("DECK_ROOT", r"C:\Users\Areej\Desktop\traversaal\moment-search-internal\demo\hamza"
                                    r"\multimodal_doc_rag\data"))
CROP = "crop='min(iw,ih*16/9)':'min(ih,iw*9/16)'"
FORCE = False


def video_for(num: int) -> Path | str | None:
    """The local Zoom export if it has the video, else a signed URL into the
    bucket (ffmpeg seeks over HTTP). Session 3's video exists only in GCS."""
    if LECTURE_ROOT.is_dir():
        for d in LECTURE_ROOT.iterdir():
            if d.is_dir() and d.name.lower().replace(" ", "") == f"session{num}":
                mp4s = sorted(d.glob("*.mp4"))
                if mp4s:
                    return mp4s[0]
    try:
        import sys
        sys.path.insert(0, str(ROOT))
        from backend import storage
        return storage.signed_url(f"hamza_moment_search/hamza-s{num}/source.mp4")
    except Exception:
        return None


def grab(src: Path, at: float, dst: Path, width: int, q: int = 4) -> bool:
    dst.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{max(0, at):.2f}", "-i", str(src),
                        "-frames:v", "1", "-vf", f"{CROP},scale={width}:-2", "-q:v", str(q), str(dst)],
                       capture_output=True)
    return r.returncode == 0 and dst.is_file()


def slide(deck: str, page: int, dst: Path, width: int) -> bool:
    src = DECKS / deck / f"page-{page:03d}.jpg"
    if not src.is_file():
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    return subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vf", f"{CROP},scale={width}:-2",
                           "-q:v", "3", str(dst)], capture_output=True).returncode == 0


def duration_s(sid: str) -> int:
    t = json.loads((DATA / sid / "transcript.json").read_text(encoding="utf-8"))
    return t["duration_ms"] // 1000


def minutes(course: dict) -> None:
    jobs = []
    for s in course["sessions"]:
        vid = video_for(int(s["id"][1:]))
        if not vid:
            print(f"{s['id']}: no video, skipping minute frames")
            continue
        for m in range(duration_s(s["id"]) // 60 + 1):
            dst = OUT / s["id"] / "t" / f"{m:04d}.jpg"
            if FORCE or not dst.is_file():
                jobs.append((vid, max(20, m * 60), dst))   # 0:00 is a blank Zoom screen
    print(f"minute frames to grab: {len(jobs)}")
    with ThreadPoolExecutor(max_workers=6) as pool:
        done = sum(pool.map(lambda j: grab(j[0], j[1], j[2], 640, 5), jobs))
    print(f"minute frames: {done}/{len(jobs)} written")


def chapters(course: dict) -> None:
    for s in course["sessions"]:
        sid = s["id"]
        cpath = DATA / sid / "content.json"
        if not cpath.is_file():
            print(f"{sid}: no content.json yet, skipping")
            continue
        content = json.loads(cpath.read_text(encoding="utf-8"))
        chs = content.get("chapters", [])
        vid = video_for(int(sid[1:]))
        dur = duration_s(sid)
        ok = 0
        for i, ch in enumerate(chs):
            dst = OUT / sid / f"ch{i + 1:02d}.jpg"
            end = chs[i + 1]["start"] if i + 1 < len(chs) else dur
            if vid:
                # A little way in: a chapter's first second is often the cut itself.
                at = ch.get("frame_at") or min(ch["start"] + 40, ch["start"] + (end - ch["start"]) * 0.25)
                ok += grab(vid, at, dst, 960, 3)
            elif s.get("deck") and ch.get("slide"):
                ok += slide(s["deck"], int(ch["slide"]), dst, 960)
        cover_ch = int(content.get("cover_chapter") or min(2, len(chs)))
        src = OUT / sid / f"ch{cover_ch:02d}.jpg"
        if vid and chs:
            c = chs[cover_ch - 1]
            grab(vid, c.get("frame_at") or c["start"] + 40, OUT / sid / "cover.jpg", 1280, 3)
        elif src.is_file():
            (OUT / sid / "cover.jpg").write_bytes(src.read_bytes())
        print(f"{sid}: {ok}/{len(chs)} chapter frames, cover from chapter {cover_ch}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--minutes", action="store_true")
    ap.add_argument("--chapters", action="store_true")
    ap.add_argument("--force", action="store_true", help="re-grab frames that already exist")
    a = ap.parse_args()
    global FORCE
    FORCE = a.force
    course = json.loads((ROOT / "data" / "course.json").read_text(encoding="utf-8"))
    both = not (a.minutes or a.chapters)
    if a.chapters or both:
        chapters(course)
    if a.minutes or both:
        minutes(course)


if __name__ == "__main__":
    main()
