import { jsonResponse } from "@/lib/server/files";
import { getAgents, getGlobalInstruction, saveAgents, saveGlobalInstruction } from "./repository";

export async function listAgents() {
  return jsonResponse(await getAgents());
}

export async function updateAgents(agents: unknown[]) {
  await saveAgents(agents);
  return jsonResponse({ ok: true });
}

export async function readAgentInstruction() {
  return jsonResponse({ instruction: await getGlobalInstruction() });
}

export async function updateAgentInstruction(instruction: string) {
  await saveGlobalInstruction(instruction);
  return jsonResponse({ ok: true });
}
