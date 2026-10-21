import { Suspense } from "react";
import { headers } from "next/headers";
import { getClientsUrl } from "@/lib/backend-url";
import SignInForm from "./sign-in-form";
import AuthLayout from "../auth-layout";
import Link from "next/link";

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
    <SignInForm apiOrigin={apiOrigin} />
    <p>New here? <Link href="/sign-up" prefetch={false}>Create an account</Link></p>
  </>;
}

export default function SignInPage() {
  return <AuthLayout title="Sign in" description="Welcome back. Pick up where you left off.">
    <Suspense fallback={<p role="status">Loading sign-in…</p>}><SignIn /></Suspense>
  </AuthLayout>;
}
