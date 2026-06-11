import { forwardRef, useImperativeHandle, useState } from "react";
import { formatSize, isFolderMountSupported, mountFolder } from "./folderMount";
import type { FileEntry, MountedFolder } from "./folderMount";

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

    async function handleMountFolder() {
      const mount = await mountFolder();
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
        <h2 className="section-title">Folder</h2>

        {isFolderMountSupported() && (
          <div className="folder-mount-toolbar">
            <button
              className="folder-mount-button"
              type="button"
              onClick={handleMountFolder}
            >
              Mount folder
            </button>
          </div>
        )}

        {mounts.map((mount) => (
          <div key={mount.id} className="folder-mount">
            <div className="folder-mount-header">
              <span className="folder-mount-name">{mount.name}</span>
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
                {mount.files.map((entry) => (
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
            Mount a local folder to browse PDF, DXF, and IFC files.
            Retrieved assets will also appear here.
          </div>
        )}
      </section>
    );
  }
);
