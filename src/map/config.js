export const STATEN_ISLAND_BOUNDS = [
  [-74.2726, 40.4774],
  [-74.0342, 40.6513]
];

export const STATEN_ISLAND_BBOX = [-74.2726, 40.4774, -74.0342, 40.6513];
export const STATEN_ISLAND_CENTER = [-74.1502, 40.5795];
const DEV_MODE_STORAGE_KEY = "mapAppDevMode";

export function getMapboxAccessToken() {
  return import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "";
}

export function isDevModeEnabled() {
  const params = new URLSearchParams(window.location.search);
  const devModeParam = params.get("devMode");

  if (devModeParam === "1" || devModeParam === "true") {
    localStorage.setItem(DEV_MODE_STORAGE_KEY, "1");
    return true;
  }

  if (devModeParam === "0" || devModeParam === "false") {
    localStorage.removeItem(DEV_MODE_STORAGE_KEY);
    return false;
  }

  return localStorage.getItem(DEV_MODE_STORAGE_KEY) === "1";
}
