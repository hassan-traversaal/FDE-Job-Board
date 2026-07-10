"use client";

import { useMemo, useState } from "react";

type Job = {
  company: string; title: string; region: "US" | "Europe" | "India" | "Global";
  location: string; salary?: string; level: string; lane: string; fit: string;
  signals: string[]; posted: string; url: string; featured?: boolean;
};

const jobs: Job[] = [
  {company:"LiveKit",title:"Forward Deployed Engineer",region:"India",location:"Remote · India",level:"Mid–Senior",lane:"Real-time AI",fit:"Builder who likes messy integrations, production voice/video, and direct customer ownership.",signals:["Python","Go / Rust","Agentic AI"],posted:"11d",url:"https://www.fwddeploy.com/jobs/forward-deployed-engineer-cb0d61f1",featured:true},
  {company:"LiveKit",title:"Forward Deployed Engineer",region:"US",location:"Remote · United States",salary:"$180k–$320k",level:"Senior",lane:"Real-time AI",fit:"High-agency product engineer comfortable turning customer workflows into reusable platform capability.",signals:["Python","Go / Rust","OpenAI"],posted:"9d",url:"https://www.fwddeploy.com/jobs/forward-deployed-engineer-4781a085",featured:true},
  {company:"JetBrains",title:"Principal Forward Deployed Engineer",region:"Europe",location:"Remote · Germany",level:"Principal",lane:"AI-native dev",fit:"Technical leader who can embed with engineering teams and reshape how software gets built with AI.",signals:["AI coding","Enterprise","Architecture"],posted:"3d",url:"https://www.fwddeploy.com/jobs/principal-forward-deployed-engineer-ai-native-software-development-m-f-d-0d411ab9",featured:true},
  {company:"Zendesk",title:"Forward Deployed Engineer",region:"US",location:"Remote · United States",salary:"$200k–$300k",level:"Senior",lane:"Customer operations",fit:"Strong full-stack builder who can connect AI agents to real support operations and prove business value.",signals:["Agents","APIs","Enterprise SaaS"],posted:"8d",url:"https://www.fwddeploy.com/jobs/forward-deployed-engineer-ad388423"},
  {company:"Leap",title:"Forward Deployed Engineer, Care Operations",region:"US",location:"Remote · United States",salary:"$153k–$189k",level:"Mid–Senior",lane:"Healthtech",fit:"Best for someone who enjoys operational systems, regulated data, and high-empathy customer discovery.",signals:["Healthcare","Workflows","Data"],posted:"9d",url:"https://www.fwddeploy.com/jobs/forward-deployed-engineer-care-operations-05b60b5b"},
  {company:"Maybern",title:"Forward Deployed Engineer",region:"US",location:"Remote · United States",salary:"$180k–$270k",level:"Senior",lane:"Fintech",fit:"Engineer who can model complex private-markets workflows and earn trust with demanding finance teams.",signals:["Fintech","Data models","Full-stack"],posted:"8d",url:"https://www.fwddeploy.com/jobs/forward-deployed-engineer-remote-f15a4279"},
  {company:"Nebius",title:"Forward Deployed Engineer — Physical AI",region:"US",location:"Remote · United States",salary:"$169.9k–$254.9k",level:"Senior",lane:"Physical AI",fit:"Infrastructure-minded AI engineer drawn to robotics, accelerated compute, and customer production environments.",signals:["Kubernetes","Python","Rust"],posted:"7d",url:"https://www.fwddeploy.com/jobs/forward-deployed-engineer-physical-ai-636f436e"},
  {company:"Hatch",title:"Forward Deployed Engineer",region:"US",location:"Remote · United States",salary:"$162k–$219k",level:"Mid–Senior",lane:"Integrations",fit:"Pragmatic integration builder who can ship the workflows standard onboarding cannot handle.",signals:["APIs","Consulting","Workflows"],posted:"11d",url:"https://www.fwddeploy.com/jobs/forward-deployed-engineer-b5c74f67"},
  {company:"OpenHands",title:"Forward Deployed Engineer",region:"Global",location:"Remote · location flexible",salary:"$150k–$215k",level:"Senior",lane:"AI coding agents",fit:"Open-source-minded engineer who can turn coding-agent capability into reliable customer deployments.",signals:["Python","Rust","CI/CD"],posted:"10d",url:"https://www.fwddeploy.com/jobs/forward-deployed-engineer-8bf26185",featured:true},
  {company:"IFS",title:"Forward Deployed AI Engineer",region:"US",location:"Remote · United States",salary:"$150k–$170k + bonus",level:"Mid–Senior",lane:"Enterprise agents",fit:"Applied AI generalist who can move from discovery to RAG, integrations, testing, and handoff.",signals:["Python","RAG","LangChain"],posted:"8d",url:"https://www.fwddeploy.com/jobs/forward-deployed-ai-engineer-e6a5a320"},
  {company:"Domino Data Lab",title:"Forward Deployed Engineer, Life Sciences",region:"US",location:"Remote · United States",level:"Senior",lane:"Life sciences",fit:"ML platform engineer who can work with scientific teams and productionize regulated AI workflows.",signals:["MLOps","Life sciences","Enterprise"],posted:"7d",url:"https://www.fwddeploy.com/s/remote-jobs"},
  {company:"Infinitus",title:"Forward Deployed Engineer",region:"US",location:"Remote · United States",level:"Senior",lane:"Healthcare voice AI",fit:"Customer-facing engineer interested in automating healthcare calls without losing operational rigor.",signals:["Voice AI","Healthcare","Integrations"],posted:"8d",url:"https://www.fwddeploy.com/s/remote-jobs"},
  {company:"GenLogs",title:"Forward Deployed Engineer",region:"US",location:"Remote · United States",level:"Mid–Senior",lane:"Supply-chain intelligence",fit:"Data-heavy builder who enjoys deploying ML into physical-world logistics and investigative workflows.",signals:["Python","SQL","ML"],posted:"8d",url:"https://www.fwddeploy.com/s/remote-jobs"},
  {company:"Second Front",title:"Forward Deployed Engineer",region:"US",location:"Remote · United States",salary:"$105k–$141k",level:"Mid–Senior",lane:"Defense / regulated",fit:"Systems engineer comfortable with government constraints, cloud deployment, and mission-critical operations.",signals:["AWS / GCP","Kubernetes","Security"],posted:"Today",url:"https://deployaijobs.com/jobs"},
  {company:"n8n",title:"Forward Deployed Engineer",region:"Europe",location:"Remote · Germany / Europe",level:"Senior",lane:"Workflow automation",fit:"Automation-native engineer who likes open source, professional services, and making integrations repeatable.",signals:["AI","GitHub","Professional services"],posted:"Today",url:"https://deployaijobs.com/jobs"},
  {company:"Rimini Street",title:"Forward Deployed Engineer, Agentic AI",region:"US",location:"Remote · United States",salary:"$140k–$180k",level:"Principal / Senior",lane:"Enterprise agents",fit:"Experienced enterprise technologist who can navigate legacy stacks and still ship modern agentic systems.",signals:["AWS / Azure","TypeScript","Enterprise"],posted:"1d",url:"https://deployaijobs.com/jobs"},
  {company:"Kinaxis",title:"Forward Deployed Engineer",region:"US",location:"Remote · United States",level:"Senior",lane:"Supply chain",fit:"Data engineer who can translate planning problems into deployable analytics and AI systems.",signals:["Airflow","BigQuery","Kafka"],posted:"Today",url:"https://deployaijobs.com/jobs"},
  {company:"Moder",title:"Forward Deployed Engineer",region:"US",location:"Remote · United States",level:"Mid–Senior",lane:"Applied AI",fit:"Hands-on generalist who can span data, LLM application work, and customer implementation.",signals:["Python","SQL","Spark"],posted:"Today",url:"https://deployaijobs.com/jobs"},
  {company:"Deployment.io",title:"Forward Deployed Engineer",region:"Global",location:"Remote · US or India",level:"2–5 years",lane:"Cloud delivery",fit:"Clear-writing engineer who can plan, build, verify, and ship into customer-owned clouds end to end.",signals:["Cloud","Agents","Customer ownership"],posted:"Evergreen",url:"https://deployment.io/careers/",featured:true},
];

const regions = ["All", "US", "Europe", "India", "Global"] as const;

export default function Home() {
  const [region, setRegion] = useState<(typeof regions)[number]>("All");
  const [query, setQuery] = useState("");
  const [onlySalary, setOnlySalary] = useState(false);
  const visible = useMemo(() => jobs.filter((job) => {
    const regionMatch = region === "All" || job.region === region;
    const haystack = `${job.company} ${job.title} ${job.lane} ${job.signals.join(" ")}`.toLowerCase();
    return regionMatch && (!onlySalary || Boolean(job.salary)) && haystack.includes(query.toLowerCase());
  }), [region, query, onlySalary]);

  return <main>
    <div className="wrap">
      <header className="hero">
        <div className="eyebrow">AI SYSTEM DESIGN · JOB BOARD</div>
        <h1>Forward Deployed<br/><span>Engineer Jobs.</span></h1>
        <p className="dek">Remote and remote-eligible roles across the US, Europe, and India.</p>
        <div className="hero-meta"><span>19 open roles</span><span>US · Europe · India</span><span>Updated 10 Jul 2026</span></div>
        <div className="rule" />
      </header>

      <section id="roles">
        <span className="kicker">OPEN ROLES</span><h2>Find your next FDE role.</h2>
        <p className="sub">Filter by hiring region, skills, company, or published compensation.</p>
        <div className="toolbar">
          <div className="tabs" role="group" aria-label="Filter by region">{regions.map(r => <button key={r} className={region === r ? "active" : ""} onClick={() => setRegion(r)}>{r}</button>)}</div>
          <label className="search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search skill, company, lane…" aria-label="Search roles"/></label>
          <label className="check"><input type="checkbox" checked={onlySalary} onChange={e=>setOnlySalary(e.target.checked)}/><span/> Pay shown</label>
        </div>
        <div className="count">SHOWING {visible.length} OF {jobs.length} ROLES</div>
        <div className="jobs">{visible.map(job => <article className={`job ${job.featured ? "featured" : ""}`} key={`${job.company}-${job.title}-${job.location}`}>
          <div className="job-top"><div className="logo">{job.company.slice(0,2).toUpperCase()}</div><div className="job-title"><div className="company">{job.company}{job.featured && <span className="pick">EDITOR’S PICK</span>}</div><h3>{job.title}</h3></div><a className="apply" href={job.url} target="_blank" rel="noreferrer" aria-label={`View ${job.title} at ${job.company}`}>View role ↗</a></div>
          <div className="facts"><span>◎ {job.location}</span><span>◈ {job.level}</span>{job.salary && <span className="salary">{job.salary}</span>}<span className="posted">{job.posted}</span></div>
          <div className="tags"><span className="lane">{job.lane}</span>{job.signals.map(s=><span key={s}>{s}</span>)}</div>
        </article>)}</div>
        {visible.length === 0 && <div className="empty">No roles match this lens. Try a broader region or search.</div>}
      </section>
      <footer><div><b>FDE JOB BOARD</b><span>A companion artifact for AI System Design.</span></div><p>Roles change quickly. Confirm location eligibility and availability before applying.</p></footer>
    </div>
  </main>;
}
