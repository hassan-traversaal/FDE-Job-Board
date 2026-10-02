/* Shared by every page: helpers, the Clerk session, and the page guard.
 *
 * Every API call carries a token minted at call time (Clerk session tokens live
 * 60s, so trusting the cookie on a slow page is how the hamza studio got its
 * intermittent 401s). fetch() sends it as a bearer header; EventSource and
 * <video> cannot set headers, so they carry it as ?__clerk_token=, which the
 * server reads instead (backend/auth.py).
 */
(function () {
  document.documentElement.classList.add("js");
  const A = (window.Academy = {});

  A.$ = (s, r = document) => r.querySelector(s);
  A.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  A.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  A.REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** 754000 -> "12:34", 4000000 -> "1:06:40" */
  A.fmt = ms => {
    const s = Math.max(0, Math.floor((ms || 0) / 1000));
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = String(s % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
  };
  /** 7045000 -> "1h 57m" */
  A.dur = ms => {
    const m = Math.round((ms || 0) / 60000), h = Math.floor(m / 60);
    return h ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
  };
  A.date = iso => {
    if (!iso) return "";
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  };
  /* Browser storage, kept per signed-in person: "academy:u:<user id>:<key>".
     Two accounts on one browser never see each other's progress. With the
     sign-in gate off there is no user, and keys are just "academy:<key>". */
  A.uid = null;
  const lsKey = k => "academy:" + (A.uid ? "u:" + A.uid + ":" : "") + k;
  A.store = {
    get(k, d) { try { const v = localStorage.getItem(lsKey(k)); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) {
      try { localStorage.setItem(lsKey(k), JSON.stringify(v)); } catch (e) { }
      if (k.startsWith("progress:")) markDirty(k.slice(9));
    },
  };

  /* ---------- progress, kept on the account ----------
     The account (/api/progress, see backend/progress.py) is the record; this
     browser keeps a working copy so pages read it instantly. On each page
     load the two are merged; changes go up a few seconds later, at once for a
     tick, and as the page closes. The merge rules are backend/progress.py's. */
  const mergeSession = (a, b) => {
    if (!a || !b) return a || b || null;
    const watched = (a.at || 0) >= (b.at || 0) ? a : b;
    const [marked, other] = (a.m || 0) >= (b.m || 0) ? [a, b] : [b, a];
    const ch = {};
    for (const k of new Set([...Object.keys(a.ch || {}), ...Object.keys(b.ch || {})]))
      ch[k] = Math.max((a.ch || {})[k] || 0, (b.ch || {})[k] || 0);
    return { t: watched.t || 0, at: watched.at || 0, m: Math.max(a.m || 0, b.m || 0), ch,
             done: Object.assign({}, other.done || {}, marked.done || {}) };
  };
  A.mergeSession = mergeSession;
  // What the account stores is rounded (seconds, whole percents); compare like with like.
  const norm = r => !r ? "" : JSON.stringify([Math.floor((r.t || 0) / 1000), Math.floor((r.at || 0) / 1000), Math.floor((r.m || 0) / 1000),
    Object.entries(r.ch || {}).filter(([, v]) => v > 0).map(([k, v]) => [k, Math.round(v * 100)]).sort(),
    Object.entries(r.done || {}).sort()]);
  const putRaw = (sid, rec) => { try { localStorage.setItem(lsKey("progress:" + sid), JSON.stringify(rec)); } catch (e) { } };
  const localSessions = () => {
    const out = {}, pre = lsKey("progress:");
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(pre)) out[k.slice(pre.length)] = JSON.parse(localStorage.getItem(k)); } } catch (e) { }
    return out;
  };
  /* Progress saved before accounts were connected belongs to whoever signs in
     first on this browser; it moves into their space, and stops being shared. */
  const adoptLegacy = () => {
    try {
      const keys = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("academy:") && !k.startsWith("academy:u:")) keys.push(k); }
      for (const k of keys) {
        const name = k.slice("academy:".length), dest = lsKey(name), val = JSON.parse(localStorage.getItem(k));
        if (name.startsWith("progress:")) {
          const mine = JSON.parse(localStorage.getItem(dest) || "null");
          localStorage.setItem(dest, JSON.stringify(mergeSession(mine, val)));
        } else if (localStorage.getItem(dest) == null) localStorage.setItem(dest, JSON.stringify(val));
        localStorage.removeItem(k);
      }
    } catch (e) { }
  };

  const dirty = new Set();
  let pushTimer = null, synced = false;
  function markDirty(sid) {
    if (!A.uid || !synced) return;                 // nothing goes up before the first merge
    dirty.add(sid);
    if (!pushTimer) pushTimer = setTimeout(() => push(), 20000);
  }
  /** After a tick or untick: send it now-ish rather than in 20 s. */
  A.syncSoon = () => { if (!dirty.size) return; clearTimeout(pushTimer); pushTimer = setTimeout(() => push(), 1200); };
  async function push(closing) {
    clearTimeout(pushTimer); pushTimer = null;
    if (!A.uid || !dirty.size) return;
    const sessions = {};
    for (const sid of dirty) sessions[sid] = A.store.get("progress:" + sid, null);
    dirty.clear();
    try {
      if (!closing) await A.pump();
      const h = { "Content-Type": "application/json" };
      if (A.token) h.Authorization = "Bearer " + A.token;
      const r = await fetch("/api/progress", { method: "PUT", headers: h, body: JSON.stringify({ sessions }),
                                               keepalive: !!closing, credentials: "same-origin" });
      if (!r.ok) throw new Error(String(r.status));
      if (!closing) { const d = await r.json(); for (const sid of Object.keys(sessions)) if (d.sessions && d.sessions[sid]) putRaw(sid, d.sessions[sid]); }
    } catch (e) {
      Object.keys(sessions).forEach(sid => dirty.add(sid));            // try again later
      if (!closing) pushTimer = setTimeout(() => push(), 30000);
    }
  }
  addEventListener("pagehide", () => push(true));
  document.addEventListener("visibilitychange", () => { if (document.hidden) push(true); });

  /** Merge the account's progress with this browser's. Resolves either way;
      with no account (gate off) or the account unreachable, the browser copy stands. */
  A.syncProgress = async () => {
    if (!A.uid || synced) return synced;
    let srv = null;
    try { srv = await Promise.race([A.api("/api/progress"), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 4000))]); }
    catch (e) { return false; }
    if (!srv || !srv.enabled) return false;
    const local = localSessions(), remote = srv.sessions || {};
    synced = true;
    for (const sid of new Set([...Object.keys(local), ...Object.keys(remote)])) {
      const m = mergeSession(local[sid], remote[sid]);
      if (!m) continue;
      putRaw(sid, m);
      if (norm(m) !== norm(remote[sid])) dirty.add(sid);
    }
    if (dirty.size) A.syncSoon();
    return true;
  };

  A.icon = {
    arrow: '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  };

  /* The real Traversaal logo (light/dark artwork), then the academy label. */
  A.brand = (dark = false, sub = "Academy") => `
    <span class="brand${dark ? " on-dark" : ""}">
      <img class="brand-logo" src="/assets/img/traversaal-logo-${dark ? "dark" : "light"}.png" alt="Traversaal.ai">
      <span class="brand-rule" aria-hidden="true"></span>
      <span class="brand-sub">${A.esc(sub)}</span>
    </span>`;

  /* ---------- Clerk ---------- */
  let cfgP = null;
  A.authConfig = () => (cfgP = cfgP || fetch("/auth/config", { cache: "no-store" }).then(r => r.json()).catch(() => null));

  const load = (src, attrs) => new Promise((ok, err) => {
    const s = document.createElement("script"); s.src = src; s.crossOrigin = "anonymous";
    for (const k in attrs || {}) s.setAttribute(k, attrs[k]);
    s.onload = ok; s.onerror = err; document.head.appendChild(s);
  });

  let clerkP = null;
  /** -> Clerk once loaded, or null when the gate is off / Clerk failed. */
  A.clerk = () => (clerkP = clerkP || (async () => {
    const cfg = await A.authConfig();
    if (!cfg || !cfg.enabled) return null;
    try {
      await load(`https://${cfg.frontend_api}/npm/@clerk/ui@1/dist/ui.browser.js`);
      await load(`https://${cfg.frontend_api}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, { "data-clerk-publishable-key": cfg.publishable_key });
      await window.Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor }, appearance: cfg.appearance || {}, localization: cfg.localization || {} });
      return window.Clerk;
    } catch (e) { console.warn("Clerk did not load", e); return null; }
  })());

  A.token = null;
  A.pump = async () => {
    const c = await A.clerk();
    try { A.token = c && c.session ? await c.session.getToken() : null; } catch (e) { A.token = null; }
    return A.token;
  };
  setInterval(() => { if (A.token) A.pump(); }, 25000);
  /** For URLs handed to EventSource / <video>, which cannot await or set headers. */
  A.tok = u => (A.token ? u + (u.includes("?") ? "&" : "?") + "__clerk_token=" + encodeURIComponent(A.token) : u);

  A.api = async (u, opts = {}) => {
    const send = async () => {
      const h = new Headers(opts.headers || {});
      const t = await A.pump();
      if (t) h.set("Authorization", "Bearer " + t);
      return fetch(u, Object.assign({}, opts, { headers: h }));
    };
    let r = await send();
    if (r.status === 401) r = await send();
    if (r.status === 401) { location.replace("/signin?next=" + encodeURIComponent(location.pathname + location.search)); throw new Error("signed out"); }
    if (!r.ok) throw new Error(`${u}: ${r.status}`);
    return r.json();
  };

  /** Gated pages: resolve when the visitor may see the page, else send them to sign in. */
  A.guard = async () => {
    const cfg = await A.authConfig();
    const next = location.pathname + location.search;
    if (cfg && cfg.misconfigured) {
      document.body.insertAdjacentHTML("afterbegin", `<div style="padding:12px 20px;background:#1A1612;color:#F3EDE3;font-size:13px">
        Sign-in is not configured on this server. Add CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to .env, or set ALLOW_PUBLIC=true for a local demo.</div>`);
      return null;
    }
    if (!cfg || !cfg.gate) return null;            // gate off: open
    const c = await A.clerk();
    if (!c) return null;
    if (!c.isSignedIn) { location.replace("/signin?next=" + encodeURIComponent(next)); return new Promise(() => { }); }
    await A.pump();
    if (c.user && c.user.id) { A.uid = c.user.id; adoptLegacy(); }
    return c;
  };

  A.mountUser = async slot => {
    const c = await A.clerk();
    if (c && c.isSignedIn && slot) { slot.innerHTML = ""; c.mountUserButton(slot, { afterSignOutUrl: "/" }); }
  };

  A.revealAuth = () => { const w = A.$(".auth-wait"); if (w) { w.classList.add("gone"); setTimeout(() => w.remove(), 400); } };

  /* ---------- the bot's markdown: paragraphs, bullets, bold/italic, `code`, [n] ----------
   Only a [n] that matches a real citation becomes a live timestamp chip; any
   other bracketed number stays text rather than a button that does nothing. */
  A.mdInline = (t, cites) => {
    t = A.esc(t)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, "$1<i>$2</i>");
    return t.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (whole, g) => g.split(/\s*,\s*/).map(n => {
      const c = (cites || []).find(x => x.n === +n);
      if (!c) return `[${n}]`;
      return `<button type="button" class="ts-chip" data-n="${c.n}" aria-label="Play moment ${c.n} at ${A.fmt(c.start_ms)}">${A.icon.clock}${A.fmt(c.start_ms)}</button>`;
    }).join(""));
  };
  /* Answers from the live bot are sectioned markdown: ## headline, ### sections,
     bullets, numbered lists, quotes and a "who said what" table. A table in a
     ~400px chat panel is unreadable as a grid, so each row becomes a short
     entry: the first cell as its label, the rest after it. */
  A.md = (md, cites) => {
    const lines = String(md || "").replace(/^\s*```(?:markdown|md)?\s*\n?/i, "").replace(/\n?```\s*$/, "").split(/\n/);
    let html = "", list = null, rows = null;
    const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
    const flushRows = () => {
      if (!rows) return;
      const [head, ...body] = rows;
      const data = body.filter(r => !/^[-:\s|]*$/.test(r.join("")));
      html += `<div class="md-rows">${data.map(r => `<div class="md-row">${r[0] ? `<b>${A.mdInline(r[0], cites)}</b>` : ""}${r.slice(1).filter(Boolean).map((c, i) =>
        `<span${i === r.length - 2 && /^\[[\d,\s]+\]$/.test(c) ? ' class="src"' : ""}>${A.mdInline(c, cites)}</span>`).join("")}</div>`).join("")}</div>`;
      rows = null;
    };
    for (const raw of lines) {
      const l = raw.trim();
      if (l.startsWith("|") && l.endsWith("|")) { closeList(); (rows = rows || []).push(l.slice(1, -1).split("|").map(c => c.trim())); continue; }
      flushRows();
      let m;
      if ((m = l.match(/^(#{1,2})\s+(.*)/))) { closeList(); html += `<h4 class="md-h">${A.mdInline(m[2], cites)}</h4>`; }
      else if ((m = l.match(/^#{3,6}\s+(.*)/))) { closeList(); html += `<h5 class="md-k">${A.mdInline(m[1], cites)}</h5>`; }
      else if ((m = l.match(/^[-*]\s+(.*)/))) { if (list !== "ul") { closeList(); html += "<ul>"; list = "ul"; } html += `<li>${A.mdInline(m[1], cites)}</li>`; }
      else if ((m = l.match(/^\d+[.)]\s+(.*)/))) { if (list !== "ol") { closeList(); html += "<ol>"; list = "ol"; } html += `<li>${A.mdInline(m[1], cites)}</li>`; }
      else if ((m = l.match(/^>\s?(.*)/))) { closeList(); html += `<blockquote>${A.mdInline(m[1], cites)}</blockquote>`; }
      else if (/^(-{3,}|\*{3,})$/.test(l)) { closeList(); }
      else { closeList(); if (l) html += `<p>${A.mdInline(l, cites)}</p>`; }
    }
    closeList(); flushRows();
    return html;
  };

  /* ---------- progress ----------
     Per session, in this browser: progress:<id> = { ch: {n: fraction watched},
     done: {n: true|false} }. A chapter is done when ticked, or watched to the
     end; a hand untick wins over watching. Percentages count chapters. */
  A.MAVEN = "https://maven.com/boring-bot";
  A.doneOf = (p, c) => { const m = (p && p.done) || {}, seen = (p && p.ch) || {}; return c.n in m ? !!m[c.n] : (seen[c.n] || 0) >= 0.95; };
  const pctOf = (d, t) => (!t ? 0 : d >= t ? 100 : Math.floor(d / t * 100));
  A.sessionProgress = s => {
    const p = A.store.get("progress:" + s.id, {}), total = s.chapters.length;
    const done = s.chapters.filter(c => A.doneOf(p, c)).length;
    return { done, total, pct: pctOf(done, total) };
  };
  A.courseProgress = sessions => {
    let done = 0, total = 0, full = 0;
    (sessions || []).forEach(s => { const r = A.sessionProgress(s); done += r.done; total += r.total; if (r.total && r.pct === 100) full++; });
    return { done, total, pct: pctOf(done, total), sessionsDone: full, sessions: (sessions || []).length };
  };

  /* ---------- a toast at the bottom of the screen ---------- */
  A.toast = (html, ms = 3200) => {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); document.body.appendChild(t); }
    t.innerHTML = html; t.classList.remove("on"); void t.offsetWidth; t.classList.add("on");
    clearTimeout(A.toast.t); A.toast.t = setTimeout(() => t.classList.remove("on"), ms);
  };

  /* ---------- the end of the course ---------- */
  A.congratsHTML = (st, inline) => `
    <div class="cg-k"><span class="cg-spark" aria-hidden="true">✻</span>Course complete</div>
    <h2 class="cg-t" id="cgT">You finished <em>Claude Code in Practice.</em></h2>
    <p class="cg-p">All ${st.sessions} sessions and ${st.chapters} chapters, ${A.dur(st.duration)} of live class, start to finish. That is the whole course. Well done.</p>
    <div class="cg-more">
      <p>Want to keep going? Hamza Farooq teaches more courses on Maven.</p>
      <div class="cg-b">
        <a class="btn btn-coral" href="${A.MAVEN}" target="_blank" rel="noopener">Explore more courses ${A.icon.arrow}</a>
        ${inline ? "" : `<a class="btn btn-ghost-dark" href="/library">Back to the library</a>`}
      </div>
    </div>`;
  A.burst = el => {                      // a small burst of the site's glyphs
    if (A.REDUCED || !el) return;
    const g = "✻✳+·×*", colors = ["#EF5F2B", "#FF7849", "#F3EDE3", "#E8A33B"];
    for (let i = 0; i < 28; i++) {
      const s = document.createElement("span"); s.className = "bit";
      const a = Math.random() * Math.PI * 2, r = 90 + Math.random() * 170;
      s.textContent = g[i % g.length];
      s.style.cssText = `--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r - 40}px;--rot:${(Math.random() * 360) | 0}deg;color:${colors[i % colors.length]};animation-delay:${Math.random() * 120}ms;font-size:${12 + Math.random() * 14}px`;
      el.appendChild(s); setTimeout(() => s.remove(), 1700);
    }
  };
  /** A centred card over the page. Escape, the x or the scrim closes it. */
  A.dialog = (html, { burst = false } = {}) => {
    const old = document.querySelector(".cg"); if (old) old.remove();
    const t = document.querySelector(".toast"); if (t) t.classList.remove("on");
    const d = document.createElement("div");
    d.className = "cg"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-labelledby", "cgT");
    d.innerHTML = `<div class="cg-scrim"></div><div class="cg-card"><button class="cg-x" type="button" aria-label="Close">×</button>${html}</div>`;
    document.body.appendChild(d);
    const close = () => { d.classList.add("out"); setTimeout(() => d.remove(), 300); removeEventListener("keydown", esc); };
    const esc = e => { if (e.key === "Escape") close(); };
    d.querySelector(".cg-x").addEventListener("click", close);
    d.querySelector(".cg-scrim").addEventListener("click", close);
    addEventListener("keydown", esc);
    const first = d.querySelector(".btn-coral"); if (first) first.focus({ preventScroll: true });
    if (burst) A.burst(d.querySelector(".cg-card"));
    return d;
  };
  A.congrats = st => A.dialog(A.congratsHTML(st, false), { burst: true });

  /* ---------- "explore more", at the bottom of every page ---------- */
  A.moreBar = () => `<span class="mb-spark" aria-hidden="true">✻</span>
    <span>Enjoying these sessions? Hamza Farooq teaches more courses on Maven.</span>
    <a href="${A.MAVEN}" target="_blank" rel="noopener">Explore more courses ${A.icon.arrow}</a>`;
  A.fillMore = () => document.querySelectorAll("[data-more]").forEach(el => { el.innerHTML = A.moreBar(); });
  document.addEventListener("DOMContentLoaded", A.fillMore);
  if (document.readyState !== "loading") A.fillMore();

  /* ---------- scroll reveal ---------- */
  A.reveal = (root = document) => {
    const els = A.$$(".r:not(.in)", root);
    if (A.REDUCED || !("IntersectionObserver" in window)) { els.forEach(el => el.classList.add("in")); return; }
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    els.forEach(el => io.observe(el));
    setTimeout(() => els.forEach(el => el.classList.add("in")), 2600);   // never trap content hidden
  };

  A.topbarScroll = () => {
    const bar = A.$(".topbar"); if (!bar) return;
    const f = () => bar.classList.toggle("scrolled", scrollY > 4);
    f(); addEventListener("scroll", f, { passive: true });
  };
})();
