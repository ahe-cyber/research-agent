import { type KeyboardEvent, type MouseEvent, useState } from "react";
import styles from "./Sidebar.module.css";

type SidebarCardParam = {
  name: string;
  type: string;
  required?: boolean | null;
};
export type SidebarCardData = {
  name: string | null;
  description: string | null;
  params?: readonly SidebarCardParam[] | null;
};
interface SidebarCardProps {
  data: SidebarCardData;
  className?: string;
  ariaLabel?: string;
  openLabel?: string;
  onOpen?: () => void;
}

function getParams(params: SidebarCardData["params"]) {
  return Array.isArray(params) ? params.filter((param) => param.name) : [];
}

export const SidebarCard = ({ data, className = "", ariaLabel, openLabel, onOpen }: SidebarCardProps) => {
  const [selected, setSelected] = useState(false);
  const params = getParams(data.params);
  const hasParams = Object.prototype.hasOwnProperty.call(data, "params");

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
      className={[styles.card, selected && styles.cardSelected, className].filter(Boolean).join(" ")}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={selected}
      title={openLabel}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    >
      {data.name && (
        <strong className={styles.cardName}>
          <span>{data.name}</span>
          {hasParams && (
            <span className={styles.cardParamSignature}>
              (
              {params.map((param, index) => (
                <span key={`${param.name}:${index}`} className={styles.cardParamName} title={param.type}>
                  {index > 0 ? ", " : ""}
                  {param.name}{param.required === false ? "?" : ""}
                </span>
              ))}
              )
            </span>
          )}
        </strong>
      )}
      {data.description && <p className={styles.cardDescription}>{data.description}</p>}
    </div>
  );
};
