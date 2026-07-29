import type { FeatureName } from "@/lib/features";

export type WorkspaceInvalidationScope = "info" | "detail";

export type WorkspaceFeatureInvalidation = Record<WorkspaceInvalidationScope, number>;

export type WorkspaceInvalidationState = Record<FeatureName, WorkspaceFeatureInvalidation>;

export const EMPTY_WORKSPACE_INVALIDATION: WorkspaceInvalidationState = {};

export const getWorkspaceFeatureInvalidation = (state: WorkspaceInvalidationState, featureId: FeatureName): WorkspaceFeatureInvalidation => {
  return state[featureId] ?? { info: 0, detail: 0 };
};

export const bumpWorkspaceInvalidation = (state: WorkspaceInvalidationState, featureId: FeatureName, scopes: WorkspaceInvalidationScope | WorkspaceInvalidationScope[]) => {
  const timestamp = Date.now();
  const current = getWorkspaceFeatureInvalidation(state, featureId);
  const scopeList = Array.isArray(scopes) ? scopes : [scopes];
  const next = { ...current };

  scopeList.forEach((scope) => {
    next[scope] = timestamp;
  });

  return {
    ...state,
    [featureId]: next
  };
};
