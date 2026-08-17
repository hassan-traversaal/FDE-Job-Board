#!/usr/bin/env node
// Weekly automated refresh for the FDE job board.
//
// Pulls new listings from fwddeploy.com and deployaijobs.com, uses Claude to
// judge curation fit and classify each one (region/level/lane/signals), and
// appends genuinely new roles to the `jobs` array in app/page.tsx.
//
// Requires: ANTHROPIC_API_KEY env var. Run with `node scripts/refresh-board.mjs`.

import { readFileSync, writeFileSync } from "fs";
import * as cheerio from "cheerio";

const PAGE_PATH = new URL("../app/page.tsx", import.meta.url);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLASSIFY_MODEL = "claude-haiku-4-5-20251001";
const MAX_DAYS_AGO = 10; // buffer beyond the 7-day cadence to survive a missed run

if (!ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Aborting.");
  process.exit(1);
}

// ---------- existing state ----------

function loadPageSource() {
  return readFileSync(PAGE_PATH, "utf8");
}

function jobsArrayBounds(src) {
  const start = src.indexOf("const jobs: Job[] = [");
  const end = src.indexOf("\n];", start);
  return { start, end };
}

function existingJobIds(src) {
  const { start, end } = jobsArrayBounds(src);
  const section = src.slice(start, end);
  const ids = new Set();
  const re = /url:"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(section))) ids.add(idOf(m[1]));
  return ids;
}

function idOf(url) {
  const m = url.match(/-([a-f0-9]+|\d+)\/?$/i);
  return m ? m[1] : url;
}

// ---------- scrape sources ----------

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; FDEBoardBot/1.0)" } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return res.text();
}

function parsePostedDays(text) {
  const s = (text ?? "").trim();
  if (/^today$/i.test(s)) return 0;
  if (/^yesterday$/i.test(s)) return 1;
  let m = s.match(/^(\d+)\s*days?(\s*ago)?$/i);
  if (m) return parseInt(m[1], 10);
  m = s.match(/^(\d+)\s*w(?:eeks?)?(\s*ago)?$/i);
  if (m) return parseInt(m[1], 10) * 7;
  m = s.match(/^(\d+)\s*mo(?:nths?)?(\s*ago)?$/i);
  if (m) return parseInt(m[1], 10) * 30;
  return null;
}

// deployaijobs.com renders each listing as:
//   <a class="job-card-link" href="/jobs/...">
//     <p class="company-name">...</p><h2 class="job-title">...</h2>
//     <span class="skill-tag">...</span> (repeated)
//     <span class="job-meta-item" aria-label="Location: ...">
//     <span class="job-meta-item" aria-label="Job type: ...">
//     <span class="job-meta-item" aria-label="Level: ...">  (optional)
//     <span class="job-salary">...</span>                   (optional)
//     <span class="job-date">Today|Yesterday|N days ago|Nw ago</span>
async function scrapeDeployAIJobs() {
  const found = [];
  for (let page = 1; page <= 14; page++) {
    const url = page === 1 ? "https://deployaijobs.com/jobs" : `https://deployaijobs.com/jobs?page=${page}`;
    let html;
    try {
      html = await fetchHtml(url);
    } catch {
      break;
    }
    const $ = cheerio.load(html);
    const cards = $("a.job-card-link").toArray();
    if (cards.length === 0) break;

    const pageDays = [];
    for (const el of cards) {
      const $el = $(el);
      const href = $el.attr("href");
      if (!href) continue;
      const company = $el.find(".company-name").first().text().trim();
      const title = $el.find(".job-title").first().text().trim();
      const location = ($el.find('[aria-label^="Location:"]').attr("aria-label") || "").replace(/^Location:\s*/i, "").trim();
      const levelAttr = $el.find('[aria-label^="Level:"]').attr("aria-label");
      const level = levelAttr ? levelAttr.replace(/^Level:\s*/i, "").trim() : "";
      const salary = $el.find(".job-salary").first().text().trim();
      const postedRaw = $el.find(".job-date").first().text().trim();
      const skills = $el
        .find(".skill-tag")
        .toArray()
        .map((s) => $(s).text().trim())
        .filter(Boolean);
      const days = parsePostedDays(postedRaw);
      if (days !== null) pageDays.push(days);
      found.push({
        url: "https://deployaijobs.com" + href,
        source: "deployaijobs",
        company,
        title,
        location,
        level,
        salary,
        skills,
        postedRaw,
        daysAgo: days,
      });
    }
    if (pageDays.length && Math.min(...pageDays) > MAX_DAYS_AGO) break;
  }
  return found;
}

// fwddeploy.com renders each listing as an <a href="/jobs/..."> containing:
//   <h3>title</h3><p>company</p>
//   <p>Full-time</p> (job type, may repeat for mobile/desktop)
//   <p>Remote</p> (badge, optional)
//   <p>location</p>
//   <p>salary</p> (optional, contains a currency amount)
//   <p>"N days"/"Today"/"Yesterday"</p> (always last)
async function scrapeFwdDeploy() {
  const found = [];
  for (const suffix of ["", "?page=2"]) {
    let html;
    try {
      html = await fetchHtml(`https://www.fwddeploy.com/s/remote-jobs${suffix}`);
    } catch {
      continue;
    }
    const $ = cheerio.load(html);
    const links = $('a[href^="/jobs/"]').toArray().filter((el) => $(el).attr("href") !== "/jobs/new");
    for (const el of links) {
      const $el = $(el);
      const href = $el.attr("href");
      const title = $el.find("h3").first().text().trim();
      if (!href || !title) continue;
      const ps = $el
        .find("p")
        .toArray()
        .map((p) => $(p).text().trim())
        .filter(Boolean);
      const company = ps[0] ?? "";
      const postedRaw = ps[ps.length - 1] ?? "";
      const rest = ps.slice(1, -1).filter((p, i, arr) => arr.indexOf(p) === i); // dedupe repeated "Full-time"
      const jobType = rest.find((p) => /^(Full-time|Part-time|Contract|internship)$/i.test(p));
      const salary = rest.find((p) => /[$€£₹]\s?[\d,]/.test(p));
      const withoutTypeSalary = rest.filter((p) => p !== jobType && p !== salary && p.toLowerCase() !== "remote");
      const location = withoutTypeSalary[0] ?? "Remote";
      found.push({
        url: "https://www.fwddeploy.com" + href,
        source: "fwddeploy",
        company,
        title,
        location,
        level: "",
        salary: salary ?? "",
        skills: [],
        postedRaw,
        daysAgo: parsePostedDays(postedRaw),
      });
    }
  }
  return found;
}

// ---------- filter to genuinely new + in-window ----------

function filterCandidates(raw, seenIds) {
  const out = [];
  const localIds = new Set();
  for (const item of raw) {
    const id = idOf(item.url);
    if (seenIds.has(id) || localIds.has(id)) continue;
    if (item.daysAgo === null || item.daysAgo > MAX_DAYS_AGO) continue;
    localIds.add(id);
    out.push(item);
  }
  return out;
}

// ---------- classify with Claude ----------

const CLASSIFY_TOOL = {
  name: "classify_roles",
  description: "Classify and curate a batch of candidate job listings for the FDE job board.",
  input_schema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "integer", description: "0-based index matching the input list" },
            include: {
              type: "boolean",
              description:
                "true if this is genuinely a forward-deployed or customer-embedded engineering role (not just advisory/sales) with clear remote or geographic eligibility, and not an obvious duplicate of another item in this same batch (distinct location variants of the same req ARE fine to keep)",
            },
            region: { type: "string", enum: ["US", "Europe", "India", "Global"] },
            level: { type: "string", description: "Short seniority label, e.g. Mid, Senior, Staff, Principal, Lead, Manager, Director, Executive, Entry" },
            lane: { type: "string", description: "Short category, e.g. Applied AI, Agentic AI, Generative AI, Healthcare AI, Voice AI, Security AI, Public sector, Fintech, Data platforms, Cloud infrastructure" },
            signals: { type: "array", items: { type: "string" }, maxItems: 3, description: "Up to 3 short skill/domain tags, deduplicated" },
            featured: { type: "boolean", description: "true only for a small number of standout roles (notable brand, exceptional comp, or unusually interesting scope)" },
            fit: { type: "string", description: "One sentence (under 25 words) on who this role suits, in your own words. Empty string if not featured." },
          },
          required: ["index", "include", "region", "level", "lane", "signals", "featured", "fit"],
        },
      },
    },
    required: ["results"],
  },
};

function summarize(c) {
  const bits = [c.company, c.title, c.location];
  if (c.level) bits.push(`level: ${c.level}`);
  if (c.salary) bits.push(c.salary);
  if (c.skills?.length) bits.push(`skills: ${c.skills.join(", ")}`);
  return bits.filter(Boolean).join(" | ");
}

async function classifyBatch(batch) {
  const listing = batch.map((c, i) => `${i}. ${summarize(c)}`).join("\n");
  const prompt = `You are curating a job board of "Forward Deployed Engineer" (FDE) roles for the FDE Field Guide.

Curation criteria — a role should be included when:
1. The work is explicitly forward-deployed, deployment-focused, or embedded with customers (not just advisory or pure sales).
2. It has a clear remote or geographic eligibility.
3. It is not an obvious duplicate of another listing in this same batch (exact same role cross-posted twice; distinct location variants of the same req ARE fine to keep separate).

Classify each of these ${batch.length} candidate listings (compact factual summaries, not full descriptions):

${listing}

Call the classify_roles tool with your results for every index from 0 to ${batch.length - 1}.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLASSIFY_MODEL,
      max_tokens: 4096,
      tools: [CLASSIFY_TOOL],
      tool_choice: { type: "tool", name: "classify_roles" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  const toolUse = data.content.find((c) => c.type === "tool_use");
  if (!toolUse) throw new Error("No tool_use block in Claude response");
  return toolUse.input.results;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---------- build Job records ----------

function postedLabel(daysAgo, isBucketed) {
  const today = new Date();
  const exact = new Date(today);
  exact.setDate(exact.getDate() - daysAgo);
  const fmt = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (!isBucketed) {
    if (daysAgo === 0) return "Today";
    if (daysAgo === 1) return "1d";
    if (daysAgo <= 6) return `${daysAgo}d`;
    return fmt(exact);
  }
  const rangeStart = new Date(today);
  rangeStart.setDate(rangeStart.getDate() - (daysAgo + 6));
  return `${fmt(rangeStart)} – ${fmt(exact)}`;
}

function esc(s) {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function main() {
  const src = loadPageSource();
  const seenIds = existingJobIds(src);

  console.log("Scraping deployaijobs.com...");
  const deployAI = await scrapeDeployAIJobs();
  console.log(`  found ${deployAI.length} raw listings`);

  console.log("Scraping fwddeploy.com...");
  const fwd = await scrapeFwdDeploy();
  console.log(`  found ${fwd.length} raw listings`);

  const candidates = filterCandidates([...deployAI, ...fwd], seenIds);
  console.log(`New in-window candidates: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log("Nothing new. Exiting without changes.");
    return;
  }

  const batches = chunk(candidates, 25);
  const classified = [];
  for (const [i, batch] of batches.entries()) {
    console.log(`Classifying batch ${i + 1}/${batches.length} (${batch.length} items)...`);
    const results = await classifyBatch(batch);
    for (const r of results) {
      classified.push({ ...batch[r.index], ...r });
    }
  }

  const included = classified.filter((c) => c.include);
  console.log(`Included after curation: ${included.length} / ${classified.length}`);

  if (included.length === 0) {
    console.log("Nothing survived curation. Exiting without changes.");
    return;
  }

  const lines = included.map((c) => {
    const bucketed = c.daysAgo > 6;
    const parts = [
      `company:"${esc(c.company)}"`,
      `title:"${esc(c.title)}"`,
      `region:"${c.region}"`,
      `location:"${esc(c.location)}"`,
    ];
    if (c.salary) parts.push(`salary:"${esc(c.salary)}"`);
    parts.push(`level:"${esc(c.level)}"`, `lane:"${esc(c.lane)}"`, `fit:"${esc(c.featured ? c.fit : "")}"`);
    parts.push(`signals:[${(c.signals || []).slice(0, 3).map((s) => `"${esc(s)}"`).join(",")}]`);
    parts.push(`posted:"${postedLabel(c.daysAgo, bucketed)}"`, `url:"${esc(c.url)}"`);
    if (c.featured) parts.push("featured:true");
    return `  {${parts.join(",")}},`;
  });

  const { end: closeIdx } = jobsArrayBounds(src);
  const updated = src.slice(0, closeIdx) + "\n" + lines.join("\n") + src.slice(closeIdx);

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const withDate = updated.replaceAll(/Updated \d{1,2} \w{3} \d{4}/g, `Updated ${dateStr}`);

  writeFileSync(PAGE_PATH, withDate);
  console.log(`Wrote ${included.length} new roles. Updated date set to ${dateStr}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
