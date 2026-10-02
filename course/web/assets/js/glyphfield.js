/* GlyphField: the welcome page's moving background.
 *
 * A grid of monospace glyphs, the way a terminal draws. A slow starburst (the
 * spinner Claude Code shows while it thinks, scaled up to fill a screen) is
 * rendered into the grid by brightness, rings ripple out of it, and every so
 * often a line of agent output types itself into an empty row and fades.
 *
 * Canvas 2D, ~6k cells, drawn at 30fps in 16 colour buckets so fillStyle
 * changes 16 times a frame, not 6,000. Reduced motion draws one still frame.
 *
 *   const f = new GlyphField(canvas, { center:[.72,.46], scale:.36 });
 *   f.setScene({ rays: 10, lines: [...] });   // morphs, does not jump
 *   f.bloom();                                 // the intro reveal
 */
(function () {
  const RAMP = " .·:;-=+*xX%#";          // dark -> bright
  const SPARK_RAMP = "·:;+=*×✳✻";
  const TAU = Math.PI * 2;
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  // Cheap value noise: enough grain to stop the field looking machined.
  function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }

  class GlyphField {
    constructor(canvas, opts = {}) {
      this.c = canvas;
      this.x = canvas.getContext("2d", { alpha: false });
      this.o = Object.assign({
        cell: 13, center: [0.7, 0.45], scale: 0.34, bg: "#14110E",
        ink: [243, 237, 227], coral: [239, 95, 43], coralHi: [255, 176, 138],
        rays: 12, spin: 0.045, ripple: true, streams: true, mouse: true, fps: 30,
      }, opts);
      this.rays = this.o.rays;
      this.lens = this._lens(this.rays, 1);
      this.lensTo = this.lens.slice();
      this.lines = opts.lines || [];
      this.streams = [];
      this.reveal = REDUCED ? 1 : 0;
      this.mouse = { x: -9999, y: -9999, a: 0 };
      this.t0 = performance.now();
      this.last = 0;
      this.running = false;
      this._onResize = () => this.resize();
      addEventListener("resize", this._onResize, { passive: true });
      if (this.o.mouse) {
        const host = opts.pointerTarget || canvas;
        host.addEventListener("pointermove", e => {
          const r = canvas.getBoundingClientRect();
          this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top; this.mouse.on = true;
        }, { passive: true });
        host.addEventListener("pointerleave", () => { this.mouse.on = false; }, { passive: true });
      }
      document.addEventListener("visibilitychange", () => { if (!document.hidden && this.running) this._kick(); });
      this.resize();
    }

    _lens(n, seed) {
      // Uneven ray lengths read as hand-drawn; equal ones read as a clip-art star.
      return Array.from({ length: n }, (_, i) => 0.62 + 0.38 * hash(i * 3.1 + seed, seed * 1.7));
    }

    /* The grid always has the same number of rays; a scene decides how many of
       them reach out (`rays`) and the rest stay short. Changing the count by
       adding or removing rays made the shape collapse and regrow on every
       switch, which read as a glitch rather than a morph. */
    setScene({ rays, lines, seed } = {}) {
      if (lines) this.lines = lines;
      const n = this.rays, k = clamp(rays || n, 3, n), step = n / k;
      const base = this._lens(n, seed == null ? Math.random() * 100 : seed);
      this.lensTo = base.map((v, i) => ((i % step) < 1 ? v : v * 0.4));
      this.streams.forEach(s => (s.fade = true));
    }

    bloom(ms = 1700) {
      if (REDUCED) { this.reveal = 1; this.draw(performance.now()); return; }
      this.reveal = 0; this.bloomStart = performance.now(); this.bloomMs = ms;
    }

    resize() {
      const dpr = Math.min(devicePixelRatio || 1, 1.75);
      const w = this.c.clientWidth, h = this.c.clientHeight;
      if (!w || !h) return;
      this.w = w; this.h = h; this.dpr = dpr;
      this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr);
      const small = w < 720;
      this.cw = small ? 11 : this.o.cell * 0.82;
      this.ch = small ? 17 : this.o.cell * 1.42;
      this.cols = Math.ceil(w / this.cw) + 1;
      this.rows = Math.ceil(h / this.ch) + 1;
      this.fontPx = small ? 11 : Math.round(this.o.cell * 0.98);
      this.x.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.x.font = `${this.fontPx}px "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace`;
      this.x.textBaseline = "middle";
      this.x.textAlign = "center";
      // Two palettes x 8 brightness buckets.
      const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
      this.styles = [];
      for (let i = 0; i < 8; i++) {
        const t = i / 7;
        this.styles.push(`rgba(${this.o.ink.join(",")},${(0.05 + 0.36 * t * t).toFixed(3)})`);
      }
      for (let i = 0; i < 8; i++) {
        const t = i / 7;
        const c = mix(this.o.coral, this.o.coralHi, t * t);
        this.styles.push(`rgba(${c.join(",")},${(0.38 + 0.62 * t).toFixed(3)})`);
      }
      if (!this.running || REDUCED) this.draw(performance.now());
    }

    start() {
      if (this.running) return;
      this.running = true;
      if (REDUCED) {
        this.reveal = 1; this.draw(performance.now());
        // the still frame is drawn again once the mono font has arrived
        if (document.fonts) document.fonts.ready.then(() => this.draw(performance.now()));
        return;
      }
      this._kick();
    }

    stop() { this.running = false; }

    _kick() {
      const loop = now => {
        if (!this.running || document.hidden) return;
        if (now - this.last >= 1000 / this.o.fps) { this.last = now; this.draw(now); }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    // ---- agent output that types itself into the field ----
    _spawnStream(t) {
      if (!this.lines.length || this.streams.length >= (this.w < 720 ? 1 : 3)) return;
      const text = this.lines[Math.floor(Math.random() * this.lines.length)];
      const maxCol = Math.max(4, this.cols - text.length - 2);
      for (let tries = 0; tries < 12; tries++) {
        const row = 2 + Math.floor(Math.random() * (this.rows - 4));
        const col = 2 + Math.floor(Math.random() * maxCol);
        const px = col * this.cw, py = row * this.ch;
        // Keep clear of the copy (bottom-left) and of rows already in use.
        if (this.o.keepOut && this.o.keepOut(px / this.w, py / this.h)) continue;
        const sx = this.o.center[0] * this.w, sy = this.o.center[1] * this.h, S = this._S || 300;
        const nearX = Math.max(px, Math.min(sx, px + text.length * this.cw));
        if (Math.hypot(nearX - sx, py - sy) < S * 0.98) continue;
        if (this.streams.some(s => Math.abs(s.row - row) < 2)) continue;
        this.streams.push({ text, row, col, born: t, typed: 0, hold: 2.8 + Math.random() * 2.4, fade: false, alpha: 1 });
        return;
      }
    }

    draw(now) {
      const x = this.x, o = this.o, t = (now - this.t0) / 1000;
      if (this.bloomStart != null) {
        const p = clamp((now - this.bloomStart) / this.bloomMs, 0, 1);
        this.reveal = easeOut(p);
        if (p >= 1) this.bloomStart = null;
      }
      // ease ray lengths toward the scene's target
      for (let i = 0; i < this.lens.length; i++) this.lens[i] += (this.lensTo[i] - this.lens[i]) * 0.045;

      x.fillStyle = o.bg; x.fillRect(0, 0, this.w, this.h);

      const cx = o.center[0] * this.w, cy = o.center[1] * this.h;
      const S = (this._S = Math.min(this.w, this.h * 1.25) * o.scale);
      const rot = t * o.spin * TAU;
      const n = this.rays;
      const breathe = 1 + 0.035 * Math.sin(t * 1.3);
      const maxR = Math.hypot(Math.max(cx, this.w - cx), Math.max(cy, this.h - cy));
      const revealR = this.reveal * (maxR + 80);
      const mx = this.mouse.x, my = this.mouse.y;
      this.mouse.a += ((this.mouse.on ? 1 : 0) - this.mouse.a) * 0.08;

      const buckets = Array.from({ length: 16 }, () => []);
      const cw = this.cw, chh = this.ch;
      const occupied = new Set();
      for (const s of this.streams) for (let k = 0; k < s.text.length; k++) occupied.add(s.row * 10000 + s.col + k);

      for (let r = 0; r < this.rows; r++) {
        const py = r * chh + chh / 2;
        for (let c = 0; c < this.cols; c++) {
          if (occupied.has(r * 10000 + c)) continue;
          const px = c * cw + cw / 2;
          const dx = px - cx, dy = (py - cy) * 1.06;
          const d = Math.hypot(dx, dy);
          if (d > revealR) continue;
          const edge = smooth(revealR, revealR - 140, d);   // soft bloom front
          let th = Math.atan2(dy, dx) - rot; th = ((th % TAU) + TAU) % TAU;
          const k = th / TAU * n;
          const i = Math.floor(k) % n, f = k - Math.floor(k);
          const prof = Math.pow(1 - Math.abs(f - 0.5) * 2, 2.5);     // tapered rays, round tips
          const len = this.lens[i] * S * breathe;
          const R = S * 0.13 + len * prof;
          const g = hash(c, r);
          let spark = smooth(R + 10, R - 18, d) * (0.55 + 0.45 * prof);
          if (d < S * 0.12) spark = 1;
          let b;
          if (spark > 0.08) {
            b = spark * (0.7 + 0.3 * Math.sin(t * 2.2 + g * 6.28));
            b *= edge;
            const bi = clamp(Math.floor(b * 7.99), 0, 7);
            const gi = clamp(Math.floor(b * (SPARK_RAMP.length - 0.01)), 0, SPARK_RAMP.length - 1);
            buckets[8 + bi].push(px, py, SPARK_RAMP[gi]);
            continue;
          }
          // the field: ripples leaving the spark, grain, and a lens under the pointer
          b = 0.07 + 0.17 * g;
          if (o.ripple) {
            const ring = Math.max(0, Math.sin(d * 0.019 - t * 1.5));
            b += 0.42 * ring * ring * Math.exp(-d / (S * 2.4));
          }
          b += 0.3 * Math.exp(-Math.abs(d - R) / 22) * prof;           // halo along each ray
          if (this.mouse.a > 0.01) {
            const md = Math.hypot(px - mx, py - my);
            b += 0.55 * this.mouse.a * Math.exp(-(md * md) / (2 * 110 * 110));
          }
          b *= edge;
          if (b < 0.23) continue;
          const bi = clamp(Math.floor(b * 7.99), 0, 7);
          const gi = clamp(Math.floor(b * (RAMP.length - 0.01)), 1, RAMP.length - 1);
          buckets[bi].push(px, py, RAMP[gi]);
        }
      }
      for (let bi = 0; bi < 16; bi++) {
        const arr = buckets[bi];
        if (!arr.length) continue;
        x.fillStyle = this.styles[bi];
        for (let j = 0; j < arr.length; j += 3) x.fillText(arr[j + 2], arr[j], arr[j + 1]);
      }

      // streams
      if (o.streams && this.reveal > 0.9) {
        if (Math.random() < 0.035) this._spawnStream(t);
        x.textAlign = "left";
        for (const s of this.streams) {
          const age = t - s.born;
          s.typed = Math.min(s.text.length, Math.floor(age * 38));
          if (s.typed >= s.text.length && age > s.text.length / 38 + s.hold) s.fade = true;
          if (s.fade) s.alpha -= 0.03;
          const y = s.row * chh + chh / 2;
          for (let k = 0; k < s.typed; k++) {
            const ch = s.text[k];
            if (ch === " ") continue;
            const lead = ch === "⏺" || ch === "✻" || ch === ">";
            const dim = ch === "⎿";
            x.fillStyle = lead ? `rgba(${o.coral.join(",")},${0.95 * s.alpha})`
              : dim ? `rgba(${o.ink.join(",")},${0.3 * s.alpha})`
                : `rgba(${o.ink.join(",")},${0.62 * s.alpha})`;
            x.fillText(ch, s.col * cw + k * cw, y);
          }
          if (s.typed < s.text.length && Math.floor(t * 3) % 2 === 0) {
            x.fillStyle = `rgba(${o.coral.join(",")},${0.9 * s.alpha})`;
            x.fillRect(s.col * cw + s.typed * cw - cw / 2 + 1, y - chh * 0.34, cw - 2, chh * 0.68);
          }
        }
        x.textAlign = "center";
        this.streams = this.streams.filter(s => s.alpha > 0);
      }
    }
  }

  window.GlyphField = GlyphField;
})();
