import type { RequestHandler, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { AuthService } from "./auth-routes.ts";

export const frontendOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];

export function requireSession(getUser: AuthService["getUser"]): RequestHandler {
  return async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    // Cookie-authenticated writes must reject untrusted browser origins.
    // Requests without Origin remain supported for the PowerShell lessons.
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.get("origin");
      if ((origin !== undefined && !frontendOrigins.includes(origin)) ||
          req.get("sec-fetch-site") === "cross-site") {
        res.status(403).json({ error: { code: "FORBIDDEN_ORIGIN", message: "Use the application to make this change." } });
        return;
      }
    }
    try {
      const user = await getUser(fromNodeHeaders(req.headers));
      if (!user) {
        res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } });
        return;
      }
      res.locals.ownerId = user.id;
    } catch {
      console.error("Session lookup failed.");
      res.status(500).json({ error: { code: "AUTH_SESSION_FAILED", message: "Unable to check your sign-in. Please try again." } });
      return;
    }
    next();
  };
}

export function ownerId(res: Response): string {
  const id: unknown = res.locals.ownerId;
  if (typeof id !== "string" || id.length === 0) throw new Error("Missing authenticated owner");
  return id;
}
