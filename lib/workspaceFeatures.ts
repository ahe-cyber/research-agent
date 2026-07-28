export type WorkspaceFeatureState = {
  activeFeature: string;
  featureOrder: string[];
};

const KEY = "research-agent.workspace-features";

const DEFAULT_ACTIVE_FEATURE = "workspace";

const DEFAULT_FEATURE_ORDER = [
  "address",
  "agent",
  "dataset",
  "folder",
  "map",
  "project",
  "record",
  "settings",
  "skill",
  "tool",
  "workspace"
];

export const loadWorkspaceFeatureState = (): WorkspaceFeatureState => {
  if (typeof localStorage === "undefined") {
    return {
      activeFeature: DEFAULT_ACTIVE_FEATURE,
      featureOrder: [...DEFAULT_FEATURE_ORDER]
    };
  }

  try {
    const workspaceFeatureState = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      activeFeature: workspaceFeatureState.activeFeature ?? DEFAULT_ACTIVE_FEATURE,
      featureOrder: Array.isArray(workspaceFeatureState.featureOrder)
        ? workspaceFeatureState.featureOrder
        : [...DEFAULT_FEATURE_ORDER]
    };
  } catch {
    return {
      activeFeature: DEFAULT_ACTIVE_FEATURE,
      featureOrder: [...DEFAULT_FEATURE_ORDER]
    };
  }
};

export const saveWorkspaceFeatureState = (workspaceFeatureStateUpdate: Partial<WorkspaceFeatureState>) => {
  if (typeof localStorage === "undefined") return;

  const workspaceFeatureState = loadWorkspaceFeatureState();
  localStorage.setItem(KEY, JSON.stringify({ ...workspaceFeatureState, ...workspaceFeatureStateUpdate }));
};
