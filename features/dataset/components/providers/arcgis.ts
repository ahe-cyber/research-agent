export const arcgisCatalogProvider = {
  type: "arcgis",
  label: "ArcGIS",
  sourceType: "arcgis-feature-layer",
  supportedInputParams: [
    "where",
    "geometry",
    "geometryType",
    "inSR",
    "spatialRel",
    "outFields",
    "returnGeometry",
    "outSR",
    "f",
    "resultOffset",
    "resultRecordCount",
    "orderByFields",
    "objectIds",
    "returnDistinctValues",
    "returnCountOnly"
  ]
} as const;
