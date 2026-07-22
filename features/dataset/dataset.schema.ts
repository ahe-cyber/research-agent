import { z } from "zod";

export const datasetCatalogProviderTypeSchema = z.enum(["arcgis", "socrata"]);
export const datasetSourceTypeSchema = z.enum(["arcgis-feature-layer", "socrata-dataset"]);

export const datasetSearchCatalogSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  type: datasetCatalogProviderTypeSchema.optional(),
  costly: z.boolean().optional(),
  supportedInputParams: z.array(z.string()).optional(),
  feature: z.literal("dataset").optional()
});

export const datasetCatalogSearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  snippet: z.string().optional(),
  url: z.string().optional(),
  type: z.string().optional(),
  portalType: z.string().optional(),
  owner: z.string().optional(),
  catalogName: z.string().optional()
});

export type DatasetCatalogProviderType = z.infer<typeof datasetCatalogProviderTypeSchema>;
export type DatasetSourceType = z.infer<typeof datasetSourceTypeSchema>;
export type DatasetSearchCatalog = z.infer<typeof datasetSearchCatalogSchema>;
export type DatasetCatalogSearchResult = z.infer<typeof datasetCatalogSearchResultSchema>;

export interface DatasetCatalogSearchOptions {
  bbox?: string;
}

export type DatasetCatalogSearchTarget =
  Pick<DatasetSearchCatalog, "url"> &
  Partial<Pick<DatasetSearchCatalog, "id" | "name" | "type">>;
