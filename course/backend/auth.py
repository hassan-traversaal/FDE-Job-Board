"""Clerk session gate. Same instance and same rules as moment-internal-app.

Ported from moment-internal-app/clerk_auth.py: one job, answer "is this request
from a signed-in user?". Nothing is stored; Clerk is the user list.

  * keys present, token missing/expired/invalid  -> not signed in, never guess
  * no keys and ALLOW_PUBLIC unset               -> fail CLOSED (503), loudly
  * ALLOW_PUBLIC=true                            -> gate off, for local demos

The browser never sees the secret key: /auth/config hands the page the
publishable key plus the Frontend API host, and ClerkJS does the rest.
"""
from __future__ import annotations

import base64
import logging
import math
import time
from typing import Any

from . import config

log = logging.getLogger("academy.auth")

_pk = ""
_clerk: Any = None
_allow_public = False
_public_origins: list[str] = []
_extra_parties: list[str] = []

#: Every answer will eventually be an LLM call billed to us. Counted per process.
ASK_RATE_LIMIT = 25
ASK_RATE_WINDOW_S = 3600
_hits: dict[str, list[float]] = {}

#: EventSource and <video> cannot send an Authorization header, so the pages put
#: a short-lived token here instead. Read, never logged, never stored.
TOKEN_PARAM = "__clerk_token"


def configure() -> None:
    global _pk, _clerk, _allow_public, _public_origins, _extra_parties
    _allow_public = config.get("ALLOW_PUBLIC").lower() in ("1", "true", "yes")
    _public_origins = [o.strip().rstrip("/") for o in config.get("PUBLIC_ORIGIN").split(",") if o.strip()]
    _extra_parties = [p.strip() for p in config.get("CLERK_AUTHORIZED_PARTIES").split(",") if p.strip()]
    _pk = config.get("CLERK_PUBLISHABLE_KEY")
    sk = config.get("CLERK_SECRET_KEY")
    if _pk and sk:
        from clerk_backend_api import Clerk
        _clerk = Clerk(bearer_auth=sk)
        log.info("Clerk gate ON (frontend API %s)", frontend_api())
    elif _allow_public:
        log.warning("Clerk gate OFF by ALLOW_PUBLIC=true: the library is open to everyone")
    else:
        log.error("Clerk keys are MISSING and ALLOW_PUBLIC is not set: gated pages answer 503 "
                  "until CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY are set")


def armed() -> bool:
    return _clerk is not None


def clerk():
    """The Clerk Backend API client (only when the gate is armed)."""
    if _clerk is None:
        raise RuntimeError("Clerk is not configured")
    return _clerk


def user_id(claims: dict[str, Any] | None) -> str | None:
    """The signed-in person's stable id, or None (gate off, or not a person).

    Today a Clerk user id ("user_..."). Moving to another OAuth provider means
    returning its stable subject here instead; nothing that stores progress
    needs to know which provider it was."""
    sub = str((claims or {}).get("sub") or "")
    return sub if sub.startswith("user_") else None


def enabled() -> bool:
    return not _allow_public


def misconfigured() -> bool:
    return not _allow_public and _clerk is None


def frontend_api(pk: str | None = None) -> str:
    """pk_test_<base64 of 'host$'> -> host. Same derivation ClerkJS uses."""
    pk = pk or _pk
    try:
        return base64.b64decode(pk.split("_")[2] + "==").decode().rstrip("$")
    except Exception:
        return ""


# Dressed in this site's tokens (web/assets/css/academy.css). #C4381F is the
# coral that clears AA with white text; the lighter brand coral does not.
APPEARANCE: dict[str, Any] = {
    "variables": {
        "colorPrimary": "#C4381F", "colorPrimaryForeground": "#FFFFFF",
        "colorBackground": "#FFFFFF", "colorForeground": "#1A1612",
        "colorMutedForeground": "#6B6357", "colorBorder": "#E6DFD3",
        "colorInput": "#FFFFFF", "colorInputForeground": "#1A1612",
        "borderRadius": "0.75rem",
        "fontFamily": "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        "fontFamilyButtons": "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        "fontSize": "1rem",
        "spacing": "1.1rem",
    },
    "options": {"socialButtonsVariant": "blockButton", "unsafe_disableDevelopmentModeWarnings": True},
    "elements": {
        "cardBox": {"width": "min(440px, 92vw)", "boxShadow": "0 40px 90px -40px rgba(26,22,18,.45)"},
        "card": {"padding": "1.75rem 2rem 1.5rem"},
        # The sign-in page sets its own serif heading, so the card's would repeat it.
        "header": {"display": "none"},
        "headerTitle": {"fontSize": "1.4rem", "fontFamily": "'Playfair Display', Georgia, serif",
                        "fontStyle": "italic", "fontWeight": "500"},
        "headerSubtitle": {"fontSize": "0.95rem"},
        "socialButtonsBlockButton": {"minHeight": "3rem", "fontSize": "0.95rem"},
        "userButtonAvatarBox": {"width": "2.1rem", "height": "2.1rem"},
        "userButtonPopoverActionButton__manageAccount": {"display": "none"},
        "userButtonPopoverCard": {"width": "15rem"},
        "userButtonPopoverMain": {"padding": "0.6rem"},
        "userButtonPopoverActions": {"padding": "0"},
        "userButtonPopoverActionButton": {"minHeight": "2.25rem", "fontSize": "0.8125rem", "padding": "0.4rem 0.6rem"},
        "userButtonPopoverFooter": {"display": "none"},
        "userPreviewAvatarBox": {"width": "1.75rem", "height": "1.75rem"},
        "userPreviewMainIdentifier": {"fontSize": "0.8125rem"},
        "userPreviewSecondaryIdentifier": {"fontSize": "0.75rem"},
    },
}

LOCALIZATION: dict[str, Any] = {
    "dividerText": "or use email",
    "signUp": {"start": {
        "title": "Take your seat",
        "subtitle": "Free account. All five sessions, every chapter, and a bot that cites the exact second.",
        "actionText": "Been here before?", "actionLink": "Log in"}},
    "signIn": {"start": {
        "title": "Welcome back",
        "subtitle": "Pick up where you left off.",
        "actionText": "New here?", "actionLink": "Create a free account"}},
}


def public_config() -> dict[str, Any]:
    on = armed()
    return {"enabled": on,
            "gate": enabled(),
            "misconfigured": misconfigured(),
            "publishable_key": _pk if on else "",
            "frontend_api": frontend_api() if on else "",
            "appearance": APPEARANCE if on else {},
            "localization": LOCALIZATION if on else {}}


# --- request side --------------------------------------------------------------

class _CIHeaders(dict):
    """Case-insensitive headers; the Clerk SDK asks for "Authorization"."""

    def __init__(self, data):
        super().__init__({str(k).lower(): v for k, v in dict(data).items()})

    def get(self, key, default=None):
        return super().get(str(key).lower(), default)

    def __getitem__(self, key):
        return super().__getitem__(str(key).lower())

    def __contains__(self, key):
        return super().__contains__(str(key).lower())


class _HeaderOnly:
    __slots__ = ("headers",)

    def __init__(self, headers):
        self.headers = _CIHeaders(headers)


def _as_requestish(request):
    """Present ?__clerk_token= as an Authorization header. A real header wins."""
    token = (request.query_params.get(TOKEN_PARAM) or "").strip()
    if not token or request.headers.get("authorization"):
        return request
    headers = dict(request.headers)
    headers["authorization"] = "Bearer " + token
    return _HeaderOnly(headers)


def _origins(request) -> list[str]:
    if _public_origins:
        return list(_public_origins)
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
    return [f"{proto}://{host}"]


def authenticate(request) -> tuple[dict[str, Any] | None, str]:
    if _allow_public:
        return {}, "auth disabled"
    if _clerk is None:
        return None, "auth is not configured"
    from clerk_backend_api.security.types import AuthenticateRequestOptions
    try:
        state = _clerk.authenticate_request(
            _as_requestish(request),
            AuthenticateRequestOptions(authorized_parties=[*_origins(request), *_extra_parties]))
    except Exception as exc:
        return None, f"{type(exc).__name__}: {exc}"
    if state.is_signed_in:
        return dict(state.payload or {}), ""
    return None, str(state.reason or state.message or "not signed in")


def rate_wait(key: str) -> int:
    """0 if this caller may ask now (and counts the question); otherwise the
    seconds until their oldest question in the window ages out."""
    now = time.time()
    seen = [t for t in _hits.get(key, ()) if now - t < ASK_RATE_WINDOW_S]
    _hits[key] = seen
    if len(seen) < ASK_RATE_LIMIT:
        seen.append(now)
        return 0
    return max(1, math.ceil(seen[0] + ASK_RATE_WINDOW_S - now))


def limit_message(wait_s: int) -> str:
    mins = math.ceil(wait_s / 60)
    when = ("in under a minute" if wait_s < 60 else "in about an hour" if mins >= 60
            else f"in about {mins} minute{'' if mins == 1 else 's'}")
    return (f"You've reached this hour's limit of {ASK_RATE_LIMIT} questions. "
            f"You can ask again {when}.")


def caller_key(request, claims: dict[str, Any] | None) -> str:
    sub = str((claims or {}).get("sub") or "")
    if sub:
        return sub
    h = request.headers
    ip = (h.get("fly-client-ip") or (h.get("x-forwarded-for") or "").split(",")[0].strip()
          or getattr(getattr(request, "client", None), "host", None) or "unknown")
    return "ip:" + ip
