import type { ReactNode } from "react";

interface EditorPanelProps {
  navbar: ReactNode;
  children: ReactNode;
}

export function EditorPanel({ navbar, children }: EditorPanelProps) {
  return (
    <main className="editor-area" aria-label="Editor">
      {navbar}
      {children}
    </main>
  );
}
