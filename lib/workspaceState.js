const KEY = "research-agent.workspace-state";

export function loadWorkspaceState() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveWorkspaceState(patch) {
  localStorage.setItem(KEY, JSON.stringify({ ...loadWorkspaceState(), ...patch }));
}
