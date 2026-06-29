import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { FileEntry, MountedFolder } from "./folderMount";
import { formatSize } from "./folderMount";
import { folderProviders } from "./providers";
import type { FolderProvider } from "./providers";
import { createSearchWidget } from "../search/SearchWidget";
import { SourceDropdownSlot } from "../workspace/SourceDropdownSlot";

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
    const folderSearchRef = useRef<HTMLDivElement | null>(null);
    const providerOptions = useMemo(() => folderProviders.map((provider) => ({
      id: provider.id,
      label: provider.label,
      disabled: !provider.isSupported()
    })), []);
    const selectedProvider = folderProviders.find((provider) => provider.id === selectedProviderId)
      || folderProviders[0];

    useEffect(() => {
      if (!folderSearchRef.current) return;
      const widget = createSearchWidget({
        placeholder: "Search mounted folders",
        inputName: "folder-file-query",
        onQuery(query) {
          setFolderQuery(query.trim().toLowerCase());
        },
        onSubmit(query) {
          setFolderQuery(query.trim().toLowerCase());
        }
      });
      folderSearchRef.current.replaceChildren(widget.shellElement);
    }, []);

    useEffect(() => {
      const onMount = () => {
        const localDriveProvider = folderProviders.find((provider) => provider.id === "local-drive");
        if (selectedProviderId === "local-drive" && localDriveProvider) {
          void handleMountFolder(localDriveProvider);
        }
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
      <section
        className={`workspace-tab${active ? " is-active" : ""}`}
        id="folderTab"
        data-tab-panel
        hidden={!active}
      >
        <div className="section-title-row">
          <h2 className="section-title">Folder</h2>
          <SourceDropdownSlot
            className="folder-provider-dropdown"
            options={providerOptions}
            selectedId={selectedProviderId}
            onChange={(provider) => setSelectedProviderId(provider?.id || "")}
            onEdit={() => window.dispatchEvent(new CustomEvent("research-agent:edit-folder-providers"))}
            editLabel="Edit folder sources"
          />
        </div>

        <div className="folder-search-widget" ref={folderSearchRef} />

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
              <p className="folder-empty-note">No supported files found (pdf, dxf, ifc).</p>
            ) : (
              <ul className="folder-file-list">
                {mount.files.filter((entry) => matchesFolderQuery(entry, folderQuery)).map((entry) => (
                  <li key={entry.key}>
                    <button
                      className="folder-file-row"
                      type="button"
                      onClick={() => onOpenFile?.(entry)}
                      title={entry.path}
                    >
                      <span className={`folder-file-badge folder-file-badge--${entry.ext}`}>
                        {entry.ext.toUpperCase()}
                      </span>
                      <span className="folder-file-name">{entry.name}</span>
                      <span className="folder-file-size">{formatSize(entry.size)}</span>
                    </button>
                  </li>
                ))}
              </ul>
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

        {mounts.length === 0 && assets.length === 0 && (
          <div className="agent-message agent-message-system">
            Mount a drive to browse PDF, DXF, and IFC files.
            Retrieved assets will also appear here.
          </div>
        )}
      </section>
    );
  }
);

function matchesFolderQuery(entry: FileEntry, query: string) {
  if (!query) return true;
  return `${entry.name} ${entry.path} ${entry.ext}`.toLowerCase().includes(query);
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
      apiKeyLabel: "API key",
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
  apiKeyLabel = "API key",
  configs,
  storageKey
}: {
  id: string;
  label: string;
  description: string;
  requiresApiKey?: boolean;
  apiKeyLabel?: string;
  configs: Record<string, { label?: string; description?: string; apiKey?: string; costly?: boolean }>;
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
    saveProviderConfigs(storageKey, configs);
  });
  costlyLabel.append(costlyCheck, " Costly");
  typeRow.append(typeSelect, costlyLabel);
  body.append(typeRow, createPasswordField(apiKeyLabel, config.apiKey || "", (value) => {
    configs[id] = { ...(configs[id] || {}), apiKey: value };
    saveProviderConfigs(storageKey, configs);
  }));

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

function loadProviderConfigs(storageKey: string) {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "{}");
  } catch {
    return {};
  }
}

function saveProviderConfigs(storageKey: string, configs: Record<string, unknown>) {
  localStorage.setItem(storageKey, JSON.stringify(configs));
}
