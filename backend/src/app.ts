import express from "express";
import cors from "cors";
import type { Pool } from "pg";
import { readClientId, readClientName, readTaskDeletionConfirmation } from "./client-input.ts";
import { deleteClientWithTasks } from "./delete-client.ts";
import { requestErrorHandler } from "./request-errors.ts";
import { createTaskRoutes } from "./task-routes.ts";
import { requireSession, ownerId, frontendOrigins } from "./require-session.ts";
import { createAuthRoutes, type AuthService } from "./auth-routes.ts";

export function createApp(db: Pick<Pool, "query" | "connect">, authService: AuthService) {
  const app = express();

  // Local development origins; update these when deployment URLs are chosen.
  app.use(cors({
    origin: frontendOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  }));

  app.use("/api", createAuthRoutes(authService));

  type ClientRow = {
    id: number;
    name: string;
    created_at: Date;
  };

  const parseClientJson = express.json({ limit: "2kb", strict: false });
  const invalidClientName = {
    code: "INVALID_CLIENT_NAME",
    message: "Enter a client name between 1 and 120 characters.",
  };

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // This prefix covers every client route and its nested task routes.
  app.use("/clients", requireSession(authService.getUser));
  app.get("/clients", async (_req, res) => {
    try {
      const result = await db.query<ClientRow>(`
        SELECT id, name, created_at
        FROM public.clients
        WHERE owner_id = $1
        ORDER BY id DESC
        LIMIT 50
      `, [ownerId(res)]);

      res.json({ data: result.rows });
    } catch (error) {
      console.error(
        "Client query failed:",
        error instanceof Error ? error.message : "Unknown database error"
      );

      res.status(500).json({
        error: {
          code: "CLIENTS_READ_FAILED",
          message: "Unable to load clients. Please try again.",
        },
      });
    }
  });

  app.get("/clients/:id", async (req, res) => {
    const id = readClientId(req.params.id);
    if (id === null) {
      res.status(400).json({
        error: { code: "INVALID_CLIENT_ID", message: "Choose a valid client." },
      });
      return;
    }

    try {
      const result = await db.query<ClientRow>(
        "SELECT id, name, created_at FROM public.clients WHERE id = $1 AND owner_id = $2", [id, ownerId(res)]
      );
      const client = result.rows[0];
      if (!client) {
        res.status(404).json({
          error: { code: "CLIENT_NOT_FOUND", message: "Client not found. Refresh the client list." },
        });
        return;
      }
      res.json({ data: client });
    } catch (error) {
      console.error("Client query failed:", error instanceof Error ? error.message : "Unknown database error");
      res.status(500).json({
        error: { code: "CLIENTS_READ_FAILED", message: "Unable to load the client. Please try again." },
      });
    }
  });

  app.post("/clients", parseClientJson, async (req, res) => {
    if (!req.is("application/json")) {
      res.status(415).json({
        error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Send application/json." },
      });
      return;
    }

    const body: unknown = req.body;
    const name = readClientName(body);
    if (name === null) {
      res.status(400).json({ error: invalidClientName });
      return;
    }

    try {
      const result = await db.query<ClientRow>(
        `INSERT INTO public.clients (name, owner_id)
         VALUES ($1, $2)
         RETURNING id, name, created_at`,
        [name, ownerId(res)]
      );
      const client = result.rows[0];

      if (!client) {
        throw new Error("The insert returned no client");
      }

      res.status(201).json({ data: client });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23514"
      ) {
        res.status(400).json({ error: invalidClientName });
        return;
      }

      console.error(
        "Client insert failed:",
        error instanceof Error ? error.message : "Unknown database error"
      );
      res.status(500).json({
        error: {
          code: "CLIENT_CREATE_UNCONFIRMED",
          message: "Could not confirm the save. Check the client list before trying again.",
        },
      });
    }
  });

  app.patch("/clients/:id", parseClientJson, async (req, res) => {
    if (!req.is("application/json")) {
      res.status(415).json({
        error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Send application/json." },
      });
      return;
    }

    const id = readClientId(req.params.id);

    if (id === null) {
      res.status(400).json({
        error: { code: "INVALID_CLIENT_ID", message: "Choose a valid client." },
      });
      return;
    }

    const body: unknown = req.body;
    const name = readClientName(body);

    if (name === null) {
      res.status(400).json({ error: invalidClientName });
      return;
    }

    try {
      const result = await db.query<ClientRow>(
        `UPDATE public.clients
         SET name = $1
         WHERE id = $2 AND owner_id = $3
         RETURNING id, name, created_at`,
        [name, id, ownerId(res)]
      );
      const client = result.rows[0];

      if (!client) {
        res.status(404).json({
          error: {
            code: "CLIENT_NOT_FOUND",
            message: "Client not found. Refresh the client list.",
          },
        });
        return;
      }

      res.json({ data: client });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23514"
      ) {
        res.status(400).json({ error: invalidClientName });
        return;
      }

      console.error(
        "Client update failed:",
        error instanceof Error ? error.message : "Unknown database error"
      );
      res.status(500).json({
        error: {
          code: "CLIENT_UPDATE_UNCONFIRMED",
          message: "Could not confirm the update. Refresh the client list before trying again.",
        },
      });
    }
  });

  app.delete("/clients/:id", parseClientJson, async (req, res) => {
    const id = readClientId(req.params.id);

    if (id === null) {
      res.status(400).json({
        error: { code: "INVALID_CLIENT_ID", message: "Choose a valid client." },
      });
      return;
    }

    if (req.headers["content-type"] && !req.is("application/json")) {
      res.status(415).json({
        error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Send application/json." },
      });
      return;
    }

    const body: unknown = req.body;
    const confirmation = readTaskDeletionConfirmation(body);
    if (confirmation.kind === "invalid") {
      res.status(400).json({
        error: { code: "INVALID_DELETE_CONFIRMATION", message: "Refresh the page and confirm deletion again." },
      });
      return;
    }

    try {
      const result = await deleteClientWithTasks(db, id, ownerId(res), confirmation);
      if (result.kind === "missing") {
        res.status(404).json({
          error: {
            code: "CLIENT_NOT_FOUND",
            message: "Client not found. Refresh the client list.",
          },
        });
        return;
      }

      if (result.kind === "confirmation-required") {
        res.status(409).json({
          error: {
            code: "CLIENT_TASKS_CONFIRMATION_REQUIRED",
            message: "Confirm deletion of this client and their tasks.",
            taskCount: result.taskCount,
          },
        });
        return;
      }

      res.json({ data: result.client });
    } catch (error) {
      console.error(
        "Client delete failed:",
        error instanceof Error ? error.message : "Unknown database error"
      );
      res.status(500).json({
        error: {
          code: "CLIENT_DELETE_UNCONFIRMED",
          message: "Could not confirm the deletion. Refresh the client list before trying again.",
        },
      });
    }
  });

  app.use("/clients/:clientId/tasks", createTaskRoutes(db));

  app.use(requestErrorHandler);

  return app;
}
