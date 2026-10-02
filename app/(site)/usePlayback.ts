"use client";

import { useState, useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
function subscribe(notify: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}
const snapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => false;

/**
 * Play/pause state for auto-scrolling rows (WCAG 2.2.2). Rows start paused when the
 * device asks for reduced motion; pressing Play is an explicit choice and starts them.
 * `mode` is "auto" until the visitor presses the button, and the CSS only applies the
 * reduced-motion static layout in auto mode.
 */
export function usePlayback() {
  const reduced = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [override, setOverride] = useState<boolean | null>(null);
  const paused = override ?? reduced;
  return { paused, mode: override === null ? "auto" : "manual", toggle: () => setOverride(!paused) };
}
