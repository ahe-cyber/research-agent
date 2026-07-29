import type { FolderProvider } from "../folder.schema";
import { browserDriveProvider } from "./providers/browserDrive";
import { googleDriveProvider } from "./providers/googleDrive";
import { localDriveProvider } from "./providers/localDrive";
import "../folder.css";

const FOLDER_PROVIDER_CONFIG_STORAGE_KEY = "research-agent.folderProviderConfig";
const folderProviders: FolderProvider[] = [
  browserDriveProvider,
  localDriveProvider,
  googleDriveProvider
];

export function createFolderProviderEditorPanel() {
  const panel = document.createElement("div");
  panel.className = "editor-sources-panel provider-editor-panel";

  const list = document.createElement("div");
  list.className = "search-sources-list provider-editor-list";
  panel.appendChild(list);

  const configs = loadProviderConfigs(FOLDER_PROVIDER_CONFIG_STORAGE_KEY);
  folderProviders.forEach((provider) => {
    list.appendChild(createProviderCard(provider, configs));
  });

  return panel;
}

function createProviderCard(provider: FolderProvider, configs: Record<string, any>) {
  const config = configs[provider.id] || {};
  const card = document.createElement("details");
  card.className = "source-editor search-source-card provider-editor-card";

  const summary = document.createElement("summary");
  summary.className = "source-editor-summary";
  const title = document.createElement("strong");
  title.textContent = config.label || provider.label;
  const subtitle = document.createElement("span");
  subtitle.textContent = config.description || provider.description || "Provider settings";
  summary.append(title, subtitle);

  const body = document.createElement("div");
  body.className = "source-editor-body provider-editor-body";
  body.append(
    createTextField("Name", config.label || provider.label, (value) => saveProviderField(configs, provider.id, "label", value)),
    createTextAreaField("Description", config.description || provider.description || "", (value) => saveProviderField(configs, provider.id, "description", value)),
    createCheckboxField("Costly", Boolean(config.costly || provider.requiresApiKey), (value) => saveProviderField(configs, provider.id, "costly", value)),
    createPasswordField("API key", config.apiKey || "", (value) => saveProviderField(configs, provider.id, "apiKey", value))
  );

  card.append(summary, body);
  return card;
}

function createTextField(label: string, value: string, onInput: (value: string) => void) {
  const field = document.createElement("label");
  field.className = "search-source-row-api-key provider-editor-field";
  const text = document.createElement("span");
  text.textContent = label;
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.addEventListener("input", () => onInput(input.value));
  field.append(text, input);
  return field;
}

function createTextAreaField(label: string, value: string, onInput: (value: string) => void) {
  const field = document.createElement("label");
  field.className = "search-source-row-api-key provider-editor-field";
  const text = document.createElement("span");
  text.textContent = label;
  const input = document.createElement("textarea");
  input.rows = 3;
  input.value = value;
  input.addEventListener("input", () => onInput(input.value));
  field.append(text, input);
  return field;
}

function createPasswordField(label: string, value: string, onInput: (value: string) => void) {
  const field = document.createElement("label");
  field.className = "search-source-row-api-key provider-editor-field";
  const text = document.createElement("span");
  text.textContent = label;
  const input = document.createElement("input");
  input.type = "password";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.value = value;
  input.addEventListener("input", () => onInput(input.value));
  field.append(text, input);
  return field;
}

function createCheckboxField(label: string, checked: boolean, onInput: (value: boolean) => void) {
  const field = document.createElement("label");
  field.className = "search-source-row-costly";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => onInput(input.checked));
  field.append(input, ` ${label}`);
  return field;
}

function saveProviderField(configs: Record<string, any>, providerId: string, key: string, value: unknown) {
  configs[providerId] = { ...(configs[providerId] || {}), [key]: value };
  saveProviderConfigs(configs);
}

function loadProviderConfigs(storageKey: string) {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "{}");
  } catch {
    return {};
  }
}

function saveProviderConfigs(configs: Record<string, unknown>) {
  localStorage.setItem(FOLDER_PROVIDER_CONFIG_STORAGE_KEY, JSON.stringify(configs));
  window.dispatchEvent(new CustomEvent("research-agent:folder-provider-config-changed"));
}
