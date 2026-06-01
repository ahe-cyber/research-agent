const NYC_RASTER_STYLE = {
  version: 8,
  sources: {
    "nyc-basemap": {
      type: "raster",
      tiles: [
        "https://maps1.nyc.gov/xyz/1.0.0/carto/basemap/{z}/{x}/{y}.jpg",
        "https://maps2.nyc.gov/xyz/1.0.0/carto/basemap/{z}/{x}/{y}.jpg",
        "https://maps3.nyc.gov/xyz/1.0.0/carto/basemap/{z}/{x}/{y}.jpg",
        "https://maps4.nyc.gov/xyz/1.0.0/carto/basemap/{z}/{x}/{y}.jpg"
      ],
      tileSize: 256,
      minzoom: 8,
      maxzoom: 19,
      attribution: "© City of New York (CC BY 4.0)"
    },
    "nyc-labels": {
      type: "raster",
      tiles: [
        "https://maps1.nyc.gov/xyz/1.0.0/carto/label/{z}/{x}/{y}.png8",
        "https://maps2.nyc.gov/xyz/1.0.0/carto/label/{z}/{x}/{y}.png8",
        "https://maps3.nyc.gov/xyz/1.0.0/carto/label/{z}/{x}/{y}.png8",
        "https://maps4.nyc.gov/xyz/1.0.0/carto/label/{z}/{x}/{y}.png8"
      ],
      tileSize: 256,
      minzoom: 8,
      maxzoom: 19
    }
  },
  layers: [
    { id: "nyc-basemap", type: "raster", source: "nyc-basemap" },
    { id: "nyc-labels", type: "raster", source: "nyc-labels" }
  ]
};

import { getMapboxAccessToken } from "./config.js";

const NYC_VECTOR_STYLE_URL = "https://tiles.arcgis.com/tiles/yG5s3afENB5iO9fj/arcgis/rest/services/NYC_Basemap_v3/VectorTileServer/resources/styles/root.json";

const BASEMAPS = [
  { id: "vector", label: "NYC Vector", style: NYC_VECTOR_STYLE_URL, maxZoom: 22 },
  { id: "raster", label: "NYC Raster", style: NYC_RASTER_STYLE, maxZoom: 19 },
  // Only shown when a Mapbox token is configured; style is a function so the
  // token is read at switch time and the URL isn't constructed until needed.
  ...(() => {
    const token = getMapboxAccessToken();
    return token ? [{
      id: "mapbox",
      label: "Mapbox Streets",
      style: () => `https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${token}`,
      maxZoom: 22
    }] : [];
  })()
];

export const DEFAULT_BASEMAP = BASEMAPS[0];

// Resolve a relative URL against a base, preserving {template} placeholders
// which the URL constructor would percent-encode.
function resolveUrl(url, base) {
  if (!url || /^https?:\/\//.test(url)) return url;
  const tokens = [];
  // Use an alphanumeric placeholder — URL constructor won't percent-encode it,
  // unlike \x00 which becomes %00 and breaks the back-substitution regex.
  const escaped = url.replace(/\{[^}]+\}/g, (m) => { tokens.push(m); return `__T${tokens.length - 1}__`; });
  const resolved = new URL(escaped, base).href;
  return resolved.replace(/__T(\d+)__/g, (_, i) => tokens[Number(i)]);
}

// Fetch an ArcGIS style JSON and rewrite all relative URLs to absolute.
// ArcGIS styles use relative paths for sprite, glyphs, source TileJSON, and
// the tile URLs *inside* that TileJSON — so we fetch the TileJSON ourselves
// and inline the resolved tile URLs directly, preventing MapLibre from ever
// seeing a relative tile path.
async function loadRemoteStyle(styleUrl) {
  const res = await fetch(styleUrl);
  if (!res.ok) throw new Error(`Failed to load style: ${res.status} ${styleUrl}`);
  const style = await res.json();

  if (style.sprite) style.sprite = resolveUrl(style.sprite, styleUrl);
  if (style.glyphs) style.glyphs = resolveUrl(style.glyphs, styleUrl);

  await Promise.all(Object.values(style.sources ?? {}).map(async (src) => {
    if (src.url) {
      const tileJsonUrl = resolveUrl(src.url, styleUrl);
      try {
        const tjRes = await fetch(tileJsonUrl);
        if (tjRes.ok) {
          const tj = await tjRes.json();
          if (Array.isArray(tj.tiles) && tj.tiles.length > 0) {
            src.tiles = tj.tiles.map(t => resolveUrl(t, tileJsonUrl));
            if (tj.minzoom != null) src.minzoom ??= tj.minzoom;
            if (tj.maxzoom != null) src.maxzoom ??= tj.maxzoom;
            if (tj.attribution) src.attribution ??= tj.attribution;
            delete src.url;
            return;
          }
        }
      } catch {}
      src.url = tileJsonUrl;
    }
    if (src.tiles) src.tiles = src.tiles.map(t => resolveUrl(t, styleUrl));
  }));

  return style;
}

export async function getStyle(basemap) {
  if (typeof basemap.style === "function") return basemap.style(); // e.g. Mapbox — URL passed directly to setStyle
  if (typeof basemap.style !== "string") return basemap.style;    // inline object
  basemap._promise ??= loadRemoteStyle(basemap.style);            // remote style needing URL resolution
  return basemap._promise;
}

export class BasemapControl {
  constructor() {
    this._currentId = BASEMAPS[0].id;
    this._map = null;
    this._container = null;
    this._open = false;
    this._onDocClick = (e) => {
      if (!this._container.contains(e.target)) this._close();
    };
  }

  onAdd(map) {
    this._map = map;
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl basemap-ctrl";
    this._render();
    document.addEventListener("click", this._onDocClick);
    return this._container;
  }

  onRemove() {
    document.removeEventListener("click", this._onDocClick);
    this._container.remove();
    this._map = null;
  }

  _render() {
    const current = BASEMAPS.find(b => b.id === this._currentId);
    this._container.innerHTML = "";

    if (this._open) {
      const menu = document.createElement("div");
      menu.className = "basemap-ctrl-menu";
      BASEMAPS.forEach(({ id, label }) => {
        const item = document.createElement("button");
        item.className = "basemap-ctrl-item" + (id === this._currentId ? " is-active" : "");
        item.textContent = label;
        item.addEventListener("click", (e) => { e.stopPropagation(); this._select(id); });
        menu.appendChild(item);
      });
      this._container.appendChild(menu);
    }

    const btn = document.createElement("button");
    btn.className = "basemap-ctrl-btn";
    btn.textContent = current.label;
    btn.addEventListener("click", (e) => { e.stopPropagation(); this._open ? this._close() : this._openMenu(); });
    this._container.appendChild(btn);
  }

  _openMenu() { this._open = true; this._render(); }
  _close() { this._open = false; this._render(); }

  async _select(id) {
    this._open = false;
    if (id === this._currentId) { this._render(); return; }
    const basemap = BASEMAPS.find(b => b.id === id);
    this._currentId = id;
    this._render();
    const style = await getStyle(basemap);
    this._map.setMaxZoom(basemap.maxZoom);
    // validate: false — external styles (Mapbox, ArcGIS) include properties
    // MapLibre's strict validator rejects, even though it renders them correctly.
    this._map.setStyle(style, { validate: false });
  }
}
