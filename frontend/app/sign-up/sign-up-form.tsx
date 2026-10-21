"use client";

import { type FormEvent, useRef, useState } from "react";
import { readUser, signUpError, validateSignUp } from "@/lib/auth";
import styles from "../create-client-form.module.css";

export default function SignUpForm({ apiOrigin }: { apiOrigin: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const submitting = useRef(false);
  const navigating = useRef(false);
  const form = useRef<HTMLFormElement>(null);

  function clearPasswords() {
    setPassword("");
    setConfirmation("");
  }

  async function checkSession() {
    const response = await fetch(`${apiOrigin}/api/me`, {
      credentials: "include", cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (response.status === 401) return false;
    const user = response.ok ? readUser(await response.json()) : null;
    if (!user || user.email.toLowerCase() !== email.trim().toLowerCase()) throw new Error("Session not confirmed");
    clearPasswords();
    navigating.current = true;
    window.location.replace("/");
    return true;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || uncertain) return;
    const invalid = validateSignUp(name, password, confirmation);
    if (invalid) {
      setMessage(invalid.message);
      setInvalidField(invalid.field);
      form.current?.querySelector<HTMLInputElement>(`[name="${invalid.field}"]`)?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    setMessage("");
    setInvalidField(null);
    try {
      const response = await fetch(`${apiOrigin}/api/auth/sign-up/email`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
        signal: AbortSignal.timeout(10000),
      });
      // Auth responses can contain tokens. Confirm only the public /api/me identity.
      if (!response.ok) {
        const rejected = signUpError(response.status);
        if (!rejected) throw new Error("Account creation not confirmed");
        setMessage(rejected);
        return;
      }
      if (!await checkSession()) throw new Error("Session missing");
    } catch {
      clearPasswords();
      setUncertain(true);
      setMessage("Account creation was not confirmed. The account may already exist. Check your session or try signing in with the same email.");
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
        // A missing session doesn't prove that account creation failed.
        setMessage("You are signed out. Try signing in with the email and password you used here to check whether the account was created.");
      }
    } catch {
      setMessage("Unable to confirm your session. Check your connection, then check again or try signing in with the same email.");
    } finally {
      if (!navigating.current) {
        submitting.current = false;
        setBusy(false);
      }
    }
  }

  const locked = busy || uncertain;
  return <form ref={form} className={styles.form} onSubmit={submit} aria-busy={busy}>
    <label className={styles.label} htmlFor="sign-up-name">Name</label>
    <input id="sign-up-name" name="name" autoComplete="name" required className={styles.input}
      value={name} onChange={event => setName(event.target.value)} disabled={locked}
      aria-invalid={invalidField === "name"} aria-describedby={invalidField === "name" ? "sign-up-message" : undefined} />
    <label className={styles.label} htmlFor="sign-up-email">Email</label>
    <input id="sign-up-email" name="email" type="email" autoComplete="username" required className={styles.input}
      value={email} onChange={event => setEmail(event.target.value)} disabled={locked} />
    <label className={styles.label} htmlFor="sign-up-password">Password</label>
    <input id="sign-up-password" name="password" type="password" autoComplete="new-password" required
      className={styles.input} value={password} onChange={event => setPassword(event.target.value)}
      disabled={locked} aria-invalid={invalidField === "password"}
      aria-describedby={`sign-up-password-hint${invalidField === "password" ? " sign-up-message" : ""}`} />
    <p id="sign-up-password-hint">Use 6–128 characters.</p>
    <label className={styles.label} htmlFor="sign-up-confirmation">Confirm password</label>
    <input id="sign-up-confirmation" name="confirmation" type="password" autoComplete="new-password" required
      className={styles.input} value={confirmation} onChange={event => setConfirmation(event.target.value)}
      disabled={locked} aria-invalid={invalidField === "confirmation"}
      aria-describedby={invalidField === "confirmation" ? "sign-up-message" : undefined} />
    <button className={styles.button} type="submit" disabled={locked}>{busy ? "Checking account…" : "Create account"}</button>
    {message && <p id="sign-up-message" role="alert">{message}</p>}
    {uncertain && <button className={styles.secondary} type="button" onClick={recover} disabled={busy}>Check session</button>}
    <p>Already have an account? <a className={styles.taskLink} href="/sign-in">Sign in</a></p>
    {busy && <p role="status">Checking account…</p>}
  </form>;
}
