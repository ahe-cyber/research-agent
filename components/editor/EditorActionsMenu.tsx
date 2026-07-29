import type { ReactNode } from "react";
import { DomSlot } from "./DomSlot";

interface EditorActionsMenuProps {
  left?: ReactNode;
  leftNodes?: Node[];
  onViewClick?: () => void;
  right?: ReactNode;
  rightNodes?: Node[];
  viewIconSrc?: string;
  viewLabel?: string;
}

export const EditorActionsMenu = ({ left, leftNodes = [], onViewClick, right, rightNodes = [], viewIconSrc, viewLabel }: EditorActionsMenuProps) => {
  return (
    <div className="editor-actions-menu">
      <div className="editor-actions-menu-actions">
        {viewIconSrc && onViewClick && (
          <button className="editor-actions-menu-view" type="button" title={viewLabel} aria-label={viewLabel} onClick={onViewClick}>
            <img src={viewIconSrc} alt="" aria-hidden="true" />
          </button>
        )}
        {viewIconSrc && !onViewClick && (
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
};
