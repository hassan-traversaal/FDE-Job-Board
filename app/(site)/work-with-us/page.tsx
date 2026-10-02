import type { Metadata } from "next";
import Image from "next/image";
import { workPage } from "../content";
import { LeadForm } from "../LeadForm";

export const metadata: Metadata = {
  title: "Talk to our forward deployed engineers | Traversaal",
  description:
    "Have an AI use case that works in a demo but stalls before production? Tell Traversaal's forward deployed engineers what you're building and we'll set up a discovery call.",
  alternates: { canonical: "/work-with-us" },
  openGraph: {
    title: "Talk to Traversaal's forward deployed engineers",
    description: "Tell us what's stuck between demo and production. We reply by email to set up a discovery call.",
    url: "https://fde.traversaal.ai/work-with-us",
    siteName: "Traversaal",
    type: "website",
    images: ["/site/og.png"],
  },
};

export default function WorkWithUsPage() {
  return (
    <main id="main" className="formpage formpage--work">
      <div className="wrap formpage__in">
        <div className="formpage__text">
          <h1 className="formpage__title">{workPage.title}</h1>
          <p className="formpage__lede">{workPage.lede}</p>

          <ol className="steps3">
            {workPage.next.map((n, k) => (
              <li key={n.k}>
                <span className="steps3__n">{k + 1}</span>
                <div>
                  <b>{n.k}</b>
                  <span>{n.v}</span>
                </div>
              </li>
            ))}
          </ol>

          <p className="formpage__note">{workPage.note}</p>

          <h2 className="leads__title">{workPage.leadsTitle}</h2>
          <ul className="leads">
            {workPage.leads.map((l) => (
              <li key={l.name}>
                <Image src={l.photo} alt="" width={l.w} height={l.w} sizes="56px" />
                <p>
                  <b>{l.name}</b>
                  <span>{l.role}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="formcard">
          <h2 className="formcard__title">Talk to our engineers</h2>
          <p className="formcard__line">Takes about a minute.</p>
          <LeadForm kind="engagement" />
        </div>
      </div>
    </main>
  );
}
