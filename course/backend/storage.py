"""The recordings, in Google Cloud Storage.

Same bucket and service account as moment-search-internal/demo/hamza: its
ingest uploaded each session as <CORPUS_ID>/hamza-sN/source.mp4. This app never
moves video bytes. /media/<id> answers with a short-lived signed URL and the
browser streams (and seeks, with range requests) straight from GCS.

Configured by STORAGE_BUCKET + the GOOGLE_CLOUD_* service-account fields in
.env. Without them, recordings fall back to files in media/ (see catalog.py).
"""
from __future__ import annotations

import logging
import time
from datetime import timedelta
from functools import lru_cache

from . import config

log = logging.getLogger("academy.storage")

#: Long enough for a two-hour class with pauses; the player asks for a fresh
#: one if a signature lapses mid-session.
SIGNED_TTL_S = 6 * 3600
_signed: dict[str, tuple[str, float]] = {}

#: A recording's presence is asked once per process and remembered: they don't
#: come and go. A failed ask (a network blip, GCS having a bad minute) is NOT an
#: answer, so it is retried after RETRY_S rather than hiding that recording until
#: the next restart, which on an always-on machine can be weeks away.
RETRY_S = 60
EXISTS_TIMEOUT_S = 5
_exists: dict[str, bool] = {}
_retry_at: dict[str, float] = {}


def configured() -> bool:
    return bool(config.get("STORAGE_BUCKET") and config.get("GOOGLE_CLOUD_PRIVATE_KEY")
                and config.get("GOOGLE_CLOUD_CLIENT_EMAIL"))


def _service_account() -> dict:
    return {
        "type": "service_account",
        "project_id": config.get("GOOGLE_CLOUD_PROJECT_ID"),
        "private_key_id": config.get("GOOGLE_CLOUD_PRIVATE_KEY_ID"),
        # .env keeps the PEM on one line with literal \n escapes
        "private_key": config.get("GOOGLE_CLOUD_PRIVATE_KEY").replace("\\n", "\n"),
        "client_email": config.get("GOOGLE_CLOUD_CLIENT_EMAIL"),
        "client_id": config.get("GOOGLE_CLOUD_CLIENT_ID"),
        "auth_uri": config.get("GOOGLE_CLOUD_AUTH_URI", "https://accounts.google.com/o/oauth2/auth"),
        "token_uri": config.get("GOOGLE_CLOUD_TOKEN_URI", "https://oauth2.googleapis.com/token"),
        "universe_domain": config.get("GOOGLE_CLOUD_UNIVERSE_DOMAIN", "googleapis.com"),
    }


@lru_cache(maxsize=1)
def _bucket():
    from google.cloud import storage as gcs
    from google.oauth2 import service_account

    creds = service_account.Credentials.from_service_account_info(_service_account())
    return gcs.Client(credentials=creds, project=creds.project_id).bucket(config.get("STORAGE_BUCKET"))


def exists(key: str) -> bool:
    if not configured() or not key:
        return False
    if key in _exists:
        return _exists[key]
    if time.time() < _retry_at.get(key, 0):
        return False
    try:
        found = _bucket().blob(key).exists(timeout=EXISTS_TIMEOUT_S)
    except Exception as exc:
        log.warning("could not check gs://%s (retrying in %ds): %s", key, RETRY_S, exc)
        _retry_at[key] = time.time() + RETRY_S
        return False
    _exists[key] = found
    return found


def signed_url(key: str) -> str | None:
    """A GET URL valid for SIGNED_TTL_S, reused until it is close to expiring."""
    if not exists(key):
        return None
    hit = _signed.get(key)
    if hit and hit[1] - time.time() > 600:
        return hit[0]
    try:
        url = _bucket().blob(key).generate_signed_url(
            version="v4", expiration=timedelta(seconds=SIGNED_TTL_S), method="GET")
    except Exception as exc:
        log.warning("signing gs://%s failed: %s", key, exc)
        return None
    _signed[key] = (url, time.time() + SIGNED_TTL_S)
    return url
