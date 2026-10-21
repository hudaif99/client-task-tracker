import "server-only";
import { cookies } from "next/headers";

export async function sessionHeaders(): Promise<{ Cookie: string }> {
  const store = await cookies();
  // Forward only Better Auth cookies to the configured Express backend.
  return { Cookie: store.getAll()
    .filter(cookie => cookie.name.startsWith("better-auth.") || cookie.name.startsWith("__Secure-better-auth."))
    .map(cookie => `${cookie.name}=${cookie.value}`).join("; ") };
}
