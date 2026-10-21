import styles from "./create-client-form.module.css";

export default function SessionExpired() {
  return <p className={styles.sessionExpired} role="alert">
    Your sign-in expired. Copy any unsaved text before <a href="/sign-in">signing in again</a>.
  </p>;
}
