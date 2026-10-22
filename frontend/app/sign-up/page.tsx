import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { getBrowserApiOrigin } from "@/lib/backend-url";
import SignUpForm from "./sign-up-form";
import AuthLayout from "../auth-layout";

async function SignUp() {
  await connection();
  let apiOrigin: string;
  try {
    apiOrigin = getBrowserApiOrigin();
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
    <SignUpForm apiOrigin={apiOrigin} />
  </>;
}

export default function SignUpPage() {
  return <AuthLayout title="Create account" description="A fresh workspace for your clients and tasks.">
    <Suspense fallback={<p role="status">Loading signup…</p>}><SignUp /></Suspense>
  </AuthLayout>;
}
