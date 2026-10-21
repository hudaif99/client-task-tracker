import assert from "node:assert/strict";
import test from "node:test";
import { isTaskForClient, readCreateTaskResult, readTaskClientId, readUpdateTaskResult, readRenameTaskResult, readTaskFilter, isTaskForFilter, readTaskCursor, getTaskQuery, readTaskPage, readDueDateResult, isDueDate, localCalendarDate, taskDueNotice } from "./tasks.ts";

const task = { id: 3, client_id: 5, title: "Prepare proposal", status: "pending", due_date: null };

test("task cursor URLs reject invalid and repeated IDs and preserve status", () => {
  assert.equal(readTaskCursor(undefined), undefined);
  assert.equal(readTaskCursor("2147483647"), 2147483647);
  for (const value of [null, "", "0", "-1", "01", "1.5", "1e2", " 5 ", "2147483648", ["5"], 5, {}]) {
    assert.equal(readTaskCursor(value), null);
  }
  assert.equal(getTaskQuery("all"), "");
  assert.equal(getTaskQuery("all", 25), "?before=25");
  assert.equal(getTaskQuery("pending", 25), "?status=pending&before=25");
  assert.equal(getTaskQuery("completed"), "?status=completed");
});

test("task pages accept empty/final pages and a full page with a matching next cursor", () => {
  assert.deepEqual(readTaskPage({ data: [], pagination: { nextBeforeId: null } }, 5, "all"), { tasks: [], nextBeforeId: null });
  assert.deepEqual(readTaskPage({ data: [task], pagination: { nextBeforeId: null } }, 5, "pending", 4), { tasks: [task], nextBeforeId: null });
  const tasks = Array.from({ length: 50 }, (_, index) => ({ ...task, id: 200 - index * 2 }));
  assert.deepEqual(readTaskPage({ data: tasks, pagination: { nextBeforeId: 102 } }, 5, "pending", 201), { tasks, nextBeforeId: 102 });
  assert.deepEqual(readTaskPage({ data: tasks, pagination: { nextBeforeId: null } }, 5, "all"), { tasks, nextBeforeId: null });
});

test("task pages reject invalid metadata, too many rows, duplicate IDs and wrong ordering", () => {
  const tasks = Array.from({ length: 50 }, (_, index) => ({ ...task, id: 100 - index }));
  for (const payload of [null, {}, { data: [task] }, { data: [task], pagination: {} },
    { data: [], pagination: { nextBeforeId: 1 } },
    { data: [task], pagination: { nextBeforeId: 3 } },
    { data: tasks, pagination: { nextBeforeId: "51" } },
    { data: tasks, pagination: { nextBeforeId: 52 } },
    { data: [...tasks, { ...task, id: 50 }], pagination: { nextBeforeId: 50 } },
    { data: [task, task], pagination: { nextBeforeId: null } },
    { data: [{ ...task, id: 2 }, task], pagination: { nextBeforeId: null } }]) {
    assert.equal(readTaskPage(payload, 5, "all"), null);
  }
});

test("task pages reject rows outside the client, selected status or cursor boundary", () => {
  const payload = { data: [task], pagination: { nextBeforeId: null } };
  assert.equal(readTaskPage(payload, 6, "all"), null);
  assert.equal(readTaskPage(payload, 5, "completed"), null);
  assert.equal(readTaskPage(payload, 5, "all", 3), null);
  assert.equal(readTaskPage(payload, 5, "all", 2), null);
});

test("task filter URLs accept only a single supported value, defaulting to all", () => {
  assert.equal(readTaskFilter(undefined), "all");
  for (const filter of ["all", "pending", "completed"]) assert.equal(readTaskFilter(filter), filter);
  for (const value of ["", "done", "Pending", " pending ", ["pending"], ["pending", "completed"], null, {}]) {
    assert.equal(readTaskFilter(value), null);
  }
});

test("filtered lists reject tasks outside the selected status or client", () => {
  assert.equal(isTaskForFilter(task, 5, "all"), true);
  assert.equal(isTaskForFilter(task, 5, "pending"), true);
  assert.equal(isTaskForFilter(task, 5, "completed"), false);
  assert.equal(isTaskForFilter({ ...task, status: "completed" }, 5, "completed"), true);
  assert.equal(isTaskForFilter({ ...task, client_id: 6 }, 5, "pending"), false);
  assert.equal(isTaskForFilter({}, 5, "all"), false);
});

test("validates client route parameters before building an API URL", () => {
  assert.equal(readTaskClientId("5"), 5);
  assert.equal(readTaskClientId("2147483647"), 2147483647);
  for (const id of ["0", "-1", "01", "5abc", "1e2", "2147483648", "../5", " 5 "]) {
    assert.equal(readTaskClientId(id), null);
  }
});

test("accepts only tasks belonging to the requested client with known statuses", () => {
  assert.equal(isTaskForClient(task, 5), true);
  assert.equal(isTaskForClient({ ...task, status: "completed" }, 5), true);
  for (const value of [null, {}, { ...task, client_id: 6 }, { ...task, status: "unknown" },
    { ...task, id: "3" }, { ...task, id: 0 }, { ...task, title: " " }, { ...task, title: "a".repeat(201) }]) {
    assert.equal(isTaskForClient(value, 5), false);
  }
});

test("confirms task creation only for a valid pending task and status 201", () => {
  assert.deepEqual(readCreateTaskResult(201, { data: task }, 5), { kind: "created", task });
  for (const [status, payload] of [[200, { data: task }], [201, {}], [201, { data: { ...task, client_id: 6 } }],
    [201, { data: { ...task, status: "completed" } }], [500, {}], [404, {}]]) {
    assert.deepEqual(readCreateTaskResult(status, payload, 5), { kind: "uncertain" });
  }
});

test("handles task validation and deleted clients without exposing server details", () => {
  const invalid = readCreateTaskResult(400, { error: { code: "INVALID_TASK_TITLE", message: "private detail" } }, 5);
  assert.equal(invalid.kind, "rejected");
  assert.equal(invalid.message.includes("private detail"), false);
  assert.deepEqual(readCreateTaskResult(404, { error: { code: "CLIENT_NOT_FOUND" } }, 5), { kind: "missing" });
  assert.equal(readCreateTaskResult(413, {}, 5).kind, "rejected");
  assert.equal(readCreateTaskResult(415, {}, 5).kind, "rejected");
});

test("confirms task updates only for the requested client, task, and status", () => {
  const completed = { ...task, status: "completed" };
  assert.deepEqual(readUpdateTaskResult(200, { data: completed }, 5, 3, "completed"), { kind: "updated" });
  assert.deepEqual(readUpdateTaskResult(200, { data: task }, 5, 3, "pending"), { kind: "updated" });
  for (const [status, payload] of [[201, { data: completed }], [200, {}], [200, { data: task }],
    [200, { data: { ...completed, id: 4 } }], [200, { data: { ...completed, client_id: 6 } }], [500, {}]]) {
    assert.deepEqual(readUpdateTaskResult(status, payload, 5, 3, "completed"), { kind: "uncertain" });
  }
});

test("recognizes known task update errors without accepting arbitrary responses", () => {
  assert.deepEqual(readUpdateTaskResult(404, { error: { code: "TASK_NOT_FOUND" } }, 5, 3, "completed"), { kind: "missing" });
  assert.deepEqual(readUpdateTaskResult(400, { error: { code: "INVALID_TASK_STATUS" } }, 5, 3, "completed"), { kind: "rejected" });
  assert.deepEqual(readUpdateTaskResult(404, {}, 5, 3, "completed"), { kind: "uncertain" });
});

test("title saves require matching task, client, title, and a valid task response", () => {
  const renamed = { ...task, title: "Updated proposal" };
  for (const status of ["pending", "completed"]) {
    assert.deepEqual(readRenameTaskResult(200, { data: { ...renamed, status } }, 5, 3, renamed.title), { kind: "updated" });
  }
  for (const [status, payload] of [[201, { data: renamed }], [200, {}], [200, { data: task }],
    [200, { data: { ...renamed, id: 4 } }], [200, { data: { ...renamed, client_id: 6 } }],
    [200, { data: { ...renamed, status: "done" } }], [500, { data: renamed }], [200, null]]) {
    assert.deepEqual(readRenameTaskResult(status, payload, 5, 3, renamed.title), { kind: "uncertain" });
  }
});

test("title save errors distinguish rejection, missing tasks, and uncertain outcomes", () => {
  const result = readRenameTaskResult(400, { error: { code: "INVALID_TASK_TITLE", message: "private detail" } }, 5, 3, "Title");
  assert.equal(result.kind, "rejected");
  assert.equal(result.message.includes("private detail"), false);
  assert.deepEqual(readRenameTaskResult(404, { error: { code: "TASK_NOT_FOUND" } }, 5, 3, "Title"), { kind: "missing" });
  for (const status of [413, 415]) assert.equal(readRenameTaskResult(status, {}, 5, 3, "Title").kind, "rejected");
  for (const [status, payload] of [[400, { error: { code: "INVALID_TASK_STATUS" } }], [404, {}],
    [500, { error: { code: "TASK_UPDATE_UNCONFIRMED" } }]]) {
    assert.deepEqual(readRenameTaskResult(status, payload, 5, 3, "Title"), { kind: "uncertain" });
  }
});

test("calendar due dates allow null and valid leap days, rejecting shifts and malformed values", () => {
  for (const value of [null, "0001-01-01", "9999-12-31", "2000-02-29", "2024-02-29", "2026-10-31"]) assert.equal(isDueDate(value), true);
  for (const value of [undefined, "", "0000-01-01", "10000-01-01", "1900-02-29", "2026-02-29", "2026-04-31",
    "2026-13-01", "2026-01-00", "2026-1-01", "2026-01-01T00:00:00Z", " 2026-10-31", "infinity", 1, false, {}]) {
    assert.equal(isDueDate(value), false);
    assert.equal(isTaskForClient({ ...task, due_date: value }, 5), false);
  }
});

test("creation verifies the exact requested due date, including an intentionally blank date", () => {
  const dated = { ...task, due_date: "2026-10-31" };
  assert.equal(readCreateTaskResult(201, { data: dated }, 5, "2026-10-31").kind, "created");
  assert.equal(readCreateTaskResult(201, { data: dated }, 5, null).kind, "uncertain");
  assert.equal(readCreateTaskResult(201, { data: task }, 5, "2026-10-31").kind, "uncertain");
  assert.equal(readCreateTaskResult(400, { error: { code: "INVALID_TASK_DUE_DATE", message: "internal detail" } }, 5).kind, "rejected");
});

test("due date saves and clears require matching task, client and exact date", () => {
  const dated = { ...task, due_date: "2026-10-31" };
  assert.deepEqual(readDueDateResult(200, { data: dated }, 5, 3, "2026-10-31"), { kind: "updated" });
  assert.deepEqual(readDueDateResult(200, { data: task }, 5, 3, null), { kind: "updated" });
  for (const payload of [null, {}, { data: { ...dated, id: 4 } }, { data: { ...dated, client_id: 6 } },
    { data: { ...dated, due_date: null } }, { data: { ...dated, due_date: "2026-11-01" } }, { data: { ...dated, due_date: undefined } }]) {
    assert.equal(readDueDateResult(200, payload, 5, 3, "2026-10-31").kind, "uncertain");
  }
  assert.equal(readDueDateResult(500, { data: dated }, 5, 3, "2026-10-31").kind, "uncertain");
});

test("due date save errors distinguish rejection/missing from uncertain results", () => {
  assert.equal(readDueDateResult(400, { error: { code: "INVALID_TASK_DUE_DATE", message: "private" } }, 5, 3, null).kind, "rejected");
  assert.equal(readDueDateResult(404, { error: { code: "TASK_NOT_FOUND" } }, 5, 3, null).kind, "missing");
  assert.equal(readDueDateResult(404, {}, 5, 3, null).kind, "uncertain");
  assert.equal(readDueDateResult(403, {}, 5, 3, null).kind, "uncertain");
});

test("due notices distinguish overdue/today from future, undated and completed tasks", () => {
  const today = "2026-10-21";
  assert.equal(taskDueNotice({ status: "pending", due_date: "2026-10-20" }, today), "Overdue");
  assert.equal(taskDueNotice({ status: "pending", due_date: today }, today), "Due today");
  assert.equal(taskDueNotice({ status: "pending", due_date: "2026-10-22" }, today), null);
  assert.equal(taskDueNotice({ status: "pending", due_date: null }, today), null);
  for (const due_date of [null, "2026-10-20", today, "2026-10-22"]) {
    assert.equal(taskDueNotice({ status: "completed", due_date }, today), null);
  }
  assert.equal(taskDueNotice({ status: "pending", due_date: today }, null), null);
});

test("due notices compare calendar boundaries without parsing date strings", () => {
  for (const [due_date, today] of [["2026-12-31", "2027-01-01"], ["2024-02-29", "2024-03-01"], ["2026-04-30", "2026-05-01"]]) {
    assert.equal(taskDueNotice({ status: "pending", due_date }, today), "Overdue");
  }
  assert.equal(localCalendarDate(new Date(2026, 0, 2, 0, 0)), "2026-01-02");
  assert.equal(localCalendarDate(new Date(2026, 11, 31, 23, 59)), "2026-12-31");
});
