import type { ReactNode } from "react";

interface PageListViewProps {
  children?: ReactNode;
}

export function PageListView({ children }: PageListViewProps) {
  return (
    <div className="page-view page-list-view">
      <div className="page-view-content page-list-view-content">{children}</div>
    </div>
  );
}
