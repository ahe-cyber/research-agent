import { z } from "zod";
import type { EditorField } from "@/lib/editorSchema";

export const mapSourceKindSchema = z.enum(["basemap", "sceneLayer", "terrain"]);
export const mapOverlayCategorySchema = z.enum(["global", "local", "manual"]);
export const mapCoordinateSchema = z.tuple([z.number(), z.number()]);
export const mapBoundsSchema = z.tuple([mapCoordinateSchema, mapCoordinateSchema]);
export const mapCornersSchema = z.tuple([
  mapCoordinateSchema,
  mapCoordinateSchema,
  mapCoordinateSchema,
  mapCoordinateSchema
]);

export const mapAttributionLinkSchema = z.object({
  text: z.string(),
  url: z.string()
});

export const mapBasemapStyleSchema = z.object({
  type: z.enum(["direct", "inline", "remote"]),
  url: z.string().optional(),
  value: z.record(z.string(), z.unknown()).optional(),
  attributionLinks: z.array(mapAttributionLinkSchema).optional()
});

export const mapBasemapSchema = z.object({
  kind: z.literal("basemap"),
  id: z.string(),
  label: z.string(),
  style: mapBasemapStyleSchema,
  maxZoom: z.number(),
  costly: z.boolean().optional(),
  requiresMapboxAccessToken: z.boolean().optional()
});

export const mapSceneLayerSchema = z.object({
  kind: z.literal("sceneLayer"),
  id: z.string(),
  label: z.string(),
  url: z.string(),
  itemUrl: z.string(),
  attribution: z.string(),
  groundToBasemap: z.boolean().optional()
});

export const mapTerrainSchema = z.object({
  kind: z.literal("terrain"),
  id: z.string(),
  label: z.string(),
  tiles: z.array(z.string()),
  tileSize: z.number(),
  maxZoom: z.number(),
  encoding: z.enum(["mapbox", "terrarium"]),
  exaggeration: z.number(),
  attribution: z.string(),
  itemUrl: z.string()
});

export const mapSourceSchema = z.discriminatedUnion("kind", [
  mapBasemapSchema,
  mapSceneLayerSchema,
  mapTerrainSchema
]);

export const drawnGeometrySchema = z.object({
  id: z.string(),
  name: z.string(),
  visible: z.boolean().optional(),
  coordinates: z.array(mapCoordinateSchema)
});

export const drawnLayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  visible: z.boolean(),
  category: mapOverlayCategorySchema.optional(),
  collapsed: z.boolean().optional(),
  geometries: z.array(drawnGeometrySchema)
});

export const pdfOverlayPageSchema = z.object({
  id: z.string(),
  page: z.number(),
  imagePath: z.string(),
  status: z.string(),
  visible: z.boolean(),
  width: z.number().optional(),
  height: z.number().optional(),
  bounds: mapBoundsSchema.nullable().optional(),
  corners: mapCornersSchema.nullable().optional(),
  automask: z.object({
    threshold: z.number(),
    feather: z.number()
  }).optional()
});

export const pdfOverlaySchema = z.object({
  id: z.string(),
  name: z.string(),
  sourcePath: z.string(),
  createdAt: z.string(),
  category: mapOverlayCategorySchema.optional(),
  pages: z.array(pdfOverlayPageSchema),
  collapsed: z.boolean().optional(),
  muted: z.boolean().optional()
});

export const mapItemEditorFields = [
  { key: "id", label: "ID", readonly: true },
  { key: "name", label: "Name" },
  { key: "description", label: "Description", multiline: true },
  { key: "kind", label: "Kind" },
  { key: "style", label: "Style", multiline: true },
  { key: "url", label: "URL" },
  { key: "tiles", label: "Tiles", multiline: true }
] satisfies readonly EditorField[];

export const mapSearchSourceEditorFields = [
  { key: "id", label: "ID", readonly: true },
  { key: "name", label: "Name" },
  { key: "description", label: "Description", multiline: true },
  { key: "costly", label: "Costly" }
] satisfies readonly EditorField[];

export type MapSourceKind = z.infer<typeof mapSourceKindSchema>;
export type MapOverlayCategory = z.infer<typeof mapOverlayCategorySchema>;
export type MapCoordinate = [number, number];
export type MapBounds = [MapCoordinate, MapCoordinate];
export type MapCorners = [MapCoordinate, MapCoordinate, MapCoordinate, MapCoordinate];
export type MapBasemap = z.infer<typeof mapBasemapSchema>;
export type MapSceneLayer = z.infer<typeof mapSceneLayerSchema>;
export type MapTerrain = z.infer<typeof mapTerrainSchema>;
export type MapSource = z.infer<typeof mapSourceSchema>;
export type DrawnGeometry = {
  id: string;
  name: string;
  visible?: boolean;
  coordinates: MapCoordinate[];
};
export type DrawnLayer = {
  id: string;
  name: string;
  visible: boolean;
  category?: MapOverlayCategory;
  collapsed?: boolean;
  geometries: DrawnGeometry[];
};
export type PdfOverlayPage = {
  id: string;
  page: number;
  imagePath: string;
  status: string;
  visible: boolean;
  width?: number;
  height?: number;
  bounds?: MapBounds | null;
  corners?: MapCorners | null;
  automask?: { threshold: number; feather: number };
};
export type PdfOverlay = {
  id: string;
  name: string;
  sourcePath: string;
  createdAt: string;
  category?: MapOverlayCategory;
  pages: PdfOverlayPage[];
  collapsed?: boolean;
  muted?: boolean;
};
