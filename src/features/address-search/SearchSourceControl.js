import { getMapboxAccessToken, getGoogleMapsApiKey } from "../map/config.js";
import { createPlaceSearchBox } from "./providers/mapbox.js";
import { createGeoSearchBox } from "./providers/nycGeoSearch.js";
import { createGoogleSearchBox } from "./providers/googlePlaces.js";

function getSources() {
  const sources = [{ id: "geosearch", label: "NYC GeoSearch" }];
  if (getMapboxAccessToken()) {
    sources.push({ id: "mapbox", label: "Mapbox", costly: true });
  }
  if (getGoogleMapsApiKey()) {
    sources.push({ id: "google", label: "Google Places", costly: true });
  }
  return sources;
}

function appendLabel(element, source) {
  if (source.costly) {
    element.classList.add("has-money-icon");
  }
  element.append(source.label);
}

export function createSearchSourceControl(map, onRetrieve, searchBoxContainer) {
  const sources = getSources();
  let currentId = sources[0].id;
  let currentBox = null;
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
      sources.forEach((source) => {
        const { id } = source;
        const item = document.createElement("button");
        item.className = "search-source-item" + (id === currentId ? " is-active" : "");
        appendLabel(item, source);
        item.addEventListener("click", (e) => { e.stopPropagation(); select(id); });
        menu.appendChild(item);
      });
      el.appendChild(menu);
    }

    const btn = document.createElement("button");
    btn.className = "section-tool-button";
    appendLabel(btn, current);
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
    const query = getSearchText(currentBox);
    currentBox?.destroy?.();
    searchBoxContainer.replaceChildren();
    // Wrap onRetrieve to pass the active source ID so callers can adapt.
    const wrapped = (result) => onRetrieve(result, currentId);
    const box = currentId === "mapbox"
      ? createPlaceSearchBox(map, wrapped, query)
      : currentId === "google"
        ? createGoogleSearchBox(map, wrapped, query)
        : createGeoSearchBox(map, wrapped, query);
    searchBoxContainer.appendChild(box);
    currentBox = box;
  }

  render();
  swapBox();

  return { element: el };
}

function getSearchText(box) {
  if (!box) return "";
  if (typeof box.value === "string") return box.value;
  return box.querySelector("input")?.value ?? "";
}
