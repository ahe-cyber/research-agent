import { dataPath } from "@/lib/server/files";
import { readJsonFile } from "@/lib/server/jsonRepository";

const mapPath = dataPath("features", "map.json");

export function getMapSources() {
  return readJsonFile(mapPath, []);
}
