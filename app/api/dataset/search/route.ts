import {
  findDatasetCatalogItems,
  getDatasetSearchSources,
  saveDatasetSearchSources
} from "@/features/dataset/server/searchRoute";

export const GET = getDatasetSearchSources;
export const POST = findDatasetCatalogItems;
export const PUT = saveDatasetSearchSources;
