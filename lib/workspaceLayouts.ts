export type WorkspacePanelLayout = Record<string, number>;

const KEY = "research-agent.workspace-layouts";

const DEFAULT_PANEL_LAYOUT = {
  ["sidebar"]: 22,
  ["editor"]: 56,
  ["agent"]: 22
};

const isWorkspacePanelLayout = (value: unknown): value is WorkspacePanelLayout => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const layout = value as Record<string, unknown>;
  return (
    typeof layout["sidebar"] === "number" &&
    typeof layout["editor"] === "number" &&
    typeof layout["agent"] === "number"
  );
};

export const loadWorkspacePanelLayout = (): WorkspacePanelLayout => {
  if (typeof localStorage === "undefined") return { ...DEFAULT_PANEL_LAYOUT };

  try {
    const panelLayout = JSON.parse(localStorage.getItem(KEY) || "{}");
    return isWorkspacePanelLayout(panelLayout) ? panelLayout : { ...DEFAULT_PANEL_LAYOUT };
  } catch {
    return { ...DEFAULT_PANEL_LAYOUT };
  }
};

export const saveWorkspacePanelLayout = (panelLayout: WorkspacePanelLayout) => {
  if (typeof localStorage === "undefined") return;

  localStorage.setItem(KEY, JSON.stringify(panelLayout));
};
