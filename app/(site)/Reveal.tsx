"use client";

import { useEffect } from "react";

/**
 * Scroll reveals for [data-reveal] elements. Content is visible by default;
 * the hidden starting state only applies once this has run, and anything
 * already on screen is marked shown first so nothing flickers.
 */
export function Reveal() {
  useEffect(() => {
    const root = document.documentElement;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

    const fold = window.innerHeight * 0.92;
    els.forEach((el) => {
      if (el.getBoundingClientRect().top < fold) el.classList.add("is-in");
    });
    root.classList.add("reveal-on");

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    els.filter((el) => !el.classList.contains("is-in")).forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      root.classList.remove("reveal-on");
    };
  }, []);

  return null;
}
