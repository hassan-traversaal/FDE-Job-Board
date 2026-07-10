# FDE Job Board

A curated Next.js job board for **Forward Deployed Engineer** roles across the United States, Europe, India, and globally distributed teams.

Built as a guided career asset for the [AI System Design bootcamp](https://maven.com/boring-bot/ai-system-design).

**[View the live job board →](https://fde-field-guide.aishwarya-ashok.chatgpt.site)**

## Why this exists

Forward Deployed Engineering sits between software engineering, applied AI, product thinking, and customer delivery. The title is still inconsistent across companies, which makes relevant openings surprisingly difficult to find in one place.

This board brings together strong FDE opportunities and closely equivalent deployment-engineering roles without turning the experience into another generic technology-job feed.

## What is included

- 55 current or recently active roles
- Remote and remote-eligible opportunities
- A primarily US-focused selection with dedicated Europe and India coverage
- Exact FDE titles plus a small number of clearly equivalent deployment roles
- Location eligibility, seniority, compensation, domain, and skill signals
- Search and filters for region and published compensation
- Direct links to employer pages or credible specialist listings

## Curation approach

A role is included when it meets most of these signals:

1. The work is explicitly forward deployed, deployment-focused, or embedded with customers.
2. The engineer is expected to build or integrate production systems—not only advise or sell.
3. The listing has a clear geographic or remote-work boundary.
4. The source is an employer careers page or an established specialist job board.
5. It is not an obvious duplicate or country-specific mirror of the same opening.

Job listings change quickly. Always confirm that the role is still open and that you meet its location requirements before applying.

## Using the board

- Filter by **US**, **Europe**, **India**, or **Global** eligibility.
- Search by company, technical skill, or domain such as healthcare, voice AI, fintech, or developer tools.
- Enable **Pay shown** to see only roles with a published compensation range.
- Use the role tags to distinguish areas such as applied AI, integrations, data platforms, and agent deployment.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed in the terminal.

To validate a production build:

```bash
npm run build
```

## Project structure

```text
app/page.tsx      Job data, filters, and page structure
app/globals.css   Editorial visual system and responsive styles
app/layout.tsx    Page metadata and root layout
public/           Static assets
```

## Contributing

If you find a strong FDE role that should be included, open an issue with:

- Company and role title
- Direct job-posting URL
- Hiring region
- Remote, hybrid, or on-site status
- Published compensation, if available

Please avoid recruiter reposts, expired listings, and duplicate geographic mirrors.

## Course

The board accompanies the [AI System Design bootcamp by Boring Bot](https://maven.com/boring-bot/ai-system-design), a practical course for designing and building production-grade AI systems.

---

Curated and maintained by [Aishwarya Ashok](https://github.com/aishwaryaashok14).
