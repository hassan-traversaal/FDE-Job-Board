/**
 * Copy for the fde.traversaal.ai home. Sources: PRODUCT.md (two-pillar v1 plan),
 * the OneTrace proposal (engagement method, generic parts), traversaal.ai/labs
 * (published results), the Maven listing (bootcamp facts, reviews) and this repo's
 * job data. No prices for services or team training, no client names beyond the
 * cleared training photos, no outcome promises.
 */

export const links = {
  // The free Level 1 course (course/), served on this domain through next.config.ts rewrites.
  // Sign-up first, then the library; a signed-in visitor goes straight to the library.
  freeCourse: "/signin?next=/library",
  bootcamp: "https://maven.com/boring-bot/ai-system-design",
  bootcampReviews: "https://maven.com/boring-bot/ai-system-design#reviews",
  teams: "/teams",
  contact: "/work-with-us",
  academyEmail: "academy@traversaal.ai",
  traversaalContact: "https://traversaal.ai/contact",
  privacy: "https://traversaal.ai/privacy",
  labs: "https://traversaal.ai/labs",
  jobs: "/jobs",
  traversaal: "https://traversaal.ai",
  academy: "https://traversaal.ai/academy",
} as const;

/** Teams Traversaal has trained, as listed in its own training proposals. Logos in public/site/trained. */
export const trained = [
  { name: "The Home Depot", src: "/site/trained/home-depot.png", w: 2000, h: 2000, shape: "square" },
  { name: "Okta", src: "/site/trained/okta.png", w: 391, h: 129, shape: "wide" },
  { name: "Tripadvisor", src: "/site/trained/tripadvisor.png", w: 900, h: 618, shape: "square" },
  { name: "HBO Max", src: "/site/trained/hbo-max.png", w: 900, h: 156, shape: "wide" },
  { name: "Chime", src: "/site/trained/chime.png", w: 421, h: 120, shape: "wide" },
  { name: "SDAIA", src: "/site/trained/sdaia.png", w: 381, h: 132, shape: "lockup" },
  { name: "Jack in the Box", src: "/site/trained/jack-in-the-box.png", w: 875, h: 900, shape: "square" },
  { name: "Orderful", src: "/site/trained/orderful.png", w: 200, h: 46, shape: "wide" },
] as const;

export const hero = {
  // Two equal lines: the work, then the teaching. The marked word gets the coral block.
  lines: [
    { pre: "We ", mark: "build", post: " enterprise AI agents for Fortune 500." },
    { pre: "We ", mark: "teach", post: " you how." },
  ],
  sub: "Our forward deployed engineers embed with your team to build AI agents. Our courses and trainings teach your engineers to build their own.",
  primary: "Start the free course",
  secondary: "Work with us",
  lead: "Led by Hamza Farooq",
  leadRole: "adjunct professor at UCLA and UMN, Stanford Continuing Studies instructor, ex-Google and Walmart Labs",
};

/** The hero card (AgentSystem.tsx) has two tabs that match the headline. Both are synthetic or drawn from public course data. */
export const heroSystem = {
  tabs: { build: "We build", teach: "We teach" },
  name: "support-agent / production",
  systems: [
    { name: "Tickets", icon: "M4 7.5h16v3a2 2 0 0 0 0 3v3H4v-3a2 2 0 0 0 0-3zM14 7.5v9" },
    { name: "Orders", icon: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8" },
    { name: "Policy docs", icon: "M7 3.5h7l4 4v13H7zM14 3.5v4h4M10 12.5h5M10 16h5" },
    { name: "CRM", icon: "M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20a7 7 0 0 1 14 0" },
  ],
  agent: { name: "AI agent" },
  // Three steps per system: what the agent does, in order, when that system fires.
  events: [
    ["Read ticket", "Found refund policy", "Drafted reply"],
    ["Checked order", "Found the delay", "Explained it"],
    ["Found clause", "Cited it", "Answered"],
    ["Pulled history", "Matched tone", "Replied"],
  ],
  controls: [
    { name: "Evals", note: "Run on every change" },
    { name: "Guardrails", note: "PII masked" },
    { name: "Monitoring", note: "Every run traced" },
    { name: "Human review", note: "For high-risk actions" },
  ],
  // Real chapters of Session 1 (course/data/sessions/s1). `at` is the chapter's start in seconds.
  teach: {
    name: "claude-code-for-fde / session 1",
    chapters: [
      { title: "Welcome, team and course logistics", at: 9 },
      { title: "Course roadmap and setup checklist", at: 661 },
      { title: "Claude products and the starter repo", at: 1242 },
      { title: "Plan-first workflow and the agent harness", at: 2100 },
      { title: "CLAUDE.md as permanent project memory", at: 3865 },
      { title: "Live demo: skills build a deck", at: 5064 },
    ],
    // Suggested questions from the course; each jumps to the chapter that answers it.
    questions: [
      { q: "What is the agent harness in Claude Code?", chapter: 3 },
      { q: "Why do I need a CLAUDE.md file?", chapter: 4 },
      { q: "How did the class build a slide deck with a skill?", chapter: 5 },
    ],
  },
};

/** Companies whose latest board listing appears in the home-page role ticker (see roleHighlights.ts). */
export const tickerCompanies = [
  "Anthropic",
  "OpenAI",
  "Databricks",
  "Perplexity",
  "Glean",
  "Figma",
  "Cohere",
  "Notion",
  "Scale AI",
  "Mistral AI",
  "ElevenLabs",
  "Datadog",
  "Salesforce",
  "ServiceNow",
  "Google",
  "Stripe",
  "MongoDB",
  "Snorkel AI",
];

export const market = {
  title: "The FDE job market, tracked weekly.",
  cta: "Browse the job board",
};

export const learn = {
  title: "Learn FDE",
  line: "We offer individual courses and enterprise training.",
  offers: [
    {
      level: "Level 1",
      name: "Claude Code for Forward Deployed Engineering",
      detail: "Five recorded sessions with Hamza Farooq, cut into short chapters. Learn at your own pace.",
      badge: "Free",
      href: links.freeCourse,
      external: false,
      cta: "Start free",
    },
    {
      level: "Level 2",
      name: "Forward Deployed Engineering Bootcamp",
      detail: "Live 6-week cohort on Maven with Hamza Farooq. Next cohort 14 Nov to 25 Dec 2026.",
      badge: "$2,500",
      href: links.bootcamp,
      external: true,
      cta: "See the cohort",
    },
    {
      level: "Teams",
      name: "Training for your team",
      detail: "Custom training designed around your team's needs and fitted to your stack.",
      badge: "Private",
      href: links.teams,
      external: false,
      cta: "Plan a program",
    },
  ],
};

export const work = {
  title: "Work with us",
  line: "We put forward deployed engineers inside your team. They prove one use case with a PoC on your data, then take the agent into production. Your team owns the code at handover.",
  gets: [
    "A working PoC on your own data before you commit to more",
    "Production with evaluation, guardrails and monitoring",
    "On-prem, private cloud or your own cloud account",
    "Code, docs and know-how handed to your engineers",
  ],
  cta: "Talk to our engineers",
};

export const method = {
  title: "How an engagement runs.",
  steps: [
    {
      name: "Embed",
      how: "We work from inside your team: the workflow, the data, the systems, the constraints.",
      gets: "Engineers who know how the work actually runs, not how it is described.",
    },
    {
      name: "Understand and plan",
      how: "We scope the first use case with the people who own the workflow and agree what success looks like.",
      gets: "One use case with measurable success criteria.",
    },
    {
      name: "Prove with a PoC",
      how: "We build a working proof of concept on your data and hold it to the outcome we agreed.",
      gets: "Evidence against that outcome, before anyone commits to more.",
    },
    {
      name: "Scale",
      how: "We take it into production: live systems wired up, edge cases handled, evaluation and monitoring in place.",
      gets: "A production system you can measure.",
    },
    {
      name: "Hand over",
      how: "We harden it, document it, and hand the code and the know-how to your engineers.",
      gets: "Your team owns the code and can run and extend it.",
    },
  ],
  note: "Discovery sets scope, team and timeline before we quote. On-prem and private-cloud deployments can be scoped.",
};

/** The free Level 1 course. Facts from course/data (course.json and the five sessions). */
export const course = {
  title: "Take our first course for free.",
  name: "Claude Code for Forward Deployed Engineering",
  body: "Our top-rated course on Maven, now open source, so you can begin your FDE journey with us. Five recorded sessions with Hamza Farooq and Aishwarya Ashok, cut into short chapters.",
  cta: "Start the free course",
  anatomy: ["Sessions", "Chapters", "Video", "Transcript", "Moment Search"],
  // The illustration below: real session and chapter titles, and one of the course's suggested questions.
  sessions: [
    { name: "Session 1", chapters: ["Welcome and logistics", "Roadmap and setup", "Claude products", "The agent harness"] },
    { name: "Session 2", chapters: ["Skills", "Subagents"] },
  ],
  query: "Why do I need a CLAUDE.md file, and what goes in it?",
  hit: { where: "Session 1 · 1:04:25", what: "Jumps to the moment in the recording" },
};

export const results = {
  title: "Some of the enterprise agents we've shipped.",
  // Sector labels follow the tags on traversaal.ai/labs.
  items: [
    { sector: "Fortune 500 retail", agent: "Retail delivery agent", forWhom: "Multi-agent decision layer for a Fortune 500 retailer", big: "~73%", what: "of review cases closed automatically" },
    { sector: "Enterprise learning", agent: "Enterprise research agent", forWhom: "Agentic retrieval for a global leadership development firm", big: "10M+", what: "pages indexed, every answer cited" },
    { sector: "Restaurants", agent: "Demand forecasting agent", forWhom: "Demand forecasts for new menu items at a national restaurant chain", big: "18.23%", what: "forecast error (MAPE)" },
    { sector: "Travel", agent: "Destination research agent", forWhom: "Agentic research with live web search, for an AI travel planning startup", big: "30%", what: "sales lift reported" },
  ],
  source: "Source: Traversaal Labs case studies. Prior engagement results; scope and outcomes vary.",
};

export const voices = {
  title: "Taught by people who do the work.",
  person: {
    name: "Hamza Farooq",
    role: "Founder and CEO, Traversaal.ai",
    bio: "Former Senior Research Manager at Google and Walmart Labs. Adjunct professor at UCLA and the University of Minnesota, instructor for Stanford Continuing Studies, and author of Build an LLM Application (from Scratch).",
  },
  quotes: [
    {
      quote: "Assignments felt less like coursework and more like being dropped into the job on Monday morning.",
      name: "Elie",
      title: "Business Lead, Data & Strategy, Digitas",
    },
    {
      quote: "Each pushes you toward real system design thinking instead of shallow vibe coding.",
      name: "Matteo",
      title: "Senior Machine Learning Engineer, Nike",
    },
    {
      quote: "This is not a passive course. It requires a serious commitment of time and effort to get the most out of it.",
      name: "Ravi",
      title: "Sr Director of Engineering, Blackline Systems",
    },
  ],
  disclosure: "Verbatim excerpts from public Maven reviews. First-time learners who leave an honest review are eligible for a complimentary place in a later cohort.",
};

export const close = {
  title: ["Learn it.", "Or have it done."],
  learn: "Start the free course",
  work: "Talk to our engineers",
  jobs: "Or browse the FDE job board",
};

/** /teams: plan a private program. What we teach is decided in a design session, not fixed in advance. */
export const teamsPage = {
  title: "Plan an FDE program for your team.",
  lede: "Custom FDE training for your engineers, fitted to your stack. We start with a design session that decides what we teach and how we run it.",
  gets: [
    { k: "Designed with you", v: "The design session sets the curriculum around your goals and the skills your engineers already have." },
    { k: "Format", v: "Virtual, in person or hybrid. The number of days depends on the format you choose." },
    { k: "Your stack", v: "Hands-on projects reflect your workflows and tools, and use synthetic data." },
    { k: "Fees", v: "Set by team size, format and scope. You get a written proposal after the call." },
  ],
  trainedTitle: "Teams we've trained",
  next: [
    "We reply by email to set up a 30 to 45 minute call.",
    "We talk through your team, stack and timing.",
    "You get a written proposal with the plan and fees.",
  ],
};

/** /work-with-us: start an engagement conversation. */
export const workPage = {
  title: "Tell us what's stuck before production.",
  lede: "A few lines is enough. We reply by email to set up a discovery call with our forward deployed engineers.",
  next: [
    { k: "Discovery call", v: "We learn the workflow, the data and what success looks like." },
    { k: "Scope before quote", v: "Discovery sets scope, team and timeline before we price anything." },
    { k: "Then we embed", v: "Engineers work inside your team through PoC, production and handover." },
  ],
  note: "On-prem and private-cloud deployments can be scoped. Your team owns the code at the end.",
  leadsTitle: "Who leads the work",
  leads: [
    { name: "Hamza Farooq", role: "Founder and CEO. Ex-Google and Walmart Labs; adjunct professor at UCLA and UMN.", photo: "/site/hamza-farooq.png", w: 1254 },
    { name: "Jaya Rajwani", role: "Director of AI. Builds Traversaal's agent platforms.", photo: "/site/people/jaya-rajwani.png", w: 400 },
  ],
};

export const forms = {
  program: {
    submit: "Plan my program",
    sizeLabel: "Engineers taking part",
    sizes: ["1 to 10", "11 to 50", "51 to 200", "201+"],
    whenLabel: "When would you like to start?",
    whens: ["This quarter", "Next quarter", "Just exploring"],
    noteLabel: "Anything we should know?",
    notePlaceholder: "Your stack, goals, or a deadline",
    done: (name: string, email: string) =>
      `Thanks, ${name}. We'll email ${email} to set up a call about your program.`,
  },
  engagement: {
    submit: "Send to our engineers",
    stageLabel: "Where is it today?",
    stages: ["An idea", "A demo or PoC", "In production, needs work"],
    noteLabel: "What are you trying to get into production?",
    notePlaceholder: "For example: a support agent that works in a demo but not on real tickets",
    done: (name: string, email: string) =>
      `Thanks, ${name}. One of our engineers will reply to ${email} to set up a discovery call.`,
  },
};
