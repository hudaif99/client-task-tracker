"use client";

import { type FormEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SessionExpired from "./session-expired";
import { readCreateClientResult } from "@/lib/clients";
import styles from "./create-client-form.module.css";

type FormState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string }
  | { kind: "uncertain" };

export default function CreateClientForm({ apiUrl }: { apiUrl: string }) {
  const router = useRouter();
  const [sessionExpired, setSessionExpired] = useState(false);
  const [name, setName] = useState("");
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const [isRefreshing, startTransition] = useTransition();
  const submitting = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isBusy = state.kind === "saving" || isRefreshing;
  const isLocked = sessionExpired || isBusy || state.kind === "uncertain";

  function focusName() {
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function refreshList() {
    startTransition(() => router.refresh());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting.current || isLocked) return;

    const cleanName = name.trim();

    if (!cleanName || Array.from(cleanName).length > 120 || cleanName.includes("\0")) {
      setState({ kind: "error", message: "Enter a client name between 1 and 120 characters." });
      focusName();
      return;
    }

    // Block a second submit immediately, before React updates the button.
    submitting.current = true;
    setState({ kind: "saving" });

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: cleanName }),
        signal: AbortSignal.timeout(10000),
      });
      if (response.status === 401) {
        setSessionExpired(true);
        setState({ kind: "idle" });
        return;
      }
      const payload: unknown = await response.json();
      const result = readCreateClientResult(response.status, payload);

      if (result.kind === "created") {
        setName("");
        setState({ kind: "success", message: `${result.client.name} added.` });
        refreshList();
        focusName();
      } else if (result.kind === "rejected") {
        setState({ kind: "error", message: result.message });
        focusName();
      } else {
        setState({ kind: "uncertain" });
      }
    } catch {
      setState({ kind: "uncertain" });
    } finally {
      submitting.current = false;
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate aria-busy={isBusy}>
      {sessionExpired && <SessionExpired />}
      <label htmlFor="client-name" className={styles.label}>Client name</label>
      <input
        ref={inputRef}
        id="client-name"
        name="name"
        className={styles.input}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setState({ kind: "idle" });
        }}
        disabled={state.kind === "saving" || state.kind === "uncertain"}
        required
        maxLength={240}
        autoComplete="organization"
        aria-invalid={state.kind === "error"}
        aria-describedby={state.kind === "error" ? "client-name-hint client-form-error" : "client-name-hint"}
      />
      <p id="client-name-hint">Use 1–120 characters.</p>
      <button type="submit" className={styles.button} disabled={isLocked}>
        {state.kind === "saving" ? "Saving…" : isRefreshing ? "Updating list…" : "Add client"}
      </button>

      {state.kind === "saving" && <p role="status">Saving client…</p>}
      {state.kind === "success" && <p role="status">{state.message}</p>}
      {state.kind === "error" && <p id="client-form-error" role="alert">{state.message}</p>}
      {state.kind === "uncertain" && (
        <div className={styles.recovery}>
          <p role="alert">
            The save was not confirmed. This client may already exist. Refresh the list and check before starting a new entry.
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={refreshList} disabled={isRefreshing}>
              Refresh client list
            </button>
            <button type="button" className={styles.secondary} disabled={isRefreshing} onClick={() => {
              setName("");
              setState({ kind: "idle" });
              focusName();
            }}>
              Start a new entry
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

