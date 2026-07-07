import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import type { FileEntry, MountedFolder } from "./folderMount";
import { formatSize, isSupportedParseExtension } from "./folderMount";
import { folderProviders } from "./providers";
import type { FolderProvider } from "./providers";
import { FeatureSourceTab } from "../workspace/FeatureSourceTab";

const FOLDER_PROVIDER_CONFIG_STORAGE_KEY = "research-agent.folderProviderConfig";

// ── Asset collection (URLs from agent records) ────────────────────────────

const ASSET_URL_PATTERN = /https?:\/\/[^\s"'<>]+?\.(?:pdf|png|jpg|jpeg|gif|webp)(?:\?[^\s"'<>]*)?/gi;

interface Asset {
  url: string;
  type: "pdf" | "image";
  recordId: string;
}

interface FolderRecord {
  id: string;
  payload: unknown;
}

export interface FolderController {
  addFromRecord(record: FolderRecord): void;
  addFromValue(value: unknown, recordId: string): void;
}

export function hasAssetUrls(value: unknown): boolean {
  return extractAssetUrls(value).length > 0;
}

function extractAssetUrls(value: unknown): string[] {
  const serialized = typeof value === "string" ? value : JSON.stringify(value) || "";
  return serialized.match(ASSET_URL_PATTERN) || [];
}

// ── FolderTab component ───────────────────────────────────────────────────

interface FolderTabProps {
  active: boolean;
  onOpenFile?: (entry: FileEntry) => void;
}

export const FolderTab = forwardRef<FolderController, FolderTabProps>(
  function FolderTab({ active, onOpenFile }, ref) {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [mounts, setMounts] = useState<MountedFolder[]>([]);
    const [folderQuery, setFolderQuery] = useState("");
    const [selectedProviderId, setSelectedProviderId] = useState("browser-drive");
    const [providerConfigVersion, setProviderConfigVersion] = useState(0);
    const providerOptions = useMemo(() => {
      const configs = typeof window !== "undefined"
        ? loadProviderConfigs(FOLDER_PROVIDER_CONFIG_STORAGE_KEY)
        : {};
      return folderProviders.map((provider) => {
        const config = configs[provider.id] || {};
        return {
          id: provider.id,
          label: config.label || provider.label,
          costly: Boolean(config.costly || config.apiKey || provider.requiresApiKey),
          disabled: !provider.isSupported()
        };
      });
    }, [providerConfigVersion]);

    useEffect(() => {
      const refreshProviderConfigs = () => setProviderConfigVersion((version) => version + 1);
      window.addEventListener("research-agent:folder-provider-config-changed", refreshProviderConfigs);
      return () => {
        window.removeEventListener("research-agent:folder-provider-config-changed", refreshProviderConfigs);
      };
    }, []);

    useEffect(() => {
      const onMount = () => {
        const provider = folderProviders.find((item) => item.id === selectedProviderId);
        if (provider && provider.isSupported()) void handleMountFolder(provider);
      };
      const onUnmount = () => {
        // Placeholder for provider-aware unmount behavior.
      };
      window.addEventListener("research-agent:mount-folder", onMount);
      window.addEventListener("research-agent:unmount-folder", onUnmount);
      return () => {
        window.removeEventListener("research-agent:mount-folder", onMount);
        window.removeEventListener("research-agent:unmount-folder", onUnmount);
      };
    }, [selectedProviderId]);

    useImperativeHandle(ref, () => ({
      addFromRecord(record) { addUrls(extractAssetUrls(record.payload), record.id); },
      addFromValue(value, recordId) { addUrls(extractAssetUrls(value), recordId); }
    }));

    function addUrls(urls: string[], recordId: string) {
      if (urls.length === 0) return;
      setAssets((prev) => {
        const next = [...prev];
        urls.forEach((url) => {
          if (!next.some((a) => a.url === url)) {
            const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
            next.unshift({ url, type: ext === "pdf" ? "pdf" : "image", recordId });
          }
        });
        return next;
      });
    }

    async function handleMountFolder(provider: FolderProvider) {
      const mount = await provider.mount();
      if (mount) setMounts((prev) => [...prev, mount]);
    }

    function handleUnmount(id: string) {
      setMounts((prev) => prev.filter((m) => m.id !== id));
    }

    return (
      <FeatureSourceTab
        active={active}
        featureId="folder"
        featureLabel="Folder"
        dropdownClassName="folder-provider-dropdown"
        dropdownOptions={providerOptions}
        selectedSourceId={selectedProviderId}
        onSourceChange={(provider) => setSelectedProviderId(provider?.id || "")}
        onEditSources={() => window.dispatchEvent(new CustomEvent("research-agent:edit-folder-providers"))}
        editSourcesLabel="Edit folder sources"
        searchClassName="folder-search-widget"
        searchId="folderSidebarSearch"
        searchPlaceholder="Search mounted folders"
        searchInputName="folder-file-query"
        onSearchQuery={(query) => setFolderQuery(query.trim().toLowerCase())}
      >
        {mounts.map((mount) => (
          <div key={mount.id} className="folder-mount">
            <div className="folder-mount-header">
              <span className="folder-mount-name">{mount.name}</span>
              <span className="folder-provider-label">
                {folderProviders.find((provider) => provider.id === mount.providerId)?.label || mount.providerId}
              </span>
              <button
                className="folder-mount-remove"
                type="button"
                aria-label={`Unmount ${mount.name}`}
                onClick={() => handleUnmount(mount.id)}
              />
            </div>

            {mount.files.length === 0 ? (
              <p className="folder-empty-note">No files found.</p>
            ) : (
              <FolderTree
                entries={mount.files.filter((entry) => matchesFolderQuery(entry, folderQuery))}
                rootName={mount.name}
                onOpenFile={onOpenFile}
              />
            )}
          </div>
        ))}

        {assets.length > 0 && (
          <>
            <h3 className="folder-section-title">Assets from records</h3>
            <div className="folder-asset-list">
              {assets.map((asset) => (
                <article key={asset.url} className="folder-asset-item">
                  <div>
                    <strong>{asset.type.toUpperCase()}</strong>
                    <span>{asset.url}</span>
                  </div>
                  <a
                    className="icon-link-button"
                    href={asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open asset"
                  >
                    Go
                  </a>
                </article>
              ))}
            </div>
          </>
        )}

      </FeatureSourceTab>
    );
  }
);

function matchesFolderQuery(entry: FileEntry, query: string) {
  if (!query) return true;
  return `${entry.name} ${entry.path} ${entry.ext}`.toLowerCase().includes(query);
}

interface FolderTreeNode {
  name: string;
  path: string;
  entry?: FileEntry;
  children: Map<string, FolderTreeNode>;
}

function FolderTree({
  entries,
  rootName,
  onOpenFile
}: {
  entries: FileEntry[];
  rootName: string;
  onOpenFile?: (entry: FileEntry) => void;
}) {
  const root = buildFolderTree(entries, rootName);
  return (
    <ul className="folder-tree">
      {Array.from(root.children.values()).map((node) => (
        <FolderTreeNodeView key={node.path} node={node} onOpenFile={onOpenFile} />
      ))}
    </ul>
  );
}

function FolderTreeNodeView({
  node,
  onOpenFile
}: {
  node: FolderTreeNode;
  onOpenFile?: (entry: FileEntry) => void;
}) {
  if (node.entry) {
    return (
      <li>
        <button
          className="folder-file-row folder-tree-file"
          type="button"
          disabled={!isSupportedParseExtension(node.entry.ext)}
          onClick={() => openMountedFile(node.entry as FileEntry, onOpenFile)}
          title={isSupportedParseExtension(node.entry.ext) ? node.entry.path : `${node.entry.path} cannot be previewed yet`}
        >
          <span className={`folder-file-badge folder-file-badge--${getExtensionClassName(node.entry.ext)}`}>
            {node.entry.ext.toUpperCase()}
          </span>
          <span className="folder-file-name">{node.entry.name}</span>
          <span className="folder-file-size">{formatSize(node.entry.size)}</span>
        </button>
      </li>
    );
  }

  return (
    <li>
      <details className="folder-tree-directory" open>
        <summary>{node.name}</summary>
        <ul className="folder-tree">
          {Array.from(node.children.values()).map((child) => (
            <FolderTreeNodeView key={child.path} node={child} onOpenFile={onOpenFile} />
          ))}
        </ul>
      </details>
    </li>
  );
}

function openMountedFile(entry: FileEntry, onOpenFile?: (entry: FileEntry) => void) {
  if (!isSupportedParseExtension(entry.ext)) return;
  onOpenFile?.(entry);
}

function getExtensionClassName(ext: string) {
  return ext.replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "file";
}

function buildFolderTree(entries: FileEntry[], rootName: string): FolderTreeNode {
  const root: FolderTreeNode = { name: rootName, path: rootName, children: new Map() };

  entries.forEach((entry) => {
    const parts = entry.path.split("/").filter(Boolean);
    if (parts[0] === rootName) parts.shift();
    let current = root;

    parts.forEach((part, index) => {
      const path = [current.path, part].filter(Boolean).join("/");
      const isFile = index === parts.length - 1;
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path,
          entry: isFile ? entry : undefined,
          children: new Map()
        });
      }
      current = current.children.get(part) as FolderTreeNode;
      if (isFile) current.entry = entry;
    });
  });

  return root;
}

export function createFolderProviderEditorPanel() {
  const panel = document.createElement("div");
  panel.className = "editor-sources-panel provider-editor-panel";

  const list = document.createElement("div");
  list.className = "search-sources-list provider-editor-list";
  panel.appendChild(list);

  const configs = loadProviderConfigs(FOLDER_PROVIDER_CONFIG_STORAGE_KEY);
  folderProviders.forEach((provider) => {
    list.appendChild(createProviderCard({
      id: provider.id,
      label: provider.label,
      description: provider.description || "",
      requiresApiKey: provider.requiresApiKey,
      supportsOAuth: Boolean(provider.authorize),
      apiKeyLabel: "API key",
      extraFields: provider.id === "google-drive"
        ? [
          {
            key: "clientId",
            label: "OAuth client ID",
            type: "password",
            placeholder: "1234567890-abc.apps.googleusercontent.com"
          },
          {
            key: "appId",
            label: "Project number",
            type: "text",
            placeholder: "1234567890"
          }
        ]
        : [],
      configs,
      storageKey: FOLDER_PROVIDER_CONFIG_STORAGE_KEY
    }));
  });

  return panel;
}

function createProviderCard({
  id,
  label,
  description,
  requiresApiKey = false,
  supportsOAuth = false,
  apiKeyLabel = "API key",
  extraFields = [],
  configs,
  storageKey
}: {
  id: string;
  label: string;
  description: string;
  requiresApiKey?: boolean;
  supportsOAuth?: boolean;
  apiKeyLabel?: string;
  extraFields?: Array<{ key: string; label: string; type: "text" | "password"; placeholder?: string }>;
  configs: Record<string, { label?: string; description?: string; apiKey?: string; costly?: boolean; [key: string]: unknown }>;
  storageKey: string;
}) {
  const config = configs[id] || {};
  const card = document.createElement("details");
  card.className = "source-editor search-source-card provider-editor-card";

  const summary = document.createElement("summary");
  summary.className = "source-editor-summary";

  const summaryContent = document.createElement("div");
  summaryContent.className = "source-editor-summary-content";

  const summaryMain = document.createElement("div");
  summaryMain.className = "source-editor-summary-main";

  const summaryText = document.createElement("div");
  summaryText.className = "source-editor-summary-text";

  const summaryEdit = document.createElement("div");
  summaryEdit.className = "source-summary-edit";

  const title = document.createElement("strong");
  title.textContent = config.label || label;

  const subtitle = document.createElement("span");
  subtitle.textContent = config.description || description || "Provider settings";

  const titleInput = document.createElement("input");
  titleInput.className = "source-title-input";
  titleInput.type = "text";
  titleInput.value = config.label || label;

  const descInput = document.createElement("textarea");
  descInput.className = "source-description-input";
  descInput.rows = 3;
  descInput.value = config.description || description;

  [titleInput, descInput].forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("input", () => {
      configs[id] = {
        ...(configs[id] || {}),
        label: titleInput.value,
        description: descInput.value
      };
      title.textContent = titleInput.value.trim() || label;
      subtitle.textContent = descInput.value.trim() || description || "Provider settings";
      saveProviderConfigs(storageKey, configs);
    });
  });

  const deleteButton = document.createElement("button");
  deleteButton.className = "circle-icon-button delete-source-button source-editor-delete-button";
  deleteButton.type = "button";
  deleteButton.setAttribute("aria-label", `Delete ${label}`);
  deleteButton.title = `Delete ${label}`;
  deleteButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    replaceWithDeletedSourceRow(card, label);
  });

  const closeButton = document.createElement("button");
  closeButton.className = "circle-icon-button source-editor-close-button";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close");
  closeButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    card.open = false;
  });

  const sideButtons = document.createElement("div");
  sideButtons.className = "source-editor-side-buttons";
  sideButtons.appendChild(deleteButton);

  summaryText.append(title, subtitle);
  summaryEdit.append(titleInput, descInput);
  summaryMain.append(sideButtons, summaryText, summaryEdit, closeButton);
  summaryContent.appendChild(summaryMain);
  summary.appendChild(summaryContent);

  const body = document.createElement("div");
  body.className = "source-editor-body provider-editor-body";

  const typeRow = document.createElement("div");
  typeRow.className = "search-source-type-row";
  const typeSelect = document.createElement("select");
  typeSelect.className = "search-source-row-select";
  folderProviders.forEach((provider) => {
    const option = document.createElement("option");
    option.value = provider.id;
    option.textContent = provider.label;
    option.selected = provider.id === id;
    typeSelect.appendChild(option);
  });
  typeSelect.disabled = true;
  const costlyLabel = document.createElement("label");
  costlyLabel.className = "search-source-row-costly";
  const costlyCheck = document.createElement("input");
  costlyCheck.type = "checkbox";
  costlyCheck.checked = Boolean(config.costly || requiresApiKey);
  costlyCheck.addEventListener("change", () => {
    configs[id] = { ...(configs[id] || {}), costly: costlyCheck.checked };
    if (oauthButton) oauthButton.hidden = !costlyCheck.checked;
    saveProviderConfigs(storageKey, configs);
  });
  costlyLabel.append(costlyCheck, " Costly");
  const oauthButton = supportsOAuth ? createOAuthButton(id, configs, storageKey) : null;
  if (oauthButton) oauthButton.hidden = !costlyCheck.checked;
  typeRow.append(typeSelect, costlyLabel);
  if (oauthButton) typeRow.appendChild(oauthButton);
  body.append(typeRow, createPasswordField(apiKeyLabel, config.apiKey || "", (value) => {
    configs[id] = { ...(configs[id] || {}), apiKey: value };
    saveProviderConfigs(storageKey, configs);
  }));

  extraFields.forEach((field) => {
    const storedValue = config[field.key];
    const value = typeof storedValue === "string" ? storedValue : "";
    const onInput = (nextValue: string) => {
      configs[id] = { ...(configs[id] || {}), [field.key]: nextValue };
      saveProviderConfigs(storageKey, configs);
    };
    body.appendChild(field.type === "password"
      ? createPasswordField(field.label, value, onInput, field.placeholder)
      : createTextField(field.label, value, onInput, field.placeholder));
  });

  card.append(summary, body);
  return card;
}

function replaceWithDeletedSourceRow(card: HTMLElement, label: string) {
  const row = document.createElement("div");
  const line = document.createElement("div");
  const deletedLabel = document.createElement("span");
  const countdown = document.createElement("span");
  const revertButton = document.createElement("button");
  let remaining = 10;

  row.className = "source-deleted-row";
  line.className = "source-deleted-line";
  deletedLabel.className = "source-deleted-label";
  countdown.className = "source-delete-countdown";
  deletedLabel.textContent = `Deleted: ${label}`;
  countdown.textContent = `${remaining}s`;
  line.append(deletedLabel, countdown);

  revertButton.className = "circle-icon-button revert-source-button";
  revertButton.type = "button";
  revertButton.setAttribute("aria-label", `Restore ${label}`);
  revertButton.title = `Restore ${label}`;
  row.append(line, revertButton);

  const parent = card.parentElement;
  if (!parent) return;
  parent.replaceChild(row, card);
  const timer = window.setInterval(() => {
    remaining -= 1;
    countdown.textContent = `${Math.max(0, remaining)}s`;
    if (remaining <= 0) {
      window.clearInterval(timer);
      row.remove();
    }
  }, 1000);
  revertButton.addEventListener("click", () => {
    window.clearInterval(timer);
    parent.replaceChild(card, row);
  });
}

function createOAuthButton(
  providerId: string,
  configs: Record<string, { label?: string; description?: string; apiKey?: string; costly?: boolean; [key: string]: unknown }>,
  storageKey: string
) {
  const provider = folderProviders.find((item) => item.id === providerId);
  const button = document.createElement("button");
  button.className = "provider-oauth-button";
  button.type = "button";
  button.textContent = "OAuth";
  button.title = "Authorize this source";
  button.disabled = !provider?.authorize;
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!provider?.authorize) return;

    saveProviderConfigs(storageKey, configs);
    button.disabled = true;
    button.textContent = "OAuth...";
    try {
      await provider.authorize(configs[providerId] || {});
      button.textContent = "OAuth connected";
    } catch (error) {
      console.error("[Folder] OAuth authorization failed", error);
      button.textContent = "OAuth failed";
      window.setTimeout(() => {
        button.textContent = "OAuth";
      }, 2500);
    } finally {
      button.disabled = false;
    }
  });
  return button;
}

function createTextField(label: string, value: string, onInput: (value: string) => void, placeholder = "") {
  const field = document.createElement("label");
  field.className = "search-source-row-api-key provider-editor-field";
  const text = document.createElement("span");
  text.textContent = label;
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = placeholder;
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

function createPasswordField(label: string, value: string, onInput: (value: string) => void, placeholder = "") {
  const field = document.createElement("label");
  field.className = "search-source-row-api-key provider-editor-field";
  const text = document.createElement("span");
  text.textContent = label;
  const input = document.createElement("input");
  input.type = "password";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = placeholder;
  input.value = value;
  input.addEventListener("input", () => onInput(input.value));
  field.append(text, input);
  return field;
}

function loadProviderConfigs(storageKey: string) {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "{}");
  } catch {
    return {};
  }
}

function saveProviderConfigs(storageKey: string, configs: Record<string, unknown>) {
  localStorage.setItem(storageKey, JSON.stringify(configs));
  if (storageKey === FOLDER_PROVIDER_CONFIG_STORAGE_KEY) {
    window.dispatchEvent(new CustomEvent("research-agent:folder-provider-config-changed"));
  }
}
