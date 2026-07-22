import type { ReactNode } from "react";

interface EditorGraphViewProps {
  children?: ReactNode;
}

export function EditorGraphView({ children }: EditorGraphViewProps) {
  return (
    <div className="page-view page-graph-view">
      <div className="page-view-content page-graph-view-content">{children}</div>
    </div>
  );
}
