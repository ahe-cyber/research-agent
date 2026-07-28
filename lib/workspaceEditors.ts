export type WorkspaceEditorTab = {
  id: string;
  label: string;
};

export type WorkspaceEditorState = {
  openEditorTabs: WorkspaceEditorTab[];
  activeEditorTab: string;
};

const KEY = "research-agent.workspace-editors";

const DEFAULT_EDITOR_STATE: WorkspaceEditorState = {
  openEditorTabs: [{ id: "map", label: "Map" }],
  activeEditorTab: "map"
};

export const loadWorkspaceEditorState = (): WorkspaceEditorState => {
  if (typeof localStorage === "undefined") return DEFAULT_EDITOR_STATE;

  try {
    const workspaceEditorState = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      openEditorTabs: Array.isArray(workspaceEditorState.openEditorTabs)
        ? workspaceEditorState.openEditorTabs
        : DEFAULT_EDITOR_STATE.openEditorTabs,
      activeEditorTab: typeof workspaceEditorState.activeEditorTab === "string"
        ? workspaceEditorState.activeEditorTab
        : DEFAULT_EDITOR_STATE.activeEditorTab
    };
  } catch {
    return DEFAULT_EDITOR_STATE;
  }
};

export const saveWorkspaceEditorState = (workspaceEditorStateUpdate: Partial<WorkspaceEditorState>) => {
  if (typeof localStorage === "undefined") return;

  const workspaceEditorState = loadWorkspaceEditorState();
  localStorage.setItem(KEY, JSON.stringify({ ...workspaceEditorState, ...workspaceEditorStateUpdate }));
};
