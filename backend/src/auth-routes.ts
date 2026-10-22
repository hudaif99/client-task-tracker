import express from "express";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";

type SessionUser = { id: string; name: string; email: string };
export type AuthService = {
  handler: (request: Request) => Promise<Response>;
  getUser: (headers: Headers) => Promise<SessionUser | null>;
};

export function createAuthRoutes(service: AuthService) {
  const routes = express.Router();
  routes.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    // Express uses the socket unless loopback-proxy trust is explicitly enabled.
    // Never pass the caller's internal rate-limit header through to Better Auth.
    delete req.headers["x-tracker-client-ip"];
    const clientIp = req.ip ?? req.socket.remoteAddress;
    if (clientIp) req.headers["x-tracker-client-ip"] = clientIp;
    next();
  });

  // The installed 1.7.11 Node adapter supports parsed JSON bodies. Limit these
  // requests before hashing passwords; tests cover this adapter boundary.
  routes.all("/auth/*splat", (req, res, next) => {
    const hasBody = req.headers["transfer-encoding"] !== undefined || Number(req.headers["content-length"] ?? 0) > 0;
    if (hasBody && !req.is("application/json")) {
      res.status(415).json({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Send application/json." } });
      return;
    }
    next();
  }, express.json({ limit: "2kb", strict: false }), toNodeHandler(service.handler));

  routes.get("/me", async (req, res) => {
    try {
      const user = await service.getUser(fromNodeHeaders(req.headers));
      if (!user) {
        res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } });
        return;
      }
      res.json({ data: { id: user.id, name: user.name, email: user.email } });
    } catch {
      console.error("Session lookup failed.");
      res.status(500).json({ error: { code: "AUTH_SESSION_FAILED", message: "Unable to check your sign-in. Please try again." } });
    }
  });

  return routes;
}
