"use client";

import { type Task, taskDueNotice } from "@/lib/tasks";
import { useLocalDate } from "./local-date-provider";
import styles from "./page.module.css";

export default function TaskDueIndicator({ task }: { task: Pick<Task, "status" | "due_date"> }) {
  const notice = taskDueNotice(task, useLocalDate());
  if (notice === null) return null;
  return <span className={`${styles.dueNotice} ${notice === "Overdue" ? styles.overdue : styles.dueToday}`}>{notice}</span>;
}
