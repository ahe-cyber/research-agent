export const PDF_BOUNDS_UPDATED = "pdf-bounds-updated";

let _map: any = null;

interface ActiveOverlay {
  file: string;
  page: number;
  dataUrl: string;
  coordinates: number[][];
  visible: boolean;
}

const active = new Map<string, ActiveOverlay>();

export function initPdfOverlayRenderer(map: any) {
  _map = map;
  map.on("style.load", () => {
    for (const [k, overlay] of active) {
      if (overlay.visible) addToMap(k, overlay.dataUrl, overlay.coordinates);
    }
  });
  initMoveMode(map);
}

function key(file: string, page: number) {
  return `${file.replace(/\W+/g, "_")}_p${page}`;
}
function srcId(k: string) { return `pdf_src_${k}`; }
function lyrId(k: string) { return `pdf_lyr_${k}`; }

function addToMap(k: string, dataUrl: string, coordinates: number[][]) {
  if (!_map) return;
  try {
    if (_map.getSource(srcId(k))) {
      replaceImageSource(k, dataUrl, coordinates);
    } else {
      addImageSource(k, dataUrl, coordinates);
    }
  } catch (err) {
    console.warn("[PDF overlay] addToMap failed:", err);
  }
}

function addImageSource(k: string, dataUrl: string, coordinates: number[][]) {
  _map.addSource(srcId(k), { type: "image", url: dataUrl, coordinates });
  _map.addLayer({
    id: lyrId(k),
    type: "raster",
    source: srcId(k),
    paint: { "raster-opacity": 0.5, "raster-resampling": "nearest" }
  });
}

function replaceImageSource(k: string, dataUrl: string, coordinates: number[][]) {
  const visibility = _map.getLayer(lyrId(k))
    ? _map.getLayoutProperty(lyrId(k), "visibility")
    : "visible";
  removeFromMap(k);
  addImageSource(k, dataUrl, coordinates);
  if (visibility) _map.setLayoutProperty(lyrId(k), "visibility", visibility);
}

function removeFromMap(k: string) {
  if (!_map) return;
  try {
    if (_map.getLayer(lyrId(k))) _map.removeLayer(lyrId(k));
    if (_map.getSource(srcId(k))) _map.removeSource(srcId(k));
  } catch (_) { /* ignore during style transitions */ }
}

function applyAutomask(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  threshold: number,
  feather: number
) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const softStart = threshold - feather;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (lum >= threshold) {
      d[i + 3] = 0;
    } else if (feather > 0 && lum >= softStart) {
      d[i + 3] = Math.round(((lum - softStart) / feather) * d[i + 3]);
    }
  }
  ctx.putImageData(img, 0, 0);
}

export async function renderPageOverlay(
  file: string,
  page: number,
  bounds: [[number, number], [number, number]],
  pdfDoc: any,
  automask: { threshold: number; feather: number },
  precomputedCoordinates?: number[][]
) {
  console.log("[PDF overlay] renderPageOverlay", file, "page", page);
  try {
    const pdfPage = await pdfDoc.getPage(page);
    const viewport = pdfPage.getViewport({ scale: 4 });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;

    await pdfPage.render({ canvas, canvasContext: ctx, viewport }).promise;
    applyAutomask(ctx, canvas.width, canvas.height, automask.threshold, automask.feather);

    const dataUrl = canvas.toDataURL("image/png");
    const [[lat1, lng1], [lat2, lng2]] = bounds;
    // Use pre-computed coordinates (after rotate/scale) if available, otherwise derive from bounds
    const coordinates = precomputedCoordinates ?? [[lng1, lat1], [lng2, lat1], [lng2, lat2], [lng1, lat2]];

    const k = key(file, page);
    active.set(k, { file, page, dataUrl, coordinates, visible: true });
    addToMap(k, dataUrl, coordinates);
  } catch (err) {
    console.error("[PDF overlay] renderPageOverlay failed:", err);
  }
}

export async function renderImageOverlay(
  file: string,
  page: number,
  imagePath: string,
  bounds: [[number, number], [number, number]],
  automask: { threshold: number; feather: number },
  precomputedCoordinates?: number[][]
) {
  try {
    const dataUrl = await loadMaskedImageDataUrl(imagePath, automask);
    const [[lat1, lng1], [lat2, lng2]] = bounds;
    const coordinates = precomputedCoordinates ?? [[lng1, lat1], [lng2, lat1], [lng2, lat2], [lng1, lat2]];
    const k = key(file, page);
    active.set(k, { file, page, dataUrl, coordinates, visible: true });
    addToMap(k, dataUrl, coordinates);
  } catch (err) {
    console.error("[PDF overlay] renderImageOverlay failed:", err);
  }
}

export function setPageVisibility(file: string, page: number, visible: boolean) {
  const k = key(file, page);
  const overlay = active.get(k);
  if (!overlay) return;
  overlay.visible = visible;
  if (!_map) return;
  try {
    if (visible) {
      _map.getLayer(lyrId(k))
        ? _map.setLayoutProperty(lyrId(k), "visibility", "visible")
        : addToMap(k, overlay.dataUrl, overlay.coordinates);
    } else if (_map.getLayer(lyrId(k))) {
      _map.setLayoutProperty(lyrId(k), "visibility", "none");
    }
  } catch (_) { /* ignore */ }
}

export function hasPageOverlay(file: string, page: number) {
  return active.has(key(file, page));
}

export function removePageOverlay(file: string, page: number) {
  const k = key(file, page);
  removeFromMap(k);
  active.delete(k);
}

// Show/hide all layers for a file. pageStates is the per-page visible flags so
// un-muting restores each page's individual state rather than forcing all on.
export function setFileVisibility(file: string, pageStates: { page: number; visible: boolean }[], show: boolean) {
  for (const { page, visible } of pageStates) {
    setPageVisibility(file, page, show && visible);
  }
}

export function removeFileOverlays(file: string, pages: number[]) {
  for (const page of pages) {
    const k = key(file, page);
    removeFromMap(k);
    active.delete(k);
  }
}

function loadMaskedImageDataUrl(
  imagePath: string,
  automask: { threshold: number; feather: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable."));
        return;
      }
      ctx.drawImage(img, 0, 0);
      applyAutomask(ctx, canvas.width, canvas.height, automask.threshold, automask.feather);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error(`Failed to load ${imagePath}.`));
    img.src = imagePath;
  });
}

// ---------------------------------------------------------------------------
// Space-to-transform mode  (left-drag=move, right-drag=rotate, scroll=scale)
// ---------------------------------------------------------------------------

function initMoveMode(map: any) {
  const container: HTMLElement = map.getContainer();
  let spaceHeld = false;

  interface DragState {
    mode: "move" | "rotate";
    key: string;
    file: string;
    page: number;
    startX: number;
    startY: number;
    originalScreenCoords: [number, number][];
    // rotate only
    centerX: number;
    centerY: number;
    startAngle: number;
  }
  let drag: DragState | null = null;
  let moveRafId: number | null = null;
  let wheelDebounce: ReturnType<typeof setTimeout> | null = null;

  function isTypingTarget(e: KeyboardEvent) {
    const el = e.target as HTMLElement;
    return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
  }

  function hitTest(mx: number, my: number): [string, ActiveOverlay] | null {
    const { lng, lat } = map.unproject([mx, my]);
    for (const [k, overlay] of [...active.entries()].reverse()) {
      if (!overlay.visible) continue;
      const lngs = overlay.coordinates.map((c) => c[0]);
      const lats = overlay.coordinates.map((c) => c[1]);
      if (lng >= Math.min(...lngs) && lng <= Math.max(...lngs) &&
          lat >= Math.min(...lats) && lat <= Math.max(...lats)) {
        return [k, overlay];
      }
    }
    return null;
  }

  function screenCoords(overlay: ActiveOverlay): [number, number][] {
    return overlay.coordinates.map((c) => {
      const p = map.project(c as [number, number]);
      return [p.x, p.y] as [number, number];
    });
  }

  function flushCoords(k: string) {
    if (moveRafId === null) {
      moveRafId = requestAnimationFrame(() => {
        moveRafId = null;
        try {
          (_map.getSource(srcId(k)) as any)?.setCoordinates(active.get(k)?.coordinates);
        } catch (_) { /* ignore */ }
      });
    }
  }

  // Dispatch all 4 corners to React for server persistence.
  function persist(file: string, page: number, coordinates: number[][]) {
    const corners = coordinates.map(([lng, lat]) => [lat, lng]) as
      [[number, number], [number, number], [number, number], [number, number]];
    document.dispatchEvent(new CustomEvent(PDF_BOUNDS_UPDATED, {
      detail: { file, page, corners }
    }));
  }

  function endSpaceMode() {
    spaceHeld = false;
    if (!drag) {
      map.dragPan.enable();
      map.dragRotate.enable();
      map.scrollZoom.enable();
      container.style.cursor = "";
    }
  }

  // --- Space key ---
  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || isTypingTarget(e) || e.repeat) return;
    e.preventDefault();
    spaceHeld = true;
    map.dragPan.disable();
    map.dragRotate.disable();
    map.scrollZoom.disable();
    container.style.cursor = "grab";
  });

  document.addEventListener("keyup", (e) => {
    if (e.code === "Space" || e.code === "AltLeft" || e.code === "AltRight") endSpaceMode();
  });

  window.addEventListener("blur", endSpaceMode);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) endSpaceMode();
  });

  // --- Left-click = move, right-click = rotate ---
  container.addEventListener("mousedown", (e) => {
    if (!spaceHeld || (e.button !== 0 && e.button !== 2)) return;
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = hitTest(mx, my);
    if (!hit) return;
    const [k, overlay] = hit;
    const sc = screenCoords(overlay);
    const cx = sc.reduce((s, [x]) => s + x, 0) / sc.length;
    const cy = sc.reduce((s, [, y]) => s + y, 0) / sc.length;
    drag = {
      mode: e.button === 2 ? "rotate" : "move",
      key: k, file: overlay.file, page: overlay.page,
      startX: mx, startY: my,
      originalScreenCoords: sc,
      centerX: cx, centerY: cy,
      startAngle: Math.atan2(my - cy, mx - cx),
    };
    container.style.cursor = "grabbing";
    e.preventDefault();
  });

  container.addEventListener("contextmenu", (e) => {
    if (spaceHeld) e.preventDefault();
  });

  // --- Scroll = scale around cursor ---
  container.addEventListener("wheel", (e) => {
    if (!spaceHeld) return;
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = hitTest(mx, my);
    if (!hit) return;
    const [k, overlay] = hit;

    const raw = normalizeWheelDelta(e);
    const zoom = typeof map.getZoom === "function" ? map.getZoom() : 14;
    const zoomDamping = Math.pow(2, Math.max(0, zoom - 14));
    const modifierDamping = e.altKey ? 4 : e.shiftKey ? 0.25 : 1;
    const scale = Math.pow(0.9, raw * modifierDamping / zoomDamping);

    const sc = screenCoords(overlay);
    const newCoords = sc.map(([sx, sy]) => {
      const { lng, lat } = map.unproject([mx + (sx - mx) * scale, my + (sy - my) * scale]);
      return [lng, lat];
    });
    overlay.coordinates = newCoords;
    try {
      (_map.getSource(srcId(k)) as any)?.setCoordinates(newCoords);
    } catch (_) { /* ignore */ }

    if (wheelDebounce) clearTimeout(wheelDebounce);
    wheelDebounce = setTimeout(() => persist(overlay.file, overlay.page, overlay.coordinates), 250);
  }, { passive: false });

  // --- Mouse move ---
  document.addEventListener("mousemove", (e) => {
    if (!drag) return;
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const overlay = active.get(drag.key);
    if (!overlay) return;

    let newCoords: number[][];
    if (drag.mode === "move") {
      const dx = mx - drag.startX;
      const dy = my - drag.startY;
      newCoords = drag.originalScreenCoords.map(([sx, sy]) => {
        const { lng, lat } = map.unproject([sx + dx, sy + dy]);
        return [lng, lat];
      });
    } else {
      const angle = Math.atan2(my - drag.centerY, mx - drag.centerX) - drag.startAngle;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      newCoords = drag.originalScreenCoords.map(([sx, sy]) => {
        const dx = sx - drag.centerX;
        const dy = sy - drag.centerY;
        const { lng, lat } = map.unproject([
          drag.centerX + dx * cos - dy * sin,
          drag.centerY + dx * sin + dy * cos,
        ]);
        return [lng, lat];
      });
    }

    overlay.coordinates = newCoords;
    flushCoords(drag.key);
  });

  // --- Mouse up ---
  document.addEventListener("mouseup", () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (moveRafId !== null) { cancelAnimationFrame(moveRafId); moveRafId = null; }
    container.style.cursor = spaceHeld ? "grab" : "";
    if (!spaceHeld) {
      map.dragPan.enable();
      map.dragRotate.enable();
      map.scrollZoom.enable();
    }
    const overlay = active.get(d.key);
    if (overlay) persist(d.file, d.page, overlay.coordinates);
  });
}

function normalizeWheelDelta(e: WheelEvent) {
  if (e.deltaMode === 0) return e.deltaY / 150;
  if (e.deltaMode === 1) return e.deltaY;
  return e.deltaY * 3;
}
