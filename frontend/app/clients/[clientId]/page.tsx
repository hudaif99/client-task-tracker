import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { sessionHeaders } from "@/lib/server-session";
import { readUser, type User } from "@/lib/auth";
import Account from "../../account";
import { getClientsUrl, getBrowserClientsUrl, getBrowserApiOrigin } from "@/lib/backend-url";
import { type Client, isClient } from "@/lib/clients";
import { type Task, type TaskFilter, readTaskClientId, readTaskFilter, readTaskCursor, getTaskQuery, readTaskPage } from "@/lib/tasks";
import CreateTaskForm from "./create-task-form";
import TaskStatusButton from "./task-status-button";
import TaskTitleEditor from "./task-title-editor";
import TaskDueDateEditor from "./task-due-date-editor";
import LocalDateProvider from "./local-date-provider";
import styles from "./page.module.css";
import workspace from "../../workspace.module.css";

type PageProps = {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const filters: { value: TaskFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
];

async function ClientTasks({ params, searchParams }: PageProps) {
  await connection();
  const { clientId: rawId } = await params;
  const clientId = readTaskClientId(rawId);
  if (clientId === null) notFound();
  const queryParams = await searchParams;
  const filter = readTaskFilter(queryParams.status);
  const pageUrl = `/clients/${clientId}`;
  if (filter === null) {
    return (
      <section className={workspace.notice}>
        <h1 className={styles.heading}>Client tasks</h1>
        <p role="alert">Choose a valid task filter: All, Pending, or Completed.</p>
        <Link className={styles.link} href={pageUrl}>Show all tasks</Link>
      </section>
    );
  }
  const beforeId = readTaskCursor(queryParams.before);
  if (beforeId === null) {
    return (
      <section className={workspace.notice}>
        <h1 className={styles.heading}>Client tasks</h1>
        <p role="alert">This task page is invalid. Return to the newest tasks.</p>
        <Link className={styles.link} href={`${pageUrl}${getTaskQuery(filter)}`}>Newest tasks</Link>
      </section>
    );
  }
  const query = getTaskQuery(filter, beforeId);

  let client: Client | undefined;
  let tasks: Task[] = [];
  let nextBeforeId: number | null = null;
  let apiUrl = "";
  let apiOrigin = "";
  let missing = false;
  let signedOut = false;
  let user: User | null = null;
  try {
    const clientUrl = `${getClientsUrl()}/${clientId}`;
    apiUrl = `${getBrowserClientsUrl()}/${clientId}/tasks`;
    apiOrigin = getBrowserApiOrigin();
    const headers = await sessionHeaders();
    const [clientResponse, tasksResponse, identity] = await Promise.all([
      fetch(clientUrl, { headers, cache: "no-store", signal: AbortSignal.timeout(5000) }),
      fetch(`${clientUrl}/tasks${query}`, { headers, cache: "no-store", signal: AbortSignal.timeout(5000) }),
      fetch(new URL("/api/me", clientUrl), { headers, cache: "no-store", signal: AbortSignal.timeout(5000) }),
    ]);

    if (clientResponse.status === 401 || tasksResponse.status === 401 || identity.status === 401) {
      signedOut = true;
    } else if (clientResponse.status === 404 || tasksResponse.status === 404) {
      missing = true;
    } else {
      if (!clientResponse.ok || !tasksResponse.ok || !identity.ok) throw new Error("Client or task request failed");
      user = readUser(await identity.json());
      if (!user) throw new Error("Unexpected identity response");
      const [clientPayload, tasksPayload]: [unknown, unknown] = await Promise.all([
        clientResponse.json(), tasksResponse.json(),
      ]);
      const taskPage = readTaskPage(tasksPayload, clientId, filter, beforeId);
      if (
        typeof clientPayload !== "object" || clientPayload === null ||
        !("data" in clientPayload) || !isClient(clientPayload.data) || clientPayload.data.id !== clientId ||
        taskPage === null
      ) {
        throw new Error("Unexpected client or task response");
      }
      client = clientPayload.data;
      tasks = taskPage.tasks;
      nextBeforeId = taskPage.nextBeforeId;
    }
  } catch (error) {
    console.error("Could not load client tasks:", error instanceof Error ? error.message : "Unknown error");
    return (
      <section className={workspace.notice}>
        <h1 className={styles.heading}>Client tasks</h1>
        <p role="alert">Unable to load this client’s tasks. Please try again.</p>
        <a className={styles.link} href={`${pageUrl}${query}`}>Reload tasks</a>
      </section>
    );
  }

  // Keep Next.js's not-found signal outside the request error handler.
  if (signedOut) redirect("/sign-in");
  if (missing || !client) notFound();

  return (
    <>
      <div className={workspace.pageTop}>
        <div className={workspace.intro}>
          <h1>Tasks for {client.name}</h1>
          <p>Keep the next step clear, one task at a time.</p>
        </div>
        {user && <Account user={user} apiOrigin={apiOrigin} />}
      </div>
      <div className={styles.grid}>
        <section className={styles.createPanel} aria-label="Add a task">
          <h2 className={styles.subheading}>Add a task</h2>
          <p className={styles.description}>Give it a title and, if you need one, a due date.</p>
          <CreateTaskForm key={clientId} apiUrl={apiUrl} clientId={clientId} />
          {beforeId !== undefined && <p className={styles.pageHint}>Viewing older tasks. New tasks appear on the newest page under Pending or All.</p>}
          {filter === "completed" && <p className={styles.pageHint}>New tasks start as pending. Find them under Pending or All.</p>}
        </section>
        <section className={styles.taskPanel} aria-label="Task list">
          <div className={styles.listHeader}>
            <h2 id={`tasks-heading-${clientId}`} className={styles.subheading} tabIndex={-1}>Tasks</h2>
            <nav className={styles.filters} aria-label="Task filters">
              {filters.map(({ value, label }) => (
                <Link key={value} className={styles.filter} prefetch={false}
                  href={`${pageUrl}${getTaskQuery(value)}`}
                  aria-current={filter === value ? "page" : undefined}>{label}</Link>
              ))}
            </nav>
          </div>
          <p className={styles.listHint}>Showing up to 50 {filter === "all" ? "tasks" : `${filter} tasks`} per page, newest first.</p>
          {tasks.length === 0 ? (
            <div className={styles.empty}>
              <p>{beforeId !== undefined ? "No older tasks match this filter." : filter === "all" ? "No tasks yet." : `No ${filter} tasks.`}</p>
              <p>{filter === "all" && beforeId === undefined ? "Add a task to get this client’s work underway." : "Choose another view to see more tasks."}</p>
            </div>
          ) : (
            <LocalDateProvider>
              <ul className={styles.list}>
                {tasks.map((task) => (
                  <li key={task.id} className={styles.task}>
                    <TaskTitleEditor task={task} apiUrl={apiUrl} />
                    <TaskDueDateEditor task={task} apiUrl={apiUrl} />
                    <div className={styles.taskFooter}>
                      <p className={styles.status} data-status={task.status}>Status: {task.status === "pending" ? "Pending" : "Completed"}</p>
                      <TaskStatusButton task={task} apiUrl={apiUrl} filter={filter} />
                    </div>
                  </li>
                ))}
              </ul>
            </LocalDateProvider>
          )}
          <nav className={styles.pagination} aria-label="Task pages">
            {beforeId !== undefined && (
              <Link className={styles.link} prefetch={false} href={`${pageUrl}${getTaskQuery(filter)}`}>Newest tasks</Link>
            )}
            {nextBeforeId !== null && (
              <Link className={styles.link} prefetch={false} href={`${pageUrl}${getTaskQuery(filter, nextBeforeId)}`}>Older tasks</Link>
            )}
          </nav>
        </section>
      </div>
    </>
  );
}

export default function ClientTasksPage({ params, searchParams }: PageProps) {
  return (
    <main className={workspace.main}>
      <Link href="/" className={workspace.backLink}>Back to clients</Link>
      <Suspense fallback={<p className={workspace.loading} role="status">Loading client tasks…</p>}>
        <ClientTasks params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
