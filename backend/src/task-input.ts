import { readClientId } from "./client-input.ts";

export function readTaskTitle(body: unknown): string | null {
  if (
    typeof body !== "object" || body === null || Array.isArray(body) ||
    !("title" in body) || typeof body.title !== "string"
  ) {
    return null;
  }

  const title = body.title.trim();
  // Match the database's character limit, including emoji.
  if (!title || Array.from(title).length > 200 || title.includes("\0")) {
    return null;
  }

  return title;
}

export function readTaskStatus(body: unknown): "pending" | "completed" | null {
  if (
    typeof body !== "object" || body === null || Array.isArray(body) ||
    !("status" in body)
  ) {
    return null;
  }
  return body.status === "pending" || body.status === "completed" ? body.status : null;
}

export function readTaskFilter(value: unknown): "all" | "pending" | "completed" | null {
  if (value === undefined || value === "all") return "all";
  return value === "pending" || value === "completed" ? value : null;
}

// Undefined means the first page; null means an invalid cursor.
export function readTaskCursor(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" ? readClientId(value) : null;
}

type TaskUpdateResult =
  | { ok: true; title: string | null; status: "pending" | "completed" | null; dueDate: string | null | undefined }
  | { ok: false; field: "title" | "status" | "due_date" | "update" };

export function readTaskDueDate(body: unknown): { ok: true; dueDate: string | null } | { ok: false } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false };
  const value: unknown = Object.hasOwn(body, "due_date") && "due_date" in body ? body.due_date : null;
  if (value === null) return { ok: true, dueDate: null };
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false };
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12) return { ok: false };
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysInMonth[month - 1]) return { ok: false };
  // Keep calendar dates as strings; JavaScript Date can shift them across timezones.
  return { ok: true, dueDate: value };
}

export function readTaskUpdate(body: unknown): TaskUpdateResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, field: "update" };
  }

  const hasTitle = Object.hasOwn(body, "title");
  const hasStatus = Object.hasOwn(body, "status");
  const hasDueDate = Object.hasOwn(body, "due_date");
  if (!hasTitle && !hasStatus && !hasDueDate) return { ok: false, field: "update" };

  const title = hasTitle ? readTaskTitle(body) : null;
  if (hasTitle && title === null) return { ok: false, field: "title" };

  const status = hasStatus ? readTaskStatus(body) : null;
  if (hasStatus && status === null) return { ok: false, field: "status" };

  const date = readTaskDueDate(body);
  if (!date.ok) return { ok: false, field: "due_date" };

  // Title/status null mean omitted. Due date uses undefined for omitted and null to clear.
  return { ok: true, title, status, dueDate: hasDueDate ? date.dueDate : undefined };
}

