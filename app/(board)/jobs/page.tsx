import type { Metadata } from "next";
import { Suspense } from "react";
import { Arrow, ext } from "../../(site)/chrome";
import { links } from "../../(site)/content";
import { JobFilters } from "./JobFilters";
import { jobs, updatedLabel, type Job } from "./data";
import { postedTimestamp, roleFamily, shortPay } from "./roles";

export const metadata: Metadata = {
  openGraph: {
    title: "Forward deployed engineer jobs | Traversaal",
    description: "Remote and remote-eligible FDE roles across the US, Europe and India, refreshed every week.",
    url: "https://fde.traversaal.ai/jobs",
    siteName: "Traversaal",
    type: "website",
    images: ["/site/og.png"],
  },
};

// Sorted and indexed once on the server; the client only toggles visibility.
const listed = jobs
  .map((job) => ({ job, family: roleFamily(job) }))
  .sort((a, b) => postedTimestamp(b.job.posted) - postedTimestamp(a.job.posted));
const companies = new Set(jobs.map((j) => j.company)).size;

// Same card language as the home page's role ticker: the whole card opens the listing.
function JobCard({ job, family }: { job: Job; family: string }) {
  const pay = shortPay(job.salary);
  return (
    <article
      className={`job${job.featured ? " job--pick" : ""}`}
      data-region={job.region}
      data-family={family}
      data-pay={job.salary ? "1" : "0"}
    >
      <div className="job__top">
        <span className="job__logo" aria-hidden="true">
          {job.company.slice(0, 2).toUpperCase()}
        </span>
        <p className="job__company">
          {job.company}
          {job.featured && <span className="job__pick">Editor’s pick</span>}
        </p>
        <Arrow external />
      </div>
      <h3>{job.title}</h3>
      <ul className="job__facts">
        <li>{job.location}</li>
        <li>{job.level}</li>
        <li className="job__posted">{job.posted}</li>
      </ul>
      {pay && <p className="job__pay">{pay}</p>}
      <div className="job__foot">
        <div className="job__tags">
          <span className="job__family">{family}</span>
          <span>{job.lane}</span>
          {job.signals.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
        <a className="job__apply" href={job.url} {...ext} aria-label={`View ${job.title} at ${job.company}`}>
          View role
        </a>
      </div>
    </article>
  );
}

export default function JobsPage() {
  return (
    <main id="main" className="board">
      <section className="bhero" aria-labelledby="board-title">
        <div className="bhero__grid" aria-hidden="true" />
        <div className="wrap bhero__in">
          <div className="bhero__text">
            <h1 id="board-title" className="bhero__title">
              Forward deployed engineer <span className="mark">jobs.</span>
            </h1>
            <p className="bhero__sub">
              Remote and remote-eligible FDE roles across the US, Europe and India, checked for real customer-embedded work and refreshed every week.
            </p>
            <ul className="bhero__meta">
              <li>
                <b>{jobs.length.toLocaleString("en-US")}</b> roles listed
              </li>
              <li>
                <b>{companies}</b> companies
              </li>
              <li>{updatedLabel}</li>
            </ul>
          </div>

          <div className="bhero__visual">
            <div className="bhero__disc" aria-hidden="true" />
            <div className="bhero__ring" aria-hidden="true" />
            <aside className="bcta" aria-labelledby="bcta-title">
              <span className="bcta__tag">Free</span>
              <h2 id="bcta-title">Get ready for these roles.</h2>
              <p>Start with our free Level 1 course, Claude Code for Forward Deployed Engineering. Then go deeper in the live bootcamp with Hamza Farooq.</p>
              <a className="btn btn--coral" href={links.freeCourse}>
                <span>Start the free course</span>
                <Arrow />
              </a>
              <a className="bcta__link" href={links.bootcamp} {...ext}>
                See the bootcamp on Maven
              </a>
            </aside>
          </div>
        </div>
      </section>

      <section className="broles" id="roles" aria-labelledby="roles-title">
        <div className="wrap">
          <header className="broles__head">
            <h2 id="roles-title" className="broles__title">
              Find your next FDE role.
            </h2>
            <p className="broles__line">Filter by region, role family or posted pay. Each card opens the original listing.</p>
          </header>
          <Suspense fallback={<p className="count">Loading job filters…</p>}>
            <JobFilters total={jobs.length} />
          </Suspense>
          <noscript><p className="count">All tracked roles are listed below. Enable JavaScript to use the filters.</p></noscript>
          <div className="jobs" id="jobs-list">
            {listed.map(({ job, family }) => (
              <JobCard key={`${job.url}-${job.company}-${job.title}-${job.location}`} job={job} family={family} />
            ))}
          </div>
          <div className="empty" id="jobs-empty" hidden>
            No roles match these filters. Try a broader region or a different search.
          </div>

          <details className="sourcing">
            <summary>How we gather these listings</summary>
            <div className="sourcing__body">
              <p>
                Roles are pulled from{" "}
                <a href="https://www.fwddeploy.com/s/remote-jobs" {...ext}>
                  FWDDeploy.com
                </a>
                ,{" "}
                <a href="https://deployaijobs.com/jobs" {...ext}>
                  DeployAI Jobs
                </a>
                , and a handful of direct employer pages, Indeed, and Ashby listings. Each one is checked for explicit forward-deployed or customer-embedded work, clear remote or geographic eligibility, and no obvious duplicate posting.
              </p>
              <p>Always confirm a role is still open before applying.</p>
            </div>
          </details>
        </div>
      </section>
    </main>
  );
}
