import assert from "node:assert/strict";
import test from "node:test";
import { readClientId, readClientName, readTaskDeletionConfirmation } from "./client-input.ts";

test("accepts positive IDs within PostgreSQL's integer range", () => {
  assert.equal(readClientId("1"), 1);
  assert.equal(readClientId("42"), 42);
  assert.equal(readClientId("2147483647"), 2147483647);
});

test("rejects malformed and out-of-range IDs", () => {
  for (const value of [
    "", "0", "-1", "+1", "01", "1.5", "1e3", "1abc", " 1 ",
    "2147483648", "99999999999999999999", "1; DROP TABLE clients",
  ]) {
    assert.equal(readClientId(value), null);
  }
});

test("requires an ID to be a URL parameter string", () => {
  for (const value of [undefined, null, 1, {}, ["1"]]) {
    assert.equal(readClientId(value), null);
  }
});

test("trims a valid client name", () => {
  assert.equal(readClientName({ name: "  Acme  " }), "Acme");
});

test("rejects missing, non-text, and blank names", () => {
  const invalidBodies: unknown[] = [
    undefined,
    null,
    [],
    "Acme",
    {},
    { name: null },
    { name: 123 },
    { name: "" },
    { name: " \t\n " },
  ];

  for (const body of invalidBodies) {
    assert.equal(readClientName(body), null);
  }
});

test("accepts 120 Unicode characters and rejects 121", () => {
  assert.equal(readClientName({ name: "😀".repeat(120) }), "😀".repeat(120));
  assert.equal(readClientName({ name: "😀".repeat(121) }), null);
  assert.equal(readClientName({ name: "a".repeat(121) }), null);
});

test("rejects null characters, which PostgreSQL text cannot store", () => {
  assert.equal(readClientName({ name: "Acme\0Ltd" }), null);
});

test("reads only the name, leaving generated fields to the database", () => {
  assert.equal(
    readClientName({ name: "Acme", id: 99, created_at: "ignored" }),
    "Acme"
  );
});

test("requires explicit task confirmation with a nonnegative integer count", () => {
  assert.deepEqual(readTaskDeletionConfirmation(undefined), { kind: "none" });
  assert.deepEqual(readTaskDeletionConfirmation({ confirmTaskDeletion: true, expectedTaskCount: 2 }), { kind: "confirmed", taskCount: 2 });
  assert.deepEqual(readTaskDeletionConfirmation({ confirmTaskDeletion: true, expectedTaskCount: 0 }), { kind: "confirmed", taskCount: 0 });
  for (const body of [null, {}, [], true, { confirmTaskDeletion: "true", expectedTaskCount: 2 },
    { confirmTaskDeletion: true }, { confirmTaskDeletion: true, expectedTaskCount: "2" },
    ...[-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1].map(expectedTaskCount => ({ confirmTaskDeletion: true, expectedTaskCount }))]) {
    assert.deepEqual(readTaskDeletionConfirmation(body), { kind: "invalid" });
  }
});
