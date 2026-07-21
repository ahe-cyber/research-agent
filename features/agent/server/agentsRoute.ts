import { dataPath, jsonResponse, readJsonFileResponse, writeJsonFile } from "@/lib/server/files";
import { handleAgentChat } from "./chatService";
import { getAgentInstruction, saveAgentInstruction } from "./instructionRoute";

const agentPath = dataPath("features", "agent.json");

export function getAgentRouteData(request: Request) {
  return isInstructionRequest(request) ? getAgentInstruction() : getAgents();
}

export function postAgentRouteData(request: Request) {
  return isChatRequest(request)
    ? handleAgentChat(request)
    : jsonResponse({ error: "Unsupported agent operation." }, { status: 400 });
}

export function saveAgentRouteData(request: Request) {
  return isInstructionRequest(request) ? saveAgentInstruction(request) : saveAgents(request);
}

export async function getAgents() {
  return readJsonFileResponse(agentPath, []);
}

export async function saveAgents(request: Request) {
  const body = await request.json().catch(() => null);

  if (!Array.isArray(body)) {
    return jsonResponse({ error: "Agents payload must be an array." }, { status: 400 });
  }

  try {
    await writeJsonFile(agentPath, body);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Failed to write agents." }, { status: 500 });
  }
}

function getResource(request: Request) {
  return new URL(request.url).searchParams.get("resource") || "";
}

function isChatRequest(request: Request) {
  return getResource(request) === "chat";
}

function isInstructionRequest(request: Request) {
  return getResource(request) === "instruction";
}
