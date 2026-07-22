import type { AgentProviderOption } from "@/features/agent/agent.schema";

export const geminiProviderOption: AgentProviderOption = {
  id: "gemini",
  label: "Gemini",
  apiKeyLabel: "Gemini API key",
  placeholder: "gemini-2.5-flash",
  implemented: true
};
