import Link from "next/link";
import styles from "./workspace.module.css";

export default function AppHeader() {
  return <>
    <a className={styles.skipLink} href="#main-content">Skip to content</a>
    <header className={styles.header}>
      <Link className={styles.brand} href="/" prefetch={false} aria-label="Client & Task Tracker home">
        <svg className={styles.brandMark} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect width="32" height="32" rx="9" fill="currentColor" />
          <path d="M9 10h9M9 16h5M9 22h9m2-7 2 2 4-5" stroke="var(--workspace-surface)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Client &amp; Task Tracker</span>
      </Link>
      <span className={styles.headerNote}>A place for your work.</span>
    </header>
  </>;
}
