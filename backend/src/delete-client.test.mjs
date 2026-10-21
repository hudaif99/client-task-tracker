import assert from "node:assert/strict";
import test from "node:test";
import { deleteClientWithTasks } from "./delete-client.ts";

function database({ count = 2, missing = false, failAt, rollbackFails = false } = {}) {
  const calls = [];
  const releases = [];
  const connection = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql === "ROLLBACK" && rollbackFails) throw new Error("Connection lost");
      if (failAt && sql.startsWith(failAt)) throw new Error("Database failed");
      if (sql.startsWith("SELECT id")) return { rows: missing ? [] : [{ id: 4 }] };
      if (sql.startsWith("SELECT count")) return { rows: [{ count: String(count) }] };
      if (sql.startsWith("DELETE")) return { rows: [{ id: 4, name: "Practice Client" }] };
      return { rows: [] };
    },
    release(error) { releases.push(error); },
  };
  return { pool: { async connect() { return connection; } }, calls, releases };
}

test("tasks block deletion without confirmation and leave no transaction open", async () => {
  const db = database();
  assert.deepEqual(await deleteClientWithTasks(db.pool, 4, "owner-a", { kind: "none" }), { kind: "confirmation-required", taskCount: 2 });
  assert.equal(db.calls.some(call => call.sql.startsWith("DELETE")), false);
  assert.equal(db.calls.at(-1).sql, "ROLLBACK");
  assert.deepEqual(db.releases, [undefined]);
});

test("a changed task count requires a fresh confirmation", async () => {
  for (const count of [0, 1, 3]) {
    const db = database({ count });
    assert.deepEqual(await deleteClientWithTasks(db.pool, 4, "owner-a", { kind: "confirmed", taskCount: 2 }), { kind: "confirmation-required", taskCount: count });
    assert.equal(db.calls.some(call => call.sql.startsWith("DELETE")), false);
  }
});

test("confirmed deletion locks the parent before counting and deletes only its ID", async () => {
  const db = database();
  assert.deepEqual(await deleteClientWithTasks(db.pool, 4, "owner-a", { kind: "confirmed", taskCount: 2 }), { kind: "deleted", client: { id: 4, name: "Practice Client" } });
  assert.equal(db.calls[0].sql, "BEGIN");
  assert.match(db.calls[1].sql, /WHERE id = \$1 AND owner_id = \$2 FOR UPDATE$/);
  assert.match(db.calls[2].sql, /FROM public.tasks WHERE client_id = \$1$/);
  assert.match(db.calls[3].sql, /WHERE id = \$1 AND owner_id = \$2 RETURNING/);
  assert.deepEqual(db.calls[1].values, [4, "owner-a"]);
  assert.deepEqual(db.calls[2].values, [4]);
  assert.deepEqual(db.calls[3].values, [4, "owner-a"]);
  assert.equal(db.calls.at(-1).sql, "COMMIT");
  assert.deepEqual(db.releases, [undefined]);
});

test("a client without tasks keeps the original no-body delete flow", async () => {
  const db = database({ count: 0 });
  assert.equal((await deleteClientWithTasks(db.pool, 4, "owner-a", { kind: "none" })).kind, "deleted");
});

test("a missing client does not query tasks or delete anything", async () => {
  const db = database({ missing: true });
  assert.deepEqual(await deleteClientWithTasks(db.pool, 4, "owner-a", { kind: "none" }), { kind: "missing" });
  assert.equal(db.calls.length, 3);
  assert.equal(db.calls.at(-1).sql, "ROLLBACK");
});

test("query or commit failures roll back and do not retry the deletion", async () => {
  for (const failAt of ["SELECT count", "DELETE", "COMMIT"]) {
    const db = database({ failAt });
    await assert.rejects(deleteClientWithTasks(db.pool, 4, "owner-a", { kind: "confirmed", taskCount: 2 }), /Database failed/);
    assert.equal(db.calls.at(-1).sql, "ROLLBACK");
    assert.ok(db.calls.filter(call => call.sql.startsWith("DELETE")).length <= 1);
    assert.equal(db.releases.length, 1);
  }
});

test("a failed rollback discards the connection", async () => {
  const db = database({ failAt: "DELETE", rollbackFails: true });
  await assert.rejects(deleteClientWithTasks(db.pool, 4, "owner-a", { kind: "confirmed", taskCount: 2 }), /Database failed/);
  assert.ok(db.releases[0] instanceof Error);
});

