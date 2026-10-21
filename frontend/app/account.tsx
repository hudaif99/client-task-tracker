import { type User } from "@/lib/auth";
import SignOutButton from "./sign-out-button";
import styles from "./workspace.module.css";

export default function Account({ user, apiOrigin }: { user: User; apiOrigin: string }) {
  return <section aria-label="Your account" className={styles.account}>
    <div className={styles.accountIdentity}>
      <span className={styles.avatar} aria-hidden="true">{Array.from(user.name.trim() || user.email)[0]?.toLocaleUpperCase()}</span>
      <div className={styles.accountInfo}>
        <p className={styles.accountName}>{user.name || "Your account"}</p>
        <p className={styles.accountEmail}>{user.email}</p>
      </div>
    </div>
    <SignOutButton apiOrigin={apiOrigin} />
  </section>;
}
