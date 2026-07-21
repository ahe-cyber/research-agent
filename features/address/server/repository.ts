import { getSearchItems, putSearchItems } from "@/lib/server/searchRepository";
import type { AddressSearchSource } from "../address.schema";

const FEATURE_ID = "address";

export function getAddressSearchSources() {
  return getSearchItems(FEATURE_ID);
}

export function saveAddressSearchSources(sources: AddressSearchSource[]) {
  return putSearchItems(FEATURE_ID, sources);
}

export async function getGeoSearchSource() {
  const sources = await getAddressSearchSources();
  return sources.find((source: any) => source?.type === "geosearch" && typeof source?.url === "string") as any;
}
