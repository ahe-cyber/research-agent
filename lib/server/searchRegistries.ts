export interface CatalogRegistryItem extends Record<string, unknown> {
  id: string;
  name: string;
  url: string;
  type: string;
  supportedInputParams?: unknown[];
}

export type CatalogRegistry = CatalogRegistryItem[];

export function normalizeCatalogRegistry(registry: unknown): CatalogRegistry {
  if (!isCatalogRegistry(registry)) {
    throw new Error("Invalid dataset search registry.");
  }

  return registry.map((catalog) => ({
    ...catalog,
    supportedInputParams: Array.isArray(catalog.supportedInputParams) ? catalog.supportedInputParams : []
  }));
}

export function isCatalogRegistry(value: unknown): value is CatalogRegistry {
  return Array.isArray(value)
    && value.every((catalog) =>
      catalog
      && typeof catalog === "object"
      && typeof (catalog as CatalogRegistryItem).id === "string"
      && typeof (catalog as CatalogRegistryItem).name === "string"
      && typeof (catalog as CatalogRegistryItem).url === "string"
      && typeof (catalog as CatalogRegistryItem).type === "string"
    );
}
