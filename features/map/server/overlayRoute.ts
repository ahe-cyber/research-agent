import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { dataPath, jsonResponse, writeJsonFile } from "@/lib/server/files";

const overlayPath = dataPath("overlay.json");
const overlayAssetRoot = path.join(process.cwd(), "public", "assets", "overlay");
const publicOverlayRoot = "/assets/overlay";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface OverlayPage {
  id: string;
  page: number;
  imagePath: string;
  status: string;
  visible: boolean;
  width?: number;
  height?: number;
  bounds?: [[number, number], [number, number]] | null;
  corners?: [[number, number], [number, number], [number, number], [number, number]] | null;
  automask?: { threshold: number; feather: number };
}

interface Overlay {
  id: string;
  name: string;
  sourcePath: string;
  createdAt: string;
  collapsed?: boolean;
  muted?: boolean;
  pages: OverlayPage[];
}

interface OverlayRegistry {
  overlays: Overlay[];
}

export async function getPdfOverlays() {
  const registry = await readOverlayRegistry();
  return jsonResponse({ overlays: registry.overlays.map(addBasePathToOverlay) });
}

export async function uploadPdfOverlay(request: Request) {
  const form = await request.formData().catch(() => null);
  const source = form?.get("pdf");
  const pageMetaRaw = form?.get("pages");

  if (!(source instanceof File) || typeof pageMetaRaw !== "string") {
    return jsonResponse({ error: "Overlay upload requires pdf and pages." }, { status: 400 });
  }

  let pageMeta: Array<{ page: number; width?: number; height?: number }>;
  try {
    pageMeta = JSON.parse(pageMetaRaw) as Array<{ page: number; width?: number; height?: number }>;
  } catch {
    return jsonResponse({ error: "Overlay page metadata must be valid JSON." }, { status: 400 });
  }
  if (!Array.isArray(pageMeta) || pageMeta.length === 0) {
    return jsonResponse({ error: "Overlay upload requires at least one page." }, { status: 400 });
  }

  const id = randomUUID();
  const assetDir = path.join(overlayAssetRoot, id);
  await mkdir(assetDir, { recursive: true });

  await writeFile(path.join(assetDir, "source.pdf"), Buffer.from(await source.arrayBuffer()));

  const pages: OverlayPage[] = [];
  for (const meta of pageMeta) {
    const pageNumber = Number(meta.page);
    const pageBlob = form?.get(`page-${pageNumber}`);
    if (!(pageBlob instanceof File) || !Number.isInteger(pageNumber) || pageNumber < 1) {
      return jsonResponse({ error: `Missing rendered image for page ${meta.page}.` }, { status: 400 });
    }

    const fileName = `page-${String(pageNumber).padStart(3, "0")}.png`;
    await writeFile(path.join(assetDir, fileName), Buffer.from(await pageBlob.arrayBuffer()));
    pages.push({
      id: randomUUID(),
      page: pageNumber,
      imagePath: `${publicOverlayRoot}/${id}/${fileName}`,
      status: "reference",
      visible: true,
      width: meta.width,
      height: meta.height,
      bounds: null,
      corners: null,
      automask: { threshold: 240, feather: 4 }
    });
  }

  const overlay: Overlay = {
    id,
    name: source.name || "overlay.pdf",
    sourcePath: `${publicOverlayRoot}/${id}/source.pdf`,
    createdAt: new Date().toISOString(),
    pages
  };

  const registry = await readOverlayRegistry();
  registry.overlays.push(overlay);
  await writeJsonFile(overlayPath, registry);
  return jsonResponse(addBasePathToOverlay(overlay), { status: 201 });
}

export async function savePdfOverlays(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.overlays)) {
    return jsonResponse({ error: "Overlay payload must have an overlays array." }, { status: 400 });
  }

  await writeJsonFile(overlayPath, { overlays: body.overlays.map(removeBasePathFromOverlay) });
  return jsonResponse({ ok: true });
}

async function readOverlayRegistry(): Promise<OverlayRegistry> {
  try {
    const data = JSON.parse(await readFile(overlayPath, "utf8"));
    return Array.isArray(data?.overlays) ? data : { overlays: [] };
  } catch {
    return { overlays: [] };
  }
}

function addBasePathToOverlay(overlay: Overlay): Overlay {
  return {
    ...overlay,
    sourcePath: withBasePath(overlay.sourcePath),
    pages: overlay.pages.map((page) => ({ ...page, imagePath: withBasePath(page.imagePath) }))
  };
}

function removeBasePathFromOverlay(overlay: Overlay): Overlay {
  return {
    ...overlay,
    sourcePath: withoutBasePath(overlay.sourcePath),
    pages: overlay.pages.map((page) => ({ ...page, imagePath: withoutBasePath(page.imagePath) }))
  };
}

function withBasePath(pathname: string): string {
  return pathname.startsWith(basePath) ? pathname : `${basePath}${pathname}`;
}

function withoutBasePath(pathname: string): string {
  return basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname;
}
