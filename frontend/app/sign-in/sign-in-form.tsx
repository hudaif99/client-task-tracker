"use client";

import { type FormEvent, useRef, useState } from "react";
import { readUser, signInError } from "@/lib/auth";
import styles from "../create-client-form.module.css";

export default function SignInForm({ apiOrigin }: { apiOrigin: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const submitting = useRef(false);
  const navigating = useRef(false);
  const passwordInput = useRef<HTMLInputElement>(null);

  async function checkSession() {
    const response = await fetch(`${apiOrigin}/api/me`, {
      credentials: "include", cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (response.status === 401) return false;
    const user = response.ok ? readUser(await response.json()) : null;
    if (!user || user.email.toLowerCase() !== email.trim().toLowerCase()) throw new Error("Session not confirmed");
    setPassword("");
    // A full navigation removes pages preserved under a previous identity.
    navigating.current = true;
    window.location.replace("/");
    return true;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || uncertain) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${apiOrigin}/api/auth/sign-in/email`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }), signal: AbortSignal.timeout(10000),
      });
      // Auth responses may contain a token. Do not store, log, or render them.
      if (!response.ok) {
        if (response.status >= 500) throw new Error("Sign-in not confirmed");
        setMessage(signInError(response.status));
        requestAnimationFrame(() => passwordInput.current?.focus());
        return;
      }
      if (!await checkSession()) throw new Error("Session missing");
    } catch {
      setPassword("");
      setUncertain(true);
      setMessage("Sign-in was not confirmed. Check your session before trying again.");
    } finally {
      if (!navigating.current) {
        submitting.current = false;
        setBusy(false);
      }
    }
  }

  async function recover() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      if (!await checkSession()) {
        setUncertain(false);
        setMessage("You are signed out. Enter your password and try again.");
        requestAnimationFrame(() => passwordInput.current?.focus());
      }
    } catch {
      setMessage("Unable to check your session. Check your connection and try again.");
    } finally {
      if (!navigating.current) {
        submitting.current = false;
        setBusy(false);
      }
    }
  }

  return <form className={styles.form} onSubmit={submit} aria-busy={busy}>
    <label className={styles.label} htmlFor="sign-in-email">Email</label>
    <input id="sign-in-email" name="email" type="email" autoComplete="username" required
      className={styles.input} value={email} onChange={event => setEmail(event.target.value)}
      disabled={busy || uncertain} />
    <label className={styles.label} htmlFor="sign-in-password">Password</label>
    <input ref={passwordInput} id="sign-in-password" name="password" type="password" autoComplete="current-password"
      required maxLength={128} className={styles.input} value={password}
      onChange={event => setPassword(event.target.value)} disabled={busy || uncertain}
      aria-describedby={message ? "sign-in-message" : undefined} />
    <button className={styles.button} type="submit" disabled={busy || uncertain}>{busy ? "Signing in…" : "Sign in"}</button>
    {message && <p id="sign-in-message" role="alert">{message}</p>}
    {uncertain && <button className={styles.secondary} type="button" disabled={busy} onClick={recover}>Check session</button>}
    {busy && <p role="status">Checking sign-in…</p>}
  </form>;
}
