import { type User } from "@/lib/auth";
import SignOutButton from "./sign-out-button";

export default function Account({ user, apiOrigin }: { user: User; apiOrigin: string }) {
  return <section aria-label="Your account" style={{ overflowWrap: "anywhere" }}>
    <p>Signed in as {user.email}</p>
    <SignOutButton apiOrigin={apiOrigin} />
  </section>;
}
