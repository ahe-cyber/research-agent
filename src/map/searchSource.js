import { getMapboxAccessToken } from "./config.js";
import { createPlaceSearchBox } from "./search.js";
import { createGeoSearchBox } from "./geosearch.js";

function getSources() {
  const sources = [{ id: "geosearch", label: "NYC GeoSearch" }];
  if (getMapboxAccessToken()) {
    sources.push({ id: "mapbox", label: "Mapbox" });
  }
  return sources;
}

export function createSearchSourceControl(map, onRetrieve, searchBoxContainer) {
  const sources = getSources();
  let currentId = sources[0].id;
  let open = false;

  const el = document.createElement("div");
  el.className = "search-source-ctrl";

  const onDocClick = (e) => { if (!el.contains(e.target)) close(); };
  document.addEventListener("click", onDocClick);

  function render() {
    const current = sources.find(s => s.id === currentId);
    el.innerHTML = "";

    if (open) {
      const menu = document.createElement("div");
      menu.className = "search-source-menu";
      sources.forEach(({ id, label }) => {
        const item = document.createElement("button");
        item.className = "search-source-item" + (id === currentId ? " is-active" : "");
        item.textContent = label;
        item.addEventListener("click", (e) => { e.stopPropagation(); select(id); });
        menu.appendChild(item);
      });
      el.appendChild(menu);
    }

    const btn = document.createElement("button");
    btn.className = "section-tool-button";
    btn.textContent = current.label;
    btn.addEventListener("click", (e) => { e.stopPropagation(); open ? close() : openMenu(); });
    el.appendChild(btn);
  }

  function openMenu() { open = true; render(); }
  function close() { open = false; render(); }

  function select(id) {
    open = false;
    if (id !== currentId) {
      currentId = id;
      swapBox();
    }
    render();
  }

  function swapBox() {
    searchBoxContainer.replaceChildren();
    // Wrap onRetrieve to pass the active source ID so callers can adapt.
    const wrapped = (result) => onRetrieve(result, currentId);
    const box = currentId === "mapbox"
      ? createPlaceSearchBox(map, wrapped)
      : createGeoSearchBox(map, wrapped);
    searchBoxContainer.appendChild(box);
  }

  render();
  swapBox();

  return { element: el };
}
