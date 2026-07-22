import type { DrawnGeometry, DrawnLayer } from "../../map.schema";

export const CUSTOM_START_DRAW = "CUSTOM_START_DRAW";
export const CUSTOM_START_EDIT = "CUSTOM_START_EDIT";
export const CUSTOM_CANCEL_DRAW = "CUSTOM_CANCEL_DRAW";
export const CUSTOM_GEOMETRY_COMPLETE = "CUSTOM_GEOMETRY_COMPLETE";
export const CUSTOM_GEOMETRY_UPDATED = "CUSTOM_GEOMETRY_UPDATED";
export const CUSTOM_LAYERS_CHANGED = "CUSTOM_LAYERS_CHANGED";
export const CUSTOM_DRAW_STOPPED = "CUSTOM_DRAW_STOPPED";

type GeometryData = DrawnGeometry;
type LayerData = DrawnLayer;

const SNAP_PX = 12;
const VERTEX_R = 6;
const MID_R = 4;
const EDGE_HIT_PX = 8;
const COORD_EPS = 1e-10;

let _map: any = null;
let _pendingLayers: LayerData[] | null = null;
let _currentLayers: LayerData[] = [];
let _editingGeometryIdForRender: string | null = null;

// Registered at module scope in the browser; handles layers dispatched before map is ready.
if (typeof document !== "undefined") {
  document.addEventListener(CUSTOM_LAYERS_CHANGED, (e: Event) => {
    const { layers } = (e as CustomEvent<{ layers: LayerData[] }>).detail;
    _currentLayers = layers;
    if (_map) {
      applyLayerRendering(_map, layers);
    } else {
      _pendingLayers = layers;
    }
  });
}

export function initCustomLayersDraw(map: any) {
  _map = map;

  // Render any layers that arrived before map was ready
  if (_pendingLayers) {
    const layers = _pendingLayers;
    _pendingLayers = null;
    if (map.isStyleLoaded()) {
      applyLayerRendering(map, layers);
    } else {
      map.once("load", () => applyLayerRendering(map, layers));
    }
  }

  // Re-render custom layers after basemap switch (style reload clears all sources/layers)
  map.on("style.load", () => {
    if (_currentLayers.length > 0) {
      applyLayerRendering(map, _currentLayers);
    }
  });

  // --- Draw interaction state ---
  const container = map.getContainer() as HTMLElement;
  let drawLayerId: string | null = null;
  let editGeometryId: string | null = null;
  let verts: [number, number][] = [];
  let isClosed = false;
  let addedReplacementVertex = false;
  let svgEl: SVGSVGElement | null = null;
  let mousePx: { x: number; y: number } | null = null;
  let dragIdx: number | null = null;

  function project(lngLat: [number, number]): { x: number; y: number } {
    return map.project(lngLat);
  }

  function unproject(x: number, y: number): [number, number] {
    const ll = map.unproject([x, y]);
    return [ll.lng, ll.lat];
  }

  function containerPos(e: MouseEvent): { x: number; y: number } {
    const r = container.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function activeMode() {
    return editGeometryId ? "edit" : "draw";
  }

  function cleanRing(coordinates: [number, number][]): [number, number][] {
    if (coordinates.length < 2) return [...coordinates];
    const last = coordinates[coordinates.length - 1];
    const first = coordinates[0];
    return sameCoord(first, last) ? coordinates.slice(0, -1) : [...coordinates];
  }

  function closeRing(coordinates: [number, number][]): [number, number][] {
    if (coordinates.length === 0) return [];
    const ring = cleanRing(coordinates);
    return [...ring, ring[0]];
  }

  function sameCoord(a: [number, number], b: [number, number]) {
    return Math.abs(a[0] - b[0]) < COORD_EPS && Math.abs(a[1] - b[1]) < COORD_EPS;
  }

  function distanceToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  function nearestSnap(pos: { x: number; y: number }) {
    if (activeMode() !== "edit") return null;
    let best: { coord: [number, number]; distance: number } | null = null;
    for (const layer of _currentLayers) {
      for (const geometry of layer.geometries) {
        if (geometry.id === editGeometryId) continue;
        for (const coord of cleanRing(geometry.coordinates)) {
          const p = project(coord);
          const distance = Math.hypot(pos.x - p.x, pos.y - p.y);
          if (distance <= SNAP_PX && (!best || distance < best.distance)) {
            best = { coord, distance };
          }
        }
      }
    }
    return best;
  }

  function lngLatForPointer(pos: { x: number; y: number }): [number, number] {
    return nearestSnap(pos)?.coord ?? unproject(pos.x, pos.y);
  }

  function pathBetween(ring: [number, number][], start: number, end: number) {
    const out: [number, number][] = [];
    let i = start;
    for (let guard = 0; guard <= ring.length; guard++) {
      out.push(ring[i]);
      if (i === end) break;
      i = (i + 1) % ring.length;
    }
    return out;
  }

  function pathBetweenReverse(ring: [number, number][], start: number, end: number) {
    const out: [number, number][] = [];
    let i = start;
    for (let guard = 0; guard <= ring.length; guard++) {
      out.push(ring[i]);
      if (i === end) break;
      i = (i - 1 + ring.length) % ring.length;
    }
    return out;
  }

  function compactRing(ring: [number, number][]) {
    const out: [number, number][] = [];
    for (const coord of ring) {
      if (out.length === 0 || !sameCoord(out[out.length - 1], coord)) out.push(coord);
    }
    if (out.length > 1 && sameCoord(out[0], out[out.length - 1])) out.pop();
    return out;
  }

  function mergeBySharedEdge(a: [number, number][], b: [number, number][], ai: number, bi: number) {
    const aj = (ai + 1) % a.length;
    const bj = (bi + 1) % b.length;
    const aOutside = pathBetween(a, aj, ai);
    const bOutside = pathBetween(b, bj, bi);
    return compactRing([...aOutside, ...bOutside.slice(1)]);
  }

  function findJoin() {
    if (!drawLayerId || !editGeometryId || verts.length < 3) return null;
    const ring = compactRing(verts);
    for (let ai = 0; ai < ring.length; ai++) {
      const aj = (ai + 1) % ring.length;
      for (const layer of _currentLayers) {
        if (layer.id !== drawLayerId) continue;
        for (const geometry of layer.geometries) {
          if (geometry.id === editGeometryId) continue;
          const other = compactRing(cleanRing(geometry.coordinates));
          for (const candidate of [other, [...other].reverse()]) {
            for (let bi = 0; bi < candidate.length; bi++) {
              const bj = (bi + 1) % candidate.length;
              if (sameCoord(ring[ai], candidate[bj]) && sameCoord(ring[aj], candidate[bi])) {
                return {
                  joinedGeometryId: geometry.id,
                  coordinates: closeRing(mergeBySharedEdge(ring, candidate, ai, bi))
                };
              }
            }
          }
        }
      }
    }
    return null;
  }

  function dispatchEditUpdate({ stopAfterJoin = true, finished = false } = {}) {
    if (!drawLayerId || !editGeometryId || verts.length < 3) return;
    const joined = isClosed ? findJoin() : null;
    const coordinates = joined?.coordinates ?? closeRing(verts);
    const detail = {
      layerId: drawLayerId,
      geometryId: editGeometryId,
      coordinates,
      joinedGeometryId: joined?.joinedGeometryId,
      finished: finished || Boolean(joined)
    };
    _currentLayers = _currentLayers.map((layer) =>
      layer.id !== drawLayerId
        ? layer
        : {
            ...layer,
            geometries: layer.geometries
              .filter((geometry) => geometry.id !== joined?.joinedGeometryId)
              .map((geometry) => geometry.id === editGeometryId ? { ...geometry, coordinates } : geometry)
          }
    );
    document.dispatchEvent(
      new CustomEvent(CUSTOM_GEOMETRY_UPDATED, {
        detail
      })
    );
    if (joined && stopAfterJoin) stopDraw();
  }

  function reopenFromDeletedEdge(edgeIndex: number, pos: { x: number; y: number }) {
    const next = (edgeIndex + 1) % verts.length;
    const a = project(verts[edgeIndex]);
    const b = project(verts[next]);
    const continueFromA = Math.hypot(pos.x - a.x, pos.y - a.y) <= Math.hypot(pos.x - b.x, pos.y - b.y);
    verts = continueFromA
      ? pathBetween(verts, next, edgeIndex)
      : pathBetweenReverse(verts, edgeIndex, next);
    isClosed = false;
    addedReplacementVertex = false;
    render();
  }

  function canCloseOpenPath(endpointIndex: number) {
    if (isClosed || verts.length < 3 || endpointIndex !== 0) return false;
    return activeMode() === "draw" || addedReplacementVertex;
  }

  function render() {
    if (!svgEl) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    svgEl.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svgEl.innerHTML = "";

    if (verts.length === 0) return;

    const pts = verts.map(project);

    if (verts.length >= 3 && (isClosed || activeMode() === "draw")) {
      const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      poly.setAttribute("points", pts.map(p => `${p.x},${p.y}`).join(" "));
      poly.setAttribute("fill", "rgba(47,111,237,0.12)");
      poly.setAttribute("stroke", "none");
      svgEl.appendChild(poly);
    }

    const edgeCount = isClosed && verts.length >= 3 ? pts.length : pts.length - 1;
    for (let i = 0; i < edgeCount; i++) {
      const j = (i + 1) % pts.length;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(pts[i].x));
      line.setAttribute("y1", String(pts[i].y));
      line.setAttribute("x2", String(pts[j].x));
      line.setAttribute("y2", String(pts[j].y));
      line.setAttribute("stroke", "#2f6fed");
      line.setAttribute("stroke-width", "2");
      if (isClosed && activeMode() === "edit") {
        line.style.pointerEvents = "stroke";
        line.style.cursor = "copy";
        line.addEventListener("contextmenu", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          reopenFromDeletedEdge(i, containerPos(ev));
        });
      }
      svgEl.appendChild(line);
    }

    if (!isClosed && verts.length >= 3 && (activeMode() === "draw" || addedReplacementVertex)) {
      const first = pts[0];
      const last = pts[pts.length - 1];
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(last.x));
      line.setAttribute("y1", String(last.y));
      line.setAttribute("x2", String(first.x));
      line.setAttribute("y2", String(first.y));
      line.setAttribute("stroke", "#2f6fed");
      line.setAttribute("stroke-width", "1.5");
      line.setAttribute("stroke-dasharray", "5 3");
      line.setAttribute("opacity", "0.4");
      svgEl.appendChild(line);
    }

    // Preview line from last vertex to mouse cursor
    if (!isClosed && mousePx && dragIdx === null && verts.length > 0) {
      const last = pts[pts.length - 1];
      const snap = nearestSnap(mousePx);
      const end = snap ? project(snap.coord) : mousePx;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(last.x));
      line.setAttribute("y1", String(last.y));
      line.setAttribute("x2", String(end.x));
      line.setAttribute("y2", String(end.y));
      line.setAttribute("stroke", "#2f6fed");
      line.setAttribute("stroke-width", "1.5");
      line.setAttribute("stroke-dasharray", "5 3");
      line.setAttribute("opacity", "0.45");
      svgEl.appendChild(line);
    }

    if (verts.length >= 2) {
      const segCount = isClosed && verts.length >= 3 ? verts.length : verts.length - 1;
      for (let i = 0; i < segCount; i++) {
        const j = (i + 1) % verts.length;
        const mx = (pts[i].x + pts[j].x) / 2;
        const my = (pts[i].y + pts[j].y) / 2;
        const geoMid: [number, number] = [
          (verts[i][0] + verts[j][0]) / 2,
          (verts[i][1] + verts[j][1]) / 2,
        ];
        const insertAt = i + 1; // insert between i and j

        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("cx", String(mx));
        c.setAttribute("cy", String(my));
        c.setAttribute("r", String(MID_R));
        c.setAttribute("fill", "white");
        c.setAttribute("stroke", "#2f6fed");
        c.setAttribute("stroke-width", "1.5");
        c.style.pointerEvents = "all";
        c.style.cursor = "crosshair";
        c.addEventListener("click", (ev) => {
          ev.stopPropagation();
          verts = [...verts.slice(0, insertAt), geoMid, ...verts.slice(insertAt)];
          if (isClosed && editGeometryId) dispatchEditUpdate({ stopAfterJoin: false });
          render();
        });
        svgEl.appendChild(c);
      }
    }

    // Vertex handles (drawn last so they sit above midpoints)
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const isFirst = i === 0;
      const snapping =
        isFirst &&
        verts.length >= 3 &&
        !isClosed &&
        mousePx !== null &&
        Math.hypot(mousePx.x - p.x, mousePx.y - p.y) < SNAP_PX;
      const externalSnap = dragIdx === i && mousePx ? nearestSnap(mousePx) : null;

      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", String(externalSnap ? project(externalSnap.coord).x : p.x));
      c.setAttribute("cy", String(externalSnap ? project(externalSnap.coord).y : p.y));
      c.setAttribute("r", String(snapping || externalSnap ? VERTEX_R + 3 : VERTEX_R));
      c.setAttribute("fill", isFirst ? "#2f6fed" : "white");
      c.setAttribute("stroke", snapping || externalSnap ? "#1a56d4" : "#2f6fed");
      c.setAttribute("stroke-width", snapping || externalSnap ? "3" : "2");
      c.style.pointerEvents = "all";
      c.style.cursor = "grab";

      const idx = i;
      c.addEventListener("mousedown", (ev) => {
        if (ev.button !== 0) return;
        ev.stopPropagation();
        ev.preventDefault();
        if (canCloseOpenPath(idx)) {
          completePolygon();
          return;
        }
        dragIdx = idx;
      });
      c.addEventListener("click", (ev) => {
        if (!canCloseOpenPath(idx)) return;
        ev.stopPropagation();
        ev.preventDefault();
        completePolygon();
      });
      c.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        verts = verts.length <= 1 ? [] : verts.filter((_, vi) => vi !== idx);
        if (verts.length < 3) isClosed = false;
        if (isClosed && editGeometryId) dispatchEditUpdate({ stopAfterJoin: false });
        render();
      });
      svgEl.appendChild(c);
    }
  }

  function onContainerMouseMove(e: MouseEvent) {
    if (!drawLayerId) return;
    mousePx = containerPos(e);
    render();
  }

  function onDocMouseMove(e: MouseEvent) {
    if (dragIdx === null || !drawLayerId) return;
    const pos = containerPos(e);
    mousePx = pos;
    verts[dragIdx] = lngLatForPointer(pos);
    render();
  }

  function onDocMouseUp(e: MouseEvent) {
    if (e.button === 0 && dragIdx !== null) {
      dragIdx = null;
      if (editGeometryId && isClosed) dispatchEditUpdate();
      render();
    }
  }

  function onMapClick(e: any) {
    if (!drawLayerId || isClosed) return;
    const event = e.originalEvent as MouseEvent | undefined;
    const pos = event ? containerPos(event) : project([e.lngLat.lng, e.lngLat.lat]);
    const lngLat = lngLatForPointer(pos);

    if (verts.length >= 3) {
      const fp = project(verts[0]);
      if (Math.hypot(pos.x - fp.x, pos.y - fp.y) < SNAP_PX) {
        if (activeMode() === "draw" || addedReplacementVertex) completePolygon();
        return;
      }
    }

    verts = [...verts, lngLat];
    if (editGeometryId && !isClosed) addedReplacementVertex = true;
    render();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && drawLayerId) stopDraw(true);
  }

  function onMapMove() {
    if (drawLayerId) render();
  }

  function onContainerContextMenu(e: MouseEvent) {
    if (!drawLayerId || !editGeometryId || !isClosed || verts.length < 3) return;
    const pos = containerPos(e);
    const pts = verts.map(project);
    let best: { edgeIndex: number; distance: number } | null = null;
    for (let i = 0; i < pts.length; i++) {
      const distance = distanceToSegment(pos, pts[i], pts[(i + 1) % pts.length]);
      if (distance <= EDGE_HIT_PX && (!best || distance < best.distance)) {
        best = { edgeIndex: i, distance };
      }
    }
    if (!best) return;
    e.preventDefault();
    e.stopPropagation();
    reopenFromDeletedEdge(best.edgeIndex, pos);
  }

  function completePolygon() {
    if (!drawLayerId || verts.length < 3) return;
    isClosed = true;
    const coordinates = closeRing(verts);
    if (editGeometryId) {
      dispatchEditUpdate({ finished: true });
    } else {
      document.dispatchEvent(
        new CustomEvent(CUSTOM_GEOMETRY_COMPLETE, { detail: { layerId: drawLayerId, coordinates } })
      );
    }
    stopDraw();
  }

  function startDraw(layerId: string) {
    stopDraw();
    drawLayerId = layerId;
    editGeometryId = null;
    verts = [];
    isClosed = false;
    addedReplacementVertex = false;
    dragIdx = null;
    mousePx = null;

    svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGSVGElement;
    Object.assign(svgEl.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "10",
    });
    container.appendChild(svgEl);
    container.style.cursor = "crosshair";

    map.on("click", onMapClick);
    map.on("move", onMapMove);
    container.addEventListener("mousemove", onContainerMouseMove);
    document.addEventListener("mousemove", onDocMouseMove);
    document.addEventListener("mouseup", onDocMouseUp);
    document.addEventListener("keydown", onKeyDown);
  }

  function startEdit(layerId: string, geometry: GeometryData) {
    stopDraw();
    drawLayerId = layerId;
    editGeometryId = geometry.id;
    _editingGeometryIdForRender = geometry.id;
    verts = cleanRing(geometry.coordinates);
    isClosed = verts.length >= 3;
    addedReplacementVertex = false;
    dragIdx = null;
    mousePx = null;

    svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGSVGElement;
    Object.assign(svgEl.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "10",
    });
    container.appendChild(svgEl);
    container.style.cursor = "crosshair";

    map.on("click", onMapClick);
    map.on("move", onMapMove);
    container.addEventListener("mousemove", onContainerMouseMove);
    container.addEventListener("contextmenu", onContainerContextMenu);
    document.addEventListener("mousemove", onDocMouseMove);
    document.addEventListener("mouseup", onDocMouseUp);
    document.addEventListener("keydown", onKeyDown);
    applyLayerRendering(map, _currentLayers);
    render();
  }

  function stopDraw(notify = false) {
    const wasEditing = _editingGeometryIdForRender !== null;
    drawLayerId = null;
    editGeometryId = null;
    _editingGeometryIdForRender = null;
    verts = [];
    isClosed = false;
    addedReplacementVertex = false;
    dragIdx = null;
    mousePx = null;

    svgEl?.remove();
    svgEl = null;
    container.style.cursor = "";

    map.off("click", onMapClick);
    map.off("move", onMapMove);
    container.removeEventListener("mousemove", onContainerMouseMove);
    container.removeEventListener("contextmenu", onContainerContextMenu);
    document.removeEventListener("mousemove", onDocMouseMove);
    document.removeEventListener("mouseup", onDocMouseUp);
    document.removeEventListener("keydown", onKeyDown);
    if (wasEditing) applyLayerRendering(map, _currentLayers);
    if (notify) document.dispatchEvent(new CustomEvent(CUSTOM_DRAW_STOPPED));
  }

  document.addEventListener(CUSTOM_START_DRAW, (e: Event) => {
    startDraw((e as CustomEvent<{ layerId: string }>).detail.layerId);
  });

  document.addEventListener(CUSTOM_START_EDIT, (e: Event) => {
    const { layerId, geometry } = (e as CustomEvent<{ layerId: string; geometry: GeometryData }>).detail;
    startEdit(layerId, geometry);
  });

  document.addEventListener(CUSTOM_CANCEL_DRAW, () => stopDraw(true));
}

function applyLayerRendering(map: any, layers: LayerData[]) {
  if (!map.isStyleLoaded()) {
    map.once("styledata", () => applyLayerRendering(map, layers));
    return;
  }

  // Remove map layers/sources for custom layers no longer present
  const existingMapLayerIds: string[] = (map.getStyle()?.layers ?? []).map((l: any) => l.id as string);
  const layerIdSet = new Set(layers.map(l => l.id));

  const toRemoveMapLayers = existingMapLayerIds.filter(
    id =>
      (id.startsWith("custom-fill-") || id.startsWith("custom-line-")) &&
      !layerIdSet.has(id.replace(/^custom-(fill|line)-/, ""))
  );
  for (const id of toRemoveMapLayers) {
    if (map.getLayer(id)) map.removeLayer(id);
  }

  const existingSrcIds = Object.keys(map.getStyle()?.sources ?? {});
  const toRemoveSrcs = existingSrcIds.filter(
    id => id.startsWith("custom-src-") && !layerIdSet.has(id.replace("custom-src-", ""))
  );
  for (const id of toRemoveSrcs) {
    if (map.getSource(id)) map.removeSource(id);
  }

  // Add or update sources and layers for each custom layer
  for (const layer of layers) {
    const srcId = `custom-src-${layer.id}`;
    const fillId = `custom-fill-${layer.id}`;
    const lineId = `custom-line-${layer.id}`;
    const visibility = layer.visible ? "visible" : "none";

    const geojson = {
      type: "FeatureCollection" as const,
      features: layer.geometries
        .filter(g => g.id !== _editingGeometryIdForRender && g.visible !== false && g.coordinates.length >= 4) // closed ring needs at least 4 points
        .map(g => ({
          type: "Feature" as const,
          properties: { id: g.id, name: g.name },
          geometry: { type: "Polygon" as const, coordinates: [g.coordinates] },
        })),
    };

    if (map.getSource(srcId)) {
      map.getSource(srcId).setData(geojson);
    } else {
      map.addSource(srcId, { type: "geojson", data: geojson });
    }

    if (!map.getLayer(fillId)) {
      map.addLayer({ id: fillId, type: "fill", source: srcId, paint: { "fill-color": "#2f6fed", "fill-opacity": 0.15 } });
    }
    if (!map.getLayer(lineId)) {
      map.addLayer({ id: lineId, type: "line", source: srcId, paint: { "line-color": "#2f6fed", "line-width": 2 } });
    }

    map.setLayoutProperty(fillId, "visibility", visibility);
    map.setLayoutProperty(lineId, "visibility", visibility);
  }
}
