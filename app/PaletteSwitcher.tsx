"use client";
/* TEMPORARY: lets stakeholders click between palette options. Delete with palettes.css once one is chosen. */
import { useEffect, useState } from "react";

const OPTIONS: { id: string; label: string; ink: string; accent: string }[] = [
  { id: "orig", label: "Current", ink: "#0f1013", accent: "#ff4b2b" },
  { id: "A", label: "A Navy + Peach", ink: "#2b3245", accent: "#f6a58f" },
  { id: "B", label: "B Slate + Rose", ink: "#2f3437", accent: "#e9a0a0" },
  { id: "C", label: "C Plum + Apricot", ink: "#33293f", accent: "#f4b48a" },
  { id: "D", label: "D Teal + Blush", ink: "#1f3a40", accent: "#f2a99b" },
  { id: "E", label: "E Indigo + Lavender", ink: "#2d2f4f", accent: "#b8aef0" },
  { id: "F", label: "F Forest + Butter", ink: "#23362f", accent: "#f1cf8a" },
  { id: "G", label: "G Slate + Mint", ink: "#2c3a4f", accent: "#a8dcc4" },
  { id: "H", label: "H Graphite + Sky", ink: "#30343b", accent: "#a9cdf2" },
  { id: "I", label: "I Wine + Pink", ink: "#3b2733", accent: "#f2b5c8" },
  { id: "J", label: "J Olive + Sage", ink: "#2e3b30", accent: "#c3d9a8" },
  { id: "K", label: "K Cocoa + Sand", ink: "#3b3029", accent: "#e8c9a0" },
  { id: "L", label: "L Midnight + Aqua", ink: "#1f2d4a", accent: "#9fe0e6" },
];

export default function PaletteSwitcher() {
  const [id, setId] = useState("A");
  useEffect(() => {
    let saved = "A";
    try {
      saved = localStorage.getItem("fde-palette") || "A";
    } catch {}
    setId(saved);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.palette = id;
    try {
      localStorage.setItem("fde-palette", id);
    } catch {}
  }, [id]);
  return (
    <div className="palette-switcher" role="group" aria-label="Colour palette preview">
      {OPTIONS.map((o) => (
        <button key={o.id} type="button" aria-pressed={id === o.id} onClick={() => setId(o.id)}>
          <i>
            <b style={{ background: o.ink }} />
            <b style={{ background: o.accent }} />
          </i>
          {o.label}
        </button>
      ))}
    </div>
  );
}
