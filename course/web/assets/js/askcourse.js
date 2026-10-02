/* The course-wide bot, on the library page.
 *
 * One button (bottom right, always there) opens a side panel that asks across
 * every session, or one, from the scope chips. It speaks the same
 * /api/ask_stream contract as a session's own bot.
 *
 * A cited moment PLAYS IN THE PANEL: a small player slides in above the
 * conversation, starting at that second. Nothing navigates away, so the
 * question and its answer stay where they are. "Open in the session" is there
 * for whoever wants the full player, and the conversation is kept for this tab,
 * so coming back brings it back.
 *
 *   Academy.courseBot(sessions)        sessions as /api/sessions returns them
 *   /library?ask                       opens the panel straight away
 */
(function () {
  const { $, $$, esc, fmt, dur, icon, REDUCED } = Academy;
  const KEEP = "academy:course-chat";            // sessionStorage: this tab's conversation
  const STAGES = [["guard", "Reading the question"], ["retrieve", "Searching"], ["citations", "Finding moments"], ["answer", "Writing"]];

  Academy.courseBot = sessions => {
    const S = sessions || [];
    const byId = Object.fromEntries(S.map(s => [s.id, s]));
    const short = s => (s.bonus ? "Bonus" : `S${s.number}`);
    const total = S.reduce((a, s) => a + s.duration_ms, 0);
    const drawer = $("#cdrawer"), panel = $(".cd-panel", drawer), log = $("#cdLog"), q = $("#cdq"), send = $("#cdSend");
    const fab = $("#askFab");
    let scope = "all", busy = false, es = null, lastFocus = null;
    let turns = load();

    /* ---------- scope ---------- */
    $("#cdScope").innerHTML = [`<button type="button" class="sc-chip" data-scope="all" aria-pressed="true">All sessions</button>`,
      ...S.map(s => `<button type="button" class="sc-chip" data-scope="${s.id}" aria-pressed="false" title="${esc(s.title)}">${short(s)}</button>`)].join("");
    const setScope = id => {
      scope = byId[id] ? id : "all";
      $$("#cdScope .sc-chip").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.scope === scope)));
      $("#cdSub").textContent = scope === "all"
        ? `All ${S.length} sessions · ${dur(total)} of class`
        : `${byId[scope].kicker} · ${byId[scope].title}`;
      q.placeholder = scope === "all" ? "Ask anything across the course" : `Ask about ${byId[scope].title}`;
    };
    $("#cdScope").addEventListener("click", e => { const b = e.target.closest("[data-scope]"); if (b) { setScope(b.dataset.scope); q.focus(); } });
    setScope("all");

    /* ---------- open / close ----------
       The page behind keeps its scrollbar: locking body scroll removes it and
       shifts the whole layout sideways as the panel arrives. */
    const open = question => {
      if (drawer.hidden) {
        lastFocus = document.activeElement;
        drawer.hidden = false;
        void drawer.offsetWidth;                      // commit the closed state, so the slide runs
        drawer.classList.add("in");
        fab.classList.add("away");
        fab.setAttribute("aria-expanded", "true");
        render();
      }
      if (question) ask(question); else setTimeout(() => q.focus({ preventScroll: true }), REDUCED ? 0 : 200);
    };
    const close = () => {
      if (drawer.hidden) return;
      drawer.classList.remove("in");
      fab.classList.remove("away");
      fab.setAttribute("aria-expanded", "false");
      pauseClip();
      setTimeout(() => { if (!drawer.classList.contains("in")) drawer.hidden = true; }, REDUCED ? 0 : 360);
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    };
    fab.innerHTML = `<img class="fab-mark" src="/assets/img/traversaal-mark.png" alt="" aria-hidden="true"><span>Ask the course</span><span class="fab-sub">${S.length} sessions</span>`;
    fab.addEventListener("click", () => open());
    $(".cd-x", drawer).addEventListener("click", close);
    $(".cd-scrim", drawer).addEventListener("click", close);
    addEventListener("keydown", e => {
      if (drawer.hidden) {
        if (e.key === "/" && !e.target.closest("input, textarea")) { e.preventDefault(); open(); }
        return;
      }
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab") return;                   // keep focus inside the panel
      const f = $$("button, a[href], textarea, input, video", panel).filter(el => !el.disabled && el.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });

    /* ---------- the moment player, inside the panel ---------- */
    const player = $("#cdPlayer"), video = $("#cdVideo");
    video.addEventListener("contextmenu", e => e.preventDefault());     // no "Save video as…"
    let clipSid = null, playingKey = null;
    const hrefOf = c => { const s = byId[c.session]; return s ? `/session/${s.number}?t=${Math.floor(c.start_ms / 1000)}` : "#"; };
    function playClip(c) {
      const s = byId[c.session];
      if (!s) return;
      playingKey = `${c.session}:${c.start_ms}`;
      $$(".mo", log).forEach(el => el.classList.toggle("on", el.dataset.key === playingKey));
      $("#cdpK").innerHTML = `<b>${fmt(c.start_ms)}</b> · ${esc(where(c))} · ${esc(c.chapter || s.title)}`;
      $("#cdpK").title = `${s.title}${c.chapter ? " · " + c.chapter : ""}`;
      $("#cdpQ").innerHTML = c.onscreen
        ? `<span class="who">On screen</span> what the class was looking at, at this moment`
        : c.text ? `<span class="who">${esc(c.speaker || "")}</span> “${esc(c.text)}”` : "";
      $("#cdpOpen").href = hrefOf(c);
      const wasHidden = player.hidden;
      player.hidden = false;
      if (wasHidden) { void player.offsetWidth; player.classList.add("in"); }
      const at = c.start_ms / 1000;
      const go = () => { try { video.currentTime = at; } catch (e) { } const p = video.play(); if (p && p.catch) p.catch(() => { }); };
      if (!s.media) {                                // no recording: the matched frame instead
        video.removeAttribute("src"); video.load();
        video.poster = c.thumb || s.cover || "";
        clipSid = null;
        return;
      }
      video.poster = c.thumb || "";
      if (clipSid !== c.session) {
        clipSid = c.session;
        video.src = s.media.url;                     // /media/sN, a signed redirect to the recording
        video.addEventListener("loadedmetadata", go, { once: true });
      } else go();
    }
    function pauseClip() { if (!video.paused) video.pause(); }
    function closeClip() {
      pauseClip();
      player.classList.remove("in");
      setTimeout(() => { if (!player.classList.contains("in")) player.hidden = true; }, REDUCED ? 0 : 300);
      playingKey = null;
      $$(".mo.on", log).forEach(el => el.classList.remove("on"));
    }
    $("#cdpX").addEventListener("click", closeClip);
    $("#cdpOpen").addEventListener("click", () => {
      // Leaving on purpose: remember to reopen this conversation on the way back.
      try { sessionStorage.setItem(KEEP + ":open", "1"); } catch (e) { }
    });

    /* ---------- the conversation ---------- */
    function load() { try { return JSON.parse(sessionStorage.getItem(KEEP) || "[]"); } catch (e) { return []; } }
    function keep() { try { sessionStorage.setItem(KEEP, JSON.stringify(turns.slice(-12))); } catch (e) { } }

    const emptyHTML = () => `
      <div class="empty">
        <div class="eyebrow">The whole course</div>
        <h3>One question, <em>every session.</em></h3>
        <p>The bot has heard all ${S.length} sessions. It answers from the moments that cover your question, wherever they are, and each moment plays right here, from that exact second.</p>
        <div class="lbl">Try one of these</div>
        ${S.filter(s => (s.questions || []).length).map(s => `
          <button type="button" class="qcard" data-q="${esc(s.questions[0])}">
            <span class="ar">${icon.arrow}</span><span style="min-width:0"><span class="qs">${esc(short(s))} · ${esc(s.title)}</span>${esc(s.questions[0])}</span>
          </button>`).join("")}
      </div>`;

    const pctCls = p => (p >= 75 ? "hi" : p >= 50 ? "mid" : "lo");
    const momentCard = c => {
      const s = byId[c.session], key = `${c.session}:${c.start_ms}`;
      return `<button type="button" class="mo${key === playingKey ? " on" : ""}" data-key="${esc(key)}" data-n="${c.n}" aria-label="Play ${esc(s ? s.title : "the session")} at ${fmt(c.start_ms)}">
        <span class="im">${c.thumb ? `<img src="${esc(c.thumb)}" alt="" loading="lazy">` : ""}<span class="ts">${fmt(c.start_ms)}</span><span class="pl" aria-hidden="true">${icon.play}</span></span>
        <span style="min-width:0">
          <span class="who"><span class="sess-tag">${esc(where(c))}</span><b style="color:var(--ink);font-weight:600">${esc(c.speaker || "Speaker")}</b>${c.onscreen ? `<span class="tag" style="padding:1px 6px;font-size:10px">on screen</span>` : ""}<span class="pct ${pctCls(c.match_pct)}">${c.match_pct}%</span></span>
          <span class="say">“${esc(c.text)}”</span>
          <span class="chn">${esc(c.chapter || (s ? s.title : ""))}</span>
        </span>
      </button>`;
    };
    const answerHTML = (md, cites) => {
      const box = document.createElement("div");
      box.innerHTML = Academy.md(md, cites);
      const h = [...box.querySelectorAll("h5.md-k")].find(el => /detail/i.test(el.textContent));
      if (h) {
        const more = document.createElement("details"); more.className = "md-more";
        more.innerHTML = "<summary>Read the detail</summary>"; h.before(more);
        let el = h.nextSibling; h.remove();
        while (el) { const nx = el.nextSibling; more.appendChild(el); el = nx; }
      }
      return box.innerHTML;
    };
    /* Which chapter of its session a moment falls in. */
    const chapterOf = c => {
      const chs = (byId[c.session] || {}).chapters || [];
      let hit = chs[0] || null;
      for (const ch of chs) { if (ch.start_ms <= c.start_ms + 400) hit = ch; else break; }
      return hit;
    };
    const where = c => { const s = byId[c.session], ch = chapterOf(c); return `${s ? short(s) : ""}${ch ? ` · Ch ${ch.n}` : ""}`; };
    const spread = () => `<div class="lbl">Moments</div>`;
    const scopeTag = t => (t.scope !== "all" && byId[t.scope] ? `<span class="you-scope">${esc(short(byId[t.scope]))}</span>` : "");
    const turnHTML = t => `
      <div class="you">${esc(t.q)}${scopeTag(t)}</div>
      <div class="trace folded"><span class="done keep">${t.cites.length} moment${t.cites.length === 1 ? "" : "s"}${t.sessions ? ` · ${t.sessions} session${t.sessions === 1 ? "" : "s"}` : ""}</span></div>
      ${t.note ? `<p class="ans-note">${esc(t.note)}</p>` : ""}
      <div class="ans">${t.err ? `<p class="err">${esc(t.err)}</p>` : answerHTML(t.md, t.cites)}</div>
      ${t.cites.length ? `<div class="moments">${spread(t)}${t.cites.map(momentCard).join("")}</div>` : ""}`;

    /* [n] chips name their moment; the detail section remembers whether it was opened. */
    function wireTurn(el, t) {
      if (!el || !t) return;
      el.querySelectorAll(".ts-chip").forEach(ch => {
        const c = t.cites.find(x => x.n === +ch.dataset.n); if (!c) return;
        const s = byId[c.session];
        ch.title = `Play ${s ? short(s) + " · " : ""}${fmt(c.start_ms)}${c.speaker ? " · " + c.speaker : ""}`;
      });
      const d = el.querySelector("details.md-more");
      if (d) { d.open = !!t.open; d.addEventListener("toggle", () => { t.open = d.open; keep(); }); }
    }
    function render() {
      log.innerHTML = turns.length ? turns.map(t => `<div class="turn" data-t="${t.id}">${turnHTML(t)}</div>`).join("") : emptyHTML();
      $("#cdClear").hidden = !turns.length;
      $$(".turn", log).forEach(el => wireTurn(el, turns.find(x => String(x.id) === el.dataset.t)));
      log.scrollTop = log.scrollHeight;
    }
    const turnOf = el => { const t = el && el.closest(".turn"); return t && (turns.find(x => String(x.id) === t.dataset.t) || t._live); };
    log.addEventListener("click", e => {
      const qc = e.target.closest(".qcard"); if (qc) { ask(qc.dataset.q); return; }
      const hit = e.target.closest(".ts-chip, .mo"); if (!hit) return;
      const t = turnOf(hit); if (!t) return;
      const c = t.cites.find(x => x.n === +hit.dataset.n); if (!c) return;
      e.preventDefault();
      playClip(c);
    });
    $("#cdClear").addEventListener("click", () => { if (es) es.close(); busy = false; turns = []; keep(); closeClip(); render(); syncSend(); q.focus(); });

    const syncSend = () => { send.disabled = busy || !q.value.trim(); };
    q.addEventListener("input", () => { q.style.height = "auto"; q.style.height = Math.min(140, q.scrollHeight) + "px"; syncSend(); });
    q.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!send.disabled) $("#cdForm").requestSubmit(); } });
    $("#cdForm").addEventListener("submit", e => { e.preventDefault(); ask(q.value); });
    send.innerHTML = icon.send;

    function ask(text) {
      text = (text || "").trim();
      if (!text || busy) return;
      if (drawer.hidden) { open(text); return; }
      busy = true; q.value = ""; q.style.height = "auto"; syncSend();
      if (!turns.length) log.innerHTML = "";
      $("#cdClear").hidden = false;
      const t = { id: Date.now(), q: text, scope, md: "", cites: [], sessions: 0 };
      const el = document.createElement("div");
      el.className = "turn"; el.dataset.t = t.id; el._live = t;
      const where = scope === "all" ? "Searching every session" : `Searching ${short(byId[scope])}`;
      el.innerHTML = `<div class="you">${esc(text)}${scopeTag(t)}</div>
        <div class="trace">${STAGES.map(([id, l]) => `<span data-s="${id}">${id === "retrieve" ? where : l}</span>`).join("")}</div>
        <div class="ans"><span class="muted">Listening back through ${scope === "all" ? "the course" : "the session"}…</span></div>
        <div class="moments" hidden></div>`;
      log.appendChild(el);
      log.scrollTop = el.offsetTop - 12;                // anchor the turn, then hold still
      const ans = $(".ans", el), mom = $(".moments", el), tr = $(".trace", el);
      const pill = (id, st) => { const p = tr.querySelector(`[data-s="${id}"]`); if (p) { p.classList.remove("run", "done"); p.classList.add(st === "running" ? "run" : "done"); } };
      let raf = null; const t0 = performance.now();
      const paint = () => { raf = null; ans.innerHTML = answerHTML(t.md, t.cites); wireTurn(el, t); };
      const finish = () => {
        busy = false; syncSend();
        if (es) { es.close(); es = null; }
        if (raf) { cancelAnimationFrame(raf); paint(); }
        tr.classList.add("folded");
        tr.querySelectorAll(".run").forEach(p => { p.classList.remove("run"); p.classList.add("done"); });
        if (t.cites.length) tr.insertAdjacentHTML("beforeend", `<span class="done keep">${t.cites.length} moment${t.cites.length === 1 ? "" : "s"} · ${t.sessions} session${t.sessions === 1 ? "" : "s"} · ${((performance.now() - t0) / 1000).toFixed(1)}s</span>`);
        if (t.md || t.err) { turns.push(t); keep(); }
      };
      es = new EventSource(Academy.tok(`/api/ask_stream?q=${encodeURIComponent(text)}&session=${encodeURIComponent(scope)}`));
      es.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch (er) { return; }
        if (m.stage === "delta") { t.md += m.text; if (!raf) raf = requestAnimationFrame(paint); return; }
        if (m.stage === "citations" && m.detail) {
          pill("citations", "done");
          t.cites = m.detail.citations || [];
          t.sessions = new Set(t.cites.map(c => c.session)).size;
          mom.hidden = false;
          mom.innerHTML = spread(t) + t.cites.map(momentCard).join("");
          ans.innerHTML = `<span class="muted">Found ${t.cites.length} moments. Writing…</span>`;
          return;
        }
        if (m.stage === "notice") { t.note = (m.detail || {}).message || ""; tr.insertAdjacentHTML("afterend", `<p class="ans-note">${esc(t.note)}</p>`); return; }
        if (m.stage === "blocked" || m.stage === "error") { t.err = (m.detail && m.detail.message) || "Something went wrong."; ans.innerHTML = `<p class="err">${esc(t.err)}</p>`; return; }
        if (m.stage === "end") { finish(); return; }
        if (m.status) pill(m.stage, m.status);
      };
      es.onerror = () => { if (!busy) return; if (!t.md && !t.cites.length) { t.err = "The connection dropped. Ask again?"; ans.innerHTML = `<p class="err">${esc(t.err)}</p>`; } finish(); };
    }

    /* Arriving with ?ask, or back from "Open in the session": the panel opens. */
    const params = new URLSearchParams(location.search);
    let reopen = false; try { reopen = sessionStorage.getItem(KEEP + ":open") === "1"; sessionStorage.removeItem(KEEP + ":open"); } catch (e) { }
    if (params.has("ask") || reopen) {
      if (params.has("ask")) history.replaceState(null, "", location.pathname);
      open(params.get("ask") || null);
    }
  };
})();
