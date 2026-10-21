import type { Pool } from "pg";
import type { TaskDeletionConfirmation } from "./client-input.ts";

type DeletedClient = { id: number; name: string };
type DeleteResult =
  | { kind: "deleted"; client: DeletedClient }
  | { kind: "missing" }
  | { kind: "confirmation-required"; taskCount: number };

export async function deleteClientWithTasks(
  pool: Pick<Pool, "connect">,
  id: number,
  ownerId: string,
  confirmation: Exclude<TaskDeletionConfirmation, { kind: "invalid" }>
): Promise<DeleteResult> {
  const connection = await pool.connect();
  let releaseError: Error | undefined;

  try {
    await connection.query("BEGIN");
    // This lock also blocks new tasks from referencing this client until we finish.
    const existing = await connection.query<{ id: number }>(
      "SELECT id FROM public.clients WHERE id = $1 AND owner_id = $2 FOR UPDATE",
      [id, ownerId]
    );
    if (!existing.rows[0]) {
      await connection.query("ROLLBACK");
      return { kind: "missing" };
    }

    const counts = await connection.query<{ count: string }>(
      "SELECT count(*) AS count FROM public.tasks WHERE client_id = $1",
      [id]
    );
    const taskCount = Number(counts.rows[0]?.count);
    if (!Number.isSafeInteger(taskCount) || taskCount < 0) {
      throw new Error("Unexpected task count");
    }

    const needsConfirmation = taskCount > 0 && confirmation.kind === "none";
    const countChanged = confirmation.kind === "confirmed" && confirmation.taskCount !== taskCount;
    if (needsConfirmation || countChanged) {
      await connection.query("ROLLBACK");
      return { kind: "confirmation-required", taskCount };
    }

    const result = await connection.query<DeletedClient>(
      "DELETE FROM public.clients WHERE id = $1 AND owner_id = $2 RETURNING id, name",
      [id, ownerId]
    );
    const client = result.rows[0];
    if (!client) throw new Error("The locked client was not deleted");

    // The foreign key removes linked tasks in this same transaction.
    await connection.query("COMMIT");
    return { kind: "deleted", client };
  } catch (error) {
    try {
      await connection.query("ROLLBACK");
    } catch {
      releaseError = new Error("Could not roll back client deletion");
    }
    throw error;
  } finally {
    connection.release(releaseError);
  }
}
