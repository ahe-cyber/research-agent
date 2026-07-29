import styles from "./Sidebar.module.css";

const APP_VERSION = "v0.0.9";

export const SidebarHeader = () => {
  return (
    <header className={styles.header}>
      <div>RESEARCH AGENT</div>
      <div className={styles.version}>{APP_VERSION}</div>
    </header>
  );
};
