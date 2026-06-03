export interface HubRegistryGroup {
  supportedInputParams: unknown[];
  items: Array<Record<string, unknown>>;
}

export type HubRegistry = Record<string, HubRegistryGroup>;

export function normalizeHubRegistry(registry: unknown): HubRegistry {
  if (!isHubRegistry(registry)) {
    throw new Error("Invalid hubs registry.");
  }

  return Object.fromEntries(
    Object.entries(registry).map(([type, group]) => [
      type,
      {
        supportedInputParams: group.supportedInputParams,
        items: group.items.map(stripHubType)
      }
    ])
  );
}

export function isHubRegistry(value: unknown): value is HubRegistry {
  return Boolean(value)
    && !Array.isArray(value)
    && typeof value === "object"
    && Object.values(value).every((group) =>
      group
      && typeof group === "object"
      && Array.isArray((group as HubRegistryGroup).supportedInputParams)
      && Array.isArray((group as HubRegistryGroup).items)
    );
}

function stripHubType(hub: Record<string, unknown>) {
  const { type: _type, ...rest } = hub || {};
  return rest;
}
