import { useEffect, useRef, useState } from "react";
import { withBasePath } from "../../lib/basePath";
import {
  CUSTOM_START_DRAW,
  CUSTOM_CANCEL_DRAW,
  CUSTOM_DRAW_STOPPED,
  CUSTOM_GEOMETRY_COMPLETE,
  CUSTOM_GEOMETRY_UPDATED,
  CUSTOM_LAYERS_CHANGED,
  CUSTOM_START_EDIT,
} from "./customLayersDraw";

interface Geometry {
  id: string;
  name: string;
  visible?: boolean;
  coordinates: [number, number][];
}

interface CustomLayer {
  id: string;
  name: string;
  visible: boolean;
  category?: LayerCategory;
  collapsed?: boolean;
  geometries: Geometry[];
}

type LayerCategory = "global" | "local" | "manual";

async function loadLayers(): Promise<CustomLayer[]> {
  try {
    const r = await fetch(withBasePath("/api/map/geometry"));
    const d = await r.json();
    return Array.isArray(d?.layers)
      ? d.layers.map((layer: CustomLayer) => ({
          ...layer,
          geometries: (layer.geometries || []).map((geometry) => ({
            ...geometry,
            visible: geometry.visible !== false
          }))
        }))
      : [];
  } catch {
    return [];
  }
}

async function saveLayers(layers: CustomLayer[]) {
  try {
    await fetch(withBasePath("/api/map/geometry"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layers }),
    });
  } catch (err) {
    console.error("[Custom layers] Save failed:", err);
  }
}

export function CustomLayersSection() {
  const [layers, setLayers] = useState<CustomLayer[]>([]);
  const [drawingLayerId, setDrawingLayerId] = useState<string | null>(null);
  const [editingGeometryId, setEditingGeometryId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoad = useRef(false);

  // Load from feature geometry data on mount
  useEffect(() => {
    loadLayers().then((loaded) => {
      initialLoad.current = true;
      setLayers(loaded);
    });
  }, []);

  // Debounced save to feature geometry data (skip the very first setState from load)
  useEffect(() => {
    if (!initialLoad.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveLayers(layers), 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [layers]);

  // Sync layers to map renderer on every change
  useEffect(() => {
    document.dispatchEvent(
      new CustomEvent(CUSTOM_LAYERS_CHANGED, { detail: { layers } })
    );
  }, [layers]);

  // Handle polygon completion dispatched from customLayersDraw
  useEffect(() => {
    function onComplete(e: Event) {
      const { layerId, coordinates } = (e as CustomEvent<{
        layerId: string;
        coordinates: [number, number][];
      }>).detail;
      setDrawingLayerId(null);
      setLayers((prev) => {
        const target = prev.find((l) => l.id === layerId);
        const n = target ? target.geometries.length + 1 : 1;
        return prev.map((l) =>
          l.id !== layerId
            ? l
            : {
                ...l,
                geometries: [
                  ...l.geometries,
                  { id: crypto.randomUUID(), name: `Polygon ${n}`, visible: true, coordinates },
                ],
              }
        );
      });
    }
    document.addEventListener(CUSTOM_GEOMETRY_COMPLETE, onComplete);
    return () => document.removeEventListener(CUSTOM_GEOMETRY_COMPLETE, onComplete);
  }, []);

  useEffect(() => {
    function onUpdated(e: Event) {
      const { layerId, geometryId, coordinates, joinedGeometryId, finished } = (e as CustomEvent<{
        layerId: string;
        geometryId: string;
        coordinates: [number, number][];
        joinedGeometryId?: string;
        finished?: boolean;
      }>).detail;

      if (joinedGeometryId || finished) {
        setDrawingLayerId(null);
        setEditingGeometryId(null);
      }

      setLayers((prev) =>
        prev.map((layer) =>
          layer.id !== layerId
            ? layer
            : {
                ...layer,
                geometries: layer.geometries
                  .filter((geometry) => geometry.id !== joinedGeometryId)
                  .map((geometry) =>
                    geometry.id === geometryId ? { ...geometry, coordinates } : geometry
                  )
              }
        )
      );
    }
    document.addEventListener(CUSTOM_GEOMETRY_UPDATED, onUpdated);
    return () => document.removeEventListener(CUSTOM_GEOMETRY_UPDATED, onUpdated);
  }, []);

  useEffect(() => {
    function onStopped() {
      setDrawingLayerId(null);
      setEditingGeometryId(null);
    }
    document.addEventListener(CUSTOM_DRAW_STOPPED, onStopped);
    return () => document.removeEventListener(CUSTOM_DRAW_STOPPED, onStopped);
  }, []);

  function addLayer() {
    const name = prompt("Layer name:");
    if (!name?.trim()) return;
    setLayers((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: name.trim(), visible: true, geometries: [] },
    ]);
  }

  function removeLayer(id: string) {
    if (drawingLayerId === id) cancelDraw();
    setLayers((prev) => prev.filter((l) => l.id !== id));
  }

  function toggleVisible(id: string) {
    setLayers((prev) =>
      prev.map((l) => (l.id !== id ? l : { ...l, visible: !l.visible }))
    );
  }

  function toggleGeometryVisible(layerId: string, geomId: string) {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id !== layerId
          ? layer
          : {
              ...layer,
              geometries: layer.geometries.map((geometry) =>
                geometry.id === geomId ? { ...geometry, visible: geometry.visible === false } : geometry
              )
            }
      )
    );
  }

  function toggleCollapsed(id: string) {
    setLayers((prev) =>
      prev.map((l) => (l.id !== id ? l : { ...l, collapsed: !l.collapsed }))
    );
  }

  function setLayerCategory(id: string, category: LayerCategory) {
    setLayers((prev) =>
      prev.map((layer) => (layer.id !== id ? layer : { ...layer, category }))
    );
  }

  function removeGeometry(layerId: string, geomId: string) {
    if (editingGeometryId === geomId) cancelDraw();
    setLayers((prev) =>
      prev.map((l) =>
        l.id !== layerId
          ? l
          : { ...l, geometries: l.geometries.filter((g) => g.id !== geomId) }
      )
    );
  }

  function startDraw(layerId: string) {
    setEditingGeometryId(null);
    setDrawingLayerId(layerId);
    document.dispatchEvent(
      new CustomEvent(CUSTOM_START_DRAW, { detail: { layerId } })
    );
  }

  function startEdit(layerId: string, geometry: Geometry) {
    const active = editingGeometryId === geometry.id;
    setDrawingLayerId(active ? null : layerId);
    setEditingGeometryId(active ? null : geometry.id);
    document.dispatchEvent(
      active
        ? new CustomEvent(CUSTOM_CANCEL_DRAW)
        : new CustomEvent(CUSTOM_START_EDIT, { detail: { layerId, geometry } })
    );
  }

  function cancelDraw() {
    setDrawingLayerId(null);
    setEditingGeometryId(null);
    document.dispatchEvent(new CustomEvent(CUSTOM_CANCEL_DRAW));
  }

  return (
    <div className="map-display-group">
      <h3>Custom Layers</h3>
      <div className="map-display-options">
        {layers.map((layer) => (
          <div key={layer.id} className="pdf-overlay-entry">
            <div className="pdf-overlay-header">
              <button
                className={`pdf-overlay-toggle${layer.visible ? " is-active" : ""}`}
                type="button"
                tabIndex={-1}
                title={layer.visible ? "Hide layer" : "Show layer"}
                onClick={() => toggleVisible(layer.id)}
              />
              <button
                className={`pdf-overlay-name${layer.collapsed ? " is-collapsed" : ""}`}
                type="button"
                onClick={() => toggleCollapsed(layer.id)}
              >
                {layer.name}
              </button>
              <CategorySelect
                value={layer.category || "manual"}
                onChange={(category) => setLayerCategory(layer.id, category)}
              />
              <button
                className="pdf-overlay-action pdf-overlay-remove pdf-overlay-delete"
                type="button"
                title="Remove layer"
                aria-label="Remove layer"
                onClick={() => removeLayer(layer.id)}
              />
            </div>

            {!layer.collapsed && (
              <div className="custom-layer-body">
                {layer.geometries.map((geom) => (
                  <div key={geom.id} className="custom-layer-geom-row">
                    <button
                      className={`pdf-overlay-toggle${geom.visible !== false ? " is-active" : ""}`}
                      type="button"
                      tabIndex={-1}
                      title={geom.visible === false ? "Show polygon" : "Hide polygon"}
                      onClick={() => toggleGeometryVisible(layer.id, geom.id)}
                    />
                    <span className="custom-layer-geom-name">{geom.name}</span>
                    <button
                      className={`pdf-overlay-action custom-layer-edit${editingGeometryId === geom.id ? " is-active" : ""}`}
                      type="button"
                      title={editingGeometryId === geom.id ? "Stop editing" : "Edit polygon"}
                      aria-label={editingGeometryId === geom.id ? "Stop editing polygon" : "Edit polygon"}
                      disabled={drawingLayerId !== null && editingGeometryId !== geom.id}
                      onClick={() => startEdit(layer.id, geom)}
                    />
                    <button
                      className="pdf-overlay-action pdf-overlay-remove pdf-overlay-delete"
                      type="button"
                      title="Remove geometry"
                      aria-label="Remove geometry"
                      onClick={() => removeGeometry(layer.id, geom.id)}
                    />
                  </div>
                ))}
                {drawingLayerId === layer.id ? (
                  <button
                    className="map-display-option custom-layer-draw-active"
                    type="button"
                    onClick={cancelDraw}
                  >
                    {editingGeometryId ? "Stop editing" : "Cancel drawing"}
                  </button>
                ) : (
                  <button
                    className="map-display-option custom-layer-add-geom"
                    type="button"
                    disabled={drawingLayerId !== null}
                    onClick={() => startDraw(layer.id)}
                  >
                    Add geometry
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        <button
          className="map-display-option custom-layer-add-layer"
          type="button"
          onClick={addLayer}
        >
          Add layer…
        </button>
      </div>
    </div>
  );
}

function CategorySelect({
  value,
  onChange
}: {
  value: LayerCategory;
  onChange: (category: LayerCategory) => void;
}) {
  return (
    <select
      className="map-card-category-select"
      aria-label="Layer category"
      value={value}
      onChange={(event) => onChange(event.target.value as LayerCategory)}
    >
      <option value="global">Global Overlay</option>
      <option value="local">Local Overlay</option>
      <option value="manual">Manual Overlay</option>
    </select>
  );
}
