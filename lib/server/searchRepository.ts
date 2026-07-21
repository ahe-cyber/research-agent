import { readFile } from "node:fs/promises";
import { dataPath, writeJsonFile } from "./files";
import { isCatalogRegistry, normalizeCatalogRegistry } from "./searchRegistries";

const searchPath = dataPath("search.json");

export async function getSearchItems(feature: string) {
  const searchItems = JSON.parse(await readFile(searchPath, "utf8"));
  const featureItems = Array.isArray(searchItems) ? searchItems.filter((item) => getSearchItemFeature(item) === feature) : [];
  return feature === "dataset" ? normalizeCatalogRegistry(featureItems) : featureItems;
}

export async function putSearchItems(feature: string, items: unknown[]) {
  if (feature === "dataset" && !isCatalogRegistry(items)) {
    throw new Error("Dataset search items must be an array of catalog entries.");
  }

  let searchItems: unknown[] = [];
  try {
    const existing = JSON.parse(await readFile(searchPath, "utf8"));
    searchItems = Array.isArray(existing) ? existing : [];
  } catch {}

  const normalizedItems = feature === "dataset" ? normalizeCatalogRegistry(items) : items;
  await writeJsonFile(searchPath, [
    ...searchItems.filter((item: any) => getSearchItemFeature(item) !== feature),
    ...normalizedItems.map((item: any) => {
      const { activity, ...rest } = item;
      return { ...rest, feature };
    })
  ]);
}

function getSearchItemFeature(item: any) {
  return item?.feature || item?.activity || "";
}
