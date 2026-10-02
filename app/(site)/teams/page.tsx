import type { Metadata } from "next";
import { TrainedLogos } from "../chrome";
import { teamsPage } from "../content";
import { LeadForm } from "../LeadForm";

export const metadata: Metadata = {
  title: "Plan an FDE program for your team | Traversaal",
  description:
    "Custom forward deployed engineering training for your engineers, fitted to your stack. A design session sets what we teach. Virtual, in person or hybrid.",
  alternates: { canonical: "/teams" },
  openGraph: {
    title: "Plan an FDE program for your team | Traversaal",
    description: "Custom FDE training built around your team's needs and fitted to your stack.",
    url: "https://fde.traversaal.ai/teams",
    siteName: "Traversaal",
    type: "website",
    images: ["/site/og.png"],
  },
};

export default function TeamsPage() {
  return (
    <main id="main" className="formpage formpage--teams">
      <div className="wrap formpage__in">
        <div className="formpage__text">
          <h1 className="formpage__title">{teamsPage.title}</h1>
          <p className="formpage__lede">{teamsPage.lede}</p>

          <dl className="facts">
            {teamsPage.gets.map((g) => (
              <div key={g.k}>
                <dt>{g.k}</dt>
                <dd>{g.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="formcard">
          <h2 className="formcard__title">Tell us about your team</h2>
          <p className="formcard__line">Three required fields. Takes under a minute.</p>
          <LeadForm kind="program" />
          <ol className="next">
            {teamsPage.next.map((n, k) => (
              <li key={n}>
                <span className="mono">{String(k + 1).padStart(2, "0")}</span>
                {n}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <section className="wrap formpage__trained" aria-labelledby="trained-title">
        <h2 id="trained-title" className="trained__title">
          {teamsPage.trainedTitle}
        </h2>
        <TrainedLogos />
      </section>
    </main>
  );
}
