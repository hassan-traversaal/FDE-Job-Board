"""Traversaal Academy · Claude Code in Practice

    python app.py                       http://127.0.0.1:8300
    python app.py --port 9000 --host 0.0.0.0

Pages (static shells; their data comes from the gated API):
    /                 the welcome page, public (or a redirect to HOME_URL, the site this course sits in)
    /signin           Clerk sign-up / sign-in
    /library          the session library        (sign-in required)
    /session/<n>      one session: player, chapters, transcript, bot

API:
    /auth/config                  what ClerkJS needs, no secrets
    /api/course                   course + session titles (public: it is an open course)
    /api/sessions/<id>            chapters, suggested questions, media     (gated)
    /api/sessions/<id>/transcript cues                                     (gated)
    /api/ask_stream?q=&session=   the bot, Server-Sent Events              (gated, metered)
    /api/frame/<video_id>/<idx>   the slide a live citation matched        (gated)
    /api/progress  GET / PUT      this learner's progress, kept on their account (gated)
    /media/<id>                   the recording, with Range support        (gated)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles

from backend import auth, bot, catalog, config, hamza, logs, progress, storage

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
logs.install()
auth.configure()

app = FastAPI(title="Traversaal Academy", docs_url=None, redoc_url=None, openapi_url=None)

PAGES = {"/": "index.html", "/signin": "signin.html", "/library": "library.html"}
#: Open to everyone: the pages themselves (each guards its own content in the
#: browser), their assets, and the course outline, which is public by design.
PUBLIC_PREFIXES = ("/assets/", "/auth/config", "/api/course", "/api/featured", "/api/reviews", "/healthz", "/favicon")
GATED_PREFIXES = ("/api/", "/media/")
METERED = ("/api/ask_stream",)


#: Each CSS/JS link in a page gets ?v=<content hash>. The files are served with
#: no cache-control, so a browser may keep its copy for hours by heuristic; a
#: changed file gets a new URL, so after a deploy no one sees yesterday's styles.
_ASSET_LINK = re.compile(r'(?<=")/assets/(?:css|js)/[\w.-]+\.(?:css|js)(?=")')
_versions: dict[str, tuple[int, int, str]] = {}


def _versioned(url: str) -> str:
    """url?v=<first 10 hex of its sha256>, recomputed only when the file changes."""
    p = config.WEB_DIR / url.lstrip("/")
    try:
        st = p.stat()
        hit = _versions.get(url)
        if not (hit and hit[:2] == (st.st_mtime_ns, st.st_size)):
            hit = _versions[url] = (st.st_mtime_ns, st.st_size, hashlib.sha256(p.read_bytes()).hexdigest()[:10])
    except OSError:
        return url                      # a missing file stays a plain (404ing) link
    return f"{url}?v={hit[2]}"


def _page(name: str) -> Response:
    html = (config.WEB_DIR / name).read_text(encoding="utf-8")
    html = _ASSET_LINK.sub(lambda m: _versioned(m.group(0)), html)
    return Response(html, media_type="text/html; charset=utf-8", headers={"cache-control": "no-cache"})


@app.middleware("http")
async def gate(request: Request, call_next):
    path = request.url.path
    if any(seg in (".", "..") for seg in path.split("/")):
        return JSONResponse({"error": "bad path"}, status_code=400)
    claims = None
    request.state.claims = None
    if path.startswith(GATED_PREFIXES) and not path.startswith(PUBLIC_PREFIXES) and auth.enabled():
        claims, reason = auth.authenticate(request)
        request.state.claims = claims
        if claims is None:
            if auth.misconfigured():
                return JSONResponse({"error": "sign-in is not configured on this server"}, status_code=503)
            return JSONResponse({"error": "sign in required", "reason": reason}, status_code=401,
                                headers={"cache-control": "no-store"})
    if path.startswith(METERED):
        wait = auth.rate_wait(auth.caller_key(request, claims))
        if wait:
            return _over_limit(wait)
    return await call_next(request)


def _over_limit(wait_s: int) -> Response:
    """The hourly question limit, said in the chat. EventSource cannot read a
    429 (it only sees "the connection failed"), so the limit arrives as a normal
    stream: one error event the page shows as the answer, then end."""
    msg = json.dumps({"stage": "error", "detail": {"message": auth.limit_message(wait_s), "limit": True}})
    return Response(f"data: {msg}\n\ndata: {json.dumps({'stage': 'end', 'status': 'done'})}\n\n",
                    media_type="text/event-stream",
                    headers={"cache-control": "no-store", "retry-after": str(wait_s)})


# --- pages -----------------------------------------------------------------------

@app.get("/")
def index():
    if config.HOME_URL:
        # Inside fde.traversaal.ai the landing page is that site's; it links in through /signin.
        return RedirectResponse(config.HOME_URL + "/", status_code=307)
    return _page(PAGES["/"])


@app.get("/signin")
def signin():
    return _page(PAGES["/signin"])


@app.get("/library")
def library():
    return _page(PAGES["/library"])


@app.get("/library/")
def library_slash():
    return RedirectResponse("/library", status_code=308)


@app.get("/session/{n}")
def session_page(n: str):
    if not catalog.session(f"s{n}"):
        return RedirectResponse("/library", status_code=307)
    return _page("session.html")


# --- api -------------------------------------------------------------------------

@app.get("/auth/config")
def auth_config():
    return JSONResponse(auth.public_config(), headers={"cache-control": "no-store"})


@app.get("/api/course")
def api_course():
    """The outline only: enough for the welcome page. No chapters, no media."""
    c = catalog.course()["course"]
    return {"course": c, "sessions": [
        {k: s[k] for k in ("id", "number", "bonus", "kicker", "title", "tagline", "date",
                           "duration_ms", "lead", "topics", "cover")}
        | {"chapter_count": len(s["chapters"])}
        for s in catalog.sessions()]}


@app.get("/api/featured")
def api_featured():
    """One real, curated answer for the welcome page's demo. Public on purpose."""
    f = catalog.course().get("featured") or {}
    sid, qi = f.get("session", "s1"), int(f.get("question", 0))
    items = catalog.curated(sid)
    if not items:
        return {}
    item = items[min(qi, len(items) - 1)]
    s = catalog.session(sid) or {}
    return {"session": sid, "number": s.get("number"), "title": s.get("title"),
            "duration_ms": s.get("duration_ms"), "q": item["q"], "answer": item["answer"],
            "chapters": [{"start_ms": c["start_ms"], "title": c["title"]} for c in s.get("chapters", [])],
            "citations": [{"n": i + 1, "start_ms": int(c["start"]) * 1000, "end_ms": int(c["end"]) * 1000,
                           "speaker": c.get("speaker", ""), "text": c.get("quote", ""),
                           "thumb": catalog.nearest_thumb(sid, int(c["start"]) * 1000)}
                          for i, c in enumerate(item.get("citations", []))]}


@app.get("/api/progress")
def api_progress_get(request: Request):
    """This learner's progress across sessions, from their account."""
    uid = auth.user_id(request.state.claims)
    if not uid:
        return {"enabled": False}          # gate off: the browser keeps progress itself
    try:
        return {"enabled": True, "sessions": progress.read(uid)}
    except Exception as exc:
        logging.getLogger("academy.progress").warning("read failed: %s", exc)
        raise HTTPException(503, "progress is unavailable right now")


@app.put("/api/progress")
async def api_progress_put(request: Request):
    """Merge this browser's progress into the account's, and return the result."""
    uid = auth.user_id(request.state.claims)
    if not uid:
        return {"enabled": False}
    raw = await request.body()
    if len(raw) > 32_000:
        raise HTTPException(413, "too large")
    try:
        body = json.loads(raw or b"{}")
    except ValueError:
        raise HTTPException(400, "not JSON")
    try:
        return {"enabled": True, "sessions": progress.write(uid, body.get("sessions") or {})}
    except Exception as exc:
        logging.getLogger("academy.progress").warning("write failed: %s", exc)
        raise HTTPException(503, "progress is unavailable right now")


@app.get("/api/reviews")
def api_reviews():
    """Maven reviews for the welcome page. Public: they are public on Maven."""
    return catalog.reviews()


@app.get("/api/sessions")
def api_sessions():
    return {"course": catalog.course()["course"], "sessions": catalog.sessions()}


@app.get("/api/sessions/{sid}")
def api_session(sid: str):
    s = catalog.session(sid)
    if not s:
        raise HTTPException(404, "no such session")
    return {**s, "bot": bot.mode()}


@app.get("/api/sessions/{sid}/transcript")
def api_transcript(sid: str):
    if not catalog.session(sid):
        raise HTTPException(404, "no such session")
    t = catalog.transcript(sid)
    return {"session": sid, "duration_ms": t.get("duration_ms", 0), "cues": t.get("cues", [])}


@app.get("/api/ask_stream")
def api_ask(q: str = "", session: str = "all"):
    return StreamingResponse(bot.ask_stream(q, session), media_type="text/event-stream",
                             headers={"cache-control": "no-cache", "x-accel-buffering": "no"})


@app.get("/api/frame/{video_id}/{idx}")
def api_frame(video_id: str, idx: int):
    """The frame a live citation matched, fetched from Hamza with the key."""
    if not video_id.startswith("hamza-s") or idx < 0:
        raise HTTPException(404, "no such frame")
    body = hamza.frame(video_id, idx)
    if not body:
        raise HTTPException(404, "no such frame")
    return Response(content=body, media_type="image/jpeg",
                    headers={"cache-control": "private, max-age=86400"})


@app.get("/media/{sid}")
def media(sid: str):
    """The recording. A file in media/ is served here (with Range support);
    otherwise this redirects to a short-lived signed GCS URL, so the browser
    streams and seeks against the bucket and no video bytes pass through us."""
    p = catalog.media_file(sid)
    if p:
        return FileResponse(p, media_type=catalog.MEDIA_TYPES.get(p.suffix, "application/octet-stream"),
                            headers={"cache-control": "private, max-age=3600"})
    url = storage.signed_url(catalog.gcs_key(sid))
    if not url:
        raise HTTPException(404, "recording not available")
    # 307 keeps it a GET; no-store so an expired signature is never replayed from cache.
    return RedirectResponse(url, status_code=307, headers={"cache-control": "no-store"})


@app.get("/healthz")
def healthz():
    ss = catalog.sessions()
    return {"ok": True, "sessions": len(ss),
            "chapters": sum(len(s["chapters"]) for s in ss),
            "recordings": sum(1 for s in ss if s["media"]),
            "bot": bot.mode(),
            "auth": "public" if not auth.enabled() else ("on" if auth.armed() else "misconfigured")}


@app.get("/favicon.ico")
def favicon():
    return FileResponse(config.WEB_DIR / "assets" / "img" / "favicon.svg", media_type="image/svg+xml")


app.mount("/assets", StaticFiles(directory=config.WEB_DIR / "assets"), name="assets")


if __name__ == "__main__":
    import uvicorn
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=config.PORT)
    ap.add_argument("--reload", action="store_true")
    a = ap.parse_args()
    # Pass the app object (not "app:app") unless reloading, so the module and
    # its config load once rather than twice.
    uvicorn.run("app:app" if a.reload else app, host=a.host, port=a.port, reload=a.reload)
