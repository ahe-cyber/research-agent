import { postJsonWithRetry } from "@/lib/server/http";
import type { AgentModelProvider } from "../../agent.schema";

const CLAUDE_REQUEST_TIMEOUT_MS = Number(process.env.CLAUDE_REQUEST_TIMEOUT_MS || 45_000);
const CLAUDE_API_VERSION = process.env.CLAUDE_API_VERSION || "2023-06-01";
const claudeSessions = new Map<string, { system: string; messages: any[]; tools: any[] }>();

export const claudeProvider: AgentModelProvider = {
  id: "claude",
  label: "Claude",
  defaultModel: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
  apiKeyLabel: "Claude API key",
  emptyResponseMessage: "No response from Claude.",
  errorResponseMessage(error) {
    return error?.status ? `Claude API returned HTTP ${error.status}.` : "Failed to reach Claude API.";
  },
  async createInteraction(apiKey, body) {
    return createClaudeInteraction(apiKey, body);
  }
};

async function createClaudeInteraction(apiKey: string, body: any) {
  const previous = body.previous_interaction_id ? claudeSessions.get(body.previous_interaction_id) : null;
  const tools = (body.tools || []).map(interactionToolToJsonSchemaTool);
  const messages = previous
    ? [
      ...previous.messages,
      {
        role: "user",
        content: toClaudeUserContent(body.input)
      }
    ]
    : [{ role: "user", content: [{ type: "text", text: String(body.input || "") }] }];

  const response = await postJsonWithRetry("https://api.anthropic.com/v1/messages", {
    label: "Claude",
    timeoutMs: CLAUDE_REQUEST_TIMEOUT_MS,
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": CLAUDE_API_VERSION
    },
    body: {
      model: body.model,
      system: body.system_instruction || undefined,
      messages,
      tools,
      max_tokens: getMaxOutputTokens(body)
    }
  });

  const id = response.id || `claude-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  claudeSessions.set(id, {
    system: body.system_instruction || "",
    tools,
    messages: [
      ...messages,
      { role: "assistant", content: response.content || [] }
    ]
  });

  return {
    id,
    output_text: (response.content || [])
      .filter((content: any) => content.type === "text" && content.text)
      .map((content: any) => content.text)
      .join(""),
    outputs: (response.content || []).flatMap((content: any) => {
      if (content.type === "text" && content.text) {
        return [{ type: "text", text: content.text }];
      }
      if (content.type === "tool_use") {
        return [{
          type: "function_call",
          id: content.id,
          name: content.name,
          arguments: content.input || {}
        }];
      }
      return [];
    })
  };
}

function interactionToolToJsonSchemaTool(tool: any) {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters || {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  };
}

function getMaxOutputTokens(body: any, fallback = 2048) {
  return Number(body?.generation_config?.max_output_tokens || body?.max_output_tokens || fallback);
}

function toClaudeUserContent(input: any) {
  const results = toClaudeToolResults(input);
  if (results.length > 0) return results;
  return [{ type: "text", text: String(input || "") }];
}

function toClaudeToolResults(input: any) {
  const results = Array.isArray(input) ? input : [input];
  return results.filter((item) => item?.type === "function_result").map((item) => ({
    type: "tool_result",
    tool_use_id: item.call_id,
    content: stringifyFunctionResult(item.result)
  }));
}

function stringifyFunctionResult(result: any) {
  if (Array.isArray(result)) {
    return result.map((part) => part?.text || "").join("\n");
  }
  return typeof result === "string" ? result : JSON.stringify(result);
}
