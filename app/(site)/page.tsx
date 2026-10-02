import type { Metadata } from "next";
import Image from "next/image";
import { Arrow, Btn, ext, TrainedLogos } from "./chrome";
import { Reveal } from "./Reveal";
import { ReviewWall } from "./ReviewWall";
import { reviews, reviewSource } from "./reviews";
import { AgentSystem } from "./AgentSystem";
import { jobStats } from "./jobStats";
import { roleHighlights as roles, type RoleHighlight } from "./roleHighlights";
import { close, course, hero, learn, links, market, method, results, voices, work } from "./content";

function Stars() {
  return (
    <svg className="stars" viewBox="0 0 100 18" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((k) => (
        <path
          key={k}
          transform={`translate(${k * 20.5} 0)`}
          d="M9 0.8l2.5 5.3 5.7.7-4.2 3.9 1.1 5.7L9 13.6 3.9 16.4 5 10.7.8 6.8l5.7-.7z"
        />
      ))}
    </svg>
  );
}

// Each chip opens the opening itself, on the site that lists it.
function RoleChip({ r, tabbable = true }: { r: RoleHighlight; tabbable?: boolean }) {
  return (
    <li className="role">
      <a className="role__link" href={r.url} {...ext} tabIndex={tabbable ? undefined : -1}>
        <span className="role__co">
          {r.company}
          <Arrow external />
        </span>
        <span className="role__title">{r.title}</span>
        <span className="role__meta">
          <span className="role__where">{r.location}</span>
          {r.salary && <b>{r.salary}</b>}
        </span>
      </a>
    </li>
  );
}

function Lane({ items, reverse = false }: { items: RoleHighlight[]; reverse?: boolean }) {
  return (
    <div className={reverse ? "lane lane--rev" : "lane"}>
      <ul className="lane__track">
        {items.map((r) => (
          <RoleChip key={r.company + r.title} r={r} />
        ))}
      </ul>
      <ul className="lane__track" aria-hidden="true">
        {items.map((r) => (
          <RoleChip key={r.company + r.title} r={r} tabbable={false} />
        ))}
      </ul>
    </div>
  );
}

export const metadata: Metadata = { alternates: { canonical: "/" } };

// Reviewers with photos come first, so the rows open on faces; within each group, the
// reviews that describe the work most concretely lead, then Maven's order.
const FEATURED = ["Elie", "Kurt", "Ron", "Imran", "Senior Machine Learning Engineer, Nike, Inc.", "Hari", "Saurabh", "Jorge", "Ravi"];
const rank = (r: (typeof reviews)[number]) => {
  const k = FEATURED.findIndex((f) => f === r.name || f === r.title);
  return k === -1 ? FEATURED.length : k;
};
const featuredFirst = reviews
  .map((r, i) => ({ r, i }))
  .sort((a, b) => Number(!a.r.photo) - Number(!b.r.photo) || rank(a.r) - rank(b.r) || a.i - b.i)
  .map(({ r }) => r);

export default function Home() {
  const stats = jobStats();
  const half = Math.ceil(roles.length / 2);

  return (
    <>
      <Reveal />

      <main id="main">
        {/* Hero */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__grid" aria-hidden="true" />
          <div className="wrap hero__in">
            <div className="hero__text">
              <h1 id="hero-title" className="hero__title">
                {hero.lines.map((l) => (
                  <span key={l.mark} className="hero__line">
                    {l.pre}
                    <span className="hl">{l.mark}</span>
                    {l.post}
                  </span>
                ))}
              </h1>
              <p className="hero__sub">{hero.sub}</p>
              <div className="hero__acts">
                <Btn href={links.freeCourse}>
                  {hero.primary}
                </Btn>
                <Btn href="#work" tone="ink">
                  {hero.secondary}
                </Btn>
              </div>
              <ul className="proof">
                <li className="proof__person">
                  <Image src="/site/hamza-farooq.png" alt="" width={1254} height={1254} sizes="44px" />
                  <span>
                    <b>{hero.lead}</b>, {hero.leadRole}
                  </span>
                </li>
                <li className="proof__rating">
                  <b className="proof__score">4.9</b>
                  <Stars />
                  <span>55 ratings on Maven</span>
                </li>
              </ul>
            </div>

            <div className="hero__visual">
              <AgentSystem />
            </div>
          </div>
        </section>

        {/* Trained */}
        <section className="trained" aria-labelledby="trained-title">
          <div className="wrap trained__in">
            <h2 id="trained-title" className="trained__title">
              Teams we&apos;ve trained
            </h2>
            <TrainedLogos eager />
          </div>
        </section>

        {/* Two doors */}
        <section className="doors" aria-label="Two ways in">
          <div className="wrap doors__in">
            <article className="door door--learn" id="learn" aria-labelledby="learn-title" data-reveal>
              <div className="door__top">
                <h2 id="learn-title" className="door__title">
                  {learn.title}
                </h2>
                <p className="door__line">{learn.line}</p>
              </div>
              <ol className="ladder">
                {learn.offers.map((o, k) => (
                  <li key={o.name} style={{ "--k": k } as React.CSSProperties}>
                    <a className={k === 0 ? "rung rung--lead" : "rung"} href={o.href} {...(o.external ? ext : {})}>
                      <span className="rung__level mono">{o.level}</span>
                      <span className="rung__name">{o.name}</span>
                      <span className="rung__detail">{o.detail}</span>
                      <span className="rung__foot">
                        <span className={k === 0 ? "badge badge--free" : "badge"}>{o.badge}</span>
                        <span className="rung__cta">
                          {o.cta}
                          <Arrow external={o.external} />
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </article>

            <article className="door door--work" id="work" aria-labelledby="work-title" data-reveal>
              <div className="door__top">
                <h2 id="work-title" className="door__title">
                  {work.title}
                </h2>
                <p className="door__line">{work.line}</p>
              </div>
              <ol className="door__method" aria-label="How an engagement runs">
                {method.steps.map((s) => (
                  <li key={s.name}>{s.name}</li>
                ))}
              </ol>
              <ul className="gets">
                {work.gets.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
              <div className="door__acts">
                <Btn href={links.contact}>
                  {work.cta}
                </Btn>
                <a className="textlink textlink--light" href="#method">
                  How an engagement runs
                </a>
              </div>
            </article>
          </div>
        </section>

        {/* Market */}
        <section className="market" aria-labelledby="market-title">
          <div className="wrap market__head" data-reveal>
            <div>
              <h2 id="market-title" className="market__title">
                {market.title}
              </h2>
              {stats && (
                <p className="market__line">
                  <b className="market__count">{stats.roles.toLocaleString("en-US")}</b>
                  <span>
                    {market.line(stats.companies, stats.since)}
                    {stats.updated && <span className="market__date"> Updated {stats.updated}.</span>}
                  </span>
                </p>
              )}
            </div>
            <Btn href={links.jobs} tone="ink">
              {market.cta}
            </Btn>
          </div>
          <div className="lanes-wrap">
            <div className="lanes" role="group" aria-label="Recent roles from the job board. Each one opens the listing in a new tab.">
              <Lane items={roles.slice(0, half)} />
              <Lane items={roles.slice(half)} reverse />
            </div>
          </div>
        </section>

        {/* Free course */}
        <section className="course" id="free-course" aria-labelledby="course-title">
          <div className="wrap course__in">
            <div className="course__text" data-reveal>
              <span className="free-stamp">Free</span>
              <h2 id="course-title" className="course__title">
                {course.title}
              </h2>
              <p className="course__body">{course.body}</p>
              <ol className="anatomy" aria-label="How the course is built">
                {course.anatomy.map((a, k) => (
                  <li key={a}>
                    <span className={k === course.anatomy.length - 1 ? "chip chip--last" : "chip"}>{a}</span>
                  </li>
                ))}
              </ol>
              <Btn href={links.freeCourse}>
                {course.cta}
              </Btn>
            </div>

            <figure className="player" aria-label={`Illustration: a chapter of ${course.name} with its recording, transcript and Moment Search`} data-reveal>
              <div className="player__bar">
                <span className="mono">{course.name} · Level 1</span>
                <span className="console__tag console__tag--dark">Illustrative</span>
              </div>
              <div className="player__body" aria-hidden="true">
                <aside className="player__side">
                  {course.sessions.map((s, si) => (
                    <div key={s.name}>
                      <p className="mono">{s.name}</p>
                      <ul>
                        {s.chapters.map((c, ci) => (
                          <li key={c} className={si > 0 ? undefined : ci < 2 ? "done" : ci === 2 ? "now" : undefined}>
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </aside>
                <div className="player__main">
                  <div className="screen">
                    <span className="screen__play" />
                    <div className="screen__scrub">
                      <span className="screen__done" />
                      <span className="screen__mark" />
                    </div>
                  </div>
                  <div className="tabs">
                    <span className="tabs__on">Transcript</span>
                    <span>Chapters</span>
                    <span>Ask</span>
                  </div>
                  <div className="lines">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="msearch">
                    <svg viewBox="0 0 20 20">
                      <circle cx="8.5" cy="8.5" r="5.5" />
                      <path d="m13 13 4.5 4.5" />
                    </svg>
                    <span className="msearch__q">{course.query}</span>
                  </div>
                  <p className="msearch__hit">
                    <span className="mono">{course.hit.where}</span> {course.hit.what}
                  </p>
                </div>
              </div>
            </figure>
          </div>
        </section>

        {/* Method */}
        <section className="method" id="method" aria-labelledby="method-title">
          <div className="wrap">
            <header className="sechead" data-reveal>
              <h2 id="method-title" className="sechead__title">
                {method.title}
              </h2>
              <p className="sechead__line">{method.line}</p>
            </header>
            <ol className="track">
              {method.steps.map((s, k) => (
                <li key={s.name} className="track__step" style={{ "--k": k } as React.CSSProperties} data-reveal>
                  <span className="track__n">{String(k + 1).padStart(2, "0")}</span>
                  <h3 className="track__name">{s.name}</h3>
                  <p className="track__how">{s.how}</p>
                  <p className="track__gets">
                    <b>You keep</b>
                    {s.gets}
                  </p>
                </li>
              ))}
            </ol>
            <div className="method__foot" data-reveal>
              <p>{method.note}</p>
              <Btn href={links.contact} tone="ink">
                {work.cta}
              </Btn>
            </div>
          </div>
        </section>

        {/* Results */}
        <section className="results" id="results" aria-labelledby="results-title">
          <div className="wrap">
            <header className="sechead" data-reveal>
              <h2 id="results-title" className="sechead__title">
                {results.title}
              </h2>
              <p className="sechead__line">{results.line}</p>
            </header>
            <ul className="ledger">
              {results.items.map((r, k) => (
                <li key={r.agent} className="ledger__card" style={{ "--k": k } as React.CSSProperties} data-reveal>
                  <p className={r.sector.startsWith("Fortune 500") ? "ledger__sector ledger__sector--f500" : "ledger__sector"}>{r.sector}</p>
                  <h3 className="ledger__agent">{r.agent}</h3>
                  <p className="ledger__for">{r.forWhom}</p>
                  <p className="ledger__num">
                    <b>{r.big}</b>
                    <span>{r.what}</span>
                  </p>
                </li>
              ))}
            </ul>
            <p className="source">
              {results.source}{" "}
              <a href={links.labs} {...ext}>
                Read the case studies on traversaal.ai/labs
              </a>
            </p>
          </div>
        </section>

        {/* Voices */}
        <section className="voices" aria-labelledby="voices-title">
          <div className="wrap">
            <header className="sechead" data-reveal>
              <h2 id="voices-title" className="sechead__title">
                {voices.title}
              </h2>
            </header>
            <div className="voices__grid">
              <figure className="crowd" data-reveal>
                <Image
                  src="/site/workshop-home-depot.jpg"
                  alt="Hamza Farooq taking a selfie with a full room of workshop attendees at The Home Depot"
                  width={1824}
                  height={1368}
                  sizes="(min-width: 1100px) 720px, 100vw"
                />
                <figcaption>Workshop at The Home Depot</figcaption>
              </figure>

              <div className="who" data-reveal>
                <div className="who__person">
                  <Image src="/site/hamza-farooq.png" alt="Hamza Farooq" width={1254} height={1254} sizes="96px" />
                  <div>
                    <p className="who__name">{voices.person.name}</p>
                    <p className="who__role">{voices.person.role}</p>
                  </div>
                </div>
                <p className="who__bio">{voices.person.bio}</p>
                <a className="textlink" href="#reviews">
                  Read what bootcamp alumni say
                </a>
              </div>

              <figure className="okta" data-reveal>
                <Image
                  src="/site/workshop-okta.jpg"
                  alt="Hamza Farooq with three members of the Okta team in front of the Okta wall"
                  width={2040}
                  height={1536}
                  sizes="(min-width: 1100px) 420px, 100vw"
                />
                <figcaption>Team training at Okta</figcaption>
              </figure>

            </div>
          </div>
        </section>

        {/* Reviews */}
        <section className="reviews" id="reviews" aria-labelledby="reviews-title">
          <div className="wrap">
            <header className="sechead" data-reveal>
              <h2 id="reviews-title" className="sechead__title">
                What engineers say after the bootcamp.
              </h2>
              <a className="reviews__score" href={links.bootcampReviews} {...ext}>
                <b>{reviewSource.score}</b>
                <span>
                  <Stars />
                  {reviewSource.ratings} ratings on Maven
                </span>
              </a>
            </header>
          </div>
          <ReviewWall items={featuredFirst} />
        </section>

        {/* Close */}
        <section className="close" aria-labelledby="close-title">
          <div className="wrap close__in" data-reveal>
            <h2 id="close-title" className="close__title">
              <span>{close.title[0]}</span>
              <span>{close.title[1]}</span>
            </h2>
            <div className="close__acts">
              <Btn href={links.freeCourse} tone="ink">
                {close.learn}
              </Btn>
              <Btn href={links.contact} tone="paper">
                {close.work}
              </Btn>
            </div>
            <a className="textlink" href={links.jobs}>
              {close.jobs}
            </a>
          </div>
        </section>
      </main>

    </>
  );
}
