import type { BetterAuthOptions } from "better-auth";
import type { Pool } from "pg";
import { readDeploymentOptions } from "./deployment-options.ts";

export function createAuthOptions(database: Pool, env: NodeJS.ProcessEnv) {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32 || secret.trim() !== secret) {
    throw new Error("Set BETTER_AUTH_SECRET to a private random value of at least 32 characters.");
  }

  const deployment = readDeploymentOptions(env);

  return {
    appName: "Client & Task Tracker",
    database,
    secret,
    baseURL: deployment.authOrigin,
    trustedOrigins: deployment.trustedAuthOrigins,
    advanced: { ipAddress: { ipAddressHeaders: ["x-tracker-client-ip"] } },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      maxPasswordLength: 128,
      // Practice signup remains open by choice; add email delivery before real-user use.
      requireEmailVerification: false,
    },
    user: { modelName: "auth_user" },
    session: { modelName: "auth_session" },
    account: { modelName: "auth_account" },
    verification: { modelName: "auth_verification" },
    // One backend process; choose shared counter storage before running multiple instances.
    rateLimit: { enabled: true, storage: "memory" },
  } satisfies BetterAuthOptions;
}
