import type { ReactNode } from "react";

interface PageMenuProps {
  left?: ReactNode;
  right?: ReactNode;
}

interface LegacyPageMenuOptions {
  left?: Node[];
  right?: Node[];
}

export function PageMenu({ left, right }: PageMenuProps) {
  return (
    <div className="page-menu">
      <div className="page-menu-actions">{left}</div>
      <div className="page-menu-actions page-menu-actions-right">{right}</div>
    </div>
  );
}

// Legacy panels can use the shared menu layout until their content moves to React.
export function createPageMenu({ left = [], right = [] }: LegacyPageMenuOptions = {}) {
  const element = document.createElement("div");
  const leftActions = document.createElement("div");
  const rightActions = document.createElement("div");

  element.className = "page-menu";
  leftActions.className = "page-menu-actions";
  rightActions.className = "page-menu-actions page-menu-actions-right";

  leftActions.append(...left);
  rightActions.append(...right);
  element.append(leftActions, rightActions);

  return {
    element,
    add(action: Node, { align = "left" }: { align?: "left" | "right" } = {}) {
      (align === "right" ? rightActions : leftActions).appendChild(action);
    }
  };
}
