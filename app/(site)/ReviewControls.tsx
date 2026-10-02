"use client";

import { useId, useState, type ReactNode } from "react";
import { usePlayback } from "./usePlayback";

export function ReviewControls({ rows, list, count }: { rows: ReactNode; list: ReactNode; count: number }) {
  const { paused, mode, toggle } = usePlayback();
  const [open, setOpen] = useState(false);
  const listId = useId();

  return (
    <div className={`rwall${paused ? " is-paused" : ""}`} data-motion={mode}>
      {rows}
      <div className="rwall__controls wrap">
        <button type="button" className="btn btn--ink" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((o) => !o)}>
          <span>{open ? "Hide the full list" : `Read all ${count} reviews in full`}</span>
          <svg className={`arrow rwall__chev${open ? " is-open" : ""}`} viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
        <button type="button" className="pausebtn" aria-pressed={paused} onClick={toggle}>
          {paused ? "Play" : "Pause"} scrolling
        </button>
      </div>
      <div id={listId} hidden={!open}>
        {list}
      </div>
    </div>
  );
}
