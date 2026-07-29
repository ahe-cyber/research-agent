import { z } from "zod";
import type { EditorField } from "@/lib/editorSchema";

export const datasetCatalogProviderTypeSchema = z.enum(["arcgis", "socrata"]);
export const datasetSourceTypeSchema = z.enum(["arcgis-feature-layer", "socrata-dataset"]);

export const datasetSearchSourceSchema = z.object({
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

export const datasetItemEditorFields = [
  { key: "id", label: "ID", readonly: true },
  { key: "name", label: "Name" },
  { key: "description", label: "Description", multiline: true },
  { key: "type", label: "Type" },
  { key: "method", label: "Method" },
  { key: "overviewUrl", label: "Overview URL" },
  { key: "queryUrl", label: "Query URL", multiline: true },
  { key: "params", label: "Params", multiline: true }
] satisfies readonly EditorField[];

export const datasetSearchSourceEditorFields = [
  { key: "id", label: "ID", readonly: true },
  { key: "name", label: "Name" },
  { key: "url", label: "URL" },
  { key: "type", label: "Type" },
  { key: "description", label: "Description", multiline: true },
  { key: "costly", label: "Costly" }
] satisfies readonly EditorField[];

export type DatasetCatalogProviderType = z.infer<typeof datasetCatalogProviderTypeSchema>;
export type DatasetSourceType = z.infer<typeof datasetSourceTypeSchema>;
export type DatasetSearchSource = z.infer<typeof datasetSearchSourceSchema>;
export type DatasetCatalogSearchResult = z.infer<typeof datasetCatalogSearchResultSchema>;

export interface DatasetCatalogSearchOptions {
  bbox?: string;
}

export type DatasetCatalogSearchTarget =
  Pick<DatasetSearchSource, "url"> &
  Partial<Pick<DatasetSearchSource, "id" | "name" | "type">>;
