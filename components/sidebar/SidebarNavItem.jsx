import styles from "./SidebarNavItem.module.css";

export function SidebarNavItem({
  tab,
  label,
  iconSrc,
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
        styles.button,
        fixed && styles.fixed,
        active && styles.active,
        dragOver && styles.dragOver,
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
