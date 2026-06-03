import { handleAgentChat } from "../../_shared/agentChat";

export async function POST(request: Request) {
  return handleAgentChat(request);
}
