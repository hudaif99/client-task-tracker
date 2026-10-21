import Link from "next/link";
import styles from "../../workspace.module.css";

export default function ClientNotFound() {
  return (
    <main className={styles.main}>
      <section className={styles.notice}>
      <h1 className={styles.heading}>Client not found</h1>
      <p>This client may have been deleted. Return to the list to choose another client.</p>
      <Link href="/">Back to clients</Link>
      </section>
    </main>
  );
}
