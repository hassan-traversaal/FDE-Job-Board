"use client";

import { useDeferredValue, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { regions, roleFamilies } from "./roles";

type Region = (typeof regions)[number];
type Family = (typeof roleFamilies)[number];

type Filters = { region: Region; family: Family; query: string; onlyPay: boolean };
const defaults: Filters = { region: "All", family: "All roles", query: "", onlyPay: false };

function readFilters(p: Pick<URLSearchParams, "get">): Filters {
  const region = p.get("region");
  const family = p.get("family");
  return {
    region: region && (regions as readonly string[]).includes(region) ? region as Region : defaults.region,
    family: family && (roleFamilies as readonly string[]).includes(family) ? family as Family : defaults.family,
    query: p.get("q") ?? "",
    onlyPay: p.get("pay") === "1",
  };
}

// Lowercased card text, cached per element on first filter.
const hay = new WeakMap<HTMLElement, string>();

/**
 * Filters for the server-rendered job list. Cards carry data-* attributes; this
 * island only toggles `hidden`, so no job data ships as JavaScript. Filter
 * state mirrors to the URL (?q=&region=&family=&pay=1) for shareable views.
 */
export function JobFilters({ total }: { total: number }) {
  // The URL is the source of truth, including browser Back/Forward navigation.
  const params = useSearchParams();
  const { region, family, query, onlyPay } = readFilters(params);
  const countRef = useRef<HTMLElement>(null);
  const q = useDeferredValue(query);

  function change(patch: Partial<Filters>) {
    const next = { region, family, query, onlyPay, ...patch };
    const p = new URLSearchParams(window.location.search);
    for (const key of ["q", "region", "family", "pay"]) p.delete(key);
    if (next.query.trim()) p.set("q", next.query);
    if (next.region !== "All") p.set("region", next.region);
    if (next.family !== "All roles") p.set("family", next.family);
    if (next.onlyPay) p.set("pay", "1");
    const url = `${window.location.pathname}${p.size ? `?${p}` : ""}${window.location.hash}`;
    // Native history updates integrate with useSearchParams without refetching the list.
    // Pass external state so Next's patched history API copies its tree and updates the hooks.
    window.history.replaceState(null, "", url);
  }

  useEffect(() => {
    const needle = q.trim().toLowerCase();
    let count = 0;
    document.querySelectorAll<HTMLElement>("#jobs-list > .job").forEach((el) => {
      const d = el.dataset;
      // The card's own text (company, title, family, lane, skills, location) is the search index.
      if (!hay.has(el)) hay.set(el, (el.textContent ?? "").toLowerCase());
      const show =
        (region === "All" || d.region === region) &&
        (family === "All roles" || d.family === family) &&
        (!onlyPay || d.pay === "1") &&
        (!needle || hay.get(el)!.includes(needle));
      el.hidden = !show;
      if (show) count++;
    });
    if (countRef.current) countRef.current.textContent = count.toLocaleString("en-US");
    const empty = document.getElementById("jobs-empty");
    if (empty) empty.hidden = count > 0;
  }, [q, region, family, onlyPay]);

  const filtered = !!query.trim() || region !== "All" || family !== "All roles" || onlyPay;

  return (
    <>
      <div className="toolbar">
        <label className="search">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m13 13 4.5 4.5" />
          </svg>
          <input
            type="search"
            name="q"
            value={query}
            onChange={(e) => change({ query: e.target.value })}
            placeholder="Search a skill, company or lane…"
            aria-label="Search roles"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="seg" role="group" aria-label="Filter by region">
          {regions.map((r) => (
            <button key={r} type="button" className={region === r ? "active" : ""} aria-pressed={region === r} onClick={() => change({ region: r })}>
              {r}
            </button>
          ))}
        </div>
        <label className="paytoggle">
          <input type="checkbox" checked={onlyPay} onChange={(e) => change({ onlyPay: e.target.checked })} />
          <span aria-hidden="true" />
          Pay shown
        </label>
      </div>
      <div className="chips" role="group" aria-label="Filter by role family">
        {roleFamilies.map((item) => (
          <button key={item} type="button" className={family === item ? "active" : ""} aria-pressed={family === item} onClick={() => change({ family: item })}>
            {item}
          </button>
        ))}
      </div>
      <div className="filter-summary">
        <p className="count" role="status">
          Showing <b ref={countRef}>{total.toLocaleString("en-US")}</b> of {total.toLocaleString("en-US")} roles
        </p>
        {filtered && <button className="filter-reset" type="button" onClick={() => change(defaults)}>Clear filters</button>}
      </div>
    </>
  );
}
