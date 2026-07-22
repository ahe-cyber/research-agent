import { postJsonWithRetry } from "@/lib/server/http";
import type { AgentModelProvider } from "@/features/agent/agent.schema";

const OPENAI_REQUEST_TIMEOUT_MS = Number(process.env.OPENAI_REQUEST_TIMEOUT_MS || 45_000);

export const openAiProvider: AgentModelProvider = {
  id: "openai",
  label: "OpenAI",
  defaultModel: process.env.OPENAI_MODEL || "gpt-5.5",
  apiKeyLabel: "OpenAI API key",
  emptyResponseMessage: "No response from OpenAI.",
  errorResponseMessage(error) {
    return error?.status ? `OpenAI API returned HTTP ${error.status}.` : "Failed to reach OpenAI API.";
  },
  async createInteraction(apiKey, body) {
    return createOpenAiInteraction(apiKey, body);
  }
};

async function createOpenAiInteraction(apiKey: string, body: any) {
  const payload: any = {
    model: body.model,
    input: toOpenAiInput(body.input),
    instructions: body.system_instruction,
    tools: (body.tools || []).map(toOpenAiTool),
    tool_choice: "auto",
    max_output_tokens: getMaxOutputTokens(body),
    ...(body.previous_interaction_id ? { previous_response_id: body.previous_interaction_id } : {})
  };

  const response = await postJsonWithRetry("https://api.openai.com/v1/responses", {
    label: "OpenAI",
    timeoutMs: OPENAI_REQUEST_TIMEOUT_MS,
    headers: { Authorization: `Bearer ${apiKey}` },
    body: payload
  });

  return {
    id: response.id,
    output_text: response.output_text || extractOpenAiText(response.output),
    outputs: (response.output || []).flatMap((item: any) => {
      if (item.type === "function_call") {
        return [{
          type: "function_call",
          id: item.call_id || item.id,
          name: item.name,
          arguments: parseArgs(item.arguments)
        }];
      }
      if (item.type === "message") {
        return (item.content || [])
          .filter((content: any) => content.type === "output_text" && content.text)
          .map((content: any) => ({ type: "text", text: content.text }));
      }
      return [];
    })
  };
}

function getMaxOutputTokens(body: any, fallback = 2048) {
  return Number(body?.generation_config?.max_output_tokens || body?.max_output_tokens || fallback);
}

function toOpenAiTool(tool: any) {
  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters || {
      type: "object",
      properties: {},
      additionalProperties: false
    },
    strict: false
  };
}

function toOpenAiInput(input: any) {
  if (Array.isArray(input)) return input.map(toOpenAiInput);
  if (input?.type === "function_result") {
    return {
      type: "function_call_output",
      call_id: input.call_id,
      output: stringifyFunctionResult(input.result)
    };
  }
  return input;
}

function stringifyFunctionResult(result: any) {
  if (Array.isArray(result)) {
    return result.map((part) => part?.text || "").join("\n");
  }
  return typeof result === "string" ? result : JSON.stringify(result);
}

function extractOpenAiText(output: any[] = []) {
  return output.flatMap((item: any) =>
    item.type === "message"
      ? (item.content || []).filter((content: any) => content.type === "output_text").map((content: any) => content.text)
      : []
  ).join("");
}

function parseArgs(value: any) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return {}; }
}
