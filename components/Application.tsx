"use client";

import { useCallback, useRef } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { Layout } from "react-resizable-panels";
import { AgentArea } from "@/components/agent/AgentArea";
import { EditorArea } from "@/components/editor/EditorArea";
import { SidebarArea } from "@/components/sidebar/SidebarArea";
import { loadWorkspaceSettings } from "@/lib/workspaceSettings";
import { loadWorkspacePanelLayout, saveWorkspacePanelLayout } from "@/lib/workspaceLayouts";

export function Application() {
  const defaultPanelLayout = loadWorkspacePanelLayout() as Layout;
  const openFileRef = useRef<((entry: unknown) => void) | null>(null);
  const openPageRef = useRef<((id: string, label: string, value: unknown, options?: unknown) => void) | null>(null);
  const suggestToolRef = useRef<((name: string) => void) | null>(null);

  const onOpenFile = useCallback((entry: unknown) => openFileRef.current?.(entry), []);
  const onOpenPage = useCallback((id: string, label: string, value: unknown) => {
    openPageRef.current?.(id, label, value);
  }, []);
  const onOpenRichPage = useCallback((id: string, label: string, value: unknown, options: unknown) => {
    openPageRef.current?.(id, label, value, options);
  }, []);
  const onOpenSettings = useCallback(() => {
    openPageRef.current?.("settings", "Settings", loadWorkspaceSettings());
  }, []);
  const onPanelLayoutChanged = useCallback((panelLayout: Layout) => {
    saveWorkspacePanelLayout(panelLayout);
  }, []);

  return (
    <div className="app-shell">
      <Group
        orientation="horizontal"
        className="workbench-panels"
        defaultLayout={defaultPanelLayout}
        onLayoutChanged={onPanelLayoutChanged}
      >
        <Panel id="sidebar" minSize="8" collapsible>
          <SidebarArea
            onOpenFile={onOpenFile}
            onOpenPage={onOpenPage}
            onOpenRichPage={onOpenRichPage}
            onOpenSettings={onOpenSettings}
          />
        </Panel>
        <Separator className="workbench-resize-handle" />
        <Panel id="editor" minSize="20">
          <EditorArea openFileRef={openFileRef} openPageRef={openPageRef} suggestToolRef={suggestToolRef} />
        </Panel>
        <Separator className="workbench-resize-handle" />
        <Panel id="agent" minSize="8" collapsible>
          <AgentArea suggestToolRef={suggestToolRef} />
        </Panel>
      </Group>
    </div>
  );
}
