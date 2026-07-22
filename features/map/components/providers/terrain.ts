import type { TerrainConfig } from "./basemaps";

interface TerrainMap {
  addSource(id: string, source: Record<string, any>): void;
  getSource(id: string): unknown;
  on(type: "style.load", listener: () => void): void;
  removeSource(id: string): void;
  setTerrain(terrain: { source: string; exaggeration: number } | null): void;
}

export class TerrainControl {
  _config: TerrainConfig;
  _container: HTMLDivElement | null;
  _enabled: boolean;
  _map: TerrainMap | null;

  constructor(config: TerrainConfig) {
    this._config = config;
    this._container = null;
    this._enabled = false;
    this._map = null;
  }

  onAdd(map: TerrainMap) {
    this._map = map;
    this._container = document.createElement("div");
    this._container.className = "map-display-detail";
    this._render();
    map.on("style.load", () => {
      if (this._enabled) addTerrain(map, this._config);
    });
    return this._container;
  }

  _render() {
    const button = document.createElement("button");
    button.className = "map-display-option map-display-check" + (this._enabled ? " is-active" : "");
    button.type = "button";
    button.tabIndex = -1;
    button.textContent = this._config.label;
    button.title = `${this._enabled ? "Hide" : "Show"} ${this._config.label}`;
    button.setAttribute("aria-pressed", String(this._enabled));
    button.addEventListener("click", () => this._toggle());
    this._container!.replaceChildren(button);
  }

  _toggle() {
    this._enabled = !this._enabled;
    if (this._enabled) {
      addTerrain(this._map!, this._config);
    } else {
      this._map!.setTerrain(null);
      if (this._map!.getSource(this._config.id)) this._map!.removeSource(this._config.id);
    }
    this._render();
  }
}

export function addTerrain(map: TerrainMap, terrain: TerrainConfig) {
  if (!map.getSource(terrain.id)) {
    map.addSource(terrain.id, {
      type: "raster-dem",
      tiles: terrain.tiles,
      tileSize: terrain.tileSize,
      maxzoom: terrain.maxZoom,
      attribution: terrain.attribution,
      encoding: terrain.encoding
    });
  }
  map.setTerrain({ source: terrain.id, exaggeration: terrain.exaggeration });
}
