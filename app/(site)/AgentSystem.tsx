import { heroSystem as s } from "./content";

/**
 * Hero illustration: one agent wired into a company's systems, with the controls that
 * make it production grade. It animates in once on load and then stays still, so it
 * needs no pause control.
 */
export function AgentSystem() {
  return (
    <figure
      className="sys"
      aria-label="Illustration: an AI agent connected to your company's systems, with evaluations, guardrails, monitoring and human review around it"
    >
      <div className="sys__disc" aria-hidden="true" />
      <div className="sys__ring" aria-hidden="true" />
      <div className="sys__card" aria-hidden="true">
        <div className="sys__bar">
          <span className="mono">{s.name}</span>
          <span className="console__tag console__tag--dark">Illustrative</span>
        </div>

        <p className="sys__label mono">Your systems</p>
        <ul className="sys__inputs">
          {s.systems.map((x, k) => (
            <li key={x.name} style={{ "--k": k } as React.CSSProperties}>
              <svg className="sys__icon" viewBox="0 0 24 24">
                <path d={x.icon} />
              </svg>
              {x.name}
            </li>
          ))}
        </ul>

        <span className="sys__link sys__link--in" />
        <div className="sys__agent">
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
            <span>{s.agent.line}</span>
          </span>
          <span className="sys__live">
            <i />
            Live
          </span>
        </div>
        <span className="sys__link sys__link--out" />

        <p className="sys__label mono">Production controls</p>
        <ul className="sys__controls">
          {s.controls.map((c, k) => (
            <li key={c.name} style={{ "--k": k } as React.CSSProperties}>
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
