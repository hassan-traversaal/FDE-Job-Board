import { NextResponse } from "next/server";

/**
 * Receives "Plan a program" (/teams) and "Talk to our engineers" (/work-with-us)
 * requests.
 *
 * Set LEAD_WEBHOOK_URL (Slack, Zapier, a CRM inbound hook) to forward each
 * request as JSON. Without it, answer 503 in every environment so the form
 * never claims an undelivered request was received.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v: unknown, n = 200) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  // Honeypot filled: answer as if accepted so bots learn nothing.
  if (clip(body.website)) return NextResponse.json({ ok: true });

  const kind = body.kind === "engagement" ? "engagement" : "program";
  const lead = {
    kind,
    name: clip(body.name, 120),
    email: clip(body.email),
    company: clip(body.company, 160),
    size: clip(body.size, 40),
    when: clip(body.when, 40),
    stage: clip(body.stage, 60),
    note: clip(body.note, 2000),
  };

  if (!lead.name || !EMAIL.test(lead.email) || !lead.company || (kind === "engagement" && !lead.note)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid fields." }, { status: 422 });
  }

  const webhook = process.env.LEAD_WEBHOOK_URL;
  if (webhook) {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "fde.traversaal.ai", receivedAt: new Date().toISOString(), ...lead }),
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (!res?.ok) {
      console.error("[lead] webhook failed", { status: res?.status, kind, email: lead.email });
      return NextResponse.json({ ok: false, error: "Delivery failed." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, delivered: false, error: "Lead delivery is not configured." }, { status: 503 });
}
