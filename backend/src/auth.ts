import { betterAuth } from "better-auth";
import { createAuthOptions } from "./auth-options.ts";
import { db } from "./db.ts";

export const auth = betterAuth(createAuthOptions(db, process.env));
