import type { EditorField } from "@/lib/editorSchema";

export type WorkspaceSetting = {
  name: string;
  key: string;
  value: string;
  secret: boolean;
};

const KEY = "research-agent.settings";

const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSetting[] = [
  {
    name: "Mapbox Access Token",
    key: "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN",
    value: "",
    secret: true
  },
  {
    name: "Gemini API Key",
    key: "GEMINI_API_KEY",
    value: "",
    secret: true
  },
  {
    name: "OpenAI API Key",
    key: "OPENAI_API_KEY",
    value: "",
    secret: true
  },
  {
    name: "Anthropic API Key",
    key: "ANTHROPIC_API_KEY",
    value: "",
    secret: true
  }
];

export const workspaceSettingsEditorFields = [
  { key: "name", label: "Name" },
  { key: "value", label: "Value", control: "secretValue" },
  { key: "secret", label: "Secret", control: "checkbox" }
] satisfies readonly EditorField[];

export const loadWorkspaceSettings = (): WorkspaceSetting[] | unknown => {
  if (typeof localStorage === "undefined") return DEFAULT_WORKSPACE_SETTINGS;

  const rawSettings = localStorage.getItem(KEY);

  if (rawSettings === null) {
    saveWorkspaceSettings(DEFAULT_WORKSPACE_SETTINGS);
    return DEFAULT_WORKSPACE_SETTINGS;
  }

  try {
    return JSON.parse(rawSettings);
  } catch {
    return rawSettings;
  }
};

export const saveWorkspaceSettings = (workspaceSettings: WorkspaceSetting[] | unknown) => {
  if (typeof localStorage === "undefined") return;

  localStorage.setItem(KEY, JSON.stringify(workspaceSettings));
};
