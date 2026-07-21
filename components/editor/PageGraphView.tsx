import type { ReactNode } from "react";

interface PageGraphViewProps {
  children?: ReactNode;
}

export function PageGraphView({ children }: PageGraphViewProps) {
  return (
    <div className="page-view page-graph-view">
      <div className="page-view-content page-graph-view-content">{children}</div>
    </div>
  );
}
