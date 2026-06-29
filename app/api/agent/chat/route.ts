import { handleAgentChat } from "../../_services/agentChat";

export async function POST(request: Request) {
  return handleAgentChat(request);
}
