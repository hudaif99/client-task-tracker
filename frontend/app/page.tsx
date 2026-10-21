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
      <p role="alert">
        Unable to load clients. Please refresh the page to try again.
      </p>
    );
  }

  // Redirect throws; keep it outside the network error handler.
  if (signedOut) redirect("/sign-in");
  if (!user) return null;

  return (
    <>
      <Account user={user} apiOrigin={new URL(apiUrl).origin} />
      <h2 style={{ marginTop: "1.5rem", fontWeight: 600 }}>Add a client</h2>
      <CreateClientForm apiUrl={apiUrl} />
      <h2 id="clients-heading" tabIndex={-1} style={{ fontWeight: 600 }}>Clients</h2>
      {clients.length === 0 ? <p>No clients yet.</p> :
        <section aria-label="Client list">
          <p>Showing up to 50 clients, newest first.</p>

          <ul style={{ listStyle: "disc", paddingLeft: "1.5rem" }}>
            {clients.map((client) => (
              <ClientRow key={client.id} client={{ id: client.id, name: client.name }} apiUrl={apiUrl} />
            ))}
          </ul>
        </section>
      }
    </>
  );
}

export default function Home() {
  return (
    <main style={{ width: "100%", padding: "2rem", maxWidth: "48rem", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>
        Client &amp; Task Tracker
      </h1>

      <Suspense fallback={<p role="status">Loading clients…</p>}>
        <ClientsList />
      </Suspense>
    </main>
  );
}
