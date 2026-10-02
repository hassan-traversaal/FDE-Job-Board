/* Welcome page: intro, the glyph field, the session rail, the live demo. */
(async function () {
  const { $, $$, esc, fmt, dur, date, icon, REDUCED } = Academy;

  /* ---------- chrome ---------- */
  const nav = $("#nav");
  const paintBrand = solid => { $("#brandSlot").innerHTML = Academy.brand(!solid); };
  let navSolid = null;
  const syncNav = () => {
    const solid = scrollY > innerHeight * 0.82;
    if (solid === navSolid) return;
    navSolid = solid; nav.classList.toggle("solid", solid); paintBrand(solid);
  };
  syncNav(); addEventListener("scroll", syncNav, { passive: true });
  $("#footBrand").innerHTML = Academy.brand(false);
  $("#ctaArrow").outerHTML = icon.arrow; $("#libArrow").outerHTML = icon.arrow;
  $$(".try-arrow").forEach(el => (el.outerHTML = icon.arrow));
  $$(".close .arr").forEach(el => (el.outerHTML = icon.arrow));

  /* ---------- the field ---------- */
  const hero = $("#top");
  const small = () => innerWidth < 720;
  const field = new GlyphField($("#field"), {
    center: small() ? [0.62, 0.24] : [0.72, 0.42],
    scale: small() ? 0.5 : 0.44,
    pointerTarget: hero,
    streams: false,           // symbols only: no typed text on the background
  });
  addEventListener("resize", () => {
    field.o.center = small() ? [0.62, 0.24] : [0.72, 0.42];
    field.o.scale = small() ? 0.5 : 0.44;
  }, { passive: true });
  new IntersectionObserver(([e]) => (e.isIntersecting ? field.start() : field.stop()), { threshold: 0.02 }).observe(hero);

  /* Per-session shape for the starburst: how many rays reach out. */
  const SCENES = { s1: { rays: 8 }, s2: { rays: 10 }, s3: { rays: 12 }, s4: { rays: 9 }, s5: { rays: 7 } };

  /* ---------- intro: a terminal says hello, then the field blooms ---------- */
  const seen = (() => { try { return sessionStorage.getItem("academy:intro") === "1"; } catch (e) { return false; } })();
  const intro = $("#intro");
  let introDone = false;
  const finishIntro = () => {
    if (introDone) return; introDone = true;
    intro.classList.add("out");
    field.bloom(seen ? 900 : 1800);
    setTimeout(() => hero.classList.add("ready"), seen ? 120 : 420);
    try { sessionStorage.setItem("academy:intro", "1"); } catch (e) { }
  };
  field.start();
  if (REDUCED || seen) { intro.remove(); finishIntro(); }
  else {
    addEventListener("keydown", finishIntro, { once: true });
    hero.addEventListener("pointerdown", finishIntro, { once: true });
    const wait = ms => new Promise(r => setTimeout(r, ms));
    (async () => {
      const cmd = 'claude "welcome the class"';
      await wait(380);
      for (let i = 1; i <= cmd.length && !introDone; i++) { $("#introCmd").textContent = cmd.slice(0, i); await wait(34 + Math.random() * 30); }
      if (introDone) return;
      await wait(260);
      $("#introCaret").remove(); $("#introOut").hidden = false;
      const msg = "Welcome, everyone. Five sessions, ready when you are.";
      const spin = ["·", "✢", "✳", "✻", "✽", "✻", "✳", "✢"]; let k = 0;
      const sp = setInterval(() => ($("#introSpin").textContent = spin[k++ % spin.length]), 110);
      for (let i = 1; i <= msg.length && !introDone; i++) { $("#introMsg").textContent = msg.slice(0, i); await wait(18); }
      await wait(700); clearInterval(sp); finishIntro();
    })();
  }

  /* ---------- the course, from the public outline ---------- */
  let data = { course: {}, sessions: [] };
  try { data = await (await fetch("/api/course")).json(); } catch (e) { }
  const S = data.sessions || [];
  const total = S.reduce((a, s) => a + (s.duration_ms || 0), 0);
  const chapters = S.reduce((a, s) => a + (s.chapter_count || 0), 0);
  const label = s => (s.bonus ? "Bonus" : String(s.number).padStart(2, "0"));

  $("#facts").innerHTML = ["Free", `${S.length} live sessions`, `${dur(total)} of class`, `${chapters} chapters`].map(t => `<span>${esc(t)}</span>`).join("");
  const st = $$("#stats .stat b");
  st[0].textContent = S.length; st[1].textContent = (total / 3600000).toFixed(1).replace(/\.0$/, "");
  st[2].textContent = chapters;

  /* rail */
  const RAIL_MS = 6500;
  $("#rail").innerHTML = S.map((s, i) => `
    <button type="button" role="tab" data-i="${i}" style="flex:${Math.max(0.6, s.duration_ms / 3600000)}" aria-label="${esc(s.kicker)}: ${esc(s.title)}">
      <span class="rt"><span class="n">${label(s)}</span><span class="t">${esc(s.title)}</span></span>
      <span class="bar"><i></i></span>
    </button>`).join("");
  const railBtns = $$("#rail button");
  let active = 0, railT0 = performance.now(), railPaused = false;
  const setScene = i => {
    active = i; railT0 = performance.now();
    const s = S[i]; if (!s) return;
    $("#railMeta").textContent = `${s.kicker} · ${date(s.date)} · ${dur(s.duration_ms)}`;
    $("#railLabel").textContent = s.title;
    $("#railCount").textContent = `${s.chapter_count} chapters · ${(s.lead || []).join(" & ")}`;
    railBtns.forEach((b, j) => { b.classList.toggle("on", j === i); b.setAttribute("aria-selected", String(j === i)); if (j !== i) b.querySelector("i").style.width = "0%"; });
    field.setScene(Object.assign({ seed: i * 7 + 3 }, SCENES[s.id] || {}));
  };
  railBtns.forEach(b => b.addEventListener("click", () => setScene(+b.dataset.i)));
  $("#railWrap").addEventListener("pointerenter", () => (railPaused = true));
  $("#railWrap").addEventListener("pointerleave", () => { railPaused = false; railT0 = performance.now() - railProg * RAIL_MS; });
  let railProg = 0;
  if (S.length) setScene(0);
  const railTick = now => {
    if (!railPaused && !REDUCED && introDone) {
      railProg = (now - railT0) / RAIL_MS;
      if (railProg >= 1) { setScene((active + 1) % S.length); railProg = 0; }
      const bar = railBtns[active] && railBtns[active].querySelector("i");
      if (bar) bar.style.width = (railProg * 100).toFixed(1) + "%";
    }
    requestAnimationFrame(railTick);
  };
  requestAnimationFrame(railTick);

  /* people: who taught what, from the session leads */
  const people = (data.course.instructors || []).map(p => {
    const taught = S.filter(s => (s.lead || []).includes(p.name));
    return `<div class="person">
      <img src="/${esc(p.photo)}" alt="">
      <div>
        <h3>${esc(p.name)}</h3>
        <div class="role">${esc(p.role)} · ${esc(p.detail)}</div>
        <div class="teaches">${taught.map(s => `<span class="tag">${s.bonus ? "Bonus" : "S" + s.number} · ${esc(s.title)}</span>`).join("")}</div>
      </div>
    </div>`;
  }).join("");
  $("#people").innerHTML = people;

  /* list + a frame that follows the cursor */
  $("#list").innerHTML = S.map(s => `
    <a class="row${s.bonus ? " bonus" : ""}" href="/signin?next=/session/${s.number}" data-enter data-next="/session/${s.number}" data-cover="${esc(s.cover || "")}">
      <div class="num">${s.bonus ? "+" : String(s.number).padStart(2, "0")}<small>${esc(s.kicker)}</small></div>
      <div><h3>${esc(s.title)}</h3><p>${esc(s.tagline)}</p></div>
      <div class="meta">${esc(date(s.date))}<br>${dur(s.duration_ms)} · ${s.chapter_count} chapters<br>${esc((s.lead || []).join(" & "))}</div>
      <span class="go">${icon.arrow}</span>
    </a>`).join("");
  const peek = $("#peek"), peekImg = peek.querySelector("img");
  let px = 0, py = 0, tx = 0, ty = 0, peekOn = false;
  $$("#list .row").forEach(row => {
    row.addEventListener("pointerenter", () => { if (!row.dataset.cover) return; peekImg.src = row.dataset.cover; peek.classList.add("on"); peekOn = true; });
    row.addEventListener("pointerleave", () => { peek.classList.remove("on"); peekOn = false; });
  });
  addEventListener("pointermove", e => { tx = e.clientX + 28; ty = e.clientY - 90; }, { passive: true });
  const peekTick = () => {
    px += (tx - px) * 0.16; py += (ty - py) * 0.16;
    if (peekOn) { peek.style.left = px + "px"; peek.style.top = py + "px"; }
    requestAnimationFrame(peekTick);
  };
  requestAnimationFrame(peekTick);

  /* ---------- signed in? then the doors open straight into the library ---------- */
  Academy.clerk().then(c => {
    if (!c || !c.isSignedIn) return;
    $$("[data-enter]").forEach(a => (a.href = a.dataset.next || "/library"));
    const n = $("#navCta"); n.href = "/library"; n.textContent = "Library";
    Academy.mountUser($("#userSlot"));
  });
  Academy.authConfig().then(cfg => {
    if (cfg && !cfg.gate) $$("[data-enter]").forEach(a => (a.href = a.dataset.next || "/library"));
  });

  /* ---------- reviews: Maven's, word for word ---------- */
  try {
    const R = await (await fetch("/api/reviews")).json();
    if (R && R.featured && (R.cards || []).length) {
      const STAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8L12 2.8z"/></svg>';
      const stars = (n, cls = "") => `<span class="stars ${cls}" role="img" aria-label="${n} out of 5 stars">${STAR.repeat(Math.round(n))}</span>`;
      const ini = n => (n || "?").trim().charAt(0).toUpperCase();
      const who = r => {
        const line = [r.role, r.company].filter(Boolean).join(" · ");
        return `<div class="rv-person">${r.photo ? `<img src="/${esc(r.photo)}" alt="" loading="lazy">` : `<span class="ini" aria-hidden="true">${esc(ini(r.name))}</span>`}
          <div><b>${esc(r.name || "Verified learner")}</b>${line ? `<span>${esc(line)}</span>` : ""}</div></div>`;
      };
      const paras = t => t.split(/\n\s*\n|\n/).map(x => x.trim()).filter(Boolean);
      const sm = R.summary || {};
      $("#rvScore").innerHTML = `<b>${(sm.average || 5).toFixed(2)}<small>/ 5</small></b>${stars(sm.average || 5)}
        <span class="meta">${sm.ratings || sm.reviews} ratings · ${sm.reviews} reviews on Maven ↗</span>`;
      $("#rvScore").setAttribute("aria-label", `Rated ${sm.average} out of 5 from ${sm.ratings} ratings on Maven`);
      // The same rating, small, under the hero copy. It takes you down to the reviews.
      const hr = $("#heroRating");
      hr.innerHTML = `${stars(sm.average || 5)}<span><b>${(sm.average || 5).toFixed(2)} / 5</b> on Maven</span>${icon.arrow}`;
      hr.setAttribute("aria-label", `Rated ${sm.average} out of 5 on Maven. Read the reviews`);
      hr.addEventListener("click", e => { e.preventDefault(); $("#reviews").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" }); });
      hr.hidden = false;
      // Featured reviews, one at a time: the first sentence set large, the rest
      // beside it. Unedited. Each stays RV_MS; the bar under it fills in that
      // time and its animationend moves to the next, so hovering (which pauses
      // the bar) pauses the rotation too.
      const RV_MS = 8000;
      const slide = (F, i) => {
        const ps = paras(F.text);
        const first = ps[0].match(/^.+?[.!?](\s|$)/), lead = first ? first[0].trim() : ps[0];
        const rest = [ps[0].slice(lead.length).trim(), ...ps.slice(1)].filter(Boolean);
        return `<figure class="rv-slide${i ? "" : " on"}" aria-roledescription="slide" aria-label="${i + 1} of ${R.featured.length}"${i ? ' aria-hidden="true"' : ""}>
          <blockquote class="rv-pull">${esc(lead)}</blockquote>
          <figcaption class="rv-rest">${rest.map(x => `<p>${esc(x)}</p>`).join("")}${stars(F.stars, "sm")}${who(F)}</figcaption>
        </figure>`;
      };
      const feat = $("#rvFeature");
      feat.style.setProperty("--rv-ms", RV_MS + "ms");
      feat.innerHTML = `<div class="rv-slides">${R.featured.map(slide).join("")}</div>
        ${R.featured.length > 1 ? `<div class="rv-dots" role="tablist" aria-label="Choose a review">${R.featured.map((F, i) =>
          `<button type="button" class="rv-dot${i ? "" : " on"}" role="tab" aria-selected="${!i}" aria-label="Review by ${esc(F.name || "a learner")}"><i><b></b></i></button>`).join("")}</div>` : ""}`;
      const slides = $$(".rv-slide", feat), dots = $$(".rv-dot", feat);
      let rvAt = 0;
      const showReview = i => {
        rvAt = (i + slides.length) % slides.length;
        slides.forEach((el, k) => { el.classList.toggle("on", k === rvAt); el.toggleAttribute("aria-hidden", k !== rvAt); });
        dots.forEach((d, k) => {
          d.classList.remove("on"); d.setAttribute("aria-selected", String(k === rvAt));
          if (k === rvAt) { void d.offsetWidth; d.classList.add("on"); }     // restart its bar
        });
      };
      dots.forEach((d, k) => {
        d.addEventListener("click", () => showReview(k));
        d.querySelector("b").addEventListener("animationend", () => { if (k === rvAt) showReview(rvAt + 1); });
      });
      feat.addEventListener("pointerenter", () => feat.classList.add("paused"));
      feat.addEventListener("pointerleave", () => feat.classList.remove("paused"));
      feat.addEventListener("focusin", () => feat.classList.add("paused"));
      feat.addEventListener("focusout", () => feat.classList.remove("paused"));
      // Off screen, the bar (and so the rotation) waits.
      new IntersectionObserver(([e]) => feat.classList.toggle("offscreen", !e.isIntersecting)).observe(feat);

      // One row of cards drifting past; doubled so the loop is seamless.
      const cards = R.cards;
      const card = (r, dupe) => `<article class="rv-card"${dupe ? ' aria-hidden="true"' : ""} title="${esc(r.text)}">${stars(r.stars, "sm")}<p>${esc(r.text)}</p>${who(r)}</article>`;
      $("#rvRows").innerHTML = `<div class="track" style="--dur:${Math.round(cards.length * 7)}s">${cards.map(r => card(r)).join("")}${cards.map(r => card(r, true)).join("")}</div>`;
      $("#rvAll").insertAdjacentHTML("beforeend", " " + icon.arrow);
      $("#reviews").hidden = false;
    }
  } catch (e) { }

  /* ---------- the demo: a real answer from Session 1, played back ---------- */
  let F = null;
  try { F = await (await fetch("/api/featured")).json(); } catch (e) { }
  if (F && F.q) {
    $("#demoTitle").textContent = `Session ${F.number}`;
    $("#demoDur").textContent = fmt(F.duration_ms);
    $("#demoEnd").textContent = fmt(F.duration_ms);
    const D = F.duration_ms || 1;
    const segs = (F.chapters || []).map((c, i, a) => ((a[i + 1] ? a[i + 1].start_ms : D) - c.start_ms) / D);
    $("#demoTl").innerHTML = segs.map(f => `<i style="flex:${f.toFixed(4)}"></i>`).join("") +
      F.citations.map(c => `<button type="button" class="mk" data-n="${c.n}" style="left:${(c.start_ms / D * 100).toFixed(2)}%" aria-label="Moment ${c.n} at ${fmt(c.start_ms)}"></button>`).join("");
    const showMoment = n => {
      const c = F.citations.find(x => x.n === n); if (!c) return;
      $$("#demoTl .mk").forEach(m => m.classList.toggle("on", +m.dataset.n === n));
      $$("#demoA .ts-chip").forEach(m => m.classList.toggle("on", +m.dataset.n === n));
      $("#demoNow").innerHTML = `${c.thumb ? `<img src="${esc(c.thumb)}" alt="">` : ""}
        <div style="min-width:0"><div class="who"><b class="mono" style="color:var(--coral-deep)">${fmt(c.start_ms)}</b> · ${esc(c.speaker)}</div><div class="say">“${esc(c.text)}”</div></div>`;
    };
    $("#demo").addEventListener("click", e => { const b = e.target.closest("[data-n]"); if (b) showMoment(+b.dataset.n); });
    let played = false;
    const play = async () => {
      if (played) return; played = true;
      const wait = ms => new Promise(r => setTimeout(r, ms));
      if (REDUCED) { $("#demoQ").textContent = F.q; $("#demoA").innerHTML = Academy.md(F.answer, F.citations); showMoment(1); return; }
      for (let i = 1; i <= F.q.length; i++) { $("#demoQ").textContent = F.q.slice(0, i); await wait(22); }
      await wait(450);
      const words = F.answer.split(/(\s+)/); let acc = "", lastN = 0;
      for (const w of words) {
        acc += w; $("#demoA").innerHTML = Academy.md(acc, F.citations);
        const m = acc.match(/\[(\d+)\]/g); const n = m ? +m[m.length - 1].slice(1, -1) : 0;
        if (n && n !== lastN) { lastN = n; showMoment(n); }
        if (w.trim()) await wait(28);
      }
    };
    new IntersectionObserver(([e], io) => { if (e.isIntersecting) { play(); io.disconnect(); } }, { threshold: 0.4 }).observe($("#demo"));
  } else {
    $("#ask").remove();
  }

  Academy.reveal();
})();
