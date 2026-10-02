import { jobs, updatedLabel } from "../(board)/jobs/data";
import { postedTimestamp } from "../(board)/jobs/roles";

/** Live counts from the job board's data module, so the home page follows the weekly refresh. */
export function jobStats() {
  if (jobs.length === 0) return null;
  // The count is cumulative, so say when it starts ("May 2026").
  const first = Math.min(...jobs.map((j) => postedTimestamp(j.posted)).filter(Number.isFinite));
  return {
    roles: jobs.length,
    companies: new Set(jobs.map((j) => j.company)).size,
    since: new Date(first).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    updated: updatedLabel.replace(/^Updated /, ""),
  };
}
