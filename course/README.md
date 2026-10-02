# Traversaal Academy · Claude Code in Practice

Our highest-rated course, open-sourced: five live sessions with Hamza Farooq and
Aishwarya Ashok, free to watch, cut into chapters, each with a bot that answers
from the recording and jumps to the exact second.

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
copy .env.example .env          # Clerk keys (already filled in locally)
.venv\Scripts\python app.py     # http://127.0.0.1:8300
```

## The flow

| Page | What it is | Gate |
|---|---|---|
| `/` | Welcome. A terminal types a greeting, then the field of glyphs blooms into a starburst; the rail cycles the five sessions | public |
| `/signin` | Clerk sign-up / log-in, same instance as moment-internal-app | public |
| `/library` | The five sessions. Each row is a chapter strip you can click into; "Pick up at …" resumes your last second. One **Ask the course** button (bottom right) opens a side panel that asks across every session, or one. A cited moment plays inside the panel from that second, so asking never leaves the library; "Open in the session" is there for the full player. `/library?ask` opens it directly | sign-in |
| `/session/<n>` | Overview first: what the session covers, chapters as an accordion, Get started / Start chapter | sign-in |
| `/session/<n>?watch` | The player: chapter list that opens and closes, chapter bar under the video, transcript, and the session's bot. Stops at the end of each chapter unless Autoplay is on. `?t=SECONDS` lands on a second | sign-in |

Pages are static shells. Each gated page checks the Clerk session in the
browser before showing anything, and every API call it makes carries a fresh
token, which the server verifies (`backend/auth.py`, ported from
moment-internal-app's `clerk_auth.py`). `ALLOW_PUBLIC=true` opens everything
for a local demo.

## What is real and what is a placeholder

**Real:** the five sessions are the Cohort 02 Zoom recordings. Transcripts are
Zoom's own speaker-attributed VTTs (4,124 cues). The 49 chapters and the 25
suggested questions were written from those transcripts, and every timestamp
and quote in them was checked against a real transcript line. Thumbnails are
actual frames from each recording, one per minute plus one per chapter.
Session 3 has no video, so it uses slides from the Module 03 deck.

**Placeholder (for now):**

- **Videos (now real).** All five recordings stream from the same GCS bucket
  demo/hamza uses (`hamza_moment_search/hamza-sN/source.mp4`). `/media/<id>`
  answers with a 6-hour signed URL and the browser streams and seeks straight
  from Google, so no video bytes pass through this app. That needs
  `STORAGE_BUCKET` and the `GOOGLE_CLOUD_*` service account in `.env`. A file
  dropped in `media/` takes priority (useful offline), and with neither, a
  session falls back to the preview player (frames + captions).
- **The bot is live.** Each session's bot asks the deployed Hamza MomentSearch
  app (`HAMZA_API_URL`, `HAMZA_API_KEY` in `.env`), scoped to that session:
  search by meaning and by what was on screen, then a streamed answer citing
  the moments. If Hamza can't be reached, the built-in demo bot answers
  instead (curated answers + transcript search) and the chat says so.

## The bot: how the live answer gets here

```
browser ──/api/ask_stream?q=&session=s2──▶ this app (sign-in + 25 questions/hour per user)
                                           │  backend/hamza.py, key stays here
                                           ▼
                     Hamza app  GET /ask_stream?q=&session=2   (Bearer academy key)
```

`backend/hamza.py` passes the stream through and translates it: Hamza's
pipeline stages fold onto the four the page draws, and each citation gains its
chapter and this site's session id. Its picture is Hamza's matched frame,
fetched through `/api/frame/<video_id>/<idx>` with the key. `backend/bot.py` picks
live or demo and falls back to demo when Hamza is down. `/healthz` reports
`"bot": "live"` or `"demo"`.

## Progress: kept on the account

What someone has watched and marked done follows their account, not their
browser. The pages call `GET` / `PUT /api/progress`; `backend/progress.py` keeps
it in the Clerk user's private metadata (under `academy`, about 1 KB for the
whole course) and merges every device's copy: the furthest point in each
chapter, the resume spot from the most recent watch, the newest tick or untick.

The browser keeps a working copy per signed-in person
(`localStorage` keys `academy:u:<user id>:…`), so pages read it instantly and
two accounts on one browser never share it. Progress saved before accounts were
connected moves into whoever signs in first. With `ALLOW_PUBLIC=true` there is
no account, and progress stays in the browser as before.

Switching away from Clerk (to plain Google OAuth, say) only touches the
backend: `auth.user_id()` returns the new provider's stable id, and
`progress.STORE` becomes a small database table keyed on it. The API, the
merge and the pages stay the same; existing progress is a one-time copy out of
Clerk metadata.

## Layout

```
app.py                  FastAPI: pages, API, media (Range requests), Clerk gate
backend/
  auth.py               Clerk session gate + sign-in card appearance/wording
  catalog.py            course, sessions, chapters, transcripts, search chunks
  bot.py                picks the bot: live Hamza, or the demo bot (curated + BM25) as fallback;
                        session=all asks the whole course
  hamza.py              the live bot: pass-through to the Hamza API, citation mapping, frame proxy
  progress.py           each learner's progress on their account (Clerk metadata), and the merge
  logs.py               keeps the Clerk token in query strings out of the access log
  config.py             .env reader
data/
  course.json           course meta, session order/dates, the welcome-page demo answer
  sessions/sN/
    transcript.json     from scripts/build_transcripts.py
    content.json        title, tagline, chapters, suggested Q&A (cover_chapter picks the cover)
web/
  index.html            welcome (assets/js/glyphfield.js is the moving background)
  signin.html  library.html  session.html
  assets/css  assets/js  assets/img
  assets/frames/sN/     t/MMMM.jpg per minute, chNN.jpg per chapter, cover.jpg
media/                  the recordings, when added (gitignored)
Dockerfile  fly.toml    the deployed image and the Fly app (see "Deploying")
scripts/
  fly_secrets.py        .env credentials -> fly secrets (an allowlist; values never printed)
  build_transcripts.py  Zoom VTT -> transcript.json
  build_frames.py       recordings/decks -> frames (needs ffmpeg)
```

## Deploying (Fly.io)

One app, one always-on machine in `iad`, next to the Hamza bot. `fly.toml`
explains each choice; the short version:

```powershell
fly auth login
fly apps create fde-traversaal-academy      # first time only
python scripts\fly_secrets.py               # which .env keys go to Fly (names only)
python scripts\fly_secrets.py --apply       # send them as fly secrets
fly deploy --ha=false                       # by hand; normally a push does it
```

- **Push to main deploys.** `.github/workflows/deploy.yml` checks the app
  starts (every `data/*.json` parses), deploys, then confirms the live
  `/healthz` has sign-in on. Docs-only and `scripts/` pushes skip it. Needs
  one repository secret, `FLY_API_TOKEN`, from
  `fly tokens create deploy -a fde-traversaal-academy`.

- **Config:** credentials are `fly secrets`; non-secret settings
  (`PUBLIC_ORIGIN`, `HAMZA_API_URL`) are in `fly.toml [env]`. `.env` never
  enters the image: `.dockerignore` is an allowlist (app.py, backend/, data/,
  web/), so `media/` and `scripts/` stay out too.
- **One machine, on purpose.** The 25-questions-an-hour limit is counted in
  memory, so a second machine would double it. Move the count to Redis before
  scaling out.
- **Deploys are blue-green:** the new machine must pass `/healthz` before it
  takes traffic, and answers in flight get 25 s to finish.
- **Try the image locally:** `docker build -t traversaal-academy .` then
  `docker run -p 8080:8080 -v "${PWD}\.env:/app/.env:ro" traversaal-academy`.
- **Before the public launch:** the Clerk keys are a development instance
  (`pk_test_`). A production instance needs the custom domain; add that domain
  to `PUBLIC_ORIGIN` too.

## Rebuilding the data

```powershell
python scripts\build_transcripts.py                # after a new Zoom export
python scripts\build_frames.py --chapters          # after editing chapters
python scripts\build_frames.py --minutes --force   # re-grab every minute frame
python scripts\fetch_reviews.py                  # refresh the Maven reviews on the welcome page
```

Keyboard on a session page: `space`/`k` play, `j`/`l` ±10s, `←`/`→` ±5s,
`c` captions, `/` ask.
