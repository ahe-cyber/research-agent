import { useEffect, useState } from "react";
import {
  isSupportedParseExtension,
  type DxfParseResult,
  type FileEntry,
  type FolderProvider,
  type FolderProviderId,
  type IfcParseResult,
  type ParseResult,
  type PdfParseResult
} from "../folder.schema";
import { browserDriveProvider } from "./providers/browserDrive";
import { googleDriveProvider } from "./providers/googleDrive";
import { localDriveProvider } from "./providers/localDrive";
import "../folder.css";

const FILE_PROVIDERS: FolderProvider[] = [
  browserDriveProvider,
  localDriveProvider,
  googleDriveProvider
];

interface FileViewerProps {
  entry: FileEntry;
}

export function FileViewer({ entry }: FileViewerProps) {
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    parseFile(entry).then(setResult).catch((err) => setError(String(err)));
  }, [entry.key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="file-viewer-state">
        <span className="file-viewer-error-text">Failed to parse {entry.name}: {error}</span>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="file-viewer-state">
        <span className="file-viewer-loading-text">Parsing {entry.name}…</span>
      </div>
    );
  }

  if (result.type === "pdf") return <PdfView entry={entry} result={result} />;
  if (result.type === "dxf") return <DxfView result={result} />;
  if (result.type === "ifc") return <IfcView result={result} />;
  return null;
}

async function parseFile(entry: FileEntry): Promise<ParseResult> {
  if (!isSupportedParseExtension(entry.ext)) {
    throw new Error(`${entry.name} cannot be previewed yet.`);
  }
  const file = await getProviderFile(entry);
  switch (entry.ext) {
    case "pdf": {
      const { parsePdf } = await import("./providers/pdf");
      return parsePdf(file);
    }
    case "dxf": {
      const { parseDxf } = await import("./providers/dxf");
      return parseDxf(file);
    }
    case "ifc": {
      const { parseIfc } = await import("./providers/ifc");
      return parseIfc(file);
    }
  }
}

async function getProviderFile(entry: FileEntry): Promise<File> {
  const provider = getFolderProvider(entry.providerId);
  if (!provider) throw new Error(`Unknown folder provider: ${entry.providerId}`);
  return provider.getFile(entry);
}

function getFolderProvider(providerId: FolderProviderId): FolderProvider | undefined {
  return FILE_PROVIDERS.find((provider) => provider.id === providerId);
}

// ── PDF ───────────────────────────────────────────────────────────────────

function PdfView({ entry, result }: { entry: FileEntry; result: PdfParseResult }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    getProviderFile(entry).then((file) => {
      url = URL.createObjectURL(file);
      setObjectUrl(url);
    }).catch(() => setObjectUrl(null));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="file-viewer file-viewer--pdf">
      <div className="file-viewer-toolbar">
        <span className="file-viewer-title">{result.fileName}</span>
        <span className="file-viewer-meta">{result.pageCount} page{result.pageCount !== 1 ? "s" : ""}</span>
      </div>
      {objectUrl ? (
        <iframe
          className="file-viewer-pdf-frame"
          src={objectUrl}
          title={result.fileName}
        />
      ) : (
        <div className="file-viewer-state">
          <span className="file-viewer-loading-text">Loading PDF…</span>
        </div>
      )}
    </div>
  );
}

// ── DXF ───────────────────────────────────────────────────────────────────

function DxfView({ result }: { result: DxfParseResult }) {
  const totalEntities = Object.values(result.entityCounts).reduce((a, b) => a + b, 0);
  const sortedEntities = Object.entries(result.entityCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="file-viewer file-viewer--structured">
      <div className="file-viewer-toolbar">
        <span className="file-viewer-title">{result.fileName}</span>
        <span className="file-viewer-meta">
          {totalEntities} entities · {result.layers.length} layers · {result.blockCount} blocks
        </span>
      </div>

      <div className="file-viewer-body">
        {result.layers.length > 0 && (
          <section className="file-viewer-section">
            <h2 className="file-viewer-section-title">Layers</h2>
            <div className="file-viewer-tag-list">
              {result.layers.map((l) => (
                <span key={l} className="file-viewer-tag">{l}</span>
              ))}
            </div>
          </section>
        )}

        {sortedEntities.length > 0 && (
          <section className="file-viewer-section">
            <h2 className="file-viewer-section-title">Entities</h2>
            <table className="file-viewer-table">
              <tbody>
                {sortedEntities.map(([type, count]) => (
                  <tr key={type}>
                    <td className="file-viewer-table-label">{type}</td>
                    <td className="file-viewer-table-value">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {result.textContent.length > 0 && (
          <section className="file-viewer-section">
            <h2 className="file-viewer-section-title">
              Text annotations ({result.textContent.length})
            </h2>
            <ul className="file-viewer-text-list">
              {result.textContent.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

// ── IFC ───────────────────────────────────────────────────────────────────

function IfcView({ result }: { result: IfcParseResult }) {
  const totalElements = Object.values(result.elementCounts).reduce((a, b) => a + b, 0);
  const sortedElements = Object.entries(result.elementCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="file-viewer file-viewer--structured">
      <div className="file-viewer-toolbar">
        <span className="file-viewer-title">{result.fileName}</span>
        <span className="file-viewer-meta">
          {result.schema}
          {result.projectName ? ` · ${result.projectName}` : ""}
          {totalElements > 0 ? ` · ${totalElements} elements` : ""}
        </span>
      </div>

      <div className="file-viewer-body">
        {sortedElements.length > 0 && (
          <section className="file-viewer-section">
            <h2 className="file-viewer-section-title">Elements</h2>
            <table className="file-viewer-table">
              <tbody>
                {sortedElements.map(([type, count]) => (
                  <tr key={type}>
                    <td className="file-viewer-table-label">{type}</td>
                    <td className="file-viewer-table-value">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {result.storeys.length > 0 && (
          <section className="file-viewer-section">
            <h2 className="file-viewer-section-title">
              Storeys ({result.storeys.length})
            </h2>
            <div className="file-viewer-tag-list">
              {result.storeys.map((s) => (
                <span key={s} className="file-viewer-tag">{s}</span>
              ))}
            </div>
          </section>
        )}

        {result.spaces.length > 0 && (
          <section className="file-viewer-section">
            <h2 className="file-viewer-section-title">
              Spaces ({result.spaces.length})
            </h2>
            <div className="file-viewer-tag-list">
              {result.spaces.map((s) => (
                <span key={s} className="file-viewer-tag">{s}</span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
