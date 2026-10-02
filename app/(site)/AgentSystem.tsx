"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { heroSystem as s } from "./content";

type Mode = "build" | "teach";

const clock = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor(sec / 60) % 60;
  const ss = String(sec % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

/**
 * Hero illustration with two tabs that match the headline. "We build": an agent wired into a
 * company's systems, with its production controls. "We teach": a course session, where a
 * question jumps to the chapter that answers it. Both play on their own and switch every few
 * runs; click a tab, a system, a chapter or a question to drive it yourself (it then stays on
 * your tab for a while), and the card tilts toward the cursor. The content is synthetic or
 * public course data. The motion is ambient, not a control, so there is no pause button.
 */
export function AgentSystem() {
  const [mode, setMode] = useState<Mode>("build");
  const [sys, setSys] = useState(0); // active system
  const [q, setQ] = useState(0); // active question
  const [tick, setTick] = useState(0); // changes on every run, restarting the CSS animations
  const [runs, setRuns] = useState(1284);
  const [elapsed, setElapsed] = useState(0); // seconds played in the current chapter
  const hold_ = useRef(0); // after a click, stay on the visitor's tab for this many more ticks
  const steps = useRef(0);
  const modeRef = useRef<Mode>("build");
  const fig = useRef<HTMLElement>(null);

  const chapter = s.teach.chapters[s.teach.questions[q].chapter];

  useEffect(() => {
    const id = setInterval(() => {
      steps.current += 1;
      const flip = steps.current % 4 === 0 && hold_.current <= 0;
      hold_.current -= 1;
      const next: Mode = flip ? (modeRef.current === "build" ? "teach" : "build") : modeRef.current;
      setTick((t) => t + 1);
      setElapsed(0);
      setMode(next);
      if (next === "build") {
        setSys((x) => (x + 1) % s.systems.length);
        setRuns((r) => r + 1);
      } else {
        setQ((x) => (x + 1) % s.teach.questions.length);
      }
    }, 2800);
    const clockId = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      clearInterval(id);
      clearInterval(clockId);
    };
  }, []);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const hold = () => {
    hold_.current = 5;
    setTick((t) => t + 1);
    setElapsed(0);
  };
  const pickMode = (m: Mode) => {
    hold();
    setMode(m);
  };
  const pickSystem = (i: number) => {
    hold();
    setMode("build");
    setSys(i);
    setRuns((r) => r + 1);
  };
  const pickQuestion = (i: number) => {
    hold();
    setMode("teach");
    setQ(i);
  };
  const pickChapter = (c: number) => {
    const i = s.teach.questions.findIndex((x) => x.chapter === c);
    if (i >= 0) return pickQuestion(i);
    hold();
    setMode("teach");
  };

  // Tilt toward the cursor; ease back when it leaves.
  const onMove = (e: PointerEvent<HTMLElement>) => {
    const el = fig.current;
    if (!el || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${(x * 8).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${(x * -22).toFixed(1)}px`);
    el.style.setProperty("--mx", `${(e.clientX - r.left).toFixed(0)}px`);
    el.style.setProperty("--my", `${(e.clientY - r.top).toFixed(0)}px`);
    el.style.setProperty("--gy", `${(y * -22).toFixed(1)}px`);
  };
  const onLeave = () => {
    const el = fig.current;
    if (!el) return;
    for (const v of ["--ry", "--rx", "--gx", "--gy", "--mx", "--my"]) el.style.removeProperty(v);
  };

  return (
    <figure
      ref={fig}
      className="sys"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      aria-label="Illustration with two tabs. We build: an AI agent connected to a company's systems, with evaluations, guardrails, monitoring and human review. We teach: a course session where a question jumps to the chapter that answers it."
    >
      <div className="sys__disc" aria-hidden="true" />
      <div className="sys__ring" aria-hidden="true" />
      <div className="sys__card">
        <div className="sys__bar">
          <div className="sys__tabs" role="group" aria-label="Show">
            {(["build", "teach"] as const).map((m) => (
              <button key={m} type="button" className={m === mode ? "is-on" : undefined} aria-pressed={m === mode} onClick={() => pickMode(m)}>
                {s.tabs[m]}
              </button>
            ))}
          </div>
          <span className="console__tag console__tag--dark">Illustrative</span>
        </div>

        <div className="sys__panes">
          {/* We build */}
          <div className={`sys__pane${mode === "build" ? "" : " is-off"}`} aria-hidden={mode !== "build"}>
            <p className="sys__label mono">
              <span>Your systems</span>
              <span className="sys__runs">
                <i /> {runs.toLocaleString("en-US")} runs traced
              </span>
            </p>
            <ul className="sys__inputs">
              {s.systems.map((x, k) => (
                <li key={x.name}>
                  <button type="button" className={k === sys ? "is-on" : undefined} aria-pressed={k === sys} tabIndex={mode === "build" ? 0 : -1} onClick={() => pickSystem(k)}>
                    <svg className="sys__icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d={x.icon} />
                    </svg>
                    {x.name}
                  </button>
                </li>
              ))}
            </ul>

            <span className="sys__link sys__link--in" aria-hidden="true">
              <i key={`in${tick}`} className="sys__packet" style={{ "--from": `${25 + sys * 16.6}%` } as CSSProperties} />
            </span>
            <div className="sys__agent">
              <span className="sys__mark" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3" />
                  <circle cx="5" cy="5" r="2" />
                  <circle cx="19" cy="5" r="2" />
                  <circle cx="12" cy="20.5" r="2" />
                  <path d="M6.6 6.6 9.8 9.8M17.4 6.6l-3.2 3.2M12 15v3.5" />
                </svg>
              </span>
              <span className="sys__what">
                <b>{s.agent.name}</b>
                <span key={`ev${tick}`} className="sys__steps">
                  {s.events[sys].map((step, k) => (
                    <span key={step} style={{ "--k": k } as CSSProperties}>
                      {step}
                    </span>
                  ))}
                </span>
              </span>
              <span className="sys__live" aria-hidden="true">
                <i />
                Live
              </span>
            </div>
            <span className="sys__link sys__link--out" aria-hidden="true">
              <i key={`out${tick}`} className="sys__packet sys__packet--out" />
            </span>

            <p className="sys__label mono">Production controls</p>
            <ul className="sys__controls">
              {s.controls.map((c, k) => (
                <li key={`${c.name}${tick}`} style={{ "--k": k } as CSSProperties}>
                  <b>{c.name}</b>
                  <span>{c.note}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* We teach */}
          <div className={`sys__pane${mode === "teach" ? "" : " is-off"}`} aria-hidden={mode !== "teach"}>
            <p className="sys__label mono">
              <span>{s.teach.name}</span>
            </p>
            <div className="sys__class">
              <ul className="sys__chapters">
                {s.teach.chapters.map((c, k) => (
                  <li key={c.title}>
                    <button type="button" className={c.at === chapter.at ? "is-on" : undefined} aria-pressed={c.at === chapter.at} tabIndex={mode === "teach" ? 0 : -1} onClick={() => pickChapter(k)}>
                      <span className="sys__dot" aria-hidden="true" />
                      {c.title}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="sys__video" aria-hidden="true">
                <span className="sys__play" />
                <span className="sys__time mono">{clock(chapter.at + elapsed)}</span>
                <span className="sys__scrub">
                  <i key={`sc${tick}`} />
                </span>
              </div>
            </div>

            <p className="sys__label mono">Ask the course</p>
            <ul className="sys__asks">
              {s.teach.questions.map((x, k) => (
                <li key={x.q}>
                  <button type="button" className={k === q ? "is-on" : undefined} aria-pressed={k === q} tabIndex={mode === "teach" ? 0 : -1} onClick={() => pickQuestion(k)}>
                    {x.q}
                  </button>
                </li>
              ))}
            </ul>
            <p key={`hit${tick}`} className="sys__hit" aria-live="off">
              <span className="mono">Session 1 · {clock(chapter.at)}</span> Jumps to the moment in the recording
            </p>
          </div>
        </div>
      </div>
    </figure>
  );
}
