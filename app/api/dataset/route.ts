import {
  findDatasetCatalogItems,
  getDatasetRouteData,
  saveDatasetRouteData
} from "@/features/dataset/server/datasetRoute";

export const GET = getDatasetRouteData;
export const POST = findDatasetCatalogItems;
export const PUT = saveDatasetRouteData;
