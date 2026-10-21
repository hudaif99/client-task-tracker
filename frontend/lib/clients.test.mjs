import assert from "node:assert/strict";
import test from "node:test";
import { isClient, readCreateClientResult, readUpdateClientResult, readDeleteClientResult } from "./clients.ts";

test("recognizes a created client only with a valid response", () => {
  const client = { id: 7, name: "Practice Client" };
  assert.deepEqual(readCreateClientResult(201, { data: client }, client.name), { kind: "created", client });
  for (const data of [null, {}, { id: "7", name: "Acme" }, { id: 0, name: "Acme" }, { id: 7, name: " " }]) {
    assert.equal(isClient(data), false);
    assert.deepEqual(readCreateClientResult(201, { data }, client.name), { kind: "uncertain" });
  }
});

test("recognizes a rejected name without displaying server details", () => {
  const result = readCreateClientResult(400, {
    error: { code: "INVALID_CLIENT_NAME", message: "Internal detail" },
  }, "Practice Client");
  assert.equal(result.kind, "rejected");
  assert.equal(result.message.includes("Internal detail"), false);
});

test("keeps failed and unexpected responses uncertain", () => {
  for (const status of [200, 400, 404, 500, 503]) {
    assert.deepEqual(readCreateClientResult(status, {}, "Practice Client"), { kind: "uncertain" });
  }
});

test("identifies body size and media type rejections", () => {
  assert.equal(readCreateClientResult(413, {}, "Practice Client").kind, "rejected");
  assert.equal(readCreateClientResult(415, {}, "Practice Client").kind, "rejected");
});

test("confirms an update only for the requested client", () => {
  const client = { id: 4, name: "Updated Practice Client" };
  assert.deepEqual(readUpdateClientResult(200, { data: client }, 4, client.name), { kind: "updated", client });
  for (const [status, payload] of [[200, { data: { ...client, id: 5 } }], [200, {}], [201, { data: client }], [500, {}]]) {
    assert.deepEqual(readUpdateClientResult(status, payload, 4, client.name), { kind: "uncertain" });
  }
});

test("recognizes update rejections and missing clients", () => {
  assert.equal(readUpdateClientResult(404, { error: { code: "CLIENT_NOT_FOUND" } }, 4, "Practice Client").kind, "rejected");
  assert.equal(readUpdateClientResult(400, { error: { code: "INVALID_CLIENT_NAME" } }, 4, "Practice Client").kind, "rejected");
  assert.equal(readUpdateClientResult(404, {}, 4, "Practice Client").kind, "uncertain");
});

test("client creation confirms the exact submitted name, including Unicode", () => {
  const requestedName = "Café 🦋";
  assert.equal(readCreateClientResult(201, { data: { id: 7, name: requestedName } }, requestedName).kind, "created");
  for (const name of ["Different client", "CAFÉ 🦋", ` ${requestedName} `, "Cafe\u0301 🦋"]) {
    assert.deepEqual(readCreateClientResult(201, { data: { id: 7, name } }, requestedName), { kind: "uncertain" });
  }
});

test("client rename keeps a mismatched submitted name uncertain even with the correct ID", () => {
  const requestedName = "Renamed 🦋";
  assert.equal(readUpdateClientResult(200, { data: { id: 4, name: requestedName } }, 4, requestedName).kind, "updated");
  for (const name of ["Original name", "RENAMED 🦋", ` ${requestedName} `]) {
    assert.deepEqual(readUpdateClientResult(200, { data: { id: 4, name } }, 4, requestedName), { kind: "uncertain" });
  }
});

test("confirms deletion only for the requested client", () => {
  const client = { id: 4, name: "Delete Test" };
  assert.deepEqual(readDeleteClientResult(200, { data: client }, 4), { kind: "deleted" });
  for (const [status, payload] of [[200, { data: { ...client, id: 5 } }], [200, {}], [204, {}], [500, {}]]) {
    assert.deepEqual(readDeleteClientResult(status, payload, 4), { kind: "uncertain" });
  }
});

test("recognizes an already removed client only from the known error", () => {
  assert.deepEqual(readDeleteClientResult(404, { error: { code: "CLIENT_NOT_FOUND" } }, 4), { kind: "missing" });
  assert.deepEqual(readDeleteClientResult(404, {}, 4), { kind: "uncertain" });
});

test("accepts a task deletion warning only with the known code and a valid count", () => {
  for (const count of [0, 1, 12]) {
    assert.deepEqual(readDeleteClientResult(409, { error: { code: "CLIENT_TASKS_CONFIRMATION_REQUIRED", taskCount: count } }, 4), { kind: "confirmation-required", taskCount: count });
  }
  for (const count of [undefined, "2", -1, 1.5, Infinity]) {
    assert.deepEqual(readDeleteClientResult(409, { error: { code: "CLIENT_TASKS_CONFIRMATION_REQUIRED", taskCount: count } }, 4), { kind: "uncertain" });
  }
  assert.deepEqual(readDeleteClientResult(409, { error: { code: "OTHER", taskCount: 2 } }, 4), { kind: "uncertain" });
});
