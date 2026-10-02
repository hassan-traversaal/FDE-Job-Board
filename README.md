# Traversaal FDE

The website for **fde.traversaal.ai**: Traversaal builds enterprise AI agents and teaches forward deployed engineering.

The first version has two main paths: Learn (the free Level 1 course, the Maven bootcamp and private team training) and Work with us (FDE implementation). The job board is at `/jobs`.

## Pages

| Route | Served by | Purpose |
| --- | --- | --- |
| `/` | this site | Learn and Work with us, with the engagement method, results and training proof |
| `/teams` | this site | Short form to plan a private team program |
| `/work-with-us` | this site | Short form to discuss an implementation, with Hamza and Jaya's profiles |
| `/jobs` | this site | Server-rendered tracked roles with search, region, role-family and pay filters |
| `/signin` | course app | Free account for the Level 1 course (Clerk sign-up and sign-in) |
| `/library` | course app | The five sessions of Claude Code in Practice (signed in) |
| `/session/<n>` | course app | One session: player, chapters, transcript and the bot (signed in) |

Every "Start the free course" link goes to `/signin?next=/library`. A signed-in visitor goes straight to the library.

## The free course (`course/`)

`course/` is the Level 1 course, Claude Code in Practice. It was moved in from [traversaal-ai/Claude-Code-Traversaal-Academy](https://github.com/traversaal-ai/Claude-Code-Traversaal-Academy) at commit `55b1235`, and its full history stays in that repo. It is a FastAPI app with plain HTML and JS pages, deployed on its own to Fly.io as `fde-traversaal-academy`. `course/README.md` covers its sign-in, bot, progress and deploy in detail.

This site serves the course on its own domain. `next.config.ts` rewrites the course's pages, `/assets`, `/auth/config`, `/media` and its `/api/*` routes to the course app. `/api/lead` stays with this site. As a result, the course's logo and "Back" links land on this home page. The course app's own welcome page is not used: with `HOME_URL` set, its `/` redirects here.

| Where | Course origin |
| --- | --- |
| `npm run dev` | `http://127.0.0.1:8300` (run the course app locally) |
| Production build | `https://fde-traversaal-academy.fly.dev` |
| Either | `COURSE_ORIGIN` overrides it |

Run both locally:

```sh
python3 -m venv --copies .course-venv    # outside FAT/exFAT volumes, drop --copies
.course-venv/bin/pip install -r course/requirements.txt
ALLOW_PUBLIC=true .course-venv/bin/python course/app.py   # :8300, no sign-in, demo bot, preview player
npm run dev -- --port 3200
```

With `ALLOW_PUBLIC=true` there is no sign-in, the bot answers in demo mode and sessions play as frame previews. Real sign-in, recordings and the live bot need the Clerk, GCS and Hamza keys in `course/.env` (see `course/.env.example`). In production they live in `fly secrets`.

Before this goes live:

1. Deploy this site with the rewrites, so `fde.traversaal.ai/signin` reaches the course.
2. Deploy the course from `course/`, either with `fly deploy --ha=false` or the manual **Deploy the free course** workflow (`.github/workflows/deploy-course.yml`, which needs a `FLY_API_TOKEN` secret). Its `fly.toml` adds `https://fde.traversaal.ai` to `PUBLIC_ORIGIN`, so Clerk accepts sessions minted there. It also sets `HOME_URL`.
3. Clerk is still a development instance (`pk_test_`). A production instance needs `fde.traversaal.ai` added as its domain.

The original repo still deploys the same Fly app when its main branch changes. Keep one source for the course; once that is this repo, enable the workflow's push trigger.

## Run locally

Requires Node.js 22.13 or newer.

```sh
npm ci
npm run dev -- --port 3200
```

For a separate checkout with a symlinked `node_modules`, use `--webpack` with the dev command. The production build already uses Webpack.

```sh
npm run lint
npm run test:lead
npm run build
npm run start -- --port 3200
npm run test:site
```

`test:lead` runs the actual lead route with a mocked delivery service, without sending external requests. `test:site` checks the four public pages, share metadata, the sitemap and the shared role count on a running local server. When the course app is reachable, it also checks the course's sign-in page through the rewrites. Set `SITE_URL` to use another local port.

## Form delivery

Set `LEAD_WEBHOOK_URL` on the host to receive JSON requests from `/teams` and `/work-with-us`. The payload includes the request kind (`program` or `engagement`), contact details, optional choices and note.

Without a webhook, the API returns 503 in both development and production. The forms preserve the visitor's inputs and show a direct contact option. Success appears only after the delivery service accepts the request.

## Job data and refresh

`app/(board)/jobs/data.ts` contains the cumulative tracked listings and update label. Both the home page and job board read it. The count describes tracked roles, rather than roles confirmed open today; visitors should verify availability with the employer.

`scripts/refresh-board.mjs` and `.github/workflows/refresh-board.yml` handle the weekly refresh on Mondays at 09:00 UTC. The workflow requires the `ANTHROPIC_API_KEY` GitHub Actions secret and writes only the data module.

Filter state is stored in `?q=&region=&family=&pay=1`. Shared URLs and browser navigation use the same state. Clear filters removes those parameters while retaining unrelated parameters and the page fragment.

## Project structure

```text
app/(site)/      Home page, forms, reviews, shared navigation and site styles
app/(board)/     Job board, filters, role classification and listing data
app/api/lead/    Form validation and webhook delivery
app/brand.css    Shared tokens, buttons, navigation and footer
course/          The free Level 1 course: FastAPI app, pages, data, Fly config
public/site/     Brand assets, photos, trained-team logos and share image
```

## Remaining inputs

- The destination webhook for form delivery.
- A Clerk production instance for the course before a public launch.

`PRODUCT.md` holds the product constraints, and `.impeccable/surfaces/` holds the approved visual direction.
