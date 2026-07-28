import styles from "./Sidebar.module.css";

export function SidebarNavItem({
  tab,
  label,
  iconSrc,
  className = "",
  active,
  dragOver,
  draggable = true,
  fixed = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onClick
}) {
  return (
    <button
      className={[
        styles.navButton,
        fixed && styles.navButtonFixed,
        active && styles.navButtonActive,
        dragOver && styles.navButtonDragOver,
        className,
      ].filter(Boolean).join(" ")}
      style={{ "--feature-icon": `url("${iconSrc}")` }}
      type="button"
      aria-label={label}
      title={label}
      draggable={draggable}
      onClick={() => onClick(tab)}
      onDragStart={draggable ? onDragStart : undefined}
      onDragOver={draggable ? onDragOver : undefined}
      onDrop={draggable ? onDrop : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
    />
  );
}
