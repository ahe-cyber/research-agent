import { useCallback } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { Layout } from "react-resizable-panels";
import { loadWorkspaceState, saveWorkspaceState } from "@/lib/workspaceState";

const SIDEBAR_ID = "sidebar";
const EDITOR_ID = "editor";
const AGENT_ID = "agent";

const DEFAULT_LAYOUT: Layout = {
  [SIDEBAR_ID]: 22,
  [EDITOR_ID]: 56,
  [AGENT_ID]: 22,
};

function isValidLayout(value: unknown): value is Layout {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const l = value as Record<string, unknown>;
  return (
    typeof l[SIDEBAR_ID] === "number" &&
    typeof l[EDITOR_ID] === "number" &&
    typeof l[AGENT_ID] === "number"
  );
}

interface WorkbenchLayoutProps {
  featureBar: React.ReactNode;
  sidebar: React.ReactNode;
  editor: React.ReactNode;
  agentPanel: React.ReactNode;
}

export function WorkbenchLayout({ featureBar, sidebar, editor, agentPanel }: WorkbenchLayoutProps) {
  const saved = loadWorkspaceState().panelLayout as unknown;
  const defaultLayout = isValidLayout(saved) ? saved : DEFAULT_LAYOUT;

  const handleLayoutChanged = useCallback((layout: Layout) => {
    saveWorkspaceState({ panelLayout: layout });
  }, []);

  return (
    <div className="app-shell">
      {featureBar}
      <Group
        orientation="horizontal"
        className="workbench-panels"
        defaultLayout={defaultLayout}
        onLayoutChanged={handleLayoutChanged}
      >
        <Panel id={SIDEBAR_ID} minSize="8" collapsible>
          {sidebar}
        </Panel>
        <Separator className="workbench-resize-handle" />
        <Panel id={EDITOR_ID} minSize="20">
          {editor}
        </Panel>
        <Separator className="workbench-resize-handle" />
        <Panel id={AGENT_ID} minSize="8" collapsible>
          {agentPanel}
        </Panel>
      </Group>
    </div>
  );
}
