import { type KeyboardEvent, type MouseEvent, type ReactNode, useState } from "react";

interface SidebarCardProps {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  openLabel?: string;
  onOpen?: () => void;
}

export function SidebarCard({ children, className = "", ariaLabel, openLabel, onOpen }: SidebarCardProps) {
  const [selected, setSelected] = useState(false);

  function toggleSelected() {
    setSelected((value) => !value);
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented) return;
    toggleSelected();
  }

  function handleDoubleClick(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    onOpen?.();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      onOpen?.();
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      toggleSelected();
    }
  }

  return (
    <div
      className={["sidebar-card", selected && "is-selected", className].filter(Boolean).join(" ")}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={selected}
      title={openLabel}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}
