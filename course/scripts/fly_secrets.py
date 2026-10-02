"""Copy this machine's .env credentials into the Fly app's secrets.

    python scripts/fly_secrets.py              # what would be sent (names only)
    python scripts/fly_secrets.py --apply      # send them
    python scripts/fly_secrets.py --apply --stage   # send, apply on the next deploy

Only the keys in SECRETS (and GOOGLE_CLOUD_*) are sent. Everything else in .env
stays local on purpose: PORT and ALLOW_PUBLIC (the container picks its own
port, and production never runs without sign-in), MEDIA_DIR and the build
scripts' paths, BOT (a flag; set it in fly.toml [env] if ever needed), and
HAMZA_API_URL, which fly.toml sets in [env] where it is visible in git.

Values are read with the app's own .env parser, so quotes come off exactly as
they do locally, and are handed to `fly secrets import` on stdin: never
printed, never on a command line, never written to a file.
GOOGLE_CLOUD_PRIVATE_KEY keeps its literal \\n escapes; storage.py turns them
back into newlines, as it does for .env.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.config import _read_env_file  # noqa: E402  (the app's own parser)

SECRETS = ("CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "STORAGE_BUCKET", "HAMZA_API_KEY")
SECRET_PREFIXES = ("GOOGLE_CLOUD_",)

#: Without these the deployed app is closed (no Clerk keys: gated pages answer
#: 503) or quietly degraded (no recordings, the demo bot). --apply refuses.
REQUIRED = ("CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "STORAGE_BUCKET",
            "GOOGLE_CLOUD_PRIVATE_KEY", "GOOGLE_CLOUD_CLIENT_EMAIL", "HAMZA_API_KEY")


def _is_secret(key: str) -> bool:
    return key in SECRETS or key.startswith(SECRET_PREFIXES)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--apply", action="store_true", help="send them (default: only list them)")
    ap.add_argument("--stage", action="store_true",
                    help="store without restarting machines; they apply on the next deploy")
    a = ap.parse_args()

    env = _read_env_file(ROOT / ".env")
    if not env:
        print("No .env here (copy .env.example and fill it in).", file=sys.stderr)
        return 1
    app = tomllib.loads((ROOT / "fly.toml").read_text(encoding="utf-8"))["app"]

    send = {k: v for k, v in env.items() if _is_secret(k) and v}
    kept = sorted(k for k in env if not _is_secret(k))
    missing = [k for k in REQUIRED if k not in send]

    print(f"Fly app: {app}")
    print("Secrets (values not shown):")
    for k in sorted(send):
        print(f"  {k}")
    if kept:
        print(f"Left local: {', '.join(kept)}")
    if missing:
        print(f"MISSING from .env: {', '.join(missing)}")
    if send.get("CLERK_PUBLISHABLE_KEY", "").startswith("pk_test_"):
        print("Note: these are Clerk development keys (pk_test_). They work on any domain;\n"
              "      a public launch wants a production instance on the custom domain.")

    if not a.apply:
        print("\nNothing sent. Run again with --apply to set these on the app.")
        return 0
    if missing:
        print("\nNot sent: fill in the missing keys first.", file=sys.stderr)
        return 1
    fly = shutil.which("fly") or shutil.which("flyctl")
    if not fly:
        print("\nflyctl is not installed (https://fly.io/docs/flyctl/install/).", file=sys.stderr)
        return 1
    cmd = [fly, "secrets", "import", "--app", app] + (["--stage"] if a.stage else [])
    body = "".join(f"{k}={v}\n" for k, v in sorted(send.items()))
    return subprocess.run(cmd, input=body, text=True, encoding="utf-8", cwd=ROOT).returncode


if __name__ == "__main__":
    sys.exit(main())
