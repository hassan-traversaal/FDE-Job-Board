"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { forms, links } from "./content";

type Kind = "program" | "engagement";
type Status = "idle" | "sending" | "sent" | "failed";
type Field = "name" | "email" | "company" | "note";
type Errors = Partial<Record<Field, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(kind: Kind, data: FormData): Errors {
  const v = (k: string) => String(data.get(k) ?? "").trim();
  const errors: Errors = {};
  if (!v("name")) errors.name = "Add your name so we know who to reply to.";
  if (!v("email")) errors.email = "Add your work email.";
  else if (!EMAIL.test(v("email"))) errors.email = "That email looks incomplete. Check the @ and the domain.";
  if (!v("company")) errors.company = "Add your company.";
  if (kind === "engagement" && !v("note")) errors.note = "One or two lines is plenty.";
  return errors;
}

function Choices({ name, legend, options }: { name: string; legend: string; options: readonly string[] }) {
  return (
    <fieldset className="choices">
      <legend>
        {legend} <span className="optional">Optional</span>
      </legend>
      <div className="choices__row">
        {options.map((o) => (
          <label key={o} className="choice">
            <input type="radio" name={name} value={o} />
            <span>{o}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function LeadForm({ kind }: { kind: Kind }) {
  const copy = forms[kind];
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState("");
  const id = useId();
  const doneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "sent") doneRef.current?.focus();
  }, [status]);

  // Clear a field's error as soon as the visitor edits it.
  function onInput(e: FormEvent<HTMLFormElement>) {
    const name = (e.target as HTMLInputElement).name as Field;
    if (!errors[name]) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const found = validate(kind, data);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...Object.fromEntries(data), kind }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.ok !== true || result.delivered === false) throw new Error("not delivered");
      const firstName = String(data.get("name")).trim().split(/\s+/)[0];
      setDone(copy.done(firstName, String(data.get("email")).trim()));
      setStatus("sent");
    } catch {
      setStatus("failed");
    }
  }

  if (status === "sent") {
    return (
      <div className="form-done" role="status" tabIndex={-1} ref={doneRef}>
        <span className="form-done__tick" aria-hidden="true" />
        <p className="form-done__title">Request received.</p>
        <p>{done}</p>
      </div>
    );
  }

  const field = (k: Field) => ({
    id: `${id}-${k}`,
    name: k,
    "aria-invalid": !!errors[k],
    "aria-describedby": errors[k] ? `${id}-${k}-error` : undefined,
  });
  const err = (k: Field) =>
    errors[k] ? (
      <span className="field__error" id={`${id}-${k}-error`}>
        {errors[k]}
      </span>
    ) : null;

  const fallback =
    kind === "program" ? (
      <>
        Email <a href={`mailto:${links.academyEmail}`}>{links.academyEmail}</a> and we&apos;ll plan it from there.
      </>
    ) : (
      <>
        Use the <a href={links.traversaalContact}>contact page on traversaal.ai</a> instead.
      </>
    );

  return (
    <form className="lead" onSubmit={onSubmit} onInput={onInput} noValidate aria-busy={status === "sending"} aria-describedby={`${id}-privacy`}>
      <div className="lead__grid">
        <div className="field">
          <label htmlFor={`${id}-name`}>Name</label>
          <input {...field("name")} autoComplete="name" maxLength={120} required />
          {err("name")}
        </div>
        <div className="field">
          <label htmlFor={`${id}-email`}>Work email</label>
          <input {...field("email")} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={200} required />
          {err("email")}
        </div>
        <div className="field field--wide">
          <label htmlFor={`${id}-company`}>Company</label>
          <input {...field("company")} autoComplete="organization" maxLength={160} required />
          {err("company")}
        </div>
      </div>

      {kind === "program" ? (
        <>
          <Choices name="size" legend={forms.program.sizeLabel} options={forms.program.sizes} />
          <Choices name="when" legend={forms.program.whenLabel} options={forms.program.whens} />
        </>
      ) : (
        <Choices name="stage" legend={forms.engagement.stageLabel} options={forms.engagement.stages} />
      )}

      <div className="field">
        <label htmlFor={`${id}-note`}>
          {copy.noteLabel} {kind === "program" && <span className="optional">Optional</span>}
        </label>
        <textarea {...field("note")} rows={3} placeholder={copy.notePlaceholder} maxLength={2000} required={kind === "engagement"} />
        {err("note")}
      </div>

      {/* Honeypot: hidden from people, filled by bots. */}
      <div className="hp" aria-hidden="true">
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <button className="btn btn--coral lead__submit" type="submit" disabled={status === "sending"}>
        <span>{status === "sending" ? "Sending…" : copy.submit}</span>
        <svg className="arrow" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
        </svg>
      </button>
      {status === "failed" && (
        <p className="field__error lead__failed" role="alert">
          Your request didn&apos;t go through. {fallback}
        </p>
      )}
      <p className="lead__privacy" id={`${id}-privacy`}>
        We only use these details to reply to you. <a href={links.privacy}>Privacy policy</a>
      </p>
      <noscript><p className="field__error">Enable JavaScript to send this form. {fallback}</p></noscript>
    </form>
  );
}
