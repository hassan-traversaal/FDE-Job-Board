import type { Job } from "./data";

export const regions = ["All", "US", "Europe", "India", "Global"] as const;
export const roleFamilies = ["All roles", "Core FDE", "Applied AI / ML", "Data Engineering", "Solutions / Implementation", "Deployment Strategy", "Field Architecture", "Leadership", "Early Career"] as const;

// "$320,000 - $405,000" -> "$320k–$405k"; ranges already written short pass through.
export function shortPay(salary?: string) {
  if (!salary) return undefined;
  return salary
    .replace(/(\d{1,3}(?:,\d{3})+)/g, (n) => {
      const v = Number(n.replace(/,/g, ""));
      return v >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}k`;
    })
    .replace(/\s*-\s*/, "–");
}

export function postedTimestamp(posted: string) {
  if (posted === "Current" || posted === "Live" || posted === "Evergreen") return Infinity;
  // Range labels ("28 Jul – 3 Aug 2026") sort by their later (fresher) bound.
  const rangeEnd = posted.split("–").pop()?.trim() ?? posted;
  const parsed = Date.parse(rangeEnd);
  return Number.isNaN(parsed) ? -Infinity : parsed;
}

export function roleFamily(job: Job) {
  const title = job.title.toLowerCase();
  if (/intern|junior|associate|entry/.test(title) || /^(entry|junior)/i.test(job.level)) return "Early Career";
  if (/director|manager|leader|lead\b|head|executive|chief|cto|svp|vice president/.test(title)) return "Leadership";
  if (/strategist|strategy|product owner|technical deployment/.test(title)) return "Deployment Strategy";
  if (/architect/.test(title)) return "Field Architecture";
  if (/data|analytics/.test(title)) return "Data Engineering";
  if (/ai|machine learning|\bml\b|genai|agentic|agents/.test(title)) return "Applied AI / ML";
  if (/solution|implementation|customer engineer|field engineer/.test(title)) return "Solutions / Implementation";
  return "Core FDE";
}
