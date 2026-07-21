import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { requestPdfPlacement, PDF_BOUNDS_SET, type PdfBoundsDetail } from "./pdfDrop";
import {
  renderImageOverlay,
  hasPageOverlay,
  setPageVisibility,
  setFileVisibility,
  removeFileOverlays,
  removePageOverlay,
  PDF_BOUNDS_UPDATED
} from "./pdfOverlayRenderer";
import { withBasePath } from "../../lib/basePath";

pdfjsLib.GlobalWorkerOptions.workerSrc = withBasePath("/pdf.worker.min.mjs");

const DEFAULT_AUTOMASK = { threshold: 240, feather: 4 };

type PageStatus = string;

export interface PageConfig {
  id: string;
  page: number;
  imagePath: string;
  status: PageStatus;
  visible: boolean;
  width?: number;
  height?: number;
  bounds?: [[number, number], [number, number]] | null;
  corners?: [[number, number], [number, number], [number, number], [number, number]] | null;
  automask?: { threshold: number; feather: number };
}

export interface OverlayConfig {
  id: string;
  name: string;
  sourcePath: string;
  createdAt: string;
  category?: OverlayCategory;
  pages: PageConfig[];
  collapsed?: boolean;
  muted?: boolean;
}

type OverlayCategory = "global" | "local" | "manual";

type PageRender = {
  page: number;
  width: number;
  height: number;
  blob: Blob;
};

export function PdfOverlaySection() {
  const [overlays, setOverlays] = useState<OverlayConfig[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const overlaysRef = useRef(overlays);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoaded = useRef(false);

  useEffect(() => {
    overlaysRef.current = overlays;
  });

  useEffect(() => {
    loadOverlays();
  }, []);

  useEffect(() => {
    if (!hasLoaded.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveOverlays(overlays), 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [overlays]);

  useEffect(() => {
    function onBoundsSet(e: Event) {
      const { file: overlayId, page, bounds } = (e as CustomEvent<PdfBoundsDetail>).detail;
      const overlay = overlaysRef.current.find((o) => o.id === overlayId);
      const pageConfig = overlay?.pages.find((p) => p.page === page);
      if (!overlay || !pageConfig) return;

      setOverlays((prev) => prev.map((o) =>
        o.id !== overlayId ? o : {
          ...o,
          pages: o.pages.map((p) =>
            p.page !== page ? p : { ...p, visible: true, status: "reference", bounds }
          )
        }
      ));
      renderPage(overlayId, { ...pageConfig, visible: true, status: "reference", bounds });
    }

    document.addEventListener(PDF_BOUNDS_SET, onBoundsSet);
    return () => document.removeEventListener(PDF_BOUNDS_SET, onBoundsSet);
  }, []);

  useEffect(() => {
    function onBoundsUpdated(e: Event) {
      const { file: overlayId, page, corners } = (e as CustomEvent<{
        file: string;
        page: number;
        corners: [[number, number], [number, number], [number, number], [number, number]];
      }>).detail;
      setOverlays((prev) => prev.map((o) =>
        o.id !== overlayId ? o : {
          ...o,
          pages: o.pages.map((p) =>
            p.page !== page ? p : { ...p, corners }
          )
        }
      ));
    }

    document.addEventListener(PDF_BOUNDS_UPDATED, onBoundsUpdated);
    return () => document.removeEventListener(PDF_BOUNDS_UPDATED, onBoundsUpdated);
  }, []);

  async function loadOverlays() {
    try {
      const res = await fetch(withBasePath("/api/map?resource=overlay"));
      if (!res.ok) throw new Error(`Overlay registry returned ${res.status}`);
      const data = await res.json();
      const loaded = normalizeOverlays(Array.isArray(data?.overlays) ? data.overlays : []);
      setOverlays(loaded);
      hasLoaded.current = true;

      for (const overlay of loaded) {
        for (const page of overlay.pages || []) {
          if (page.status === "removed" || !page.visible || overlay.muted) continue;
          renderPage(overlay.id, page);
        }
      }
    } catch (error) {
      console.error("[PDF overlay] Failed to load overlays", error);
      hasLoaded.current = true;
    }
  }

  async function saveOverlays(nextOverlays: OverlayConfig[]) {
    try {
      await fetch(withBasePath("/api/map?resource=overlay"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overlays: nextOverlays })
      });
    } catch (error) {
      console.error("[PDF overlay] Failed to save overlays", error);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsUploading(true);

    try {
      const pageRenders = await renderPdfPages(file);
      const form = new FormData();
      form.append("pdf", file, file.name);
      form.append("pages", JSON.stringify(pageRenders.map(({ page, width, height }) => ({ page, width, height }))));
      for (const page of pageRenders) {
        form.append(`page-${page.page}`, page.blob, `page-${String(page.page).padStart(3, "0")}.png`);
      }

      const res = await fetch(withBasePath("/api/map?resource=overlay"), { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Overlay upload returned ${res.status}`);
      setOverlays((prev) => [...prev, data]);
    } catch (error) {
      console.error("[PDF overlay] Upload failed", error);
      alert(error instanceof Error ? error.message : "Failed to upload PDF overlay.");
    } finally {
      setIsUploading(false);
    }
  }

  async function renderPdfPages(file: File): Promise<PageRender[]> {
    const pdfDoc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    return Promise.all(
      Array.from({ length: pdfDoc.numPages }, async (_, index) => {
        const pageNumber = index + 1;
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context unavailable.");
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Failed to render PDF page.")), "image/png");
        });
        return { page: pageNumber, width: viewport.width, height: viewport.height, blob };
      })
    );
  }

  function renderPage(overlayId: string, page: PageConfig) {
    if (!page.bounds && !page.corners) return;
    const coordinates = page.corners ? page.corners.map(([lat, lng]) => [lng, lat]) : undefined;
    const fallbackBounds = page.bounds
      ?? (page.corners?.slice(0, 2).map(([lat, lng]) => [lat, lng]) as [[number, number], [number, number]] | undefined);
    if (!fallbackBounds) return;
    renderImageOverlay(
      overlayId,
      page.page,
      page.imagePath,
      fallbackBounds,
      page.automask ?? DEFAULT_AUTOMASK,
      coordinates
    );
  }

  function toggleMuted(overlayId: string) {
    setOverlays((prev) => prev.map((overlay) => {
      if (overlay.id !== overlayId) return overlay;
      const muted = !overlay.muted;
      setFileVisibility(overlay.id, overlay.pages, !muted);
      return { ...overlay, muted };
    }));
  }

  function toggleCollapsed(overlayId: string) {
    setOverlays((prev) => prev.map((overlay) =>
      overlay.id !== overlayId ? overlay : { ...overlay, collapsed: !overlay.collapsed }
    ));
  }

  function setOverlayCategory(overlayId: string, category: OverlayCategory) {
    setOverlays((prev) => prev.map((overlay) =>
      overlay.id !== overlayId ? overlay : { ...overlay, category }
    ));
  }

  function togglePageVisibility(overlayId: string, pageNumber: number) {
    setOverlays((prev) => prev.map((overlay) => {
      if (overlay.id !== overlayId) return overlay;
      return {
        ...overlay,
        pages: overlay.pages.map((page) => {
          if (page.page !== pageNumber) return page;
          const visible = !page.visible;
          if (visible && !hasPageOverlay(overlayId, pageNumber)) renderPage(overlayId, { ...page, visible });
          setPageVisibility(overlayId, pageNumber, visible);
          return { ...page, visible };
        })
      };
    }));
  }

  function setPageCategory(overlayId: string, pageNumber: number, currentStatus: PageStatus) {
    const currentLabel = getStatusLabel(currentStatus);
    const value = prompt("Page category:", currentLabel);
    if (!value?.trim()) return;

    const status = normalizeStatusInput(value);
    setOverlays((prev) => updatePage(prev, overlayId, pageNumber, (page) => {
      if (status === "done") {
        setPageVisibility(overlayId, pageNumber, false);
        return { ...page, status, visible: false };
      }
      return { ...page, status };
    }));
  }

  function togglePagePlacement(overlayId: string, page: PageConfig) {
    if (isPagePlaced(page)) {
      removePageOverlay(overlayId, page.page);
      setOverlays((prev) => updatePage(prev, overlayId, page.page, (current) => ({
        ...current,
        bounds: null,
        corners: null,
        visible: false
      })));
      return;
    }

    requestPdfPlacement(overlayId, page.page, page.width, page.height);
  }

  function removePage(overlayId: string, pageNumber: number) {
    removePageOverlay(overlayId, pageNumber);
    setOverlays((prev) => updatePage(prev, overlayId, pageNumber, (page) => ({
      ...page,
      status: "removed",
      visible: false
    })));
  }

  function removeOverlay(overlayId: string) {
    const overlay = overlaysRef.current.find((item) => item.id === overlayId);
    removeFileOverlays(overlayId, overlay?.pages.map((page) => page.page) ?? []);
    setOverlays((prev) => prev.filter((item) => item.id !== overlayId));
  }

  function filteredPages(overlay: OverlayConfig) {
    return overlay.pages.filter((page) => {
      if (page.status === "removed") return false;
      if (selectedFilter === "all") return true;
      return normalizeStatus(page.status) === selectedFilter;
    });
  }

  const filterCategories = getFilterCategories(overlays);

  return (
    <div className="map-display-group">
      <h3>PDF Overlays</h3>
      <div className="pdf-overlay-filter" role="group" aria-label="PDF overlay page filter">
        {filterCategories.map((filter) => (
          <button
            key={filter}
            className={`pdf-overlay-filter-button${selectedFilter === filter ? " is-active" : ""}`}
            type="button"
            onClick={() => setSelectedFilter(filter)}
          >
            {filter === "reference" ? "Ref" : filter}
          </button>
        ))}
      </div>
      <div className="map-display-options">
        {overlays.map((overlay) => (
          <div key={overlay.id} className="pdf-overlay-entry">
            <div className="pdf-overlay-header">
              <button
                className={`pdf-overlay-toggle${overlay.muted ? "" : " is-active"}`}
                type="button"
                tabIndex={-1}
                title={overlay.muted ? "Show overlay" : "Hide overlay"}
                onClick={() => toggleMuted(overlay.id)}
              />
              <button
                className={`pdf-overlay-name${overlay.collapsed ? " is-collapsed" : ""}${overlay.muted ? " is-muted" : ""}`}
                type="button"
                title={overlay.name}
                onClick={() => toggleCollapsed(overlay.id)}
              >
                {overlay.name}
              </button>
              <CategorySelect
                value={overlay.category || "manual"}
                onChange={(category) => setOverlayCategory(overlay.id, category)}
              />
              <a className="pdf-overlay-action" href={overlay.sourcePath} target="_blank" rel="noreferrer">PDF</a>
              <button className="pdf-overlay-action pdf-overlay-remove" type="button" title="Remove PDF" onClick={() => removeOverlay(overlay.id)}>
                x
              </button>
            </div>
            {!overlay.collapsed && filteredPages(overlay).map((page) => (
              <div
                key={page.id}
                className={`pdf-overlay-page-row${normalizeStatus(page.status) === "done" ? " is-done" : ""}`}
              >
                <button
                  className={`pdf-overlay-toggle${page.visible ? " is-active" : ""}`}
                  type="button"
                  tabIndex={-1}
                  title={page.visible ? "Hide page" : "Show page"}
                  onClick={() => togglePageVisibility(overlay.id, page.page)}
                />
                <span className="pdf-overlay-page-title">Page {page.page}</span>
                <button
                  className="pdf-overlay-page-status"
                  type="button"
                  title="Set category"
                  onClick={() => setPageCategory(overlay.id, page.page, page.status)}
                >
                  {getStatusLabel(page.status)}
                </button>
                <button
                  className={`pdf-overlay-action pdf-overlay-place${isPagePlaced(page) ? " is-active" : ""}`}
                  type="button"
                  title={isPagePlaced(page) ? "Remove page from map" : "Place page on map"}
                  onClick={() => togglePagePlacement(overlay.id, page)}
                >
                  Place
                </button>
                <button className="pdf-overlay-action pdf-overlay-remove pdf-overlay-delete" type="button" aria-label="Remove page" title="Remove page" onClick={() => removePage(overlay.id, page.page)}>
                </button>
              </div>
            ))}
          </div>
        ))}
        <button className="map-display-option pdf-overlay-load-button" type="button" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
          {isUploading ? "Saving PDF..." : "Upload PDF..."}
        </button>
        <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={handleFileChange} />
      </div>
    </div>
  );
}

function CategorySelect({
  value,
  onChange
}: {
  value: OverlayCategory;
  onChange: (category: OverlayCategory) => void;
}) {
  return (
    <select
      className="map-card-category-select"
      aria-label="Overlay category"
      value={value}
      onChange={(event) => onChange(event.target.value as OverlayCategory)}
    >
      <option value="global">Global Overlay</option>
      <option value="local">Local Overlay</option>
      <option value="manual">Manual Overlay</option>
    </select>
  );
}

function updatePage(
  overlays: OverlayConfig[],
  overlayId: string,
  pageNumber: number,
  updater: (page: PageConfig) => PageConfig
) {
  return overlays.map((overlay) =>
    overlay.id !== overlayId
      ? overlay
      : {
          ...overlay,
          pages: overlay.pages.map((page) => page.page === pageNumber ? updater(page) : page)
        }
  );
}

function normalizeOverlays(overlays: OverlayConfig[]) {
  return overlays.map((overlay) => ({
    ...overlay,
    pages: overlay.pages.map((page) => ({
      ...page,
      status: normalizeStatus(page.status)
    }))
  }));
}

function normalizeStatus(status: PageStatus): PageStatus {
  return status === "active" ? "reference" : status;
}

function normalizeStatusInput(value: string): PageStatus {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "ref" || lower === "reference" || lower === "active") return "reference";
  if (lower === "done") return "done";
  if (lower === "removed") return "removed";
  return trimmed;
}

function getStatusLabel(status: PageStatus) {
  const normalized = normalizeStatus(status);
  if (normalized === "reference") return "Ref";
  if (normalized === "done") return "Done";
  if (normalized === "removed") return "Removed";
  return normalized;
}

function isPagePlaced(page: PageConfig) {
  return Boolean(page.bounds || page.corners);
}

function getFilterCategories(overlays: OverlayConfig[]) {
  const custom = new Set<string>();
  overlays.forEach((overlay) => {
    overlay.pages.forEach((page) => {
      const status = normalizeStatus(page.status);
      if (status && status !== "reference" && status !== "done" && status !== "removed") {
        custom.add(status);
      }
    });
  });
  return ["all", "reference", "done", ...Array.from(custom).sort((a, b) => a.localeCompare(b))];
}
