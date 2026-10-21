export type User = { id: string; name: string; email: string };

export function readUser(payload: unknown): User | null {
  if (typeof payload !== "object" || payload === null || !("data" in payload)) return null;
  const user = payload.data;
  if (typeof user !== "object" || user === null ||
      !("id" in user) || typeof user.id !== "string" || !user.id ||
      !("name" in user) || typeof user.name !== "string" ||
      !("email" in user) || typeof user.email !== "string") return null;
  return { id: user.id, name: user.name, email: user.email };
}

export function signInError(status: number): string {
  if (status === 400 || status === 401) return "Check your email and password and try again.";
  if (status === 429) return "Too many attempts. Wait a little before trying again.";
  return "Unable to sign in. Please try again later.";
}

export function validateSignUp(name: string, password: string, confirmation: string):
  { field: "name" | "password" | "confirmation"; message: string } | null {
  if (!name.trim() || name.includes("\0")) return { field: "name", message: "Enter your name." };
  // Match Better Auth's configured JavaScript string-length limits; don't trim passwords.
  if (password.length < 15 || password.length > 128) {
    return { field: "password", message: "Use a password between 15 and 128 characters." };
  }
  if (password !== confirmation) return { field: "confirmation", message: "The passwords do not match." };
  return null;
}

export function signUpError(status: number): string | null {
  if (status === 400) return "Check your name, email and password and try again.";
  if (status === 422) return "Unable to create an account with these details. Try signing in or use another email.";
  if (status === 429) return "Too many attempts. Wait a little before trying again.";
  if (status === 413) return "These details are too long. Shorten your name or email and try again.";
  // Unknown failures may happen after an account was created. Never silently retry.
  return null;
}
