import type { ReactNode } from "react";

interface EditorPanelItemProps {
  children: ReactNode;
}

export function EditorPanelItem({ children }: EditorPanelItemProps) {
  return (
    <div className="editor-viewport" id="editorViewport">
      {children}
    </div>
  );
}
