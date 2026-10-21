import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { type Client, isClient } from "@/lib/clients";
import { getClientsUrl } from "@/lib/backend-url";
import CreateClientForm from "./create-client-form";
import ClientRow from "./client-row";
import { sessionHeaders } from "@/lib/server-session";
import { readUser, type User } from "@/lib/auth";
import Account from "./account";
import styles from "./page.module.css";
import workspace from "./workspace.module.css";

async function ClientsList() {
  // Fetch live data after a page request, rather than during the build.
  await connection();
  let clients: Client[] = [];
  let apiUrl = "";
  let user: User | null = null;
  let signedOut = false;

  try {
    apiUrl = getClientsUrl();
    const headers = await sessionHeaders();
    const [response, identity] = await Promise.all([
      fetch(apiUrl, { headers, cache: "no-store", signal: AbortSignal.timeout(5000) }),
      fetch(new URL("/api/me", apiUrl), { headers, cache: "no-store", signal: AbortSignal.timeout(5000) }),
    ]);

    if (response.status === 401 || identity.status === 401) {
      signedOut = true;
    } else {
      if (!response.ok || !identity.ok) throw new Error("Client or identity request failed");
      user = readUser(await identity.json());
      if (!user) throw new Error("Unexpected identity response");

      const payload: unknown = await response.json();

      if (
        typeof payload !== "object" ||
        payload === null ||
        !("data" in payload) ||
        !Array.isArray(payload.data) ||
        !payload.data.every(isClient)
      ) {
        throw new Error("Unexpected clients response");
      }

      clients = payload.data;
    }
  } catch (error) {
    console.error(
      "Could not load clients:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return (
      <div className={styles.notice} role="alert">
        <h2>Clients couldn’t be loaded</h2>
        <p>Check your connection and refresh the page to try again.</p>
        <form action="/" method="get"><button type="submit">Reload clients</button></form>
      </div>
    );
  }

  // Redirect throws; keep it outside the network error handler.
  if (signedOut) redirect("/sign-in");
  if (!user) return null;

  return (
    <>
      <div className={workspace.pageTop}>
        <div className={workspace.intro}>
          <h1>Clients</h1>
          <p>A place for your clients and the work you do for them.</p>
        </div>
        <Account user={user} apiOrigin={new URL(apiUrl).origin} />
      </div>
      <div className={styles.workspace}>
        <section className={styles.createPanel} aria-labelledby="add-client-heading">
          <div className={styles.panelHeading}>
            <span className={styles.addMark} aria-hidden="true">+</span>
            <h2 id="add-client-heading">Add a client</h2>
          </div>
          <p>Start with a name. Add their tasks when you’re ready.</p>
          <CreateClientForm apiUrl={apiUrl} />
        </section>
        <section className={styles.directory} aria-label="Client list">
          <div className={styles.directoryHeading}>
            <h2 id="clients-heading" tabIndex={-1}>Your clients</h2>
            <span className={styles.count}>{clients.length} shown</span>
          </div>
          <p className={styles.listHint}>Showing up to 50 clients, newest first.</p>
          {clients.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyMark} aria-hidden="true">+</span>
              <h3>No clients yet.</h3>
              <p>Add your first client to start keeping their tasks together.</p>
              <a href="#client-name">Add your first client</a>
            </div>
          ) : <ul className={styles.clientList}>
            {clients.map((client) => (
              <ClientRow key={client.id} client={{ id: client.id, name: client.name }} apiUrl={apiUrl} />
            ))}
          </ul>}
        </section>
      </div>
    </>
  );
}

export default function Home() {
  return (
    <main className={workspace.main}>
      <Suspense fallback={
        <div className={styles.loading} role="status">
          <p>Loading clients…</p>
          <div aria-hidden="true"><span /><span /><span /></div>
        </div>
      }>
        <ClientsList />
      </Suspense>
    </main>
  );
}
