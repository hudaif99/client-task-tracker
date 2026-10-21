"use client";

import { type FormEvent, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SessionExpired from "../../session-expired";
import { readCreateTaskResult, isDueDate } from "@/lib/tasks";
import styles from "../../create-client-form.module.css";

type FormState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; message: string; field?: "title" | "date" }
  | { kind: "success"; message: string }
  | { kind: "missing" }
  | { kind: "uncertain" };

export default function CreateTaskForm({ apiUrl, clientId }: { apiUrl: string; clientId: number }) {
  const router = useRouter();
  const [sessionExpired, setSessionExpired] = useState(false);
  const formId = useId();
  const titleId = `task-title-${clientId}-${formId}`;
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const [isRefreshing, startTransition] = useTransition();
  const submitting = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const busy = state.kind === "saving" || isRefreshing;
  const locked = sessionExpired || busy || state.kind === "uncertain" || state.kind === "missing";

  function focusTitle() {
    requestAnimationFrame(() => input.current?.focus());
  }

  function refreshTasks() {
    startTransition(() => router.refresh());
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || locked) return;
    const cleanTitle = title.trim();
    if (!cleanTitle || Array.from(cleanTitle).length > 200 || cleanTitle.includes("\0")) {
      setState({ kind: "error", message: "Enter a task title between 1 and 200 characters.", field: "title" });
      focusTitle();
      return;
    }
    const requestedDate = dueDate === "" ? null : dueDate;
    if (!isDueDate(requestedDate) || !dateInput.current?.validity.valid) {
      setState({ kind: "error", message: "Choose a valid due date, or leave it blank.", field: "date" });
      dateInput.current?.focus();
      return;
    }

    submitting.current = true;
    setState({ kind: "saving" });
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: cleanTitle, due_date: requestedDate }),
        signal: AbortSignal.timeout(10000),
      });
      if (response.status === 401) {
        setSessionExpired(true);
        setState({ kind: "idle" });
        return;
      }
      const payload: unknown = await response.json();
      const result = readCreateTaskResult(response.status, payload, clientId, cleanTitle, requestedDate);
      if (result.kind === "created") {
        setTitle("");
        setDueDate("");
        setState({ kind: "success", message: `${result.task.title} added.` });
        refreshTasks();
        focusTitle();
      } else if (result.kind === "rejected") {
        setState({ kind: "error", message: result.message });
        focusTitle();
      } else {
        setState({ kind: result.kind });
      }
    } catch {
      // A lost response can happen after the task was saved.
      setState({ kind: "uncertain" });
    } finally {
      submitting.current = false;
    }
  }

  return (
    <form className={styles.form} onSubmit={save} noValidate aria-busy={busy}>
      {sessionExpired && <SessionExpired />}
      <label className={styles.label} htmlFor={titleId}>Task title</label>
      <input ref={input} id={titleId} name="title" className={styles.input}
        value={title} onChange={(event) => {
          setTitle(event.target.value);
          setState({ kind: "idle" });
        }} required maxLength={400}
        disabled={state.kind === "saving" || state.kind === "uncertain" || state.kind === "missing"}
        aria-invalid={state.kind === "error" && state.field !== "date"}
        aria-describedby={`${titleId}-hint${state.kind === "error" ? ` ${titleId}-error` : ""}`} />
      <p id={`${titleId}-hint`}>Use 1–200 characters. New tasks start as pending.</p>
      <label className={styles.label} htmlFor={`${titleId}-due-date`}>Due date (optional)</label>
      <input ref={dateInput} id={`${titleId}-due-date`} name="due_date" type="date"
        min="0001-01-01" max="9999-12-31" className={styles.input} value={dueDate}
        disabled={locked} onChange={event => { setDueDate(event.target.value); setState({ kind: "idle" }); }}
        aria-invalid={state.kind === "error" && state.field === "date"}
        aria-describedby={`${titleId}-due-hint${state.kind === "error" ? ` ${titleId}-error` : ""}`} />
      <p id={`${titleId}-due-hint`}>Leave blank for no due date.</p>
      <button type="submit" className={styles.button} disabled={locked}>
        {state.kind === "saving" ? "Saving…" : isRefreshing ? "Updating tasks…" : "Add task"}
      </button>
      {state.kind === "saving" && <p role="status">Saving task…</p>}
      {state.kind === "success" && <p role="status">{state.message}</p>}
      {state.kind === "error" && <p id={`${titleId}-error`} role="alert">{state.message}</p>}
      {state.kind === "missing" && (
        <p role="alert">This client no longer exists. Return to the client list to choose another client.</p>
      )}
      {state.kind === "uncertain" && (
        <div className={styles.recovery}>
          <p role="alert">The save was not confirmed. This task may already exist. Refresh the task list and check before starting a new entry.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} disabled={isRefreshing} onClick={refreshTasks}>
              Refresh task list
            </button>
            <button type="button" className={styles.secondary} disabled={isRefreshing} onClick={() => {
              setTitle("");
              setDueDate("");
              setState({ kind: "idle" });
              focusTitle();
            }}>Start a new entry</button>
          </div>
        </div>
      )}
    </form>
  );
}


