import { dataPath } from "@/lib/server/files";
import { readJsonFile, writeJsonFile } from "@/lib/server/jsonRepository";

const agentPath = dataPath("features", "agent.json");
const instructionPath = dataPath("instruction.json");

interface AgentRegistry {
  globalInstruction?: string;
}

export function getAgents() {
  return readJsonFile(agentPath, []);
}

export function saveAgents(agents: unknown[]) {
  return writeJsonFile(agentPath, agents);
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
