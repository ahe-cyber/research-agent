export interface HubRegistryItem extends Record<string, unknown> {
  id: string;
  name: string;
  url: string;
  type: string;
  supportedInputParams?: unknown[];
}

export type HubRegistry = HubRegistryItem[];

export function normalizeHubRegistry(registry: unknown): HubRegistry {
  if (!isHubRegistry(registry)) {
    throw new Error("Invalid dataset search registry.");
  }

  return registry.map((hub) => ({
    ...hub,
    supportedInputParams: Array.isArray(hub.supportedInputParams) ? hub.supportedInputParams : []
  }));
}

export function isHubRegistry(value: unknown): value is HubRegistry {
  return Array.isArray(value)
    && value.every((hub) =>
      hub
      && typeof hub === "object"
      && typeof (hub as HubRegistryItem).id === "string"
      && typeof (hub as HubRegistryItem).name === "string"
      && typeof (hub as HubRegistryItem).url === "string"
      && typeof (hub as HubRegistryItem).type === "string"
    );
}
