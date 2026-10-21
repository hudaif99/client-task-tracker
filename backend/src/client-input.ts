export function readClientId(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d{0,9}$/.test(value)) {
    return null;
  }

  const id = Number(value);

  // Keep IDs within PostgreSQL's integer range.
  return id <= 2147483647 ? id : null;
}

export function readClientName(body: unknown): string | null {
  if (
    typeof body !== "object" ||
    body === null ||
    !("name" in body) ||
    typeof body.name !== "string"
  ) {
    return null;
  }

  const name = body.name.trim();

  // Count Unicode characters to match PostgreSQL's character limit.
  if (!name || Array.from(name).length > 120 || name.includes("\0")) {
    return null;
  }

  return name;
}

export type TaskDeletionConfirmation =
  | { kind: "none" }
  | { kind: "confirmed"; taskCount: number }
  | { kind: "invalid" };

export function readTaskDeletionConfirmation(body: unknown): TaskDeletionConfirmation {
  if (body === undefined) return { kind: "none" };

  if (
    typeof body === "object" && body !== null && !Array.isArray(body) &&
    "confirmTaskDeletion" in body && body.confirmTaskDeletion === true &&
    "expectedTaskCount" in body && typeof body.expectedTaskCount === "number" &&
    Number.isSafeInteger(body.expectedTaskCount) && body.expectedTaskCount >= 0
  ) {
    return { kind: "confirmed", taskCount: body.expectedTaskCount };
  }

  return { kind: "invalid" };
}
