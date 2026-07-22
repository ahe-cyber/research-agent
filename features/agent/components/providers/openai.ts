import type { AgentProviderOption } from "@/features/agent/agent.schema";

export const openAiProviderOption: AgentProviderOption = {
  id: "openai",
  label: "OpenAI",
  apiKeyLabel: "OpenAI API key",
  placeholder: "gpt-5.5",
  implemented: true
};
