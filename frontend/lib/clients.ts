export type Client = {
  id: number;
  name: string;
};

export function isClient(value: unknown): value is Client {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "number" &&
    Number.isSafeInteger(value.id) &&
    value.id > 0 &&
    "name" in value &&
    typeof value.name === "string" &&
    value.name.trim().length > 0
  );
}

type CreateClientResult =
  | { kind: "created"; client: Client }
  | { kind: "rejected"; message: string }
  | { kind: "uncertain" };

export function readCreateClientResult(
  status: number,
  payload: unknown
): CreateClientResult {
  if (
    status === 201 &&
    typeof payload === "object" && payload !== null &&
    "data" in payload && isClient(payload.data)
  ) {
    return { kind: "created", client: payload.data };
  }

  if (
    status === 400 &&
    typeof payload === "object" && payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" && payload.error !== null &&
    "code" in payload.error && payload.error.code === "INVALID_CLIENT_NAME"
  ) {
    return { kind: "rejected", message: "Enter a client name between 1 and 120 characters." };
  }

  if (status === 413) {
    return { kind: "rejected", message: "The entry is too large. Shorten the name and try again." };
  }

  if (status === 415) {
    return { kind: "rejected", message: "The request format was not accepted. Refresh the page and try again." };
  }

  // An unreadable success or failed response can follow a committed insert.
  return { kind: "uncertain" };
}

export function readUpdateClientResult(status: number, payload: unknown, expectedId: number):
  | { kind: "updated"; client: Client }
  | { kind: "rejected"; message: string }
  | { kind: "uncertain" } {
  if (
    status === 200 && typeof payload === "object" && payload !== null &&
    "data" in payload && isClient(payload.data) && payload.data.id === expectedId
  ) {
    return { kind: "updated", client: payload.data };
  }

  if (
    status === 404 && typeof payload === "object" && payload !== null &&
    "error" in payload && typeof payload.error === "object" && payload.error !== null &&
    "code" in payload.error && payload.error.code === "CLIENT_NOT_FOUND"
  ) {
    return { kind: "rejected", message: "This client no longer exists. Refresh the page to update the list." };
  }

  const result = readCreateClientResult(status, payload);
  return result.kind === "rejected" ? result : { kind: "uncertain" };
}

export function readDeleteClientResult(status: number, payload: unknown, expectedId: number):
  | { kind: "deleted" }
  | { kind: "missing" }
  | { kind: "confirmation-required"; taskCount: number }
  | { kind: "uncertain" } {
  if (
    status === 409 && typeof payload === "object" && payload !== null &&
    "error" in payload && typeof payload.error === "object" && payload.error !== null &&
    "code" in payload.error && payload.error.code === "CLIENT_TASKS_CONFIRMATION_REQUIRED" &&
    "taskCount" in payload.error && typeof payload.error.taskCount === "number" &&
    Number.isSafeInteger(payload.error.taskCount) && payload.error.taskCount >= 0
  ) {
    return { kind: "confirmation-required", taskCount: payload.error.taskCount };
  }

  if (
    status === 200 && typeof payload === "object" && payload !== null &&
    "data" in payload && isClient(payload.data) && payload.data.id === expectedId
  ) {
    return { kind: "deleted" };
  }

  if (
    status === 404 && typeof payload === "object" && payload !== null &&
    "error" in payload && typeof payload.error === "object" && payload.error !== null &&
    "code" in payload.error && payload.error.code === "CLIENT_NOT_FOUND"
  ) {
    return { kind: "missing" };
  }

  return { kind: "uncertain" };
}
