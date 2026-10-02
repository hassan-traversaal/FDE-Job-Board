"""One config file, read once.

`.env` at the project root is parsed here (no python-dotenv dependency) and the
real environment wins over it, so `fly secrets set X=...` works with no file.
"""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "sessions"
WEB_DIR = ROOT / "web"
MEDIA_DIR = Path(os.getenv("MEDIA_DIR", str(ROOT / "media")))


def _read_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        out[key.strip()] = val
    return out


ENV: dict[str, str] = {**_read_env_file(ROOT / ".env"), **os.environ}

# A CA bundle variable naming a file that is not there (conda's activation sets
# SSL_CERT_FILE, and it outlives the file) makes every HTTPS client in the
# process, Clerk's included, fail at construction. Without it they fall back to
# their own bundle, which is what was meant anyway.
for _var in ("SSL_CERT_FILE", "SSL_CERT_DIR", "REQUESTS_CA_BUNDLE"):
    _val = os.environ.get(_var)
    if _val and not Path(_val).exists():
        os.environ.pop(_var)
        ENV.pop(_var, None)


def get(key: str, default: str = "") -> str:
    return (ENV.get(key) or default).strip()


PORT = int(get("PORT", "8300"))

#: The site this course sits inside (https://fde.traversaal.ai). That site owns
#: "/" and serves /signin, /library and /session/<n> from this app through
#: rewrites, so a visitor stays on one domain. When set, this app's own welcome
#: page steps aside and "/" sends people to that site's home. Unset (local runs
#: on their own), the welcome page shows as before.
HOME_URL = get("HOME_URL").rstrip("/")

#: The bot's mode. "demo" answers from the transcripts on this machine (curated
#: answers for the suggested questions, transcript search for anything else).
#: Swap in the real MomentSearch pipeline by pointing MOMENT_API_URL at a
#: deployment that speaks the same /ask_stream SSE contract (see backend/bot.py).
MOMENT_API_URL = get("MOMENT_API_URL")
