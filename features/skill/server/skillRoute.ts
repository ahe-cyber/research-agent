import { dataPath, readJsonFileResponse } from "@/lib/server/files";

const skillPath = dataPath("features", "skill.json");

export async function getSkills() {
  return readJsonFileResponse(skillPath, [], "Failed to read skills.");
}
