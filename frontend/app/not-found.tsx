import Link from "next/link";
import styles from "./workspace.module.css";

export default function NotFound() {
  return <main className={styles.main}>
    <section className={styles.notice}>
      <h1 className={styles.heading}>Page not found</h1>
      <p>This page isn’t available. Return to your clients to keep working.</p>
      <Link href="/">Back to clients</Link>
    </section>
  </main>;
}
