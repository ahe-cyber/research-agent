import type { ReactNode } from "react";

interface EditorListViewProps {
  children?: ReactNode;
}

export function EditorListView({ children }: EditorListViewProps) {
  return (
    <div className="page-view page-list-view">
      <div className="page-view-content page-list-view-content">{children}</div>
    </div>
  );
}
