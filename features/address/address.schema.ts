import { z } from "zod";
import type { EditorField } from "@/lib/editorSchema";

export const addressSearchSourceTypeSchema = z.enum(["geosearch", "google", "mapbox"]);

export const addressSearchOutputSchema = z.object({
  variable: z.string(),
  path: z.string()
});

export const addressSearchSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: addressSearchSourceTypeSchema,
  url: z.string().url().optional(),
  costly: z.boolean().optional(),
  description: z.string().optional(),
  outputs: z.array(addressSearchOutputSchema).optional(),
  feature: z.literal("address").optional(),
  apiKey: z.string().optional()
});

export const addressSearchSourcesSchema = z.array(addressSearchSourceSchema);

export const addressItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  address: z.string().optional(),
  borough: z.string().optional(),
  bbl: z.string().optional(),
  bin: z.string().optional()
});

export const addressItemsSchema = z.array(addressItemSchema);

export const addressItemEditorFields = [
  { key: "id", label: "ID", readonly: true },
  { key: "name", label: "Name" },
  { key: "description", label: "Description", multiline: true },
  { key: "address", label: "Address" },
  { key: "borough", label: "Borough" },
  { key: "bbl", label: "BBL" },
  { key: "bin", label: "BIN" }
] satisfies readonly EditorField[];

export const addressSearchSourceEditorFields = [
  { key: "id", label: "ID", readonly: true },
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "url", label: "URL" },
  { key: "description", label: "Description", multiline: true },
  { key: "costly", label: "Costly" },
  { key: "apiKey", label: "API Key" }
] satisfies readonly EditorField[];

export type AddressSearchSourceType = z.infer<typeof addressSearchSourceTypeSchema>;
export type AddressSearchOutput = z.infer<typeof addressSearchOutputSchema>;
export type AddressSearchSource = z.infer<typeof addressSearchSourceSchema>;
export type AddressItem = z.infer<typeof addressItemSchema>;
