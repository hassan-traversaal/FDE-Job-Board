/* One session: an overview first, then the player with its chapters,
 * transcript, and the bot that cites moments.
 *
 * Views
 *   overview  /session/2            what it covers, chapters (accordion), Get started
 *   watch     /session/2?watch      the player; ?t=SECONDS lands on a second
 * Back/forward move between them.
 *
 * Playback stops at the end of each chapter and offers the next one, unless
 * Autoplay is on, in which case it plays straight through.
 *
 * The player drives everything off one clock, P. With the recording in media/
 * P is the <video>. Without it, P is a Clock with the same face (currentTime,
 * play, pause, events) and the screen shows the frame from that minute of the
 * class with the transcript as captions.
 */
(async function () {
  const { $, $$, esc, fmt, dur, date, icon, store, REDUCED } = Academy;
  const ICON = {
    prev: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="2.4" height="14" rx="1"/><path d="M19 6.2v11.6a.8.8 0 0 1-1.2.7L9.6 12.7a.8.8 0 0 1 0-1.4l8.2-5.8a.8.8 0 0 1 1.2.7Z"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="16.6" y="5" width="2.4" height="14" rx="1"/><path d="M5 6.2v11.6a.8.8 0 0 0 1.2.7l8.2-5.8a.8.8 0 0 0 0-1.4L6.2 5.5A.8.8 0 0 0 5 6.2Z"/></svg>',
    cc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 10.2a2.4 2.4 0 1 0 0 3.6M17 10.2a2.4 2.4 0 1 0 0 3.6" stroke-linecap="round"/></svg>',
    fs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  };

  $("#brand").innerHTML = Academy.brand(false);
  Academy.topbarScroll();
  const num = location.pathname.split("/").filter(Boolean).pop();
  const sid = "s" + num;
  const body = document.body;

  await Academy.guard();
  const syncing = Academy.syncProgress();               // the account's progress, merged in
  Academy.mountUser($("#userSlot"));
  let S, T, course;
  try {
    [S, T, course] = await Promise.all([Academy.api(`/api/sessions/${sid}`), Academy.api(`/api/sessions/${sid}/transcript`),
      Academy.api("/api/sessions").catch(() => ({ course: {} }))]);
  } catch (e) { Academy.revealAuth(); $("#ov").innerHTML = `<div class="ov-in"><p>This session could not load. Refresh to try again.</p></div>`; return; }
  Academy.revealAuth();

  const CH = S.chapters, CUES = T.cues || [];
  const D = S.duration_ms;
  const people = (course.course || {}).instructors || [];
  const face = n => (people.find(p => p.name === n) || {}).photo;
  const faces = names => `<span class="faces">${(names || []).map(n => face(n) ? `<img src="/${esc(face(n))}" alt="">` : "").join("")}</span>`;
  const label = S.bonus ? "Bonus session" : `Session ${S.number}`;

  document.title = `${S.title} · Claude Code in Practice`;
  $("#crumbSession").textContent = `${label} · ${S.title}`;
  $("#askTitle").textContent = S.bonus ? "Ask the bonus session" : `Ask Session ${S.number}`;
  $("#askSub").textContent = `It has heard all ${dur(D)}. Answers cite the exact moment.`;
  $(".ask-note span").textContent = S.bot === "live"
    ? "Answers by MomentSearch, from what was said and shown"
    : "Preview answers, drawn from the transcript";
  $("#chCount").textContent = CH.length;
  $("#txCount").textContent = CUES.length;
  $("#tDur").textContent = fmt(D);

  /* ---------- the clock ---------- */
  class Clock extends EventTarget {
    constructor(seconds) { super(); this.duration = seconds; this._t = 0; this.paused = true; this.playbackRate = 1; }
    get currentTime() { return this._t; }
    set currentTime(v) { this._t = Math.max(0, Math.min(this.duration, v)); this._emit("timeupdate"); this._emit("seeked"); }
    play() {
      if (!this.paused) return Promise.resolve();
      this.paused = false; this._emit("play");
      let last = performance.now(), lastEmit = 0;
      const step = now => {
        if (this.paused) return;
        // rAF can hand the first frame a timestamp from before play(); never step back.
        this._t = Math.min(this.duration, this._t + Math.max(0, now - last) / 1000 * this.playbackRate); last = Math.max(last, now);
        if (now - lastEmit > 250) { this._emit("timeupdate"); lastEmit = now; }
        if (this._t >= this.duration) { this.pause(); this._emit("ended"); return; }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      return Promise.resolve();
    }
    pause() { if (this.paused) return; this.paused = true; this._emit("pause"); }
    _emit(n) { this.dispatchEvent(new Event(n)); }
  }

  const screen = $("#screen"), still = $("#still"), badge = $("#badge");
  let P;
  const media = S.media;
  if (media && !media.audio_only) { P = document.createElement("video"); P.playsInline = true; P.preload = "metadata"; screen.prepend(P); }
  else if (media) { P = document.createElement("audio"); P.preload = "metadata"; screen.append(P); }
  else P = new Clock(D / 1000);
  if (media) {
    // Recordings are for watching here, not downloading: no download in the
    // browser's controls, and no right-click "Save video as…" / "Show controls".
    P.setAttribute("controlslist", "nodownload");
    P.addEventListener("contextmenu", e => e.preventDefault());
  }
  if (media) {
    // The __session cookie authenticates media; a fresh token is the fallback
    // when a range request lands after the cookie lapsed.
    let retried = false;
    P.src = media.url;
    P.addEventListener("error", async () => {
      if (retried) return; retried = true;
      const t = P.currentTime || 0; await Academy.pump();
      P.src = Academy.tok(media.url); P.currentTime = t;
    });
  }
  const showStill = !media || media.audio_only;
  if (showStill) {
    still.hidden = false; badge.hidden = false;
    badge.innerHTML = !media
      ? (S.has_video ? `<span class="pulse"></span><span><b>Preview</b><span class="long"> · recording not uploaded yet</span></span>`
                     : `<span class="pulse"></span><span><b>Audio session</b><span class="long"> · shown with Module ${String(S.number).padStart(2, "0")} slides</span></span>`)
      : `<span class="pulse"></span><span><b>Audio only</b><span class="long"> · slides from the deck</span></span>`;
  }

  const minuteFrame = ms => `/assets/frames/${sid}/t/${String(Math.round(ms / 60000)).padStart(4, "0")}.jpg`;
  // Anything before the first chapter's first words belongs to the first chapter.
  const chapterAt = ms => { let hit = CH[0]; for (const c of CH) { if (c.start_ms <= ms) hit = c; else break; } return hit; };
  // What is *playing*: a seek to a chapter's first second can land a few frames
  // short of it (keyframes, the clock's first tick), and that must not read as
  // the end of the chapter before.
  const EPS = 400;
  const playingAt = ms => chapterAt(ms + EPS);
  const frameAt = ms => (S.frames ? minuteFrame(ms) : ((chapterAt(ms) || {}).thumb || S.cover));
  let stillSrc = "";
  const paintStill = ms => {
    if (!showStill) return;
    const src = frameAt(ms);
    if (src === stillSrc) return;
    stillSrc = src;
    const img = new Image();
    img.onload = () => { if (stillSrc === src) still.src = src; };
    img.src = src;
    if (S.frames) new Image().src = minuteFrame(ms + 60000);        // warm the next minute
  };

  /* ---------- captions ---------- */
  const cueIndex = ms => {
    let lo = 0, hi = CUES.length - 1, ans = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (CUES[mid].start_ms <= ms) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  };
  let capsOn = store.get("captions", true), lastCap = -2;
  const cap = $("#cap");
  const paintCap = ms => {
    const i = cueIndex(ms), c = CUES[i];
    const live = c && ms < c.end_ms + 1500 ? i : -1;
    if (live === lastCap) return;
    lastCap = live;
    cap.innerHTML = live < 0 ? "" : `<span>${c.speaker ? `<span class="spk">${esc(c.speaker.split(" ")[0])}</span>` : ""}${esc(c.text)}</span>`;
  };
  const setCaps = on => { capsOn = on; store.set("captions", on); cap.classList.toggle("off", !on); $("#ccBtn").classList.toggle("on", on); $("#ccBtn").setAttribute("aria-pressed", String(on)); };

  /* ---------- progress ---------- */
  await syncing;
  const progress = store.get("progress:" + sid, { t: 0, ch: {} });
  progress.ch = progress.ch || {};
  const fracOf = c => Math.min(1, progress.ch[c.n] || 0);
  progress.done = progress.done || {};
  /* Done = ticked by hand, or watched to the end. A hand untick wins over watching. */
  const isDone = c => (c.n in progress.done ? !!progress.done[c.n] : fracOf(c) >= 0.95);
  const doneCount = () => CH.filter(isDone).length;
  const sessPct = () => (doneCount() >= CH.length ? 100 : Math.floor(doneCount() / CH.length * 100));
  const allSessions = (course && course.sessions) || [];
  const courseNow = () => Academy.courseProgress(allSessions);
  const courseStats = () => ({ sessions: allSessions.length, chapters: allSessions.reduce((a, s) => a + s.chapters.length, 0),
                               duration: allSessions.reduce((a, s) => a + s.duration_ms, 0) });
  /* After any done change: say what it means (chapter, session, course). */
  function announceDone(n, on, before) {
    const sp = sessPct(), c = CH[n - 1], cp = allSessions.length ? courseNow() : null;
    if (on && cp && cp.pct === 100 && before.course < 100) { Academy.congrats(courseStats()); return; }
    if (on && sp === 100 && before.session < 100) { sessionComplete(); return; }
    Academy.toast(on
      ? `<span class="ok">✓ Chapter ${n} done.</span><span>This session is <b>${sp}%</b> complete${cp ? ` · course <b>${cp.pct}%</b>` : ""}.</span>`
      : `<span>Chapter ${n} marked not done. This session is <b>${sp}%</b> complete.</span>`);
  }
  const doneBefore = () => ({ session: sessPct(), course: allSessions.length ? courseNow().pct : 0 });
  /* Where to go once this session is done: the next session not yet finished
     (wrapping round to any earlier one), or null when every other one is done. */
  const nextSession = () => {
    const i = allSessions.findIndex(s => s.id === sid);
    if (i < 0) return null;
    const rest = [...allSessions.slice(i + 1), ...allSessions.slice(0, i)];
    return rest.find(s => Academy.sessionProgress(s).pct < 100) || null;
  };
  const sessHref = s => `/session/${s.number}`;
  const nextCard = nx => `
    <a class="sc-next" href="${sessHref(nx)}">
      ${nx.cover ? `<img src="${esc(nx.cover)}" alt="">` : ""}
      <span><small>Up next · ${esc(nx.kicker)} · ${dur(nx.duration_ms)}</small><b>${esc(nx.title)}</b></span>
      ${icon.arrow}
    </a>`;
  /* All chapters done: say so, and offer the next session or the library. */
  function sessionComplete() {
    const nx = nextSession(), cp = courseNow();
    Academy.dialog(`
      <div class="cg-k">${ICON.check} Session complete</div>
      <h2 class="cg-t" id="cgT">You finished <em>${esc(S.title)}.</em></h2>
      <p class="cg-p">All ${CH.length} chapters, ${dur(D)} of live class.${cp.sessions ? ` ${cp.sessionsDone} of ${cp.sessions} sessions done, and the course is ${cp.pct}% complete.` : ""}</p>
      <div class="cg-more">
        ${nx ? nextCard(nx) : ""}
        <div class="cg-b">
          ${nx ? `<a class="btn btn-coral" href="${sessHref(nx)}">Next session ${icon.arrow}</a>` : ""}
          <a class="btn ${nx ? "btn-ghost-dark" : "btn-coral"}" href="/library">Back to the library</a>
        </div>
      </div>`, { burst: true });
  }
  const overall = () => CH.reduce((a, c) => a + fracOf(c) * (c.end_ms - c.start_ms), 0) / D;

  /* ================= overview ================= */
  const ov = $("#ov");
  function ctaHTML() {
    const first = CH[0] ? CH[0].start_ms : 0;
    if (sessPct() === 100) {
      const nx = nextSession();
      return `${nx ? `<a class="btn btn-coral" href="${sessHref(nx)}">Next session: ${esc(nx.title)} ${icon.arrow}</a>` : ""}
        <a class="btn ${nx ? "btn-ghost" : "btn-coral"}" href="/library">Back to the library</a>
        <button class="btn btn-ghost" type="button" data-start="${first}">${icon.play} Watch again</button>`;
    }
    const resume = progress.t > 5000 && progress.t < D - 5000 ? progress.t : 0;
    return `${resume
        ? `<button class="btn btn-coral" type="button" data-start="${resume}">${icon.play} Resume at ${fmt(resume)}</button>
           <button class="btn btn-ghost" type="button" data-start="${first}">Start from the beginning</button>`
        : `<button class="btn btn-coral" type="button" data-start="${first}">${icon.play} Get started</button>`}
      <button class="btn btn-ghost ask-m" type="button" data-ask>Ask this session</button>`;
  }
  const renderOverview = () => {
    const resume = progress.t > 5000 && progress.t < D - 5000 ? progress.t : 0;
    const rch = resume ? chapterAt(resume) : null;
    const pct = Math.round(overall() * 100);
    const firstOpen = rch ? rch.n : 1;
    ov.innerHTML = `
    <div class="ov-in">
      <div class="ov-hero">
        <div>
          <div class="ov-kick"><b>${esc(S.kicker)}</b><span>${esc(date(S.date))}</span><span>${dur(D)}</span><span>${CH.length} chapters</span><span class="done-tag" id="ovDoneTag"${sessPct() === 100 ? "" : " hidden"}>✓ Completed</span></div>
          <h1 class="balance">${esc(S.title)}</h1>
          ${S.tagline ? `<p class="ov-tag pretty">${esc(S.tagline)}</p>` : ""}
          <div class="ov-who">${faces(S.lead)}<span>Taught live by ${esc((S.lead || []).join(" & "))}</span></div>
          <div class="ov-cta" id="ovCta">${ctaHTML()}</div>
        </div>
        <button class="ov-cover" type="button" data-start="${resume || (CH[0] ? CH[0].start_ms : 0)}" aria-label="${resume ? "Resume" : "Start"} ${esc(S.title)}">
          ${S.cover ? `<img src="${esc(S.cover)}" alt="">` : ""}<span class="pl">${icon.play}</span><span class="len">${fmt(D)}</span>
        </button>
      </div>

      <div class="ov-stats">
        <div class="ov-stat"><b>${dur(D)}</b><span>Of live class</span></div>
        <div class="ov-stat"><b>${CH.length}</b><span>Chapters</span></div>
        <div class="ov-stat"><b>${CUES.length.toLocaleString()}</b><span>Searchable lines</span></div>
        <div class="ov-stat"><b id="ovDone">${sessPct()}%</b><span id="ovDoneSub">${doneCount()} of ${CH.length} chapters done</span><div class="bar"><i id="ovDoneBar" style="width:${sessPct()}%"></i></div></div>
      </div>

      ${S.summary ? `<div class="ov-about">
        <h2 class="ov-h">What this session covers</h2>
        <div><p class="pretty">${esc(S.summary)}</p>
          ${(S.topics || []).length ? `<div class="topics">${S.topics.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}</div>
      </div>` : ""}

      <div class="ov-chapters">
        <div class="ov-ch-head"><h2>Chapters<small>${CH.length} · ${dur(D)}</small></h2><button class="linkbtn" type="button" id="expandAll">Expand all</button></div>
        <ol class="acc">
          ${CH.map(c => {
            const f = fracOf(c), dn = isDone(c), st = dn ? " done" : f > 0.02 ? " part" : "";
            return `<li class="acc-item${st}${c.n === firstOpen ? " open" : ""}" data-n="${c.n}">
              <button class="acc-head" type="button" aria-expanded="${c.n === firstOpen}" aria-controls="acc-${c.n}">
                <span class="acc-n">${dn ? ICON.check : c.n}</span>
                <span style="min-width:0"><span class="acc-t">${esc(c.title)}</span><span class="acc-m">Starts at ${fmt(c.start_ms)}${dn ? " · done" : f > 0.02 ? ` · ${Math.round(f * 100)}% watched` : ""}</span></span>
                <span class="acc-r">${dur(c.end_ms - c.start_ms)}</span>
                <span class="acc-chev">${ICON.chev}</span>
              </button>
              <div class="acc-body" id="acc-${c.n}"><div><div class="acc-pad">
                <button class="th" type="button" data-start="${c.start_ms}" aria-label="Play chapter ${c.n}">${c.thumb ? `<img src="${esc(c.thumb)}" alt="" loading="lazy">` : ""}<span class="fill" style="width:${Math.round(f * 100)}%"></span></button>
                <div>
                  <p>${esc(c.summary || "")}</p>
                  <div class="acc-meta">${c.speaker ? `Led by ${esc(c.speaker)} · ` : ""}${fmt(c.start_ms)} to ${fmt(c.end_ms)}</div>
                  <div class="acc-acts">
                    <button class="btn btn-ink btn-sm acc-go" type="button" data-start="${c.start_ms}">${icon.play} ${dn ? "Watch again" : f > 0.02 ? "Continue chapter" : "Start chapter"}</button>
                    <label class="done-box"><input type="checkbox" data-done="${c.n}"${dn ? " checked" : ""}><span>Mark as done</span></label>
                  </div>
                </div>
              </div></div></div>
            </li>`;
          }).join("")}
        </ol>
      </div>
      <div class="more-bar">${Academy.moreBar()}</div>
    </div>`;
  };
  ov.addEventListener("click", e => {
    if (e.target.closest(".done-box")) return;
    const st = e.target.closest("[data-start]");
    if (st) { startAt(+st.dataset.start); return; }
    if (e.target.closest("[data-ask]")) { setView("watch", { push: true }); selectTab("ask"); $("#q").focus(); return; }
    if (e.target.closest("#expandAll")) {
      const items = $$(".acc-item", ov), open = !items.every(i => i.classList.contains("open"));
      items.forEach(i => { i.classList.toggle("open", open); i.querySelector(".acc-head").setAttribute("aria-expanded", String(open)); });
      e.target.textContent = open ? "Collapse all" : "Expand all";
      return;
    }
    const head = e.target.closest(".acc-head");
    if (head) {
      const item = head.parentElement, open = !item.classList.contains("open");
      item.classList.toggle("open", open); head.setAttribute("aria-expanded", String(open));
    }
  });

  /* ================= views ================= */
  let view = null;
  const wantsWatch = () => { const p = new URLSearchParams(location.search); return p.has("watch") || +p.get("t") > 0; };
  function setView(v, { push = false } = {}) {
    if (v === view) return;
    const prev = view;
    view = v;
    body.classList.toggle("view-ov", v === "ov");
    body.classList.toggle("view-watch", v === "watch");
    if (v === "ov") { if (prev === "watch") { P.pause(); save(); } hideEnd(); renderOverview(); ov.scrollTop = 0; scrollTo(0, 0); }
    else { lastCh = null; paint(); requestAnimationFrame(fitPlayer); }
    if (push) history.pushState({ v }, "", v === "watch" ? `${location.pathname}?watch` : location.pathname);
  }
  addEventListener("popstate", () => setView(wantsWatch() ? "watch" : "ov"));

  /* ---------- the player fills the column ----------
     Desktop only. As wide as the centre column allows, capped only so the
     chapter's label and name stay in view underneath; the buttons, who leads
     it and the summary follow straight after (a short scroll on a laptop).
     Re-runs when the column changes size: window resize, the chapter list
     opening or closing. The name can wrap, so it settles in a pass or two. */
  const centerEl = $(".center"), centerIn = $(".center-in");
  function fitPlayer() {
    if (innerWidth < 1180 || view !== "watch") { centerIn.style.width = ""; return; }
    const cs = getComputedStyle(centerEl);
    const availW = centerEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const availH = centerEl.clientHeight - parseFloat(cs.paddingTop) - 12;
    let w = availW;
    for (let i = 0; i < 4; i++) {
      centerIn.style.width = Math.round(w) + "px";
      const bar = $("#chbar").getBoundingClientRect(), name = $("#cbT").getBoundingClientRect();
      const keep = $(".controls").offsetHeight + 14 + (name.bottom - bar.top) + 8;
      const fit = Math.max(Math.min(560, availW), Math.min(availW, (availH - keep) * 16 / 9));
      if (Math.abs(fit - w) < 2) break;
      w = fit;
    }
    centerIn.style.width = Math.round(w) + "px";
  }
  let fitRaf = 0;
  new ResizeObserver(() => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fitPlayer); }).observe(centerEl);
  $("#crumbSession").addEventListener("click", e => { e.preventDefault(); if (view === "watch") setView("ov", { push: true }); });
  const startAt = ms => {
    setView("watch", { push: true });
    const c = chapterAt(ms);
    seek(ms, { play: true, label: c && c.start_ms === ms ? `Chapter ${c.n}` : "" });
  };

  /* ---------- the chapter rail: opens and closes ---------- */
  let railOpen = store.get("rail", innerWidth >= 1600);
  const setRail = open => {
    railOpen = open; store.set("rail", open);
    body.classList.toggle("rail-closed", !open);
    $("#railToggle").setAttribute("aria-pressed", String(open));
    $("#railToggle").title = open ? "Hide the chapter list" : "Show the chapter list";
  };
  $("#railIcon").outerHTML = ICON.list;
  $("#railClose").innerHTML = ICON.close;
  $("#railToggle").addEventListener("click", () => setRail(!railOpen));
  $("#railClose").addEventListener("click", () => setRail(false));
  setRail(railOpen);

  /* ---------- scrubber ---------- */
  const segs = $("#segs"), knob = $("#knob"), scrub = $("#scrub"), hoverCard = $("#hoverCard");
  segs.innerHTML = CH.map(c => `<i style="flex:${(c.end_ms - c.start_ms) / D}"><b></b></i>`).join("");
  const segEls = [...segs.children];
  scrub.setAttribute("aria-valuemax", String(Math.round(D / 1000)));
  const msFromX = x => { const r = segs.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)) * D; };
  const pctOf = ms => (ms / D) * 100;
  let dragging = false;
  scrub.addEventListener("pointermove", e => {
    const ms = msFromX(e.clientX), ch = chapterAt(ms), r = scrub.getBoundingClientRect();
    hoverCard.style.left = Math.max(95, Math.min(r.width - 95, e.clientX - r.left)) + "px";
    hoverCard.querySelector("img").src = frameAt(ms);
    hoverCard.querySelector(".t").innerHTML = `<b>${fmt(ms)}</b>${esc(ch ? ch.title : "")}`;
    segEls.forEach((s, i) => s.classList.toggle("hov", CH[i] === ch));
    if (dragging) setTime(ms, false);
  });
  scrub.addEventListener("pointerleave", () => segEls.forEach(s => s.classList.remove("hov")));
  scrub.addEventListener("pointerdown", e => {
    if (e.target.closest(".pin")) return;
    dragging = true; scrub.classList.add("drag"); scrub.setPointerCapture(e.pointerId); setTime(msFromX(e.clientX), false);
  });
  scrub.addEventListener("pointerup", e => { if (!dragging) return; dragging = false; scrub.classList.remove("drag"); setTime(msFromX(e.clientX), true); });
  scrub.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") { setTime(now() + 5000, true); e.preventDefault(); }
    if (e.key === "ArrowLeft") { setTime(now() - 5000, true); e.preventDefault(); }
  });

  /* ---------- chapters in the rail ---------- */
  $("#chapters").innerHTML = CH.map(c => `
    <li class="chap-li${isDone(c) ? " is-done" : ""}" data-n="${c.n}"><button type="button" class="mark" data-mark="${c.n}" aria-pressed="${isDone(c)}" aria-label="Mark chapter ${c.n} as done" title="Mark as done">${ICON.check}</button><button type="button" class="chap" data-n="${c.n}" title="${esc(c.summary)}" aria-label="Chapter ${c.n}: ${esc(c.title)}, at ${fmt(c.start_ms)}">
      <span class="th">${c.thumb ? `<img src="${esc(c.thumb)}" alt="" loading="lazy">` : ""}<span class="n">${c.n}</span><span class="fill" style="width:${Math.round(fracOf(c) * 100)}%"></span></span>
      <span style="min-width:0">
        <span class="t">${esc(c.title)}</span>
        <span class="m"><span>${fmt(c.start_ms)}</span><span>·</span><span>${dur(c.end_ms - c.start_ms)}</span><span class="live"><span class="pulse"></span>playing</span></span>
      </span>
    </button></li>`).join("");
  const chapEls = $$("#chapters .chap");
  const chList = $("#panel-ch");
  const keepInView = el => {            // the playing chapter stays in view in the rail
    if (!el || chList.scrollHeight <= chList.clientHeight + 1) return;
    const top = el.offsetTop, bottom = top + el.offsetHeight;
    if (top < chList.scrollTop + 8 || bottom > chList.scrollTop + chList.clientHeight - 8)
      chList.scrollTo({ top: Math.max(0, top - 60), behavior: REDUCED ? "auto" : "smooth" });
  };
  function setDone(n, on) {
    const before = doneBefore();
    progress.done[n] = !!on;
    progress.m = Date.now();
    store.set("progress:" + sid, progress);
    Academy.syncSoon();
    paintDone();
    announceDone(n, !!on, before);
  }
  function paintDone() {
    CH.forEach(c => {
      const dn = isDone(c);
      const li = $(`#chapters .chap-li[data-n="${c.n}"]`);
      if (li) { li.classList.toggle("is-done", dn); li.querySelector(".mark").setAttribute("aria-pressed", String(dn)); }
      const item = $(`.acc-item[data-n="${c.n}"]`, ov);
      if (item) {
        item.classList.toggle("done", dn);
        item.querySelector(".acc-n").innerHTML = dn ? ICON.check : c.n;
        const box = item.querySelector("[data-done]"); if (box) box.checked = dn;
      }
    });
    const n = doneCount(), sp = sessPct(), full = sp === 100, st = $("#ovDone", ov);
    if (st) {
      st.textContent = sp + "%"; st.classList.toggle("full", full);
      $("#ovDoneSub", ov).textContent = `${n} of ${CH.length} chapters done`;
      $("#ovDoneBar", ov).style.width = sp + "%";
      const tag = $("#ovDoneTag", ov); if (tag) tag.hidden = !full;
      const cta = $("#ovCta", ov);
      if (cta && cta.dataset.full !== String(full)) { cta.dataset.full = String(full); cta.innerHTML = ctaHTML(); }
    }
    const rp = $("#railProg");
    rp.classList.toggle("full", full);
    rp.innerHTML = `<div class="row"><span class="lbl">${full ? "Session complete" : "Your progress"}</span><span class="num">${sp}%</span></div>
      <div class="pbar${full ? " full" : ""}"><i style="width:${sp}%"></i></div>
      <div class="sub">${n} of ${CH.length} chapters done</div>`;
    $("#ciProg").innerHTML = `<span class="pbar${full ? " full" : ""}"><i style="width:${sp}%"></i></span><span><b>${sp}%</b> of this session done</span>`;
    const cur = lastCh || playingAt(now());
    if (cur) $("#doneToggle").checked = isDone(cur);
  }
  $("#chapters").addEventListener("click", e => {
    const m = e.target.closest("[data-mark]"); if (!m) return;
    e.stopPropagation();
    const c = CH[+m.dataset.mark - 1]; setDone(c.n, !isDone(c));
  });
  ov.addEventListener("change", e => {
    const box = e.target.closest("[data-done]"); if (box) setDone(+box.dataset.done, box.checked);
  });
  $("#doneToggle").addEventListener("change", e => {
    const c = lastCh || playingAt(now()); if (c) setDone(c.n, e.target.checked);
  });

  chapEls.forEach(el => el.addEventListener("click", () => {
    const c = CH[+el.dataset.n - 1]; seek(c.start_ms, { play: true, label: `Chapter ${c.n}` });
  }));

  /* ---------- the chapter bar under the video ---------- */
  $("#cbPrevIcon").outerHTML = ICON.left;
  const initials = n => n.split(/\s+/).map(w => w[0] || "").join("").slice(0, 2).toUpperCase();
  const paintBar = ch => {
    if (!ch) return;
    const nx = CH[ch.n];
    $("#cbK").textContent = `Chapter ${ch.n} of ${CH.length} · ${fmt(ch.start_ms)} to ${fmt(ch.end_ms)} · ${dur(ch.end_ms - ch.start_ms)}`;
    $("#cbT").textContent = ch.title;
    $("#cbS").textContent = ch.summary || "";
    const who = ch.speaker || (S.lead || [])[0] || "";
    $("#cbWho").innerHTML = who
      ? `${face(who) ? `<span class="faces"><img src="/${esc(face(who))}" alt=""></span>` : `<span class="ini" aria-hidden="true">${esc(initials(who))}</span>`}
         <span>Led by <b>${esc(who)}</b></span>`
      : "";
    const bar = $("#chbar"); bar.classList.remove("swap"); void bar.offsetWidth; bar.classList.add("swap");
    $("#cbPrev").disabled = ch.n === 1;
    $("#doneToggle").checked = isDone(ch);
    const next = $("#cbNext");
    next.classList.toggle("last", !nx);
    const ns = nx ? null : nextSession();
    $("#cbNextK").textContent = nx ? `Next chapter · ${fmt(nx.start_ms)}` : ns ? `Last chapter · next session` : "Last chapter";
    $("#cbNextT").textContent = nx ? `${nx.n}. ${nx.title} →` : ns ? `${ns.title} →` : "Back to the library →";
    next.setAttribute("aria-label", nx ? `Next chapter: ${nx.n}. ${nx.title}, at ${fmt(nx.start_ms)}` : ns ? `Next session: ${ns.title}` : "Back to the library");
  };
  const goChapter = n => { const c = CH[n - 1]; if (c) seek(c.start_ms, { play: true, label: `Chapter ${c.n}` }); };
  $("#cbPrev").addEventListener("click", () => {
    const ms = now(), ch = playingAt(ms);
    goChapter(ms - ch.start_ms > 4000 ? ch.n : Math.max(1, ch.n - 1));
  });
  $("#cbNext").addEventListener("click", () => {
    const n = (endedCh || playingAt(now())).n + 1;
    if (CH[n - 1]) { goChapter(n); return; }
    const ns = nextSession();
    location.href = ns ? sessHref(ns) : "/library";
  });

  /* ---------- stop at the end of a chapter, unless Autoplay is on ---------- */
  let autoplay = store.get("autoplay", false), stopAt = null, endedCh = null;
  const endcard = $("#endcard"), player = $("#player");
  const armStop = () => {
    const ch = playingAt(now());
    stopAt = !autoplay && ch && ch.n < CH.length ? ch.end_ms : null;
  };
  const showEnd = ch => {
    endedCh = ch;
    const nx = CH[ch.n];
    $("#ecK").innerHTML = `${ICON.check} Chapter ${ch.n} of ${CH.length} complete`;
    $("#ecT").textContent = nx ? `Up next: ${nx.title}` : "That's the whole session.";
    $("#ecSub").textContent = nx ? `Chapter ${nx.n} · ${dur(nx.end_ms - nx.start_ms)} · starts at ${fmt(nx.start_ms)}` : "";
    $("#ecNext").hidden = !nx;
    $("#ecAgain").hidden = !nx;
    $(".ec-auto").hidden = !nx;
    const ns = nx ? null : nextSession();
    $("#ecSession").hidden = !ns;
    $("#ecLib").hidden = !!nx;
    $("#ecLib").className = `btn btn-sm ${ns ? "btn-ghost-dark" : "btn-coral"}`;
    if (!nx) {
      $("#ecT").textContent = "That's the whole session.";
      $("#ecSub").textContent = ns ? `Up next: ${ns.kicker} · ${ns.title}` : "Every chapter, start to finish.";
      if (ns) $("#ecSession").href = sessHref(ns);
    }
    endcard.hidden = false; player.classList.add("ended");
  };
  const hideEnd = () => { endedCh = null; endcard.hidden = true; player.classList.remove("ended"); };
  const setAutoplay = on => {
    autoplay = on; store.set("autoplay", on);
    $("#autoToggle").checked = on; $("#ecAuto").checked = on;
    if (on && endedCh && CH[endedCh.n]) { goChapter(endedCh.n + 1); return; }
    if (!endedCh) armStop();
  };
  $("#autoToggle").addEventListener("change", e => setAutoplay(e.target.checked));
  $("#ecAuto").addEventListener("change", e => setAutoplay(e.target.checked));
  $("#ecNext").addEventListener("click", () => goChapter(endedCh.n + 1));
  $("#ecAgain").addEventListener("click", () => goChapter(endedCh.n));
  endcard.addEventListener("click", e => e.stopPropagation());
  $("#autoToggle").checked = autoplay; $("#ecAuto").checked = autoplay;

  /* ---------- transcript ---------- */
  const tx = $("#tx");
  let txRendered = false, lastCueEl = null;
  const renderTranscript = (filter = "") => {
    const f = filter.trim().toLowerCase();
    let html = "", hits = 0, chi = -1;
    const re = f ? new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi") : null;
    CUES.forEach((c, i) => {
      if (f && !c.text.toLowerCase().includes(f) && !(c.speaker || "").toLowerCase().includes(f)) return;
      const ch = chapterAt(c.start_ms), idx = CH.indexOf(ch);
      if (!f && idx !== chi) { chi = idx; html += `<div class="ch-rule">${ch.n} · ${esc(ch.title)}</div>`; }
      hits++;
      const text = re ? esc(c.text).replace(new RegExp(re.source.replace(/&/g, "&amp;"), "gi"), m => `<mark>${m}</mark>`) : esc(c.text);
      html += `<button type="button" class="cue" data-i="${i}"><span class="tt">${fmt(c.start_ms)}</span><span>${c.speaker ? `<span class="sp">${esc(c.speaker)}</span>` : ""}${text}</span></button>`;
    });
    tx.innerHTML = html || `<p style="padding:20px 10px;color:var(--muted)">Nothing in the transcript matches “${esc(filter)}”.</p>`;
    $("#txHits").textContent = f ? `${hits} match${hits === 1 ? "" : "es"}` : "";
    lastCueEl = null;
  };
  tx.addEventListener("click", e => { const b = e.target.closest(".cue"); if (b) seek(CUES[+b.dataset.i].start_ms, { play: true }); });
  let findT = null;
  $("#txFind").addEventListener("input", e => { clearTimeout(findT); findT = setTimeout(() => renderTranscript(e.target.value), 140); });
  const paintCue = ms => {
    if (!txRendered || $("#panel-tx").hidden) return;
    const el = tx.querySelector(`.cue[data-i="${cueIndex(ms)}"]`);
    if (el === lastCueEl) return;
    if (lastCueEl) lastCueEl.classList.remove("on");
    lastCueEl = el;
    if (el) { el.classList.add("on"); if ($("#txFollow").checked && !$("#txFind").value) tx.scrollTop = el.offsetTop - tx.clientHeight / 3; }
  };

  /* ---------- tabs ---------- */
  const tabs = { ch: $("#tab-ch"), tx: $("#tab-tx"), ask: $("#tab-ask") };
  function selectTab(k) {
    Object.entries(tabs).forEach(([key, t]) => t.setAttribute("aria-selected", String(key === k)));
    $("#panel-ch").hidden = k !== "ch";
    $("#panel-tx").hidden = k !== "tx";
    $("#ask").dataset.mobileHidden = String(k !== "ask");
    if (k === "tx" && !txRendered) { renderTranscript(); txRendered = true; }
    if (k === "tx") { lastCueEl = null; paintCue(now()); }
    if (k !== "ask" && !railOpen && innerWidth >= 1180) setRail(true);
  }
  Object.entries(tabs).forEach(([k, t]) => t.addEventListener("click", () => selectTab(k)));

  /* ---------- time ---------- */
  const now = () => (P.currentTime || 0) * 1000;
  let lastCh = null, lastSave = 0;
  function paint() {
    let ms = now();
    if (!P.paused && stopAt != null && ms >= stopAt) {
      // The chapter just finished. Hold on its last frame and offer the next.
      const ch = chapterAt(stopAt - 1);
      stopAt = null; P.pause();
      P.currentTime = Math.max(ch.start_ms, ch.end_ms - 2 * EPS) / 1000;
      const before = doneBefore(), newly = !isDone(ch);
      progress.ch[ch.n] = 1; if (!(ch.n in progress.done)) { progress.done[ch.n] = true; progress.m = Date.now(); } save(); Academy.syncSoon(); paintDone();
      if (newly) announceDone(ch.n, true, before);
      const fill = chapEls[ch.n - 1].querySelector(".fill"); if (fill) fill.style.width = "100%";
      showEnd(ch);
      ms = now();
    }
    $("#tNow").textContent = fmt(ms);
    knob.style.left = pctOf(ms) + "%";
    scrub.setAttribute("aria-valuenow", String(Math.round(ms / 1000)));
    scrub.setAttribute("aria-valuetext", fmt(ms));
    CH.forEach((c, i) => { segEls[i].firstChild.style.width = (Math.max(0, Math.min(1, (ms - c.start_ms) / (c.end_ms - c.start_ms))) * 100) + "%"; });
    const ch = playingAt(ms);
    if (ch !== lastCh) {
      lastCh = ch;
      chapEls.forEach(el => el.classList.toggle("on", ch && +el.dataset.n === ch.n));
      paintBar(ch);
      if (ch) keepInView(chapEls[ch.n - 1]);
    }
    paintStill(ms); paintCap(ms); paintCue(ms);
    if (!P.paused && ch) {
      const f = (ms - ch.start_ms) / (ch.end_ms - ch.start_ms);
      if (f > (progress.ch[ch.n] || 0)) {
        progress.ch[ch.n] = Math.min(1, f + 0.01);
        const fill = chapEls[ch.n - 1].querySelector(".fill"); if (fill) fill.style.width = Math.round(progress.ch[ch.n] * 100) + "%";
      }
      if (performance.now() - lastSave > 4000) save();
    }
  }
  function save() { lastSave = performance.now(); progress.t = now(); progress.at = Date.now(); store.set("progress:" + sid, progress); }
  function setTime(ms, commit) { P.currentTime = Math.max(0, Math.min(D, ms)) / 1000; hideEnd(); armStop(); paint(); if (commit) save(); }
  const flash = text => { const f = $("#flash"); f.textContent = text; f.classList.add("on"); clearTimeout(flash.t); flash.t = setTimeout(() => f.classList.remove("on"), 1600); };

  /** The one way anything moves the playhead: chapters, cues, citations, pins, ?t= */
  function seek(ms, { play = true, label = "" } = {}) {
    if (view !== "watch") setView("watch", { push: true });
    setTime(ms, true);
    flash(`${label ? label + " · " : "Jumped to "}${fmt(ms)}`);
    const r = player.getBoundingClientRect();
    if (r.top < 60 || r.bottom > innerHeight) player.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" });
    if (play) togglePlay(true);
  }

  /* ---------- transport ---------- */
  const syncPlay = () => {
    const playing = !P.paused;
    player.classList.toggle("playing", playing);
    $("#playBtn").innerHTML = playing ? icon.pause : icon.play;
    $("#playBtn").setAttribute("aria-label", playing ? "Pause" : "Play");
    $("#big").setAttribute("aria-label", playing ? "Pause" : "Play");
  };
  function togglePlay(force) {
    const want = force === undefined ? P.paused : force;
    if (want && endedCh) { if (CH[endedCh.n]) goChapter(endedCh.n + 1); return; }   // play after a chapter = the next one
    if (want) { armStop(); const p = P.play(); if (p && p.catch) p.catch(() => { }); } else P.pause();
  }
  ["play", "pause", "ended"].forEach(ev => P.addEventListener(ev, () => { syncPlay(); if (ev !== "play") save(); }));
  P.addEventListener("ended", () => {
    const ch = CH[CH.length - 1]; if (!ch) return;
    const before = doneBefore(), newly = !isDone(ch);
    progress.ch[ch.n] = 1; if (!(ch.n in progress.done)) { progress.done[ch.n] = true; progress.m = Date.now(); }
    save(); paintDone(); showEnd(ch);
    if (newly) announceDone(ch.n, true, before);
  });
  P.addEventListener("timeupdate", paint);
  P.addEventListener("seeked", paint);
  const loop = () => { if (!P.paused) paint(); requestAnimationFrame(loop); };   // a smooth knob while playing
  requestAnimationFrame(loop);

  $("#big").innerHTML = icon.play;
  $("#prevCh").innerHTML = ICON.prev; $("#nextCh").innerHTML = ICON.next;
  $("#ccBtn").innerHTML = ICON.cc; $("#fsBtn").innerHTML = ICON.fs;
  syncPlay(); setCaps(capsOn);
  $("#big").addEventListener("click", e => { e.stopPropagation(); togglePlay(); });
  $("#playBtn").addEventListener("click", () => togglePlay());
  screen.addEventListener("click", e => { if (!e.target.closest("button, .endcard")) togglePlay(); });
  $("#prevCh").addEventListener("click", () => $("#cbPrev").click());
  $("#nextCh").addEventListener("click", () => { const n = (endedCh || playingAt(now())).n + 1; if (CH[n - 1]) goChapter(n); });
  const RATES = [1, 1.25, 1.5, 2];
  $("#rateBtn").addEventListener("click", () => {
    const r = RATES[(RATES.indexOf(P.playbackRate) + 1) % RATES.length] || 1;
    P.playbackRate = r; $("#rateBtn").textContent = r + "×";
  });
  $("#ccBtn").addEventListener("click", () => setCaps(!capsOn));
  $("#fsBtn").addEventListener("click", () => { if (document.fullscreenElement) document.exitFullscreen(); else if (player.requestFullscreen) player.requestFullscreen(); });

  addEventListener("keydown", e => {
    if (e.target.closest("input, textarea, [contenteditable]")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "/") { e.preventDefault(); if (innerWidth < 900) { setView("watch", { push: true }); selectTab("ask"); } $("#q").focus(); return; }
    if (view !== "watch") return;
    if (k === " " || k === "k") { e.preventDefault(); togglePlay(); }
    else if (k === "j") setTime(now() - 10000, true);
    else if (k === "l") setTime(now() + 10000, true);
    else if (k === "arrowleft" && e.target === document.body) setTime(now() - 5000, true);
    else if (k === "arrowright" && e.target === document.body) setTime(now() + 5000, true);
    else if (k === "c") setCaps(!capsOn);
    else if (k === "n") $("#nextCh").click();
  });
  addEventListener("pagehide", () => { if (view === "watch") save(); });

  /* Land: ?t= is a deep link (library strip, resume card), else where you left off. */
  const qt = +new URLSearchParams(location.search).get("t");
  const land = () => { setTime(qt > 0 ? qt * 1000 : (progress.t || 0), false); if (qt > 0) flash(`Starts at ${fmt(qt * 1000)}`); };
  if (media) P.addEventListener("loadedmetadata", land, { once: true }); else land();
  setView(wantsWatch() ? "watch" : "ov");
  paintDone();

  /* ================= the bot ================= */
  const log = $("#log"), q = $("#q"), send = $("#send");
  const STAGES = [["guard", "Reading the question"], ["retrieve", "Searching the session"], ["citations", "Finding moments"], ["answer", "Writing"]];
  let busy = false, es = null, turns = 0;

  const empty = () => {
    log.innerHTML = `
      <div class="empty">
        <div class="eyebrow">${esc(label)}</div>
        <h3>Ask it <em>anything</em> from the class.</h3>
        <p>Every answer comes with the moments it is based on. Press one and the player jumps to that second.</p>
        ${S.questions.length ? `<div class="lbl">Try one of these</div>${S.questions.map(x => `<button type="button" class="qcard" data-q="${esc(x)}"><span class="ar">${icon.arrow}</span><span>${esc(x)}</span></button>`).join("")}` : ""}
      </div>`;
    $("#clear").hidden = true;
  };
  empty();
  log.addEventListener("click", e => {
    const qc = e.target.closest(".qcard"); if (qc) { ask(qc.dataset.q); return; }
    const chip = e.target.closest("[data-cite]");
    if (chip) {
      const turn = chip.closest(".turn"), c = (turn._cites || []).find(x => x.n === +chip.dataset.n);
      if (c) {
        turn.querySelectorAll("[data-cite]").forEach(x => x.classList.toggle("on", x.dataset.n === chip.dataset.n));
        markPins(turn._cites, c.n);
        seek(c.start_ms, { play: true, label: `Moment ${c.n}` });
      }
    }
  });
  $("#clear").addEventListener("click", () => { if (es) es.close(); busy = false; empty(); markPins([]); syncSend(); });

  const syncSend = () => { send.disabled = busy || !q.value.trim(); };
  q.addEventListener("input", () => { q.style.height = "auto"; q.style.height = Math.min(140, q.scrollHeight) + "px"; syncSend(); });
  q.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!send.disabled) $("#askForm").requestSubmit(); } });
  $("#askForm").addEventListener("submit", e => { e.preventDefault(); ask(q.value); });
  send.innerHTML = icon.send;

  const pins = $("#pins");
  function markPins(cites, on) {
    pins.innerHTML = (cites || []).map(c => `<button type="button" class="pin${c.n === on ? " on" : ""}" style="left:${pctOf(c.start_ms)}%" data-n="${c.n}" aria-label="Moment ${c.n} at ${fmt(c.start_ms)}"></button>`).join("");
    pins._cites = cites;
  }
  pins.addEventListener("click", e => {
    const p = e.target.closest(".pin"); if (!p) return;
    const c = (pins._cites || []).find(x => x.n === +p.dataset.n);
    if (c) { markPins(pins._cites, c.n); seek(c.start_ms, { play: true, label: `Moment ${c.n}` }); }
  });

  const pctCls = p => (p >= 75 ? "hi" : p >= 50 ? "mid" : "lo");
  const momentCard = c => `
    <button type="button" class="mo" data-cite data-n="${c.n}" aria-label="Play moment ${c.n}: ${esc(c.speaker)} at ${fmt(c.start_ms)}">
      <span class="im">${c.thumb ? `<img src="${esc(c.thumb)}" alt="" loading="lazy">` : ""}<span class="ts">${fmt(c.start_ms)}</span></span>
      <span style="min-width:0">
        <span class="who"><b style="color:var(--ink);font-weight:600">${esc(c.speaker || "Speaker")}</b>${c.onscreen ? `<span class="tag" style="padding:1px 6px;font-size:10px">on screen</span>` : ""}<span class="pct ${pctCls(c.match_pct)}">${c.match_pct}% match</span></span>
        <span class="say">“${esc(c.text)}”</span>
        ${c.chapter ? `<span class="chn">in ${esc(c.chapter)}</span>` : ""}
      </span>
    </button>`;

  function ask(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    if (innerWidth < 900) { setView("watch", { push: true }); selectTab("ask"); }
    busy = true; q.value = ""; q.style.height = "auto"; syncSend();
    if (!turns || log.querySelector(".empty")) log.innerHTML = "";
    turns++;
    $("#clear").hidden = false;
    const turn = document.createElement("div");
    turn.className = "turn";
    turn.innerHTML = `<div class="you">${esc(text)}</div>
      <div class="trace">${STAGES.map(([id, l]) => `<span data-s="${id}">${l}</span>`).join("")}</div>
      <div class="ans"><span class="muted">Listening back through the session…</span></div>
      <div class="moments" hidden></div>`;
    log.appendChild(turn);
    // Anchor the new turn at the top and hold still; chasing the stream slides
    // the text out from under whoever is reading it.
    log.scrollTop = turn.offsetTop - 12;
    const ans = turn.querySelector(".ans"), mom = turn.querySelector(".moments"), tr = turn.querySelector(".trace");
    const pill = (id, st) => { const el = tr.querySelector(`[data-s="${id}"]`); if (el) { el.classList.remove("run", "done"); el.classList.add(st === "running" ? "run" : "done"); } };
    let md = "", cites = [], raf = null;
    const t0 = performance.now();
    let detailOpen = false;
    const paintAns = () => {
      raf = null;
      ans.innerHTML = Academy.md(md, cites).replace(/class="ts-chip"/g, 'class="ts-chip" data-cite');
      // A live answer ends with a long "The detail" section. It folds away so
      // the headline, takeaways and who-said-what stay in view.
      const h = [...ans.querySelectorAll("h5.md-k")].find(el => /detail/i.test(el.textContent));
      if (h) {
        const box = document.createElement("details");
        box.className = "md-more"; box.open = detailOpen;
        box.innerHTML = `<summary>Read the detail</summary>`;
        h.before(box);
        let el = h.nextSibling; h.remove();
        while (el) { const nx = el.nextSibling; box.appendChild(el); el = nx; }
        box.addEventListener("toggle", () => { detailOpen = box.open; });
      }
    };
    const done = () => {
      busy = false; syncSend();
      if (es) { es.close(); es = null; }
      tr.querySelectorAll(".run").forEach(el => { el.classList.remove("run"); el.classList.add("done"); });
      if (cites.length) {
        tr.classList.add("folded");
        tr.insertAdjacentHTML("beforeend", `<span class="done keep">${cites.length} moment${cites.length === 1 ? "" : "s"} · ${((performance.now() - t0) / 1000).toFixed(1)}s</span>`);
      }
    };
    es = new EventSource(Academy.tok(`/api/ask_stream?q=${encodeURIComponent(text)}&session=${sid}`));
    es.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.stage === "delta") { md += m.text; if (!raf) raf = requestAnimationFrame(paintAns); return; }
      if (m.stage === "citations" && m.detail) {
        pill("citations", "done");
        cites = m.detail.citations || []; turn._cites = cites;
        mom.hidden = false;
        mom.innerHTML = `<div class="lbl">Moments</div>` + cites.map(momentCard).join("");
        markPins(cites);
        ans.innerHTML = `<span class="muted">Found ${cites.length} moment${cites.length === 1 ? "" : "s"}. Writing…</span>`;
        return;
      }
      if (m.stage === "notice") { tr.insertAdjacentHTML("afterend", `<p class="ans-note">${esc((m.detail && m.detail.message) || "")}</p>`); return; }
      if (m.stage === "blocked" || m.stage === "error") { if (!cites.length) tr.classList.add("folded"); ans.innerHTML = `<p class="err">${esc((m.detail && m.detail.message) || "Something went wrong.")}</p>`; return; }
      if (m.stage === "end") { if (raf) { cancelAnimationFrame(raf); paintAns(); } done(); return; }
      if (m.status) pill(m.stage, m.status);
    };
    es.onerror = () => {
      if (!busy) return;
      if (!md && !cites.length) ans.innerHTML = `<p class="err">The connection dropped. Ask again?</p>`;
      done();
    };
  }
})();
