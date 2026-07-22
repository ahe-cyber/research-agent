import { jsonResponse } from "@/lib/server/files";
import type { AddressSearchSource } from "../address.schema";
import { getAddressSearchSources, saveAddressSearchSources } from "./repository";

export async function listAddressSearchSources() {
  return jsonResponse(await getAddressSearchSources());
}

export async function updateAddressSearchSources(sources: AddressSearchSource[]) {
  await saveAddressSearchSources(sources);
  return jsonResponse({ ok: true });
}
