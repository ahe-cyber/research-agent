import type { ReactNode } from "react";

interface PageListViewProps {
  children?: ReactNode;
}

interface LegacyPageListViewOptions {
  children?: Node[];
}

export function PageListView({ children }: PageListViewProps) {
  return (
    <div className="page-view page-list-view">
      <div className="page-view-content page-list-view-content">{children}</div>
    </div>
  );
}

// Legacy panels can use the shared list layout until their content moves to React.
export function createPageListView({ children = [] }: LegacyPageListViewOptions = {}) {
  const element = document.createElement("div");
  const content = document.createElement("div");

  element.className = "page-view page-list-view";
  content.className = "page-view-content page-list-view-content";
  content.append(...children);
  element.appendChild(content);

  return {
    element,
    content,
    add(child: Node) {
      content.appendChild(child);
    },
    replace(...children: Node[]) {
      content.replaceChildren(...children);
    }
  };
}
