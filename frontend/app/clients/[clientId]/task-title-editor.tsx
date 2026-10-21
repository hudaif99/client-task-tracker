"use client";

import { type FormEvent, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SessionExpired from "../../session-expired";
import { type Task, readRenameTaskResult } from "@/lib/tasks";
import styles from "../../create-client-form.module.css";

type SaveState =
  | { kind: "idle" | "saving" | "saved" | "uncertain" | "missing" }
  | { kind: "error"; message: string };

export default function TaskTitleEditor({ task, apiUrl }: { task: Task; apiUrl: string }) {
  const router = useRouter();
  const [sessionExpired, setSessionExpired] = useState(false);
  const formId = useId();
  const inputId = `edit-task-${task.client_id}-${task.id}-${formId}`;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const [isRefreshing, startTransition] = useTransition();
  const submitting = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const busy = state.kind === "saving" || isRefreshing;
  const locked = sessionExpired || busy || state.kind === "uncertain" || state.kind === "missing";

  function focusTitle() {
    requestAnimationFrame(() => input.current?.focus());
  }

  function closeEditor() {
    setEditing(false);
    requestAnimationFrame(() => editButton.current?.focus());
  }

  function refreshTasks() {
    startTransition(() => router.refresh());
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || locked) return;
    const cleanTitle = title.trim();
    if (!cleanTitle || Array.from(cleanTitle).length > 200 || cleanTitle.includes("\0")) {
      setState({ kind: "error", message: "Enter a task title between 1 and 200 characters." });
      focusTitle();
      return;
    }

    submitting.current = true;
    setState({ kind: "saving" });
    try {
      const response = await fetch(`${apiUrl}/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: cleanTitle }),
        signal: AbortSignal.timeout(10000),
      });
      if (response.status === 401) {
        setSessionExpired(true);
        setState({ kind: "idle" });
        return;
      }
      const payload: unknown = await response.json();
      const result = readRenameTaskResult(response.status, payload, task.client_id, task.id, cleanTitle);
      if (result.kind === "updated") {
        setState({ kind: "saved" });
        closeEditor();
        refreshTasks();
      } else if (result.kind === "rejected") {
        setState({ kind: "error", message: result.message });
        focusTitle();
      } else {
        setState({ kind: result.kind });
      }
    } catch {
      // The title may have been saved before the response was lost.
      setState({ kind: "uncertain" });
    } finally {
      submitting.current = false;
    }
  }

  return (
    <div aria-busy={busy}>
      {sessionExpired && <SessionExpired />}
      <div className={styles.rowHeading}>
        <span>{task.title}</span>
        {!editing && (
          <button ref={editButton} type="button" className={styles.secondary}
            aria-label={`Edit title: ${task.title}`} aria-disabled={locked} onClick={() => {
              if (submitting.current || locked) return;
              setTitle(task.title);
              setState({ kind: "idle" });
              setEditing(true);
              focusTitle();
            }}>Edit</button>
        )}
      </div>
      {editing && (
        <form className={styles.form} onSubmit={save} noValidate>
          <label className={styles.label} htmlFor={inputId}>Task title</label>
          <input ref={input} id={inputId} name="title" className={styles.input}
            value={title} onChange={(event) => {
              setTitle(event.target.value);
              setState({ kind: "idle" });
            }} required maxLength={400} disabled={locked}
            aria-invalid={state.kind === "error"}
            aria-describedby={`${inputId}-hint${state.kind === "error" ? ` ${inputId}-error` : ""}`} />
          <p id={`${inputId}-hint`}>Use 1–200 characters.</p>
          <div className={styles.actions}>
            <button type="submit" className={styles.button} disabled={locked}>
              {state.kind === "saving" ? "Saving…" : isRefreshing ? "Updating tasks…" : "Save title"}
            </button>
            <button type="button" className={styles.secondary} disabled={locked} onClick={closeEditor}>Cancel</button>
          </div>
          {state.kind === "saving" && <p role="status">Saving task title…</p>}
          {state.kind === "error" && <p id={`${inputId}-error`} role="alert">{state.message}</p>}
          {state.kind === "missing" && <p role="alert">This task is no longer available for this client. Refresh the task list.</p>}
          {state.kind === "uncertain" && (
            <p role="alert">The update was not confirmed. Refresh the task list and check the saved title before editing again. Your draft is kept below the saved title.</p>
          )}
          {(state.kind === "uncertain" || state.kind === "missing") && (
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} disabled={isRefreshing} onClick={refreshTasks}>Refresh task list</button>
              {state.kind === "uncertain" && (
                <button type="button" className={styles.secondary} disabled={isRefreshing} onClick={() => {
                  setState({ kind: "idle" });
                  focusTitle();
                }}>Continue editing after checking</button>
              )}
            </div>
          )}
        </form>
      )}
      {state.kind === "saved" && <p role="status">Task title saved.</p>}
    </div>
  );
}


