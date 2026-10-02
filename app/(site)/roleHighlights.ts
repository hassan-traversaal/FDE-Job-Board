import { jobs } from "../(board)/jobs/data";
import { postedTimestamp, shortPay } from "../(board)/jobs/roles";
import { tickerCompanies } from "./content";

export type RoleHighlight = { company: string; title: string; location: string; salary?: string; url: string };

// A posting link, not a board's index or search page (some listings only have those).
const isPosting = (url: string) => /^https:\/\//.test(url) && !/\/(jobs|careers)\/?$/.test(new URL(url).pathname);

const latest = [...jobs].sort((a, b) => postedTimestamp(b.posted) - postedTimestamp(a.posted));

/** The newest board listing for each ticker company, linking to the opening itself. */
export const roleHighlights: RoleHighlight[] = tickerCompanies.flatMap((company) => {
  const job = latest.find((j) => j.company === company && isPosting(j.url));
  if (!job) return [];
  return [{ company, title: job.title, location: job.location.split(",")[0], salary: shortPay(job.salary), url: job.url }];
});
