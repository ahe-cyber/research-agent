import styles from "./Sidebar.module.css";

export function SidebarHeader({ kicker, version, dropdown, action }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerBody}>
        <span className={styles.kickerRow}>
          <span className={`${styles.kicker} panel-kicker`}>{kicker}</span>
          {version && <span className={styles.version}>{version}</span>}
        </span>
        <div className={styles.dropdown}>{dropdown}</div>
      </div>
      <div className={styles.action}>{action}</div>
    </header>
  );
}
