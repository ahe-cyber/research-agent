import type { ReactNode } from "react";

interface PageMenuProps {
  left?: ReactNode;
  right?: ReactNode;
}

export function PageMenu({ left, right }: PageMenuProps) {
  return (
    <div className="page-menu">
      <div className="page-menu-actions">{left}</div>
      <div className="page-menu-actions page-menu-actions-right">{right}</div>
    </div>
  );
}
