import type { BetterAuthOptions } from "better-auth";
import type { Pool } from "pg";

export function createAuthOptions(database: Pool, env: NodeJS.ProcessEnv) {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32 || secret.trim() !== secret) {
    throw new Error("Set BETTER_AUTH_SECRET to a private random value of at least 32 characters.");
  }

  let url: URL;
  try {
    url = new URL(env.BETTER_AUTH_URL ?? "");
  } catch {
    throw new Error("Set BETTER_AUTH_URL to http://127.0.0.1:4000 for local development.");
  }
  if (url.href !== "http://127.0.0.1:4000/") {
    throw new Error("Set BETTER_AUTH_URL to http://127.0.0.1:4000 for local development.");
  }

  return {
    appName: "Client & Task Tracker",
    database,
    secret,
    baseURL: url.origin,
    trustedOrigins: ["http://127.0.0.1:3000"],
    advanced: { ipAddress: { ipAddressHeaders: ["x-tracker-client-ip"] } },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 15,
      maxPasswordLength: 128,
      // Local lesson only: add verification and password-reset delivery before public sign-ups.
      requireEmailVerification: false,
    },
    user: { modelName: "auth_user" },
    session: { modelName: "auth_session" },
    account: { modelName: "auth_account" },
    verification: { modelName: "auth_verification" },
    // One local process; choose shared counter storage before running multiple instances.
    rateLimit: { enabled: true, storage: "memory" },
  } satisfies BetterAuthOptions;
}
