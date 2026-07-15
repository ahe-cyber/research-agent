export function FeatureTab({
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
        "feature-button",
        fixed && "is-fixed",
        active && "is-active",
        dragOver && "is-drag-over",
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
