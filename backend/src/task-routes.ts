import express from "express";
import type { Pool } from "pg";
import { ownerId } from "./require-session.ts";
import { readClientId } from "./client-input.ts";
import { readTaskTitle, readTaskUpdate, readTaskFilter, readTaskCursor, readTaskDueDate } from "./task-input.ts";
import { makeTaskPage, taskPageQuery } from "./task-page.ts";

type TaskRow = {
  id: number;
  client_id: number;
  title: string;
  status: "pending" | "completed";
  created_at: Date;
  due_date: string | null;
};

// Keep the client ID from the URL where this router is mounted.
export function createTaskRoutes(db: Pick<Pool, "query">) {
  const taskRoutes = express.Router({ mergeParams: true });
  const parseTaskJson = express.json({ limit: "2kb", strict: false });
  const missingClient = {
    code: "CLIENT_NOT_FOUND",
    message: "Client not found. Refresh the client list.",
  };
  const invalidTitle = {
    code: "INVALID_TASK_TITLE",
    message: "Enter a task title between 1 and 200 characters.",
  };
  const invalidStatus = {
    code: "INVALID_TASK_STATUS",
    message: "Choose pending or completed.",
  };
  const invalidDueDate = {
    code: "INVALID_TASK_DUE_DATE",
    message: "Choose a valid date in YYYY-MM-DD format, or use null for no due date.",
  };

  taskRoutes.get<{ clientId: string }>("/", async (req, res) => {
    const clientId = readClientId(req.params.clientId);
    if (clientId === null) {
      res.status(400).json({ error: { code: "INVALID_CLIENT_ID", message: "Choose a valid client." } });
      return;
    }

    const filter = readTaskFilter(req.query.status);
    if (filter === null) {
      res.status(400).json({ error: { code: "INVALID_TASK_FILTER", message: "Choose all, pending, or completed." } });
      return;
    }
    const beforeId = readTaskCursor(req.query.before);
    if (beforeId === null) {
      res.status(400).json({ error: { code: "INVALID_TASK_CURSOR", message: "Choose a valid task page." } });
      return;
    }

    try {
      const client = await db.query<{ id: number }>(
        "SELECT id FROM public.clients WHERE id = $1 AND owner_id = $2", [clientId, ownerId(res)]
      );
      if (!client.rows[0]) {
        res.status(404).json({ error: missingClient });
        return;
      }

      const result = await db.query<TaskRow>(
        taskPageQuery,
        [clientId, filter === "all" ? null : filter, beforeId ?? null, ownerId(res)]
      );
      res.json(makeTaskPage(result.rows));
    } catch (error) {
      console.error("Task query failed:", error instanceof Error ? error.message : "Unknown database error");
      res.status(500).json({
        error: { code: "TASKS_READ_FAILED", message: "Unable to load tasks. Please try again." },
      });
    }
  });

  taskRoutes.post<{ clientId: string }>("/", parseTaskJson, async (req, res) => {
    const clientId = readClientId(req.params.clientId);
    if (clientId === null) {
      res.status(400).json({ error: { code: "INVALID_CLIENT_ID", message: "Choose a valid client." } });
      return;
    }
    if (!req.is("application/json")) {
      res.status(415).json({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Send application/json." } });
      return;
    }
    const body: unknown = req.body;
    const title = readTaskTitle(body);
    if (title === null) {
      res.status(400).json({ error: invalidTitle });
      return;
    }
    const date = readTaskDueDate(body);
    if (!date.ok) {
      res.status(400).json({ error: invalidDueDate });
      return;
    }

    try {
      const result = await db.query<TaskRow>(
        `INSERT INTO public.tasks (client_id, title, due_date)
         SELECT id, $2, $4::date FROM public.clients WHERE id = $1 AND owner_id = $3
         RETURNING id, client_id, title, status, created_at,
           to_char(due_date::timestamp, 'YYYY-MM-DD') AS due_date`,
        [clientId, title, ownerId(res), date.dueDate]
      );
      const task = result.rows[0];
      if (!task) {
        res.status(404).json({ error: missingClient });
        return;
      }
      res.status(201).json({ data: task });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && "constraint" in error) {
        // The foreign key also handles a client deleted during this request.
        if (error.code === "23503" && error.constraint === "tasks_client_fk") {
          res.status(404).json({ error: missingClient });
          return;
        }
        if (error.code === "23514" && error.constraint === "tasks_title_valid") {
          res.status(400).json({ error: invalidTitle });
          return;
        }
        if (error.code === "23514" && error.constraint === "tasks_due_date_valid") {
          res.status(400).json({ error: invalidDueDate });
          return;
        }
      }
      console.error("Task insert failed:", error instanceof Error ? error.message : "Unknown database error");
      res.status(500).json({
        error: {
          code: "TASK_CREATE_UNCONFIRMED",
          message: "Could not confirm the save. Check the task list before trying again.",
        },
      });
    }
  });

  taskRoutes.patch<{ clientId: string; taskId: string }>("/:taskId", parseTaskJson, async (req, res) => {
    const clientId = readClientId(req.params.clientId);
    if (clientId === null) {
      res.status(400).json({ error: { code: "INVALID_CLIENT_ID", message: "Choose a valid client." } });
      return;
    }
    const taskId = readClientId(req.params.taskId);
    if (taskId === null) {
      res.status(400).json({ error: { code: "INVALID_TASK_ID", message: "Choose a valid task." } });
      return;
    }
    if (!req.is("application/json")) {
      res.status(415).json({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Send application/json." } });
      return;
    }
    const body: unknown = req.body;
    const update = readTaskUpdate(body);
    if (!update.ok) {
      const error = update.field === "title" ? invalidTitle
        : update.field === "status" ? invalidStatus
        : update.field === "due_date" ? invalidDueDate
        : { code: "INVALID_TASK_UPDATE", message: "Provide a task title, status or due date to update." };
      res.status(400).json({ error });
      return;
    }

    try {
      const result = await db.query<TaskRow>(
        `UPDATE public.tasks
         SET title = COALESCE($1, title), status = COALESCE($2, status),
           due_date = CASE WHEN $6::boolean THEN $7::date ELSE due_date END
         WHERE id = $3 AND client_id = $4
           AND EXISTS (SELECT 1 FROM public.clients WHERE id = $4 AND owner_id = $5)
         RETURNING id, client_id, title, status, created_at,
           to_char(due_date::timestamp, 'YYYY-MM-DD') AS due_date`,
        [update.title, update.status, taskId, clientId, ownerId(res), update.dueDate !== undefined, update.dueDate ?? null]
      );
      const task = result.rows[0];
      if (!task) {
        res.status(404).json({
          error: { code: "TASK_NOT_FOUND", message: "Task not found for this client. Refresh the task list." },
        });
        return;
      }
      res.json({ data: task });
    } catch (error) {
      if (
        typeof error === "object" && error !== null &&
        "code" in error && error.code === "23514" &&
        "constraint" in error
      ) {
        if (error.constraint === "tasks_due_date_valid") {
          res.status(400).json({ error: invalidDueDate });
          return;
        }
        if (error.constraint === "tasks_status_valid" || error.constraint === "tasks_title_valid") {
          res.status(400).json({ error: error.constraint === "tasks_title_valid" ? invalidTitle : invalidStatus });
          return;
        }
      }
      console.error("Task update failed:", error instanceof Error ? error.message : "Unknown database error");
      res.status(500).json({
        error: {
          code: "TASK_UPDATE_UNCONFIRMED",
          message: "Could not confirm the update. Refresh the task list before trying again.",
        },
      });
    }
  });
  return taskRoutes;
}
