import type { AgentProviderOption } from "../../agent.schema";

export const openAiProviderOption: AgentProviderOption = {
  id: "openai",
  label: "OpenAI",
  apiKeyLabel: "OpenAI API key",
  placeholder: "gpt-5.5",
  implemented: true
};
