"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const items = [
  { href: "/#learn", label: "Learn", match: "" },
  { href: "/teams", label: "Team training", match: "/teams" },
  { href: "/work-with-us", label: "Work with us", match: "/work-with-us" },
  { href: "/jobs", label: "Job board", match: "/jobs" },
];

function Links({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  return (
    <>
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={i.match && path.startsWith(i.match) ? "page" : undefined} onClick={onNavigate}>
          {i.label}
        </Link>
      ))}
    </>
  );
}

/** Desktop links plus a disclosure menu below 960px; marks the current page. */
export function NavLinks() {
  const path = usePathname() ?? "/";
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => menu.current?.removeAttribute("open");

  // Close the mobile menu on route change and on Escape.
  useEffect(close, [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !menu.current?.open) return;
      const focusInside = menu.current.contains(document.activeElement);
      close();
      if (focusInside) menu.current.querySelector("summary")?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <nav aria-label="Main" className="nav__links">
        <Links path={path} />
      </nav>
      <details className="mnav" ref={menu}>
        <summary aria-label="Menu">
          <span className="mnav__bars" aria-hidden="true" />
        </summary>
        <nav aria-label="Main, mobile" className="mnav__panel">
          <Links path={path} onNavigate={close} />
        </nav>
      </details>
    </>
  );
}
