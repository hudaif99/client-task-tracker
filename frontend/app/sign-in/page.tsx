import { Suspense } from "react";
import { headers } from "next/headers";
import { getClientsUrl } from "@/lib/backend-url";
import SignInForm from "./sign-in-form";

async function SignIn() {
  let apiOrigin: string;
  try {
    apiOrigin = new URL(getClientsUrl()).origin;
  } catch {
    return <p role="alert">Sign-in is unavailable. Please try again later.</p>;
  }
  const host = (await headers()).get("host");
  // Cookies belong to a hostname, so local frontend/backend must use 127.0.0.1 together.
  if (host && new URL(`http://${host}`).hostname === "localhost") {
    const canonical = new URL(`http://${host}/sign-in`);
    canonical.hostname = "127.0.0.1";
    return <p>Use the local sign-in address: <a href={canonical.href}>Open sign-in on 127.0.0.1</a>.</p>;
  }
  return <>
    <p>Sign in with your existing practice account.</p>
    <SignInForm apiOrigin={apiOrigin} />
    <p>New here? <a href="/sign-up" style={{ textDecoration: "underline" }}>Create an account</a></p>
  </>;
}

export default function SignInPage() {
  return <main style={{ width: "100%", padding: "2rem", maxWidth: "32rem", margin: "0 auto" }}>
    <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>Sign in</h1>
    <Suspense fallback={<p role="status">Loading sign-in…</p>}><SignIn /></Suspense>
  </main>;
}
