import assert from "node:assert/strict";
import test from "node:test";
import { readTaskTitle, readTaskStatus, readTaskUpdate, readTaskFilter, readTaskCursor, readTaskDueDate } from "./task-input.ts";
import { makeTaskPage } from "./task-page.ts";

test("trims a task title and ignores fields controlled by the URL or database", () => {
  assert.equal(readTaskTitle({ title: "  Prepare proposal  ", client_id: 99, status: "completed", id: 7 }), "Prepare proposal");
});

test("rejects missing, non-text, and whitespace-only task titles", () => {
  for (const body of [undefined, null, [], "Task", {}, { title: 123 }, { title: null }, { title: "" }, { title: " \t\n " }]) {
    assert.equal(readTaskTitle(body), null);
  }
});

test("counts Unicode characters for the 200-character task title limit", () => {
  assert.equal(readTaskTitle({ title: "😀".repeat(200) }), "😀".repeat(200));
  assert.equal(readTaskTitle({ title: "😀".repeat(201) }), null);
  assert.equal(readTaskTitle({ title: "a".repeat(201) }), null);
});

test("rejects null characters before reaching PostgreSQL", () => {
  assert.equal(readTaskTitle({ title: "A\0B" }), null);
});

test("accepts only the two exact task status values", () => {
  assert.equal(readTaskStatus({ status: "pending" }), "pending");
  assert.equal(readTaskStatus({ status: "completed" }), "completed");
  for (const body of [undefined, null, [], "completed", {}, { status: null }, { status: true },
    { status: "done" }, { status: "Completed" }, { status: " pending " }, { status: ["pending"] }]) {
    assert.equal(readTaskStatus(body), null);
  }
});

test("status updates read no other authority-bearing fields", () => {
  assert.equal(readTaskStatus({ status: "completed", client_id: 99, id: 99, title: "Ignored" }), "completed");
});

test("partial task updates preserve omitted fields and ignore resource IDs", () => {
  assert.deepEqual(readTaskUpdate({ title: "  Revised proposal  ", client_id: 99, id: 99 }),
    { ok: true, title: "Revised proposal", status: null, dueDate: undefined });
  assert.deepEqual(readTaskUpdate({ status: "completed", client_id: 99 }),
    { ok: true, title: null, status: "completed", dueDate: undefined });
  assert.deepEqual(readTaskUpdate({ title: "Proposal", status: "pending" }),
    { ok: true, title: "Proposal", status: "pending", dueDate: undefined });
});

test("task updates require at least one supported field in a JSON object", () => {
  for (const body of [undefined, null, [], "Task", 1, {}, { client_id: 7 }, { name: "Task" }]) {
    assert.deepEqual(readTaskUpdate(body), { ok: false, field: "update" });
  }
});

test("invalid supplied fields reject the whole task update", () => {
  for (const title of [null, undefined, 3, "", " \t ", "A\0B", "😀".repeat(201)]) {
    assert.deepEqual(readTaskUpdate({ title, status: "completed" }), { ok: false, field: "title" });
  }
  for (const status of [null, undefined, "done", "Completed", " pending "]) {
    assert.deepEqual(readTaskUpdate({ title: "Valid title", status }), { ok: false, field: "status" });
  }
  assert.deepEqual(readTaskUpdate({ title: "😀".repeat(200) }),
    { ok: true, title: "😀".repeat(200), status: null, dueDate: undefined });
});

test("due dates accept omission/null and real calendar days including leap-year boundaries", () => {
  assert.deepEqual(readTaskDueDate({}), { ok: true, dueDate: null });
  assert.deepEqual(readTaskDueDate({ due_date: null }), { ok: true, dueDate: null });
  for (const value of ["0001-01-01", "9999-12-31", "2000-02-29", "2024-02-29", "2026-04-30", "0100-03-01"]) {
    assert.deepEqual(readTaskDueDate({ due_date: value }), { ok: true, dueDate: value });
  }
});

test("due dates reject invalid days, noncanonical strings, timestamps and unsupported values", () => {
  for (const value of ["2026-02-29", "1900-02-29", "2100-02-29", "2026-04-31", "2026-01-32",
    "0000-01-01", "10000-01-01", "2026-00-01", "2026-13-01", "2026-01-00", "2026-1-01",
    "2026-01-1", "2026-10-21T00:00:00Z", " 2026-10-21", "2026-10-21 ", "infinity", "",
    20261021, false, [], {}, undefined, "2026-10-21' OR true --"]) {
    assert.deepEqual(readTaskDueDate({ due_date: value }), { ok: false });
  }
});

test("due-date updates distinguish omitted from clearing and reject invalid combined writes", () => {
  assert.deepEqual(readTaskUpdate({ due_date: null }), { ok: true, title: null, status: null, dueDate: null });
  assert.deepEqual(readTaskUpdate({ due_date: "2026-10-31" }), { ok: true, title: null, status: null, dueDate: "2026-10-31" });
  assert.deepEqual(readTaskUpdate({ title: " New ", status: "completed", due_date: null }),
    { ok: true, title: "New", status: "completed", dueDate: null });
  assert.deepEqual(readTaskUpdate({ title: "New", status: "completed", due_date: "2026-02-30" }),
    { ok: false, field: "due_date" });
  assert.deepEqual(readTaskUpdate({ due_date: undefined }), { ok: false, field: "due_date" });
});

test("task filters default to all and accept only a single exact supported value", () => {
  assert.equal(readTaskFilter(undefined), "all");
  for (const filter of ["all", "pending", "completed"]) assert.equal(readTaskFilter(filter), filter);
  for (const value of [null, "", "done", "Pending", " pending ", ["pending"], ["pending", "completed"],
    { status: "pending" }, 1, true, "pending' OR 1=1 --"]) {
    assert.equal(readTaskFilter(value), null);
  }
});

test("task cursors distinguish the first page from invalid or repeated IDs", () => {
  assert.equal(readTaskCursor(undefined), undefined);
  assert.equal(readTaskCursor("1"), 1);
  assert.equal(readTaskCursor("2147483647"), 2147483647);
  for (const value of [null, "", "0", "-1", "01", "1.5", "1e2", " 5 ", "2147483648", ["5"], 5, {}]) {
    assert.equal(readTaskCursor(value), null);
  }
});

test("task page lookahead yields a cursor only when an older task exists", () => {
  for (const count of [0, 1, 49, 50, 51]) {
    const rows = Array.from({ length: count }, (_, index) => ({ id: 200 - index * 2 }));
    const page = makeTaskPage(rows);
    assert.equal(page.data.length, Math.min(count, 50));
    assert.equal(page.pagination.nextBeforeId, count === 51 ? rows[49].id : null);
    assert.equal(rows.length, count);
    if (count === 51) assert.equal(page.data.some(row => row.id === rows[50].id), false);
  }
});
