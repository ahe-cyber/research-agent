import { createRoot } from "react-dom/client";
import { EditorListView } from "./EditorListView";
import { EditorActionsMenu } from "./EditorActionsMenu";

export function createEmptyPagePanel() {
  const panel = document.createElement("div");
  panel.className = "editor-empty-page-panel";
  panel.hidden = true;

  createRoot(panel).render(
    <>
      <EditorActionsMenu />
      <EditorListView />
    </>
  );

  return panel;
}
