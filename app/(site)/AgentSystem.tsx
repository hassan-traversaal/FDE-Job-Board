"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { heroSystem as s } from "./content";

/**
 * Hero illustration: one agent wired into a company's systems. It runs on its own, firing a
 * system every couple of seconds (a packet travels in, the agent works, each production
 * control checks off, a run counter ticks), and responds to the visitor: click any system to
 * fire it, move the cursor and the card tilts toward it. The illustration is synthetic.
 * Its motion is ambient, not a control, so it has no pause button; the card's tilt is the
 * only part that depends on a pointer.
 */
export function AgentSystem() {
  const [active, setActive] = useState(0);
  const [tick, setTick] = useState(0); // changes on every run, so CSS animations restart
  const [runs, setRuns] = useState(1284);
  const fig = useRef<HTMLElement>(null);

  const fire = (i: number) => {
    setActive(i);
    setTick((t) => t + 1);
    setRuns((r) => r + 1);
  };

  useEffect(() => {
    const id = setInterval(() => {
      setActive((a) => (a + 1) % s.systems.length);
      setTick((t) => t + 1);
      setRuns((r) => r + 1);
    }, 2600);
    return () => clearInterval(id);
  }, []);

  // Tilt toward the cursor; ease back when it leaves.
  const onMove = (e: PointerEvent<HTMLElement>) => {
    const el = fig.current;
    if (!el || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${(x * 9).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${(-y * 7).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${(x * -22).toFixed(1)}px`);
    el.style.setProperty("--gy", `${(y * -22).toFixed(1)}px`);
  };
  const onLeave = () => {
    const el = fig.current;
    if (!el) return;
    for (const v of ["--ry", "--rx", "--gx", "--gy"]) el.style.removeProperty(v);
  };

  return (
    <figure
      ref={fig}
      className="sys"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      aria-label="Illustration: an AI agent connected to your company's systems, with evaluations, guardrails, monitoring and human review around it. Select a system to run the agent."
    >
      <div className="sys__disc" aria-hidden="true" />
      <div className="sys__ring" aria-hidden="true" />
      <div className="sys__card">
        <div className="sys__bar">
          <span className="mono">{s.name}</span>
          <span className="sys__runs mono" aria-hidden="true">
            <i /> {runs.toLocaleString("en-US")} runs traced
          </span>
        </div>

        <p className="sys__label mono" aria-hidden="true">
          Your systems
        </p>
        <ul className="sys__inputs">
          {s.systems.map((x, k) => (
            <li key={x.name} style={{ "--k": k } as CSSProperties}>
              <button type="button" className={k === active ? "is-on" : undefined} aria-pressed={k === active} onClick={() => fire(k)}>
                <svg className="sys__icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d={x.icon} />
                </svg>
                {x.name}
              </button>
            </li>
          ))}
        </ul>

        <span className="sys__link sys__link--in" aria-hidden="true">
          <i key={`in${tick}`} className="sys__packet" style={{ "--from": `${12.5 + active * 25}%` } as CSSProperties} />
        </span>
        <div className="sys__agent" aria-hidden="true">
          <span className="sys__mark">
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
            <span key={`ev${tick}`} className="sys__event">
              {s.events[active]}
            </span>
          </span>
          <span className="sys__live">
            <i />
            Live
          </span>
        </div>
        <span className="sys__link sys__link--out" aria-hidden="true">
          <i key={`out${tick}`} className="sys__packet sys__packet--out" />
        </span>

        <p className="sys__label mono" aria-hidden="true">
          Production controls
        </p>
        <ul className="sys__controls" aria-hidden="true">
          {s.controls.map((c, k) => (
            <li key={`${c.name}${tick}`} style={{ "--k": k } as CSSProperties}>
              <b>{c.name}</b>
              <span>{c.note}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="sys__chip sys__chip--a" aria-hidden="true">
        {s.chips[0]}
      </p>
      <p className="sys__chip sys__chip--b" aria-hidden="true">
        {s.chips[1]}
      </p>
    </figure>
  );
}
