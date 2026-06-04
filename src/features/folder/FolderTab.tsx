import { forwardRef, useImperativeHandle, useState } from "react";

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

interface FolderTabProps {
  active: boolean;
}

export const FolderTab = forwardRef<FolderController, FolderTabProps>(
  function FolderTab({ active }, ref) {
    const [assets, setAssets] = useState<Asset[]>([]);

    useImperativeHandle(ref, () => ({
      addFromRecord(record) {
        addUrls(extractAssetUrls(record.payload), record.id);
      },
      addFromValue(value, recordId) {
        addUrls(extractAssetUrls(value), recordId);
      }
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

    return (
      <section
        className={`workspace-tab${active ? " is-active" : ""}`}
        id="folderTab"
        data-tab-panel
        hidden={!active}
      >
        <h2 className="section-title">Folder</h2>
        {assets.length === 0 ? (
          <div className="agent-message agent-message-system">
            Retrieved PDFs and images will appear here.
          </div>
        ) : (
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
        )}
      </section>
    );
  }
);

export function hasAssetUrls(value: unknown): boolean {
  return extractAssetUrls(value).length > 0;
}

function extractAssetUrls(value: unknown): string[] {
  const serialized =
    typeof value === "string" ? value : JSON.stringify(value) || "";
  return serialized.match(ASSET_URL_PATTERN) || [];
}
