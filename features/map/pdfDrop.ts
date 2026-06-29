const DRAG_TYPE = "application/pdf-page";

export const PDF_BOUNDS_SET = "pdf-bounds-set";
export const PDF_PLACE_REQUEST = "pdf-place-request";
let activePlacementCleanup: (() => void) | null = null;

export interface PdfBoundsDetail {
  file: string;
  page: number;
  bounds: [[number, number], [number, number]]; // [[lat, lng] top-left, [lat, lng] bottom-right]
}

interface DragPayload {
  file: string;
  page: number;
  aspectRatio?: number; // pageWidth / pageHeight
}

export function createPdfDragPayload(
  file: string,
  page: number,
  width?: number,
  height?: number
) {
  const payload: DragPayload = { file, page };
  if (width && height) payload.aspectRatio = width / height;
  return JSON.stringify(payload);
}

export function requestPdfPlacement(file: string, page: number, width?: number, height?: number) {
  document.dispatchEvent(new CustomEvent<DragPayload>(PDF_PLACE_REQUEST, {
    detail: JSON.parse(createPdfDragPayload(file, page, width, height))
  }));
}

export function registerMapDropZone(map: any) {
  const container: HTMLElement = map.getContainer();

  container.addEventListener("dragover", (e) => {
    if (!e.dataTransfer?.types.includes(DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });

  container.addEventListener("drop", (e) => {
    const raw = e.dataTransfer?.getData(DRAG_TYPE);
    if (!raw) return;
    e.preventDefault();

    let payload: DragPayload;
    try { payload = JSON.parse(raw); } catch { return; }

    const cr = container.getBoundingClientRect();
    startPlacementMode(map, container, payload, {
      x: e.clientX - cr.left,
      y: e.clientY - cr.top
    });
  });

  document.addEventListener(PDF_PLACE_REQUEST, (e: Event) => {
    startPlacementMode(map, container, (e as CustomEvent<DragPayload>).detail);
  });
}

function startPlacementMode(
  map: any,
  container: HTMLElement,
  payload: DragPayload,
  initialAnchor?: { x: number; y: number }
) {
  activePlacementCleanup?.();
  const { aspectRatio } = payload;
  let anchor: { x: number; y: number } | null = initialAnchor ?? null;
  let hasDragged = false;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:100";
  container.appendChild(svg);

  const selRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  selRect.setAttribute("fill", "rgba(47,111,237,0.08)");
  selRect.setAttribute("stroke", "#2f6fed");
  selRect.setAttribute("stroke-width", "1.5");
  selRect.setAttribute("stroke-dasharray", "5 3");
  svg.appendChild(selRect);

  const anchorDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  anchorDot.setAttribute("r", "4");
  anchorDot.setAttribute("fill", "#2f6fed");
  svg.appendChild(anchorDot);
  if (anchor) {
    anchorDot.setAttribute("cx", String(anchor.x));
    anchorDot.setAttribute("cy", String(anchor.y));
  }

  container.style.cursor = "crosshair";
  map.dragPan.disable();

  // Returns the constrained bottom-right pixel point given raw mouse position.
  // If aspectRatio is known, height is derived from the horizontal span.
  function constrain(mouseX: number, mouseY: number): { x: number; y: number } {
    if (!anchor) return { x: mouseX, y: mouseY };
    const dx = mouseX - anchor.x;
    if (aspectRatio) {
      return { x: mouseX, y: anchor.y + dx / aspectRatio };
    }
    return { x: mouseX, y: mouseY };
  }

  function updateRect(mouseX: number, mouseY: number) {
    if (!anchor) return;
    const br = constrain(mouseX, mouseY);
    selRect.setAttribute("x", String(Math.min(anchor.x, br.x)));
    selRect.setAttribute("y", String(Math.min(anchor.y, br.y)));
    selRect.setAttribute("width", String(Math.abs(br.x - anchor.x)));
    selRect.setAttribute("height", String(Math.abs(br.y - anchor.y)));
  }

  function onMouseMove(e: MouseEvent) {
    const cr = container.getBoundingClientRect();
    updateRect(e.clientX - cr.left, e.clientY - cr.top);
  }

  function onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    const cr = container.getBoundingClientRect();
    anchor = { x: e.clientX - cr.left, y: e.clientY - cr.top };
    hasDragged = false;
    anchorDot.setAttribute("cx", String(anchor.x));
    anchorDot.setAttribute("cy", String(anchor.y));
    updateRect(anchor.x, anchor.y);
    e.preventDefault();
  }

  function onMouseUp(e: MouseEvent) {
    if (e.button !== 0 || !anchor || !hasDragged) return;
    cleanup();
    const cr = container.getBoundingClientRect();
    const br = constrain(e.clientX - cr.left, e.clientY - cr.top);
    const topLeft = map.unproject([Math.min(anchor.x, br.x), Math.min(anchor.y, br.y)]);
    const bottomRight = map.unproject([Math.max(anchor.x, br.x), Math.max(anchor.y, br.y)]);
    document.dispatchEvent(new CustomEvent<PdfBoundsDetail>(PDF_BOUNDS_SET, {
      detail: {
        file: payload.file,
        page: payload.page,
        bounds: [[topLeft.lat, topLeft.lng], [bottomRight.lat, bottomRight.lng]]
      }
    }));
  }

  function onDragMouseMove(e: MouseEvent) {
    if (!anchor) return;
    hasDragged = true;
    onMouseMove(e);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") cleanup();
  }

  function cleanup() {
    if (activePlacementCleanup !== cleanup) return;
    activePlacementCleanup = null;
    container.removeEventListener("mousedown", onMouseDown);
    container.removeEventListener("mousemove", onDragMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.removeEventListener("keydown", onKeyDown);
    container.style.cursor = "";
    map.dragPan.enable();
    svg.remove();
  }

  activePlacementCleanup = cleanup;
  if (anchor) updateRect(anchor.x, anchor.y);
  container.addEventListener("mousedown", onMouseDown);
  container.addEventListener("mousemove", onDragMouseMove);
  document.addEventListener("mouseup", onMouseUp);
  document.addEventListener("keydown", onKeyDown);
}
