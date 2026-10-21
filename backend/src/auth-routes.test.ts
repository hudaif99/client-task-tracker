import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import { createAuthRoutes } from "./auth-routes.ts";
import { requestErrorHandler } from "./request-errors.ts";

test("auth transport bounds JSON and preserves request data, cookies and response headers", async () => {
  const app = express();
  let calls = 0;
  app.use("/api", createAuthRoutes({
    handler: async request => {
      calls++;
      assert.equal(new URL(request.url).pathname, "/api/auth/sign-in/email");
      assert.equal(request.headers.get("cookie"), "test-cookie=sample");
      assert.equal(request.headers.get("x-tracker-client-ip"), "127.0.0.1");
      assert.deepEqual(await request.json(), { email: "test@example.invalid", password: "test-only-password" });
      return Response.json({ ok: true }, { headers: { "Set-Cookie": "test-cookie=next; HttpOnly; SameSite=Lax" } });
    },
    getUser: async () => null,
  }));
  app.use(requestErrorHandler);
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/auth/sign-in/email`;
    const response = await fetch(url, { method: "POST", headers: {
      "Content-Type": "application/json", Cookie: "test-cookie=sample", "x-tracker-client-ip": "203.0.113.1",
    }, body: JSON.stringify({ email: "test@example.invalid", password: "test-only-password" }) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(response.headers.get("set-cookie"), "test-cookie=next; HttpOnly; SameSite=Lax");
    assert.equal(response.headers.get("cache-control"), "no-store");

    const oversized = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: "x".repeat(2048) }) });
    assert.equal(oversized.status, 413);
    assert.equal(calls, 1);
    const malformed = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{broken" });
    assert.equal(malformed.status, 400);
    assert.equal(calls, 1);
    const unsupported = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body: "x".repeat(4096) });
    assert.equal(unsupported.status, 415);
    assert.equal(calls, 1);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test("identity endpoint rejects missing sessions and returns only the signed-in user's public identity", async () => {
  const app = express();
  const user = { id: "test-user", name: "Test", email: "test@example.invalid", token: "must-not-return" };
  app.use("/api", createAuthRoutes({
    handler: async () => new Response(null, { status: 404 }),
    getUser: async headers => headers.get("cookie") === "test-session=valid" ? user : null,
  }));
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/api/me`;
    for (const cookie of [undefined, "test-session=invalid"]) {
      const response = await fetch(url, { headers: cookie ? { Cookie: cookie } : undefined });
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error.code, "UNAUTHENTICATED");
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
    const response = await fetch(url, { headers: { Cookie: "test-session=valid" } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: { id: user.id, name: user.name, email: user.email } });
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
