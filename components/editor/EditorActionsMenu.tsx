import type { ReactNode } from "react";

interface EditorActionsMenuProps {
  left?: ReactNode;
  right?: ReactNode;
  viewIconSrc?: string;
  viewLabel?: string;
}

export function EditorActionsMenu({ left, right, viewIconSrc, viewLabel }: EditorActionsMenuProps) {
  return (
    <div className="editor-actions-menu">
      <div className="editor-actions-menu-actions">
        {viewIconSrc && (
          <span className="editor-actions-menu-view" title={viewLabel} aria-label={viewLabel}>
            <img src={viewIconSrc} alt="" aria-hidden="true" />
          </span>
        )}
        {left}
      </div>
      <div className="editor-actions-menu-actions editor-actions-menu-actions-right">{right}</div>
    </div>
  );
}
