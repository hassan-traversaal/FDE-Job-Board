# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 (App Router, TypeScript) in the existing FDE job-board repo, deployed on Vercel at fde.traversaal.ai. The landing page takes `/`; the job board moves to `/jobs` on the same domain. The board's weekly refresh workflow (`scripts/refresh-board.mjs`, `.github/workflows/refresh-board.yml`) writes into `app/(board)/jobs/data.ts`, which both the board and the home page's counts import. The repo sits on a FAT32 volume, so macOS `._*` fork files appear and must stay out of builds and commits.

## Users

- **Engineers who want to do FDE work.** Software, ML and platform engineers, often senior, who have seen the forward deployed engineer title spread and want the skills. They arrive from Hamza Farooq's LinkedIn posts, Maven, or the job board.
- **Engineering and L&D leaders** who want their team trained as FDEs.
- **Companies that need FDE work done.** Leaders with an AI use case that has stalled between demo and production, looking for engineers who embed with their team and own the build.

## Product Purpose

fde.traversaal.ai is Traversaal's main FDE destination. Its v1 message: **Traversaal is an FDE company, and it also teaches FDE.** It routes each visitor to one of two pillars and nothing more:

1. **Learn**: Traversaal teaches FDE.
   - Claude Code in Practice, Level 1: a free course (`course/`, served on this domain at /signin, /library and /session/<n>). This is the lead offer ("Take our first course for free").
   - The Forward Deployed Engineering Bootcamp on Maven: a live paid cohort.
   - Training for groups and teams: private enterprise programs.
2. **Work with us**: Traversaal does FDE work. Companies engage Traversaal's forward deployed engineers for implementation.

The FDE job board is mentioned and reachable, but it is not a third pillar.

Success: engineers start the free course; companies and team leads start a conversation.

## Positioning

- Traversaal does forward deployed engineering for enterprises and teaches the same craft. Neighbouring course providers do not do the work; neighbouring consultancies do not teach it.
- The method is Traversaal's own (from its customer proposals): Embed → Understand and plan → Prove with a PoC → Scale → Hand over. The customer team owns the code at the end.
- Traversaal tracks the FDE job market itself through the job board on this domain.

## Operating Context

- The free course is Claude Code in Practice: five recorded live sessions with Hamza Farooq and Aishwarya Ashok (Cohort 02, June 2026), 49 chapters, transcripts, and a bot powered by Moment Search that answers from the recordings and jumps to the second. A free account (Clerk) opens it and keeps progress. Learners take the course first; Moment Search is where they ask questions. Moment Search is not an entry point.
- Deliberately deferred from v1, but planned under this domain later: blog, FDE bench, interview prep, hiring, and a broader FDE marketplace. Hamza Farooq agreed to "start with two" pillars to keep v1 quiet.
- Maven bootcamp facts (public): Forward Deployed Engineering Bootcamp, 6-week live cohort, next cohort 14 November to 25 December 2026, $2,500 per seat, 4.9 from 55 ratings, maven.com/boring-bot/ai-system-design.
- Enterprise team training also has a separate page and brochure (repo traversaal-ai/fde-enterprise-training, preview at fde-enterprise-training.vercel.app). This site no longer offers the brochure (removed 2026-10-02); /teams says a design session decides what is taught.
- FDE engagement facts (OneTrace proposal, generic parts): discovery establishes scope, complexity, team and timeline before a quote; on-prem or private-cloud deployment can be scoped; the customer owns the resulting solution.

## Capabilities and Constraints

- No pricing for FDE engagements or team training. Scope drives price.
- Labs case studies are public on traversaal.ai/labs and anonymised. Quote them with the source line "Prior engagement results; scope and outcomes vary." Results as published: retail delivery agent, ~73% of review cases closed automatically; enterprise research agent, 10M+ pages indexed with cited answers; demand forecasting agent, 18.23% MAPE; destination research agent, 30% sales lift reported.
- The job board count is cumulative (997 roles posted 29 May to 27 Sep 2026); never "open now".
- Forms live on this site: /teams (plan a program) and /work-with-us (talk to our engineers), posting to /api/lead, which forwards to LEAD_WEBHOOK_URL. Production refuses submissions until that is set.
- Open: the LEAD_WEBHOOK_URL destination; the program name for team training; a Clerk production instance for the course.

## Brand Commitments

- Traversaal.ai name and logo (coral mark, dark wordmark on light). Coral accent near `#FF4B2B`.
- Type: Geist and Geist Mono, matching the Arya landing page (v11), set by the user on 2026-10-02.
- Light page, white or near-white ground (Hamza asked for a light theme on 2026-09-29).
- **Not hand-drawn.** Hamza rejected the whiteboard/marker concept on 2026-10-01 as informal for an FDE company. No sketch strokes, handwriting fonts or sticky notes.
- Voice: direct, technically literate, evidence-led, active. No em dashes. "Customer team", not "client". "Complimentary" or "free" only where the offer really costs nothing (the free course is genuinely free). No hype, no invented claims, no AI-template phrasing.

## Evidence on Hand

- Hamza Farooq: founder and CEO, former Senior Research Manager at Google and Walmart Labs, adjunct faculty at UCLA and the University of Minnesota, instructor for Stanford Continuing Studies, author of Build an LLM Application (from Scratch) for Manning. Portrait in `public/` once copied.
- Jaya Rajwani: Director of AI, Traversaal.ai.
- Maven reviews of the FDE bootcamp (verbatim, first name and title).
- Labs case studies (above) and the five-step method.
- Workshop photos at The Home Depot and Okta (cleared for training proof).
- Teams trained (logo strip, user request 2026-10-02, from Traversaal's A Foundery proposal): The Home Depot, Okta, Tripadvisor, HBO Max, Chime, SDAIA, Jack in the Box, Orderful.
- All 46 written Maven reviews of the FDE bootcamp (verbatim, fetched 2026-10-02), excluding two by Traversaal employees.
- Not cleared: company logos beyond the trained list above, client names for FDE work, product screenshots, headcounts.

## Product Principles

1. Two doors, nothing else in the way. Every section either helps someone learn FDE or helps someone hire Traversaal for it.
2. The free course is the front door to learning; paid and team options sit behind it, not in front of it.
3. Doing the work is the credential. Show engagement method and published results before biography.
4. Quiet over complete. Deferred areas stay off the v1 page.

## Accessibility & Inclusion

WCAG 2.2 AA contrast, keyboard access, visible focus, 44px targets on mobile, reduced-motion support.
