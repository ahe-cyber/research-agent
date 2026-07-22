import type { AgentProviderOption } from "@/features/agent/agent.schema";

export const claudeProviderOption: AgentProviderOption = {
  id: "claude",
  label: "Claude",
  apiKeyLabel: "Claude API key",
  placeholder: "claude-sonnet-4-6",
  implemented: true
};
