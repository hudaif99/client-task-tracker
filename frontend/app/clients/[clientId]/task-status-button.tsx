"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SessionExpired from "../../session-expired";
import { type Task, type TaskFilter, readUpdateTaskResult } from "@/lib/tasks";
import styles from "../../create-client-form.module.css";

type UpdateState = "idle" | "saving" | "updated" | "missing" | "rejected" | "uncertain";

export default function TaskStatusButton({ task, apiUrl, filter }: { task: Task; apiUrl: string; filter: TaskFilter }) {
  const router = useRouter();
  const [sessionExpired, setSessionExpired] = useState(false);
  const [state, setState] = useState<UpdateState>("idle");
  const [isRefreshing, startTransition] = useTransition();
  const submitting = useRef(false);
  const button = useRef<HTMLButtonElement>(null);
  const busy = state === "saving" || isRefreshing;
  const locked = sessionExpired || busy || state === "uncertain" || state === "missing" || state === "rejected";
  const nextStatus = task.status === "pending" ? "completed" : "pending";
  const label = nextStatus === "completed" ? "Mark completed" : "Mark pending";

  function refreshTasks() {
    startTransition(() => router.refresh());
  }

  async function updateStatus() {
    if (submitting.current || locked) return;
    submitting.current = true;
    setState("saving");
    try {
      const response = await fetch(`${apiUrl}/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
        signal: AbortSignal.timeout(10000),
      });
      if (response.status === 401) {
        setSessionExpired(true);
        setState("idle");
        return;
      }
      const payload: unknown = await response.json();
      const result = readUpdateTaskResult(response.status, payload, task.client_id, task.id, nextStatus);
      setState(result.kind);
      if (result.kind === "updated") {
        if (filter !== "all" && nextStatus !== filter) {
          // Keep focus on the list when this task leaves the selected filter.
          document.getElementById(`tasks-heading-${task.client_id}`)?.focus();
        }
        refreshTasks();
      }
    } catch {
      // Check the saved status before sending another change.
      setState("uncertain");
    } finally {
      submitting.current = false;
    }
  }

  return (
    <div aria-busy={busy}>
      {sessionExpired && <SessionExpired />}
      <button ref={button} type="button" className={styles.secondary}
        aria-label={state === "saving" ? `Saving status for ${task.title}` : `${label}: ${task.title}`}
        aria-disabled={locked} onClick={updateStatus}>
        {state === "saving" ? "Saving…" : isRefreshing ? "Updating tasks…" : label}
      </button>
      {state === "saving" && <p role="status">Saving task status…</p>}
      {state === "updated" && <p role="status">Task status saved.</p>}
      {state === "missing" && <p role="alert">This task is no longer available for this client. Refresh the task list.</p>}
      {state === "rejected" && <p role="alert">The status change was not accepted. Refresh the task list before trying again.</p>}
      {state === "uncertain" && <p role="alert">The update was not confirmed. Refresh the task list and check the saved status before making another change.</p>}
      {(state === "uncertain" || state === "missing" || state === "rejected") && (
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} disabled={isRefreshing} onClick={refreshTasks}>
            Refresh task list
          </button>
          {state !== "missing" && (
            <button type="button" className={styles.secondary} disabled={isRefreshing} onClick={() => {
              setState("idle");
              requestAnimationFrame(() => button.current?.focus());
            }}>Continue after checking</button>
          )}
        </div>
      )}
    </div>
  );
}


