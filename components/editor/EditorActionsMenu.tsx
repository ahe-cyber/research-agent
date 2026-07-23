import type { ReactNode } from "react";
import { DomSlot } from "./DomSlot";

interface EditorActionsMenuProps {
  left?: ReactNode;
  leftNodes?: Node[];
  right?: ReactNode;
  rightNodes?: Node[];
  viewIconSrc?: string;
  viewLabel?: string;
}

export function EditorActionsMenu({ left, leftNodes = [], right, rightNodes = [], viewIconSrc, viewLabel }: EditorActionsMenuProps) {
  return (
    <div className="editor-actions-menu">
      <div className="editor-actions-menu-actions">
        {viewIconSrc && (
          <span className="editor-actions-menu-view" title={viewLabel} aria-label={viewLabel}>
            <img src={viewIconSrc} alt="" aria-hidden="true" />
          </span>
        )}
        {left}
        {leftNodes.length > 0 && <DomSlot nodes={leftNodes} />}
      </div>
      <div className="editor-actions-menu-actions editor-actions-menu-actions-right">
        {right}
        {rightNodes.length > 0 && <DomSlot nodes={rightNodes} />}
      </div>
    </div>
  );
}
