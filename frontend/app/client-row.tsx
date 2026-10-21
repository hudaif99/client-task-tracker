"use client";

import { type FormEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SessionExpired from "./session-expired";
import Link from "next/link";
import { type Client, readUpdateClientResult, readDeleteClientResult } from "@/lib/clients";
import styles from "./create-client-form.module.css";
import directoryStyles from "./page.module.css";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string }
  | { kind: "uncertain" };

export default function ClientRow({ client, apiUrl }: { client: Client; apiUrl: string }) {
  const router = useRouter();
  const [sessionExpired, setSessionExpired] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [taskCountToDelete, setTaskCountToDelete] = useState<number | null>(null);
  const [deleteState, setDeleteState] = useState<"idle" | "deleting" | "uncertain" | "deleted" | "missing">("idle");
  const [name, setName] = useState(client.name);
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const [isRefreshing, startTransition] = useTransition();
  const submitting = useRef(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const cancelDeleteButton = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const busy = state.kind === "saving" || deleteState === "deleting" || isRefreshing;
  const locked = sessionExpired || busy || state.kind === "uncertain";
  const inputId = `edit-client-${client.id}`;

  function refreshList() {
    startTransition(() => router.refresh());
  }

  function closeEditor() {
    setEditing(false);
    requestAnimationFrame(() => editButton.current?.focus());
  }

  function closeDeleteConfirmation() {
    setConfirmingDelete(false);
    requestAnimationFrame(() => deleteButton.current?.focus());
  }

  async function deleteClient() {
    if (sessionExpired || submitting.current || busy || deleteState !== "idle") return;
    submitting.current = true;
    setDeleteState("deleting");
    try {
      const response = await fetch(`${apiUrl}/${client.id}`, {
        method: "DELETE",
        ...(taskCountToDelete === null ? {} : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmTaskDeletion: true, expectedTaskCount: taskCountToDelete }),
        }),
        credentials: "include",
        signal: AbortSignal.timeout(10000),
      });
      if (response.status === 401) {
        setSessionExpired(true);
        setState({ kind: "idle" });
        setDeleteState("idle");
        return;
      }
      const payload: unknown = await response.json();
      const result = readDeleteClientResult(response.status, payload, client.id);
      if (result.kind === "confirmation-required") {
        setTaskCountToDelete(result.taskCount);
        setDeleteState("idle");
        requestAnimationFrame(() => cancelDeleteButton.current?.focus());
        return;
      }
      setDeleteState(result.kind);
      if (result.kind !== "uncertain") {
        // Keep keyboard focus on the page when this row disappears.
        document.getElementById("clients-heading")?.focus();
        refreshList();
      }
    } catch {
      setDeleteState("uncertain");
    } finally {
      submitting.current = false;
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || locked) return;
    const cleanName = name.trim();
    if (!cleanName || Array.from(cleanName).length > 120 || cleanName.includes("\0")) {
      setState({ kind: "error", message: "Enter a client name between 1 and 120 characters." });
      input.current?.focus();
      return;
    }

    submitting.current = true;
    setState({ kind: "saving" });
    try {
      const response = await fetch(`${apiUrl}/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: cleanName }),
        signal: AbortSignal.timeout(10000),
      });
      if (response.status === 401) {
        setSessionExpired(true);
        setState({ kind: "idle" });
        setDeleteState("idle");
        return;
      }
      const payload: unknown = await response.json();
      const result = readUpdateClientResult(response.status, payload, client.id, cleanName);
      if (result.kind === "updated") {
        setState({ kind: "success", message: `Name changed to ${result.client.name}.` });
        closeEditor();
        refreshList();
      } else if (result.kind === "rejected") {
        setState({ kind: "error", message: result.message });
        requestAnimationFrame(() => input.current?.focus());
      } else {
        setState({ kind: "uncertain" });
      }
    } catch {
      // A lost response does not tell us whether the database saved the name.
      setState({ kind: "uncertain" });
    } finally {
      submitting.current = false;
    }
  }

  return (
    <li className={styles.clientRow}>
      {sessionExpired && <SessionExpired />}
      {deleteState === "deleted" || deleteState === "missing" ? (
        <div>
          <p role="status">
            {deleteState === "deleted" ? `${client.name} deleted.` : "This client was already removed."}
          </p>
          <button type="button" className={styles.secondary} disabled={isRefreshing} onClick={refreshList}>
            {isRefreshing ? "Updating list…" : "Refresh client list"}
          </button>
        </div>
      ) : <>
      <div className={`${styles.rowHeading} ${directoryStyles.clientHeading}`}>
        <div className={directoryStyles.clientIdentity}>
          <span className={directoryStyles.clientInitial} aria-hidden="true">{Array.from(client.name.trim())[0]?.toLocaleUpperCase()}</span>
          <span className={directoryStyles.clientName}>{client.name}</span>
        </div>
        {!editing && !confirmingDelete && (<>
          <Link href={`/clients/${client.id}`} className={`${styles.taskLink} ${directoryStyles.viewTasks}`} aria-label={`Tasks for ${client.name}`}>View tasks</Link>
          <button ref={editButton} type="button" className={styles.secondary}
            aria-label={`Edit ${client.name}`} aria-disabled={busy || sessionExpired} onClick={() => {
              if (busy || sessionExpired) return;
              setName(client.name);
              setState({ kind: "idle" });
              setEditing(true);
              requestAnimationFrame(() => input.current?.focus());
            }}>Edit</button>
          <button ref={deleteButton} type="button" className={`${styles.secondary} ${directoryStyles.deleteAction}`}
            aria-label={`Delete ${client.name}`} aria-disabled={busy || sessionExpired} onClick={() => {
              if (busy || sessionExpired) return;
              setDeleteState("idle");
              setTaskCountToDelete(null);
              setState({ kind: "idle" });
              setConfirmingDelete(true);
              requestAnimationFrame(() => cancelDeleteButton.current?.focus());
            }}>Delete</button>
        </>)}
      </div>
      {confirmingDelete && (
        <div className={styles.confirmation} role="group" aria-labelledby={`delete-client-${client.id}`} aria-busy={busy}>
          <p id={`delete-client-${client.id}`}>Delete “{client.name}”? This permanently removes the client and cannot be undone.</p>
          {taskCountToDelete !== null && (
            <p role="alert">
              {taskCountToDelete > 0
                ? `This client has ${taskCountToDelete} ${taskCountToDelete === 1 ? "task" : "tasks"}. Deleting this client will also permanently delete all of these tasks. Confirm again to continue.`
                : "The task count changed. This client now has no tasks. Review and confirm deletion again."}
            </p>
          )}
          <div className={styles.actions}>
            <button ref={cancelDeleteButton} type="button" className={styles.secondary}
              disabled={busy} onClick={closeDeleteConfirmation}>
              {deleteState === "uncertain" ? "Close confirmation" : "Cancel"}
            </button>
            <button type="button" className={`${styles.button} ${directoryStyles.dangerButton}`}
              disabled={sessionExpired || busy || deleteState === "uncertain"} onClick={deleteClient}>
              {deleteState === "deleting" ? "Deleting…" : taskCountToDelete !== null && taskCountToDelete > 0 ? "Delete client and tasks" : "Delete permanently"}
            </button>
          </div>
          {deleteState === "deleting" && <p role="status">Deleting client…</p>}
          {deleteState === "uncertain" && (
            <div>
              <p role="alert">The deletion was not confirmed. Refresh the list to check whether this client still exists before trying again.</p>
              <button type="button" className={styles.secondary} disabled={isRefreshing} onClick={refreshList}>
                {isRefreshing ? "Updating list…" : "Refresh client list"}
              </button>
            </div>
          )}
        </div>
      )}
      {editing && (
        <form className={styles.form} onSubmit={save} noValidate aria-busy={busy}>
          <label htmlFor={inputId} className={styles.label}>Client name</label>
          <input ref={input} id={inputId} name="name" className={styles.input}
            value={name} onChange={(event) => {
              setName(event.target.value);
              setState({ kind: "idle" });
            }} required maxLength={240} disabled={locked}
            aria-invalid={state.kind === "error"}
            aria-describedby={`${inputId}-hint${state.kind === "error" ? ` ${inputId}-error` : ""}`} />
          <p id={`${inputId}-hint`}>Use 1–120 characters.</p>
          <div className={styles.actions}>
            <button type="submit" className={styles.button} disabled={locked}>
              {state.kind === "saving" ? "Saving…" : "Save name"}
            </button>
            <button type="button" className={styles.secondary} disabled={busy} onClick={closeEditor}>
              {state.kind === "uncertain" ? "Close editor" : "Cancel"}
            </button>
          </div>
          {state.kind === "saving" && <p role="status">Saving name…</p>}
          {state.kind === "error" && <p id={`${inputId}-error`} role="alert">{state.message}</p>}
          {state.kind === "uncertain" && (
            <div>
              <p role="alert">The update was not confirmed. Refresh the list to check the saved name before editing again.</p>
              <button type="button" className={styles.secondary} disabled={isRefreshing} onClick={refreshList}>
                {isRefreshing ? "Updating list…" : "Refresh client list"}
              </button>
            </div>
          )}
        </form>
      )}
      {state.kind === "success" && <p role="status">{state.message}</p>}
      </>}
    </li>
  );
}


