export type WorkspaceFeatureState = {
  activeFeature: string;
  featureOrder: string[];
};

const KEY = "research-agent.workspace-features";

export const DEFAULT_ACTIVE_FEATURE = "workspace";

export const DEFAULT_FEATURE_ORDER = [
  "address",
  "agent",
  "dataset",
  "folder",
  "map",
  "project",
  "record",
  "skill",
  "tool"
];

export const DEFAULT_WORKSPACE_FEATURE_STATE = {
  activeFeature: DEFAULT_ACTIVE_FEATURE,
  featureOrder: [...DEFAULT_FEATURE_ORDER]
};

const normalizeFeatureOrder = (featureOrder: unknown) => {
  if (!Array.isArray(featureOrder)) return [...DEFAULT_FEATURE_ORDER];
  return featureOrder.filter((feature): feature is string => typeof feature === "string" && feature !== "workspace" && feature !== "settings");
};

export const loadWorkspaceFeatureState = (): WorkspaceFeatureState => {
  if (typeof localStorage === "undefined") {
    return { ...DEFAULT_WORKSPACE_FEATURE_STATE, featureOrder: [...DEFAULT_FEATURE_ORDER] };
  }

  try {
    const workspaceFeatureState = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      activeFeature: workspaceFeatureState.activeFeature ?? DEFAULT_ACTIVE_FEATURE,
      featureOrder: normalizeFeatureOrder(workspaceFeatureState.featureOrder)
    };
  } catch {
    return { ...DEFAULT_WORKSPACE_FEATURE_STATE, featureOrder: [...DEFAULT_FEATURE_ORDER] };
  }
};

export const saveWorkspaceFeatureState = (workspaceFeatureStateUpdate: Partial<WorkspaceFeatureState>) => {
  if (typeof localStorage === "undefined") return;

  const workspaceFeatureState = loadWorkspaceFeatureState();
  localStorage.setItem(KEY, JSON.stringify({ ...workspaceFeatureState, ...workspaceFeatureStateUpdate }));
};
