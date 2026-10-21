import type { ReactNode } from "react";
import styles from "./workspace.module.css";

export default function AuthLayout({ title, description, children }: {
  title: string; description: string; children: ReactNode;
}) {
  return <main className={styles.authLayout}>
    <section className={styles.authStory} aria-label="About Client & Task Tracker">
      <span className={styles.authSymbol} aria-hidden="true">✓</span>
      <h2>Your clients and tasks.<br />Together, in one place.</h2>
      <p>Keep the details close and the next step clear.</p>
      <ul>
        <li>A dedicated space for each client</li>
        <li>Tasks, due dates, and progress at a glance</li>
        <li>Your own account, your own work</li>
      </ul>
    </section>
    <section className={styles.authCard} aria-label={title}>
      <h1>{title}</h1>
      <p className={styles.authDescription}>{description}</p>
      {children}
    </section>
  </main>;
}
