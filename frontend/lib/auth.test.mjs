import assert from "node:assert/strict";
import test from "node:test";
import { readUser, signInError, validateSignUp, signUpError } from "./auth.ts";

test("identity parsing returns only public fields and rejects malformed identities", () => {
  const user = { id: "practice-user", name: "Practice", email: "practice@example.invalid" };
  assert.deepEqual(readUser({ data: { ...user, token: "never-return" } }), user);
  for (const payload of [null, {}, { data: null }, { data: {} },
    { data: { ...user, id: "" } }, { data: { ...user, email: 1 } }, { data: { ...user, name: null } }]) {
    assert.equal(readUser(payload), null);
  }
});

test("sign-in errors avoid account disclosure and give rate-limit recovery", () => {
  assert.equal(signInError(400), signInError(401));
  assert.match(signInError(429), /Wait/);
  assert.match(signInError(500), /later/);
});

test("signup checks blank names, password length boundaries and exact confirmation", () => {
  for (const name of ["", " \t ", "A\0B"]) assert.equal(validateSignUp(name, "a".repeat(15), "a".repeat(15)).field, "name");
  for (const length of [14, 129]) assert.equal(validateSignUp("Practice", "a".repeat(length), "a".repeat(length)).field, "password");
  for (const length of [15, 128]) assert.equal(validateSignUp(" Practice ", "a".repeat(length), "a".repeat(length)), null);
  assert.equal(validateSignUp("Practice", " leading-space-password ", " leading-space-password "), null);
  assert.equal(validateSignUp("Practice", " leading-space-password ", "leading-space-password").field, "confirmation");
});

test("signup treats unknown/server failures as uncertain instead of allowing another account write", () => {
  for (const status of [200, 201, 403, 500, 502]) assert.equal(signUpError(status), null);
  assert.match(signUpError(400), /Check/);
  assert.match(signUpError(422), /signing in/);
  assert.match(signUpError(429), /Wait/);
  assert.match(signUpError(413), /too long/);
});
