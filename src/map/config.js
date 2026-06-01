export const STATEN_ISLAND_BOUNDS = [
  [-74.2726, 40.4774],
  [-74.0342, 40.6513]
];

export const STATEN_ISLAND_BBOX = [-74.2726, 40.4774, -74.0342, 40.6513];
export const STATEN_ISLAND_CENTER = [-74.1502, 40.5795];

export function getMapboxAccessToken() {
  return import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "";
}
