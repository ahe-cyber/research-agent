export const socrataCatalogProvider = {
  type: "socrata",
  label: "Socrata",
  sourceType: "socrata-dataset",
  supportedInputParams: [
    "$select",
    "$where",
    "$order",
    "$group",
    "$limit",
    "$offset",
    "$q",
    "$query"
  ]
} as const;
