export type LngLat = readonly [number, number];

export const STATEN_ISLAND_BOUNDS: readonly [LngLat, LngLat] = [
  [-74.2726, 40.4774],
  [-74.0342, 40.6513]
];

export const STATEN_ISLAND_BBOX: readonly [number, number, number, number] = [-74.2726, 40.4774, -74.0342, 40.6513];
export const STATEN_ISLAND_CENTER: LngLat = [-74.1502, 40.5795];

export function getMapboxAccessToken() {
  return process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
}

export function getGoogleMapsApiKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
}
