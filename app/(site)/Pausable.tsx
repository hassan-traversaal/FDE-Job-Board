"use client";

import { type ReactNode } from "react";
import { usePlayback } from "./usePlayback";

/** Wraps auto-scrolling content with a visible pause toggle (WCAG 2.2.2). */
export function Pausable({ children, className, label }: { children: ReactNode; className: string; label: string }) {
  const { paused, mode, toggle } = usePlayback();
  return (
    <div className={`${className}${paused ? " is-paused" : ""}`} data-motion={mode}>
      {children}
      <div className="wrap pausable__bar">
        <button type="button" className="pausebtn" aria-pressed={paused} onClick={toggle}>
          {paused ? "Play" : "Pause"} {label}
        </button>
      </div>
    </div>
  );
}
