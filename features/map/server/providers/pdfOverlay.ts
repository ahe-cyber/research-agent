import type { PdfOverlay, PdfOverlayPage } from "@/features/map/map.schema";

type OverlayPage = PdfOverlayPage;
type Overlay = PdfOverlay;

interface OverlayRegistry {
  overlays: Overlay[];
}

export async function getPdfOverlays() {
  const { jsonResponse } = await import("@/lib/server/files");
  const registry = await readOverlayRegistry();
  return jsonResponse({ overlays: registry.overlays.map(addBasePathToOverlay) });
}

export async function uploadPdfOverlay(request: Request) {
  const { randomUUID } = await import("node:crypto");
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const { jsonResponse, writeJsonFile } = await import("@/lib/server/files");
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
  const assetDir = path.join(process.cwd(), "public", "assets", "overlay", id);
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
      imagePath: `/assets/overlay/${id}/${fileName}`,
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
    sourcePath: `/assets/overlay/${id}/source.pdf`,
    createdAt: new Date().toISOString(),
    pages
  };

  const registry = await readOverlayRegistry();
  registry.overlays.push(overlay);
  await writeJsonFile(await getOverlayPath(), registry);
  return jsonResponse(addBasePathToOverlay(overlay), { status: 201 });
}

export async function savePdfOverlays(request: Request) {
  const { jsonResponse, writeJsonFile } = await import("@/lib/server/files");
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.overlays)) {
    return jsonResponse({ error: "Overlay payload must have an overlays array." }, { status: 400 });
  }

  await writeJsonFile(await getOverlayPath(), { overlays: body.overlays.map(removeBasePathFromOverlay) });
  return jsonResponse({ ok: true });
}

async function readOverlayRegistry(): Promise<OverlayRegistry> {
  const { readFile } = await import("node:fs/promises");
  try {
    const data = JSON.parse(await readFile(await getOverlayPath(), "utf8"));
    return Array.isArray(data?.overlays) ? data : { overlays: [] };
  } catch {
    return { overlays: [] };
  }
}

async function getOverlayPath() {
  const { dataPath } = await import("@/lib/server/files");
  return dataPath("overlay.json");
}

function addBasePathToOverlay(overlay: Overlay): Overlay {
  return {
    ...overlay,
    sourcePath: withConfiguredBasePath(overlay.sourcePath),
    pages: overlay.pages.map((page) => ({ ...page, imagePath: withConfiguredBasePath(page.imagePath) }))
  };
}

function removeBasePathFromOverlay(overlay: Overlay): Overlay {
  return {
    ...overlay,
    sourcePath: withoutConfiguredBasePath(overlay.sourcePath),
    pages: overlay.pages.map((page) => ({ ...page, imagePath: withoutConfiguredBasePath(page.imagePath) }))
  };
}

function withConfiguredBasePath(pathname: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return pathname.startsWith(basePath) ? pathname : `${basePath}${pathname}`;
}

function withoutConfiguredBasePath(pathname: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname;
}
