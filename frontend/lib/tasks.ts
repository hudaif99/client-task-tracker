export function isDueDate(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  // Use calendar arithmetic, not Date parsing that can normalize or shift a day.
  return day >= 1 && day <= days[month - 1];
}

export type Task = {
  id: number;
  client_id: number;
  title: string;
  status: "pending" | "completed";
  due_date: string | null;
};

export function localCalendarDate(now: Date): string {
  return `${String(now.getFullYear()).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function taskDueNotice(task: Pick<Task, "status" | "due_date">, today: string | null): "Overdue" | "Due today" | null {
  if (today === null || task.status === "completed" || task.due_date === null) return null;
  // Both dates are canonical calendar strings, so comparison needs no timezone conversion.
  if (task.due_date < today) return "Overdue";
  return task.due_date === today ? "Due today" : null;
}

export type TaskFilter = "all" | "pending" | "completed";

export function readTaskFilter(value: unknown): TaskFilter | null {
  if (value === undefined || value === "all") return "all";
  return value === "pending" || value === "completed" ? value : null;
}

export function readTaskCursor(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" ? readTaskClientId(value) : null;
}

export function getTaskQuery(filter: TaskFilter, beforeId?: number): string {
  const query = new URLSearchParams();
  if (filter !== "all") query.set("status", filter);
  if (beforeId !== undefined) query.set("before", String(beforeId));
  return query.size ? `?${query}` : "";
}

export function readTaskPage(payload: unknown, clientId: number, filter: TaskFilter, beforeId?: number):
  { tasks: Task[]; nextBeforeId: number | null } | null {
  if (
    typeof payload !== "object" || payload === null ||
    !("data" in payload) || !Array.isArray(payload.data) || payload.data.length > 50 ||
    !payload.data.every((task: unknown) => isTaskForFilter(task, clientId, filter)) ||
    !("pagination" in payload) || typeof payload.pagination !== "object" || payload.pagination === null ||
    !("nextBeforeId" in payload.pagination)
  ) return null;

  const tasks: Task[] = payload.data;
  if (tasks.some((task, index) =>
    (beforeId !== undefined && task.id >= beforeId) || (index > 0 && task.id >= tasks[index - 1].id)
  )) return null;
  const nextBeforeId = payload.pagination.nextBeforeId;
  if (nextBeforeId !== null && (tasks.length !== 50 || nextBeforeId !== tasks[49].id)) return null;
  return { tasks, nextBeforeId: nextBeforeId === null ? null : tasks[49].id };
}

export function isTaskForFilter(value: unknown, clientId: number, filter: TaskFilter): value is Task {
  return isTaskForClient(value, clientId) && (filter === "all" || value.status === filter);
}

export function readTaskClientId(value: string): number | null {
  if (!/^[1-9]\d{0,9}$/.test(value)) return null;
  const id = Number(value);
  return id <= 2147483647 ? id : null;
}

export function isTaskForClient(value: unknown, clientId: number): value is Task {
  return (
    typeof value === "object" && value !== null &&
    "id" in value && typeof value.id === "number" &&
    Number.isSafeInteger(value.id) && value.id > 0 && value.id <= 2147483647 &&
    "client_id" in value && value.client_id === clientId &&
    "title" in value && typeof value.title === "string" &&
    value.title.trim().length > 0 && Array.from(value.title).length <= 200 &&
    !value.title.includes("\0") &&
    "status" in value && (value.status === "pending" || value.status === "completed") &&
    "due_date" in value && isDueDate(value.due_date)
  );
}

export function readCreateTaskResult(status: number, payload: unknown, clientId: number, requestedTitle: string, dueDate: string | null = null):
  | { kind: "created"; task: Task }
  | { kind: "rejected"; message: string }
  | { kind: "missing" }
  | { kind: "uncertain" } {
  if (
    status === 201 && typeof payload === "object" && payload !== null &&
    "data" in payload && isTaskForClient(payload.data, clientId) && payload.data.status === "pending" &&
    payload.data.title === requestedTitle && payload.data.due_date === dueDate
  ) {
    return { kind: "created", task: payload.data };
  }

  if (
    typeof payload === "object" && payload !== null &&
    "error" in payload && typeof payload.error === "object" && payload.error !== null &&
    "code" in payload.error
  ) {
    if (status === 400 && payload.error.code === "INVALID_TASK_TITLE") {
      return { kind: "rejected", message: "Enter a task title between 1 and 200 characters." };
    }
    if (status === 400 && payload.error.code === "INVALID_TASK_DUE_DATE") {
      return { kind: "rejected", message: "Choose a valid due date, or leave it blank." };
    }
    if (status === 404 && payload.error.code === "CLIENT_NOT_FOUND") {
      return { kind: "missing" };
    }
  }
  if (status === 413) {
    return { kind: "rejected", message: "The entry is too large. Shorten the title and try again." };
  }
  if (status === 415) {
    return { kind: "rejected", message: "The request format was not accepted. Refresh the page and try again." };
  }
  return { kind: "uncertain" };
}

export function readDueDateResult(status: number, payload: unknown, clientId: number, taskId: number, dueDate: string | null):
  | { kind: "updated" }
  | { kind: "rejected"; message: string }
  | { kind: "missing" }
  | { kind: "uncertain" } {
  if (status === 200 && typeof payload === "object" && payload !== null &&
      "data" in payload && isTaskForClient(payload.data, clientId) &&
      payload.data.id === taskId && payload.data.due_date === dueDate) return { kind: "updated" };
  if (typeof payload === "object" && payload !== null && "error" in payload &&
      typeof payload.error === "object" && payload.error !== null && "code" in payload.error) {
    if (status === 404 && payload.error.code === "TASK_NOT_FOUND") return { kind: "missing" };
    if (status === 400 && payload.error.code === "INVALID_TASK_DUE_DATE") {
      return { kind: "rejected", message: "Choose a valid due date, or leave it blank." };
    }
  }
  if (status === 413 || status === 415) return { kind: "rejected", message: "The request was not accepted. Refresh the task list and try again." };
  return { kind: "uncertain" };
}

export function readUpdateTaskResult(
  status: number,
  payload: unknown,
  clientId: number,
  taskId: number,
  requestedStatus: Task["status"]
):
  | { kind: "updated" }
  | { kind: "missing" }
  | { kind: "rejected" }
  | { kind: "uncertain" } {
  if (
    status === 200 && typeof payload === "object" && payload !== null &&
    "data" in payload && isTaskForClient(payload.data, clientId) &&
    payload.data.id === taskId && payload.data.status === requestedStatus
  ) {
    return { kind: "updated" };
  }
  if (
    typeof payload === "object" && payload !== null &&
    "error" in payload && typeof payload.error === "object" && payload.error !== null &&
    "code" in payload.error
  ) {
    if (status === 404 && payload.error.code === "TASK_NOT_FOUND") return { kind: "missing" };
    if (status === 400 && payload.error.code === "INVALID_TASK_STATUS") return { kind: "rejected" };
  }
  return { kind: "uncertain" };
}

export function readRenameTaskResult(
  status: number, payload: unknown, clientId: number, taskId: number, requestedTitle: string
):
  | { kind: "updated" }
  | { kind: "rejected"; message: string }
  | { kind: "missing" }
  | { kind: "uncertain" } {
  if (
    status === 200 && typeof payload === "object" && payload !== null &&
    "data" in payload && isTaskForClient(payload.data, clientId) &&
    payload.data.id === taskId && payload.data.title === requestedTitle
  ) {
    return { kind: "updated" };
  }
  if (
    typeof payload === "object" && payload !== null &&
    "error" in payload && typeof payload.error === "object" && payload.error !== null &&
    "code" in payload.error
  ) {
    if (status === 404 && payload.error.code === "TASK_NOT_FOUND") return { kind: "missing" };
    if (status === 400 && payload.error.code === "INVALID_TASK_TITLE") {
      return { kind: "rejected", message: "Enter a task title between 1 and 200 characters." };
    }
  }
  if (status === 413) return { kind: "rejected", message: "The entry is too large. Shorten the title and try again." };
  if (status === 415) return { kind: "rejected", message: "The request format was not accepted. Refresh the page and try again." };
  return { kind: "uncertain" };
}
