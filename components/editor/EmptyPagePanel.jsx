import { createRoot } from "react-dom/client";
import { EditorListView } from "./EditorListView";
import { PageMenu } from "./PageMenu";

export function createEmptyPagePanel() {
  const panel = document.createElement("div");
  panel.className = "editor-empty-page-panel";
  panel.hidden = true;

  createRoot(panel).render(
    <>
      <PageMenu />
      <EditorListView />
    </>
  );

  return panel;
}
