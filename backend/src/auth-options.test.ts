import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { createAuthOptions } from "./auth-options.ts";

const env = { BETTER_AUTH_SECRET: "a".repeat(64), BETTER_AUTH_URL: "http://127.0.0.1:4000" };

test("auth configuration rejects missing/short secrets and unexpected local URLs without echoing values", async () => {
  const pool = new pg.Pool();
  try {
    for (const secret of [undefined, "", "private-short-key", ` ${env.BETTER_AUTH_SECRET}`]) {
      assert.throws(() => createAuthOptions(pool, { ...env, BETTER_AUTH_SECRET: secret }), /Set BETTER_AUTH_SECRET/);
    }
    for (const url of [undefined, "", "not a URL", "http://localhost:4000", "https://example.com",
      "http://127.0.0.1:4000/path", "http://127.0.0.1:4000?x=1", "http://user:private@127.0.0.1:4000"]) {
      assert.throws(() => createAuthOptions(pool, { ...env, BETTER_AUTH_URL: url }), /Set BETTER_AUTH_URL/);
    }
  } finally {
    await pool.end();
  }
});

test("auth uses the supplied runtime pool, local trusted origin, explicit tables, and rate limiting", async () => {
  const pool = new pg.Pool();
  try {
    const options = createAuthOptions(pool, env);
    assert.equal(options.database, pool);
    assert.equal(options.baseURL, "http://127.0.0.1:4000");
    assert.deepEqual(options.trustedOrigins, ["http://127.0.0.1:3000"]);
    assert.deepEqual(options.advanced.ipAddress.ipAddressHeaders, ["x-tracker-client-ip"]);
    assert.equal(options.emailAndPassword.enabled, true);
    assert.equal(options.emailAndPassword.minPasswordLength, 6);
    assert.equal(options.emailAndPassword.maxPasswordLength, 128);
    assert.equal(options.user.modelName, "auth_user");
    assert.equal(options.session.modelName, "auth_session");
    assert.equal(options.account.modelName, "auth_account");
    assert.equal(options.verification.modelName, "auth_verification");
    assert.equal(options.rateLimit.enabled, true);
  } finally {
    await pool.end();
  }
});
