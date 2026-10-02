---
target: fde.traversaal.ai home, subpages and brochure
total_score: 21
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 4
target_identity: "file:/Volumes/KINGSTON/2. Desktop/Traversaal/FDE/app/(site)/page.tsx"
target_fingerprint: "sha256:44a08da5179b43c5094414ce23b7c4ebd41b95cc23965ad56f942df26bab52da"
target_path: /Volumes/KINGSTON/2. Desktop/Traversaal/FDE/app/(site)/page.tsx
timestamp: 2026-10-02T12-27-55Z
slug: app-site-page-tsx
---
Method: dual-agent (A: design review · B: detector + standards) plus brochure review

## Design Health Score (before fixes)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | No current-page state in nav |
| 2 | Match system / real world | 3 | MAPE and Moment Search unexplained |
| 3 | User control and freedom | 2 | No mobile nav; role marquee could not be paused |
| 4 | Consistency and standards | 2 | Contact label drift; step numbering styles |
| 5 | Error prevention | 3 | Solid inline validation |
| 6 | Recognition over recall | 3 | Doors far down on mobile |
| 7 | Flexibility and efficiency | n/a | Persuade surface |
| 8 | Aesthetic and minimalist design | 2 | Rating x3, method x2, trained proof x2 |
| 9 | Error recovery | 3 | Specific errors, email fallback |
| 10 | Help and documentation | n/a | Marketing surface |
| Total | | 21/32 | Acceptable |

## Priority issues
- [P1] Mobile had no navigation.
- [P1] Job board shipped all 997 jobs as client JS (571KB chunk); home count read the board file with fs, fragile on Workers.
- [P1] /work-with-us had no trust signal at the conversion point.
- [P1] Role marquee failed WCAG 2.2.2 (no pause), inputs had a faint focus ring.
- [P2] Results ledger tall and quiet; MAPE read as a loss.
- [P2] Repetition: rating x3, method twice, step pills in the Work door.
- [P2] No og:image; subpages shared the home page's OG url and title.
- [P2] Course player is a placeholder until the real course is supplied (open).
- Brochure: hedging repeated 4x, duplicate photo and logo strip, empty page bottoms, print text below 9pt.
