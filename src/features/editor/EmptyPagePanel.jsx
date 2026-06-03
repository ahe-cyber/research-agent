import { createRoot } from "react-dom/client";
import { PageListView } from "./PageListView";
import { PageMenu } from "./PageMenu";

export function createEmptyPagePanel() {
  const panel = document.createElement("div");
  panel.className = "editor-empty-page-panel";
  panel.hidden = true;

  createRoot(panel).render(
    <>
      <PageMenu />
      <PageListView />
    </>
  );

  return panel;
}
