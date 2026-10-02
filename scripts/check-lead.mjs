// Exercises the actual route with a mocked delivery service. No requests leave this process.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../app/api/lead/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const valid = { kind: "program", name: "Test Engineer", email: "engineer@example.com", company: "Example" };

function handler(env = {}, fetch = async () => { throw new Error("Unexpected delivery request"); }) {
  const exports = {};
  runInNewContext(compiled, {
    exports, require, fetch, AbortSignal,
    process: { env },
    console: { error() {} },
  });
  return exports.POST;
}

const request = (body) => new Request("http://localhost/api/lead", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

test("malformed JSON and non-object payloads return 400", async () => {
  for (const body of ["{", "null", "[]"]) {
    assert.equal((await handler()(request(body))).status, 400);
  }
});

test("missing contact details and engagement notes return 422", async () => {
  for (const body of [
    { ...valid, name: " " },
    { ...valid, email: "engineer@" },
    { ...valid, company: " " },
    { ...valid, kind: "engagement", note: " " },
  ]) assert.equal((await handler()(request(body))).status, 422);
});

test("unconfigured delivery never reports success in development or production", async () => {
  for (const NODE_ENV of ["development", "production"]) {
    const response = await handler({ NODE_ENV })(request(valid));
    assert.equal(response.status, 503);
    const result = await response.json();
    assert.equal(result.ok, false);
    assert.equal(result.delivered, false);
  }
});

test("honeypot requests do not reach delivery", async () => {
  const response = await handler()(request({ website: "spam.example" }));
  assert.equal(response.status, 200);
});

test("failed or timed-out delivery returns 502", async () => {
  for (const delivery of [async () => new Response(null, { status: 500 }), async () => { throw new Error("Timeout"); }]) {
    const response = await handler({ LEAD_WEBHOOK_URL: "https://mock.example/lead" }, delivery)(request(valid));
    assert.equal(response.status, 502);
  }
});

test("confirmed delivery forwards the program and engagement details", async () => {
  for (const body of [valid, { ...valid, kind: "engagement", stage: "A demo or PoC", note: "Support agent" }]) {
    let forwarded;
    const response = await handler({ LEAD_WEBHOOK_URL: "https://mock.example/lead" }, async (url, options) => {
      assert.equal(url, "https://mock.example/lead");
      forwarded = JSON.parse(options.body);
      return new Response(null, { status: 200 });
    })(request(body));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
    assert.equal(forwarded.kind, body.kind);
    assert.equal(forwarded.email, valid.email);
    assert.equal(forwarded.source, "fde.traversaal.ai");
    assert.ok(forwarded.receivedAt);
    if (body.note) assert.equal(forwarded.note, body.note);
  }
});
