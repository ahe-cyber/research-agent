import { dataPath } from "@/lib/server/files";
import { readJsonFile, writeJsonFile } from "@/lib/server/jsonRepository";
import { getSearchItems, putSearchItems } from "@/lib/server/searchRepository";

const FEATURE_ID = "agent";
const agentSessionPath = dataPath("features", "agent.json");
const instructionPath = dataPath("instruction.json");

interface AgentRegistry {
  globalInstruction?: string;
}

export function getAgentSessions() {
  return readJsonFile(agentSessionPath, { activeSessionId: "", sessions: [] });
}

export function getAgentSearchSources() {
  return getSearchItems(FEATURE_ID);
}

export function saveAgentData(data: unknown) {
  return writeJsonFile(agentSessionPath, data);
}

export function saveAgentSessions(sessions: unknown[]) {
  const firstSession = sessions?.[0] as { id?: string } | undefined;
  return writeJsonFile(agentSessionPath, { activeSessionId: firstSession?.id || "", sessions });
}

export function saveAgentSearchSources(sources: unknown[]) {
  return putSearchItems(FEATURE_ID, sources);
}

export async function getGlobalInstruction() {
  const data = await readJsonFile<AgentRegistry>(instructionPath, { globalInstruction: "" });
  return data.globalInstruction || "";
}

export async function saveGlobalInstruction(instruction: string) {
  const data = await readJsonFile<AgentRegistry>(instructionPath, { globalInstruction: "" });
  data.globalInstruction = instruction;
  await writeJsonFile(instructionPath, data);
}
