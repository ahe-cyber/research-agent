export function FeatureTab({ tab, label, iconSrc, active, dragOver, onDragStart, onDragOver, onDrop, onDragEnd, onClick }) {
  return (
    <button
      className={[
        "feature-button",
        active && "is-active",
        dragOver && "is-drag-over",
      ].filter(Boolean).join(" ")}
      style={{ "--feature-icon": `url("${iconSrc}")` }}
      type="button"
      aria-label={label}
      title={label}
      draggable
      onClick={() => onClick(tab)}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    />
  );
}
