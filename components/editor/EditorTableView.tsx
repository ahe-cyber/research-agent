import type { ReactNode } from "react";

interface EditorTableViewProps {
  actions?: ReactNode;
  children?: ReactNode;
}

export function EditorTableView({ actions, children }: EditorTableViewProps) {
  return (
    <div className="page-view page-table-view">
      <div className="page-view-action-bar page-table-view-action-bar">
        <div className="page-view-actions" />
        <div className="page-view-actions page-view-actions-right">{actions}</div>
      </div>
      <div className="page-view-content page-table-view-content">{children}</div>
    </div>
  );
}
