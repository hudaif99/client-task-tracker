import { Suspense } from "react";
import { headers } from "next/headers";
import { getClientsUrl } from "@/lib/backend-url";
import SignUpForm from "./sign-up-form";

async function SignUp() {
  let apiOrigin: string;
  try {
    apiOrigin = new URL(getClientsUrl()).origin;
  } catch {
    return <p role="alert">Account creation is unavailable. Please try again later.</p>;
  }
  const host = (await headers()).get("host");
  if (host && new URL(`http://${host}`).hostname === "localhost") {
    const canonical = new URL(`http://${host}/sign-up`);
    canonical.hostname = "127.0.0.1";
    return <p>Use the local signup address: <a href={canonical.href}>Open signup on 127.0.0.1</a>.</p>;
  }
  return <>
    <p>Create your practice account to manage your own clients and tasks.</p>
    <SignUpForm apiOrigin={apiOrigin} />
  </>;
}

export default function SignUpPage() {
  return <main style={{ width: "100%", padding: "2rem", maxWidth: "32rem", margin: "0 auto" }}>
    <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>Create account</h1>
    <Suspense fallback={<p role="status">Loading signup…</p>}><SignUp /></Suspense>
  </main>;
}
