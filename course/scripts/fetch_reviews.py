"""Maven reviews -> data/reviews.json (+ reviewer photos in web/assets/img/reviews/)

    python scripts/fetch_reviews.py

Reads the same public endpoint the course page on maven.com uses
(maven.com/boring-bot/claude-code-in-practice#course-reviews). Keeps only what
the welcome page shows: first name, role, company, rating, the review text,
cohort and date. Reviews with no written text (e.g. "Shared with Hamza as a
Video Review") are dropped; anonymous reviews keep their text but no name.
Photos are downloaded rather than hotlinked. Re-run to refresh.
"""
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COURSE_ID = 19374                       # Claude Code in Practice on Maven
API = f"https://api.maven.com/courses/{COURSE_ID}/reviews"
PAGE_URL = "https://maven.com/boring-bot/claude-code-in-practice#course-reviews"
OUT = ROOT / "data" / "reviews.json"
IMG = ROOT / "web" / "assets" / "img" / "reviews"
UA = {"User-Agent": "Mozilla/5.0 (traversaal-academy review sync)"}

#: Text that is a note about the review rather than a review.
NOT_A_REVIEW = re.compile(r"^\s*(shared .* video review|video review)\s*\.?\s*$", re.I)


def get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return r.read()


def main() -> None:
    items, page = [], 1
    while True:
        d = json.loads(get(f"{API}?page={page}&limit=50"))
        items += d.get("items", [])
        meta = d.get("metadata") or {}
        if page >= int(meta.get("pages") or 1) or not d.get("items"):
            break
        page += 1

    IMG.mkdir(parents=True, exist_ok=True)
    out, ratings = [], []
    for it in items:
        ratings.append(it.get("rating") or 0)
        text = (it.get("review") or "").strip()
        if not text or NOT_A_REVIEW.match(text):
            continue
        anon = bool(it.get("is_anonymous"))
        user = it.get("user") or {}
        bio = ((user.get("attrs") or {}).get("bio") or {})
        photo = None
        if not anon and bio.get("profile_image_url"):
            ext = Path(bio["profile_image_url"].split("?")[0]).suffix.lower() or ".jpg"
            dst = IMG / f"{it['id']}{ext if ext in ('.jpg', '.jpeg', '.png', '.webp') else '.jpg'}"
            try:
                if not dst.is_file():
                    dst.write_bytes(get(bio["profile_image_url"].replace(" ", "%20")))
                photo = f"assets/img/reviews/{dst.name}"
            except Exception:
                photo = None
        cohort = it.get("cohort")
        out.append({
            "id": it["id"],
            "name": None if anon else (user.get("preferred_name") or "").strip() or None,
            "role": None if anon else (bio.get("job_title") or "").strip() or None,
            "company": None if anon else (bio.get("company") or "").strip() or None,
            "photo": photo,
            "stars": round((it.get("rating") or 0) / 2, 1),      # Maven rates out of 10
            "text": re.sub(r"[ \t]+", " ", text),
            "cohort": cohort.get("name") if isinstance(cohort, dict) else None,
            "date": (it.get("created_at") or "")[:10],
        })

    out.sort(key=lambda r: r["date"], reverse=True)
    summary = {"source": PAGE_URL, "reviews": len(ratings), "written": len(out),
               "average": round(sum(ratings) / len(ratings) / 2, 2) if ratings else None}
    # The headline Maven itself shows ("5.0 (54)") counts star-only ratings too.
    try:
        html = get(PAGE_URL.split("#")[0]).decode("utf-8", "replace")
        nd = json.loads(re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S).group(1))
        rs = nd["props"]["pageProps"]["ratingSummary"]
        summary["ratings"] = rs["num_ratings"]
        summary["average"] = round(rs["sum_ratings"] / rs["num_ratings"] / 2, 2)
    except Exception as exc:
        print("rating summary not read:", exc)
    OUT.write_text(json.dumps({"summary": summary, "reviews": out}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(items)} reviews ({len(out)} written), {summary.get('ratings')} ratings, average {summary['average']} -> {OUT}")


if __name__ == "__main__":
    main()
