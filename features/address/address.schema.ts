import { z } from "zod";

export const addressSearchSourceTypeSchema = z.enum(["geosearch", "google", "mapbox"]);

export const addressSearchOutputSchema = z.object({
  variable: z.string(),
  path: z.string()
});

export const addressSearchSourceSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: addressSearchSourceTypeSchema,
  url: z.string().url().optional(),
  costly: z.boolean().optional(),
  description: z.string().optional(),
  outputs: z.array(addressSearchOutputSchema).optional(),
  feature: z.literal("address").optional(),
  apiKey: z.string().optional()
});

export const addressSearchSourcesSchema = z.array(addressSearchSourceSchema);

export type AddressSearchSourceType = z.infer<typeof addressSearchSourceTypeSchema>;
export type AddressSearchOutput = z.infer<typeof addressSearchOutputSchema>;
export type AddressSearchSource = z.infer<typeof addressSearchSourceSchema>;
