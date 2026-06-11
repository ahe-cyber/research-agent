import type { Tile3DLayer } from "@deck.gl/geo-layers";
import type { MapboxOverlay } from "@deck.gl/mapbox";
import type { SceneLayerConfig } from "./basemaps";

interface SceneLayerMap {
  addControl(control: unknown): void;
  easeTo(options: { duration: number; pitch: number }): void;
  getPitch(): number;
  removeControl(control: unknown): void;
}

let deckModulesPromise: Promise<[
  typeof import("@deck.gl/geo-layers"),
  typeof import("@deck.gl/mapbox"),
  typeof import("@loaders.gl/i3s")
]> | null = null;

function loadDeckModules() {
  deckModulesPromise ??= Promise.all([
    import("@deck.gl/geo-layers"),
    import("@deck.gl/mapbox"),
    import("@loaders.gl/i3s")
  ]);
  return deckModulesPromise;
}

const DECK_COORDINATE_SYSTEMS = {
  0: "cartesian",
  1: "lnglat",
  2: "meter-offsets",
  3: "lnglat-offsets"
} as const;

function normalizeTileCoordinateSystem(tile: any, groundToBasemap = false) {
  const coordinateSystem = tile.content?.coordinateSystem;
  if (typeof coordinateSystem === "number") {
    tile.content.coordinateSystem = DECK_COORDINATE_SYSTEMS[coordinateSystem as keyof typeof DECK_COORDINATE_SYSTEMS];
  }
  if (groundToBasemap && tile.content?.cartographicOrigin) {
    const positions = tile.content.attributes?.positions?.value;
    if (positions) {
      let minZ = Infinity;
      for (let index = 2; index < positions.length; index += 3) {
        minZ = Math.min(minZ, positions[index]);
      }
      if (Number.isFinite(minZ)) tile.content.cartographicOrigin[2] = -minZ;
    }
  }
}

export class SceneLayersControl {
  _config: SceneLayerConfig;
  _container: HTMLDivElement | null;
  _enabled: boolean;
  _loading: boolean;
  _map: SceneLayerMap | null;
  _overlay: MapboxOverlay | null;

  constructor(config: SceneLayerConfig) {
    this._config = config;
    this._container = null;
    this._enabled = false;
    this._loading = false;
    this._map = null;
    this._overlay = null;
  }

  onAdd(map: SceneLayerMap) {
    this._map = map;
    this._container = document.createElement("div");
    this._container.className = "map-display-detail";
    this._render();
    return this._container;
  }

  onRemove() {
    if (this._overlay) this._map!.removeControl(this._overlay);
    this._container!.remove();
    this._container = null;
    this._map = null;
    this._overlay = null;
  }

  _render() {
    if (!this._container) return;
    const button = document.createElement("button");
    button.className = "map-display-option map-display-check" + (this._enabled ? " is-active" : "");
    button.type = "button";
    button.tabIndex = -1;
    button.textContent = this._loading ? "Loading 3D..." : this._config.label;
    button.title = `${this._enabled ? "Hide" : "Show"} ${this._config.label}`;
    button.setAttribute("aria-pressed", String(this._enabled));
    button.addEventListener("click", () => this._toggle());
    this._container!.replaceChildren(button);
  }

  _toggle() {
    if (this._enabled) {
      this._enabled = false;
      this._overlay?.setProps({ layers: [] });
      this._render();
      return;
    }
    void this._enable();
  }

  async _enable() {
    this._enabled = true;
    this._loading = true;
    this._render();

    try {
      const [{ Tile3DLayer }, { MapboxOverlay }, { COORDINATE_SYSTEM, I3SLoader }] = await loadDeckModules();
      if (!this._enabled || !this._map) return;
      if (!this._overlay) {
        this._overlay = new MapboxOverlay({ interleaved: true, layers: [] });
        this._map.addControl(this._overlay);
      }
      this._overlay.setProps({
        layers: [new Tile3DLayer({
          id: this._config.id,
          data: this._config.url,
          // Tile3DLayer supports I3S at runtime, but its loader prop is typed only
          // as the narrower 3D Tiles loader type.
          loader: I3SLoader as any,
          loadOptions: {
            i3s: {
              // Keep mesh vertices as lng/lat offsets for MapLibre's Mercator view.
              coordinateSystem: COORDINATE_SYSTEM.LNGLAT_OFFSETS
            }
          },
          // loaders.gl 4 still emits numeric enums; deck.gl 9 expects strings.
          // Flatten the geographic elevation when the 2D basemap has no terrain.
          onTileLoad: (tile) => normalizeTileCoordinateSystem(tile, this._config.groundToBasemap),
          onError: (error) => console.error(`[Map App] Failed to load ${this._config.label}`, error)
        })]
      });
      if (this._map.getPitch() < 45) {
        this._map.easeTo({ pitch: 55, duration: 600 });
      }
    } catch (error) {
      this._enabled = false;
      console.error(`[Map App] Failed to initialize ${this._config.label}`, error);
    } finally {
      this._loading = false;
      this._render();
    }
  }
}
