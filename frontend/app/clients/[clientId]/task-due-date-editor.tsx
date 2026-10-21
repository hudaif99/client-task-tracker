"use client";

import { type FormEvent, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type Task, readDueDateResult, isDueDate } from "@/lib/tasks";
import SessionExpired from "../../session-expired";
import TaskDueIndicator from "./task-due-indicator";
import styles from "../../create-client-form.module.css";
import taskStyles from "./page.module.css";

type State = { kind: "idle" | "saving" | "saved" | "uncertain" | "missing" } | { kind: "error"; message: string };

export default function TaskDueDateEditor({ task, apiUrl }: { task: Task; apiUrl: string }) {
  const router = useRouter();
  const id = useId();
  const inputId = `due-date-${task.client_id}-${task.id}-${id}`;
  const [editing, setEditing] = useState(false);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isRefreshing, startTransition] = useTransition();
  const submitting = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const busy = state.kind === "saving" || isRefreshing;
  const locked = busy || sessionExpired || state.kind === "uncertain" || state.kind === "missing";

  function focusDate() { requestAnimationFrame(() => input.current?.focus()); }
  function close() {
    setEditing(false);
    requestAnimationFrame(() => editButton.current?.focus());
  }
  function refresh() { startTransition(() => router.refresh()); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || locked) return;
    const requestedDate = dueDate === "" ? null : dueDate;
    if (!isDueDate(requestedDate) || !input.current?.validity.valid) {
      setState({ kind: "error", message: "Choose a valid due date, or leave it blank." });
      focusDate();
      return;
    }
    submitting.current = true;
    setState({ kind: "saving" });
    try {
      const response = await fetch(`${apiUrl}/${task.id}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ due_date: requestedDate }), signal: AbortSignal.timeout(10000),
      });
      if (response.status === 401) {
        setSessionExpired(true);
        setState({ kind: "idle" });
        return;
      }
      const result = readDueDateResult(response.status, await response.json(), task.client_id, task.id, requestedDate);
      if (result.kind === "updated") {
        setState({ kind: "saved" });
        close();
        refresh();
      } else if (result.kind === "rejected") {
        setState({ kind: "error", message: result.message });
        focusDate();
      } else setState({ kind: result.kind });
    } catch {
      // The write may have committed. Preserve the draft and require a deliberate check.
      setState({ kind: "uncertain" });
    } finally { submitting.current = false; }
  }

  return <div className={taskStyles.taskEditor} aria-busy={busy}>
    {sessionExpired && <SessionExpired />}
    <div className={styles.rowHeading}>
      <p className={taskStyles.dateValue}>{task.due_date === null ? "No due date" : <>Due date: <time dateTime={task.due_date}>{task.due_date}</time></>}</p>
      <TaskDueIndicator task={{ status: task.status, due_date: task.due_date }} />
      {!editing && <button ref={editButton} type="button" className={styles.secondary}
        aria-label={`Edit due date: ${task.title}`} aria-disabled={locked} onClick={() => {
          if (submitting.current || locked) return;
          setDueDate(task.due_date ?? "");
          setState({ kind: "idle" });
          setEditing(true);
          focusDate();
        }}>Edit due date</button>}
    </div>
    {editing && <form className={styles.form} onSubmit={save} noValidate>
      <label className={styles.label} htmlFor={inputId}>Due date</label>
      <input ref={input} id={inputId} name="due_date" type="date" min="0001-01-01" max="9999-12-31"
        className={styles.input} value={dueDate} disabled={locked}
        onChange={event => { setDueDate(event.target.value); setState({ kind: "idle" }); }}
        aria-invalid={state.kind === "error"}
        aria-describedby={`${inputId}-hint${state.kind === "error" ? ` ${inputId}-error` : ""}`} />
      <p id={`${inputId}-hint`}>Leave blank for no due date.</p>
      <div className={styles.actions}>
        <button className={styles.button} type="submit" disabled={locked}>{busy ? "Saving…" : "Save due date"}</button>
        <button className={styles.secondary} type="button" disabled={locked} onClick={() => {
          // A partially typed native date can be invalid even while its value is empty.
          if (input.current) input.current.value = "";
          setDueDate(""); setState({ kind: "idle" }); focusDate();
        }}>Clear date</button>
        <button className={styles.secondary} type="button" disabled={locked} onClick={close}>Cancel</button>
      </div>
      {state.kind === "error" && <p id={`${inputId}-error`} role="alert">{state.message}</p>}
      {state.kind === "saving" && <p role="status">Saving due date…</p>}
      {state.kind === "missing" && <p role="alert">This task is no longer available. Refresh the task list.</p>}
      {state.kind === "uncertain" && <p role="alert">The save was not confirmed. Refresh the list and check the saved date. Your draft is kept here.</p>}
      {(state.kind === "uncertain" || state.kind === "missing") && <div className={styles.actions}>
        <button className={styles.secondary} type="button" disabled={isRefreshing} onClick={refresh}>Refresh task list</button>
        {state.kind === "uncertain" && <button className={styles.secondary} type="button" disabled={isRefreshing} onClick={() => {
          setState({ kind: "idle" }); focusDate();
        }}>Continue editing after checking</button>}
      </div>}
    </form>}
    {state.kind === "saved" && <p role="status">Due date saved.</p>}
  </div>;
}
