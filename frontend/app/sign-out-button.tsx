"use client";

import { useRef, useState } from "react";
import { readUser } from "@/lib/auth";
import styles from "./create-client-form.module.css";

export default function SignOutButton({ apiOrigin }: { apiOrigin: string }) {
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  async function signOut() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    let navigating = false;
    try {
      if (!uncertain) {
        const response = await fetch(`${apiOrigin}/api/auth/sign-out`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: "{}", signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error("Sign-out not confirmed");
      }
      const response = await fetch(`${apiOrigin}/api/me`, {
        credentials: "include", cache: "no-store", signal: AbortSignal.timeout(10000),
      });
      if (response.status === 401) {
        // Drop the client router cache, including pages from this account.
        navigating = true;
        window.location.replace("/sign-in");
        return;
      }
      if (!response.ok || !readUser(await response.json())) throw new Error("Session not confirmed");
      setUncertain(false);
      setMessage("You are still signed in. Try signing out again.");
    } catch {
      setUncertain(true);
      setMessage("Sign-out was not confirmed. Check your session before trying again.");
    } finally {
      if (!navigating) {
        submitting.current = false;
        setBusy(false);
      }
    }
  }
  return <div className={styles.signOut}>
    <button className={styles.secondary} type="button" disabled={busy} onClick={signOut}>
      {busy ? "Checking session…" : uncertain ? "Check sign-out" : "Sign out"}
    </button>
    {message && <p role="alert">{message}</p>}
  </div>;
}
