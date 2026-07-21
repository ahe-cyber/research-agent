import { dataPath, readJsonFileResponse } from "@/lib/server/files";

const mapPath = dataPath("features", "map.json");

export async function getMapSources() {
  return readJsonFileResponse(mapPath, [], "Failed to read map sources.");
}
