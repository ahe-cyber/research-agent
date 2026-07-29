import { dataPath } from "@/lib/server/files";
import { readJsonFile, writeJsonFile } from "@/lib/server/jsonRepository";
import { getSearchItems, putSearchItems } from "@/lib/server/searchRepository";
import type { AddressItem } from "../address.schema";
import type { AddressSearchSource } from "../address.schema";

const FEATURE_ID = "address";
const addressPath = dataPath("features", "address.json");

export function getAddressData() {
  return readJsonFile<AddressItem[]>(addressPath, []);
}

export function getAddressSearchSources() {
  return getSearchItems(FEATURE_ID);
}

export function saveAddressData(addresses: AddressItem[]) {
  return writeJsonFile(addressPath, addresses);
}

export function saveAddressSearchSources(sources: AddressSearchSource[]) {
  return putSearchItems(FEATURE_ID, sources);
}

export async function getGeoSearchSource() {
  const sources = await getAddressSearchSources();
  return sources.find((source: any) => source?.type === "geosearch" && typeof source?.url === "string") as any;
}

export async function getAddressSearchSource(sourceId: string) {
  const sources = await getAddressSearchSources();
  return sources.find((source: any) => source?.id === sourceId) as any;
}
