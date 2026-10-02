// Read-only smoke checks against a running local preview or production build.
import assert from "node:assert/strict";
import { load } from "cheerio";

const base = new URL(process.env.SITE_URL ?? "http://localhost:3200");
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname), "Use a local test server.");
let homeCount;
let boardCount;
for (const path of ["/", "/teams", "/work-with-us", "/jobs"]) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200, `${path} must load`);
  const $ = load(await response.text());
  assert.equal($("h1").length, 1, `${path} needs one main heading`);
  assert.equal($("main#main").length, 1, `${path} needs the skip-link destination`);
  assert.ok($("title").text(), `${path} needs a title`);
  assert.equal(new URL($("link[rel=canonical]").attr("href")).href, new URL(path, "https://fde.traversaal.ai").href);
  assert.ok($("meta[property='og:image']").attr("content")?.endsWith("/site/og.png"));
  assert.equal($("meta[name='twitter:card']").attr("content"), "summary_large_image");
  assert.equal($(".mnav__panel a").length, 4, `${path} needs mobile navigation`);
  if (path === "/") {
    homeCount = Number($(".market__count").text().replaceAll(",", ""));
    const chips = $(".lane__track:not([aria-hidden]) .role__link");
    assert.ok(chips.length >= 8, "Home needs a role ticker");
    chips.each((_, a) => assert.match($(a).attr("href") ?? "", /^https:\/\/.+\/.+/, "Ticker roles link to the opening"));
  }
  if (path === "/jobs") boardCount = $("#jobs-list > .job").length;
  if (path === "/teams" || path === "/work-with-us") {
    assert.equal($("form.lead").length, 1);
    // The "Prefer another way?" line was removed on request; the failure message keeps the direct contact.
    assert.equal($(".lead__alternative").length, 0);
    for (const name of ["name", "email", "company"]) assert.ok($(`input[name='${name}']`).attr("required") !== undefined);
  }
  console.log(`PASS ${path}: content, navigation and sharing metadata`);
}
assert.ok(boardCount > 0);
assert.equal(homeCount, boardCount, "Home and board must use the same role count");
for (const path of ["/site/og.png", "/sitemap.xml", "/robots.txt"]) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200, `${path} must be available`);
  if (path.endsWith(".xml")) {
    const xml = await response.text();
    for (const route of ["/teams", "/work-with-us", "/jobs"]) assert.ok(xml.includes(`https://fde.traversaal.ai${route}`));
  }
  if (path.endsWith(".txt")) assert.ok((await response.text()).includes("Sitemap: https://fde.traversaal.ai/sitemap.xml"));
  console.log(`PASS ${path}`);
}
console.log(`PASS shared dataset: ${boardCount} tracked roles`);

// The free course is a separate app served through next.config.ts rewrites. Check it
// only when its origin is up (npm run course:dev locally), and say so when it is not.
const signin = await fetch(new URL("/signin?next=/library", base)).catch(() => null);
if (signin?.ok) {
  const $ = load(await signin.text());
  assert.match($("title").text(), /Claude Code in Practice/, "/signin should be the course's sign-in page");
  for (const path of ["/auth/config", "/api/course"]) {
    const response = await fetch(new URL(path, base));
    assert.equal(response.status, 200, `${path} must reach the course app`);
  }
  assert.equal((await fetch(new URL("/api/lead", base))).status, 405, "/api/lead must stay this site's route");
  console.log("PASS course: sign-in, auth config and outline served through the rewrites");
} else {
  console.log("SKIP course: its app is not reachable (run npm run course:dev, or set COURSE_ORIGIN)");
}
