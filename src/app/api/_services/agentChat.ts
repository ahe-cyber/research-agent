import { readFile, writeFile } from "node:fs/promises";
import { dataPath, jsonResponse } from "../_lib/files";
import { errorMessage, isHttpUrl, isJsonContentType } from "../_lib/http";
import { TOOL_DECLARATIONS } from "../tool/route";

const DEFAULT_AGENT_SYSTEM_INSTRUCTION = "You are a GIS research assistant.";
const AGENT_ATTACHMENT_CONTEXT_MAX_CHARS = 8_000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const datasetPath = dataPath("dataset.json");
const searchRegistryPath = dataPath("search.json");
const agentPath = dataPath("agent.json");

const RETRYABLE_STATUSES = new Set([429, 502, 503]);
const agentInteractionIds = new Map<string, string>();

export async function handleAgentChat(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return jsonResponse({ error: "GEMINI_API_KEY is not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const { contents, messages, systemInstruction } = body || {};
  const appMessages = normalizeAppMessages(messages);
  const legacyContents = Array.isArray(contents) ? contents : [];

  if (appMessages.length === 0 && legacyContents.length === 0) {
    return jsonResponse({ error: "messages must be a non-empty array." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      void runAgentChat({
        apiKey,
        appMessages,
        legacyContents,
        systemInstruction,
        reportContent: body?.reportContent || "",
        send: (obj) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      })
        .catch((error) => {
          console.error("[Agent] Gemini request failed", error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "error",
            message: "Failed to reach Gemini API.",
            detail: errorMessage(error)
          })}\n\n`));
        })
        .finally(() => controller.close());
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    }
  });
}

async function runAgentChat({ apiKey, appMessages, legacyContents, systemInstruction, reportContent, send }: any) {
  let flatCatalogs: any[] = [];
  let datasetSources: any[] = [];
  let agentRegistry: any = { agents: [], connections: [] };

  try {
    const registry = JSON.parse(await readFile(searchRegistryPath, "utf8"));
    flatCatalogs = Array.isArray(registry)
      ? registry.filter((item: any) => item.activity === "dataset").map((item: any) => ({ id: item.id, name: item.name, url: item.url, type: item.type }))
      : [];
  } catch {}

  try {
    datasetSources = JSON.parse(await readFile(datasetPath, "utf8"));
  } catch {}

  try {
    const loadedAgents = JSON.parse(await readFile(agentPath, "utf8"));
    if (Array.isArray(loadedAgents)) {
      agentRegistry = { agents: loadedAgents, connections: [] };
    }
  } catch {}

  const activeAgent = findAgentModule(agentRegistry, getAddressedAgentId(appMessages));
  const globalInstruction = (typeof systemInstruction === "string" && systemInstruction.trim())
    ? systemInstruction.trim()
    : DEFAULT_AGENT_SYSTEM_INSTRUCTION;
  const baseInstruction = activeAgent
    ? buildEntryAgentInstruction(activeAgent, globalInstruction)
    : globalInstruction;
  const currentReportContent = getReportContentFromMessages(appMessages) || reportContent || "";

  const interactionTools = toInteractionTools(TOOL_DECLARATIONS);
  const seenIds = new Set();
  let maxTurns = 10;

  async function executeAgentTool(name: string, args: any = {}) {
    if (name === "list_catalogs") {
      return { catalogs: flatCatalogs };
    }

    if (name === "list_sources") {
      const summary = datasetSources
        .filter((s) => !s.isDeleted)
        .map((s) => ({
          id: s.id,
          name: s.name,
          description: (s.description || "").slice(0, 300),
          type: s.type,
          queryUrl: s.queryUrl || getSourceQueryBaseUrl(s),
          defaultParams: sourceParamsToObject(s.defaultParams || [])
        }));
      return { sources: summary };
    }

    if (name === "query_source") {
      try {
        return await queryConfiguredSource(datasetSources, args.sourceId, args.params || {});
      } catch (error) {
        console.error("[Agent source query] Failed:", errorMessage(error));
        return { error: errorMessage(error) };
      }
    }

    if (name === "list_agents") {
      return { agents: summarizeAgentModules(agentRegistry) };
    }

    if (name === "call_agent") {
      try {
        return await callAgentModule(apiKey, agentRegistry, args.agentId, args.message || "", args.callerId || activeAgent?.id || "", Boolean(args.blind));
      } catch (error) {
        console.error("[Agent module call] Failed:", errorMessage(error));
        return { error: errorMessage(error) };
      }
    }

    if (name === "create_agent") {
      try {
        const result = await createAgentModule(agentRegistry, args);
        agentRegistry = result.registry;
        send({ type: "agents_updated" });
        return { created: { id: result.agent.id, name: result.agent.name } };
      } catch (error) {
        console.error("[Agent module create] Failed:", errorMessage(error));
        return { error: errorMessage(error) };
      }
    }

    if (name === "edit_agent") {
      try {
        const result = await editAgentInstructions(agentRegistry, args);
        agentRegistry = result.registry;
        send({ type: "agents_updated" });
        return { edited: result.edited, ok: true };
      } catch (error) {
        console.error("[Agent module edit] Failed:", errorMessage(error));
        return { error: errorMessage(error) };
      }
    }

    if (name === "edit_communication") {
      try {
        const result = await editCommunication(agentRegistry, args);
        agentRegistry = { agents: JSON.parse(await readFile(agentPath, "utf8")), connections: [] };
        send({ type: "agents_updated" });
        return result;
      } catch (error) {
        console.error("[Edit communication] Failed:", errorMessage(error));
        return { error: errorMessage(error) };
      }
    }

    if (name === "get_report") {
      return { content: currentReportContent || "" };
    }

    if (name === "update_report") {
      send({ type: "report_append", heading: args.heading || null, content: args.content });
      return { appended: true };
    }

    if (name !== "search_catalog") {
      return { error: `Unknown tool: ${name}` };
    }

    const requestedCatalogUrl = args.catalogUrl || args.hubUrl;
    const catalog = flatCatalogs.find((catalog) => catalog.url === requestedCatalogUrl || requestedCatalogUrl?.startsWith(catalog.url));
    const catalogUrl = catalog?.url || requestedCatalogUrl;
    const catalogType = catalog?.type || "arcgis";
    const catalogName = catalog?.name || catalogUrl;

    if (!catalogUrl) {
      return { error: "catalogUrl is required.", results: [], count: 0 };
    }

    send({ type: "search_start", query: args.query, catalogName, catalogUrl });

    try {
      const results = catalogType === "socrata"
        ? await searchSocrata(catalogUrl, args.query)
        : await searchArcGIS(catalogUrl, args.query, args.bbox);

      for (const item of results) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          send({ type: "result", item: { ...item, catalogName, portalType: catalogType } });
        }
      }

      return {
        results: results.map((r: any) => ({ id: r.id, title: r.title, snippet: (r.snippet || "").slice(0, 200) })),
        count: results.length
      };
    } catch (error) {
      console.error("[Agent catalog search] Failed:", errorMessage(error));
      send({ type: "search_error", query: args.query, catalogName, message: errorMessage(error) });
      return { error: errorMessage(error), results: [], count: 0 };
    }
  }

  function buildInteractionBody(input: any, previousInteractionId: string | null = null) {
    return {
      model: GEMINI_MODEL,
      input,
      ...(previousInteractionId ? { previous_interaction_id: previousInteractionId } : {}),
      tools: interactionTools,
      system_instruction: baseInstruction,
      generation_config: { temperature: 0.7, max_output_tokens: 2048 }
    };
  }

  const interactionInput = appMessages.length > 0
    ? appMessagesToInteractionInput(appMessages)
    : contentHistoryToInteractionInput(legacyContents);
  let interaction = await createInteraction(apiKey, buildInteractionBody(interactionInput));

  while (maxTurns-- > 0) {
    const functionCalls = getInteractionFunctionCalls(interaction);
    const text = getInteractionOutputText(interaction);

    if (functionCalls.length === 0) {
      if (!text) send({ type: "error", message: "No response from Gemini." });
      for (let i = 0; i < text.length; i += 60) send({ type: "text", delta: text.slice(i, i + 60) });
      break;
    }

    const functionResults = [];
    for (const call of functionCalls) {
      const result = await executeAgentTool(call.name, call.args);
      functionResults.push({
        type: "function_result",
        call_id: call.id,
        name: call.name,
        result: [{ type: "text", text: JSON.stringify(result) }]
      });
    }

    if (functionResults.length === 0) break;
    interaction = await createInteraction(apiKey, buildInteractionBody(
      functionResults.length === 1 ? functionResults[0] : functionResults,
      interaction.id
    ));
  }
}

async function createInteraction(apiKey: string, body: any, { maxRetries = 3, baseDelayMs = 600 } = {}) {
  let attempt = 0;
  while (true) {
    const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(body)
    });

    if (upstream.ok) return upstream.json();

    const errorText = await upstream.text().catch(() => "");
    let errorBody: any = {};
    try { errorBody = errorText ? JSON.parse(errorText) : {}; } catch {}
    const message = errorBody.error?.message || errorText || upstream.statusText || "Unknown Gemini error";

    if (RETRYABLE_STATUSES.has(upstream.status) && attempt < maxRetries) {
      const delay = baseDelayMs * 2 ** attempt;
      console.warn(`[Agent] Gemini ${upstream.status} - retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
      continue;
    }

    const error: any = new Error(`Gemini Interactions API returned ${upstream.status}: ${message}`);
    error.status = upstream.status;
    error.upstreamBody = errorBody.error || errorBody || errorText;
    throw error;
  }
}

function contentHistoryToInteractionInput(contents: any[]) {
  const turns = (contents || []).map((turn) => {
    const role = turn.role === "model" ? "Assistant" : "User";
    const text = (turn.parts || [])
      .map((part: any) => part.text || "")
      .filter(Boolean)
      .join("\n");
    return text ? `${role}: ${text}` : "";
  }).filter(Boolean);

  if (turns.length === 1 && turns[0].startsWith("User: ")) {
    return turns[0].slice("User: ".length);
  }

  return turns.join("\n\n");
}

function appMessagesToInteractionInput(messages: any[]) {
  const turns = (messages || []).map((message) => {
    const sender = String(message.sender || "unknown").trim() || "unknown";
    const replyTo = String(message.replyTo || "").trim();
    const content = String(message.content || "").trim();
    const contextText = serializeMessageContext(message.context);
    const route = replyTo ? `${sender} -> ${replyTo}` : sender;
    const parts = [`From: ${route}`];
    if (contextText) parts.push(contextText);
    if (content) parts.push(content);
    return parts.join("\n\n");
  }).filter(Boolean);

  return turns.length === 1 ? turns[0] : turns.join("\n\n---\n\n");
}

function serializeMessageContext(context: any = {}) {
  const parts = [];
  const toolHints = Array.isArray(context.toolHints)
    ? context.toolHints.map((hint: any) => String(hint || "").trim()).filter(Boolean)
    : [];
  if (toolHints.length > 0) {
    parts.push(`<tool_suggestion>${toolHints.join(", ")}</tool_suggestion>`);
  }

  const attachments = Array.isArray(context.attachments) ? context.attachments : [];
  if (attachments.length > 0) {
    const attachmentText = attachments.map((attachment: any) => {
      const title = attachment.title || attachment.kind || "Context";
      const payload = typeof attachment.payload === "string"
        ? attachment.payload
        : JSON.stringify(attachment.payload || attachment, null, 2);
      return `Attachment "${title}":\n${payload}`;
    });
    parts.push(`<context>\n${attachmentText.join("\n\n---\n\n")}\n</context>`);
  }

  return parts.join("\n\n");
}

function normalizeAppMessages(messages: any) {
  if (!Array.isArray(messages)) return [];

  return messages
    .map((message) => ({
      sender: String(message?.sender || "").trim(),
      content: String(message?.content || ""),
      replyTo: message?.replyTo ? String(message.replyTo).trim() : "",
      context: message?.context && typeof message.context === "object" ? message.context : {}
    }))
    .filter((message) =>
      message.sender
      && (message.content.trim()
        || (Array.isArray(message.context.attachments) && message.context.attachments.length > 0)
        || (Array.isArray(message.context.toolHints) && message.context.toolHints.length > 0))
    );
}

function getReportContentFromMessages(messages: any[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const report = messages[i]?.context?.report;
    if (typeof report === "string") return report;
  }
  return null;
}

function getAddressedAgentId(messages: any[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.sender === "user" && message.replyTo) return message.replyTo;
  }
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.replyTo) return messages[i].replyTo;
  }
  return "";
}

function getInteractionOutputText(interaction: any) {
  if (typeof interaction.output_text === "string") return interaction.output_text;
  if (Array.isArray(interaction.outputs)) {
    const lastText = interaction.outputs
      .filter((output: any) => output.type === "text" && output.text)
      .at(-1);
    if (lastText) return lastText.text;
  }

  const modelOutputs = (interaction.steps || []).filter((step: any) => step.type === "model_output");
  const lastOutput = modelOutputs.at(-1);
  return (lastOutput?.content || [])
    .filter((content: any) => content.type === "text" && content.text)
    .map((content: any) => content.text)
    .join("");
}

function getInteractionFunctionCalls(interaction: any) {
  const stepCalls = (interaction.steps || [])
    .filter((step: any) => step.type === "function_call")
    .map((step: any) => ({
      id: step.id,
      name: step.name,
      args: step.arguments || {}
    }));
  if (stepCalls.length > 0) return stepCalls;

  return (interaction.outputs || [])
    .filter((output: any) => output.type === "function_call")
    .map((output: any) => ({
      id: output.id,
      name: output.name,
      args: output.arguments || {}
    }));
}

function toInteractionTools(functionDeclarations: any[]) {
  return functionDeclarations.map((declaration) => ({
    type: "function",
    name: declaration.name,
    description: declaration.description,
    parameters: normalizeJsonSchema(declaration.parameters || {
      type: "OBJECT",
      properties: {},
      additionalProperties: false
    })
  }));
}

function normalizeJsonSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(normalizeJsonSchema);

  const normalized: any = {};
  Object.entries(schema).forEach(([key, value]) => {
    normalized[key] = key === "type" && typeof value === "string"
      ? value.toLowerCase()
      : normalizeJsonSchema(value);
  });
  return normalized;
}

async function callAgentModule(apiKey: string, registry: any, agentId: string, message: string, callerId = "", blind = false) {
  const agent = findAgentModule(registry, agentId);
  if (!agent) {
    throw new Error(`Agent module not found: ${agentId}`);
  }

  const prompt = String(message || "").trim();
  if (!prompt) {
    throw new Error("call_agent requires a message.");
  }

  const caller = findAgentModule(registry, callerId);

  const fromTo = caller
    ? `From: ${caller.name || caller.id} -> To: ${agent.name || agent.id}\n\n`
    : `To: ${agent.name || agent.id}\n\n`;

  const pairKey = `${callerId || "__root__"}:${agent.id}`;
  const previousInteractionId = blind ? null : agentInteractionIds.get(pairKey) ?? null;

  const interaction = await createInteraction(apiKey, {
    model: GEMINI_MODEL,
    input: fromTo + prompt,
    ...(previousInteractionId ? { previous_interaction_id: previousInteractionId } : {}),
    system_instruction: buildEntryAgentInstruction(agent, "", caller),
    generation_config: { temperature: 0.7, max_output_tokens: 2048 },
    store: !blind
  });

  if (blind) return { blind: true, agent: { id: agent.id, name: agent.name || "Agent module" } };

  agentInteractionIds.set(pairKey, interaction.id);

  const text = getInteractionOutputText(interaction);
  return {
    agent: { id: agent.id, name: agent.name || "Agent module" },
    caller: caller ? { id: caller.id, name: caller.name || "Agent module" } : null,
    text
  };
}

async function createAgentModule(registry: any, args: any) {
  const name = String(args.name || "").trim();
  if (!name) throw new Error("create_agent requires a name.");

  const id = `agent-${Date.now().toString(36)}`;
  const description = String(args.description || "").trim();

  const agent = { id, name, description, x: 100, y: 100, attachments: [], toolHints: [] };
  registry.agents.push(agent);
  await writeFile(agentPath, `${JSON.stringify(registry.agents || [], null, 2)}\n`, "utf8");
  return { registry, agent };
}

async function editAgentInstructions(registry: any, args: any) {
  const instruction = String(args.instruction || "").trim();
  if (!instruction) throw new Error("edit_agent requires instruction text.");

  const target = String(args.agentId || "").trim();
  if (!target) throw new Error("edit_agent requires agentId.");

  const agent = findAgentModule(registry, target);
  if (!agent) throw new Error(`Agent module not found: ${target}`);

  const mode = String(args.mode || "replace").toLowerCase();
  if (mode === "append") {
    agent.description = [agent.description, instruction].filter(Boolean).join("\n\n");
  } else {
    agent.description = instruction;
  }

  await writeFile(agentPath, `${JSON.stringify(registry.agents || [], null, 2)}\n`, "utf8");
  return { registry, edited: { id: agent.id, name: agent.name || "Agent module", instruction: agent.description } };
}

async function editCommunication(registry: any, args: any) {
  const instruction = String(args.instruction || "").trim();
  if (!instruction) throw new Error("edit_communication requires instruction text.");

  const sender = findAgentModule(registry, String(args.senderId || "").trim());
  if (!sender) throw new Error(`Sender agent not found: ${args.senderId}`);

  const receiver = findAgentModule(registry, String(args.receiverId || "").trim());
  if (!receiver) throw new Error(`Receiver agent not found: ${args.receiverId}`);

  if (!Array.isArray(sender.agentPeers)) sender.agentPeers = [];
  if (!Array.isArray(receiver.agentPeers)) receiver.agentPeers = [];

  let senderPeer = sender.agentPeers.find((p: any) => p.id === receiver.id);
  if (!senderPeer) {
    senderPeer = { id: receiver.id, "communication-instruction": "" };
    sender.agentPeers.push(senderPeer);
    if (!receiver.agentPeers.find((p: any) => p.id === sender.id)) {
      receiver.agentPeers.push({ id: sender.id, "communication-instruction": "" });
    }
  }
  senderPeer["communication-instruction"] = instruction;

  await writeFile(agentPath, `${JSON.stringify(registry.agents || [], null, 2)}\n`, "utf8");
  return { ok: true, senderId: sender.id, receiverId: receiver.id };
}

function summarizeAgentModules(registry: any) {
  return (registry.agents || []).map((agent: any) => ({
    id: agent.id,
    name: agent.name || "Agent module",
    instruction: String(agent.description || "").slice(0, 500),
    tools: Array.isArray(agent.toolHints) ? agent.toolHints : [],
    encouragedAgents: getAttachedAgentSummaries(agent),
    peers: (agent.agentPeers || []).map((peer: any) => {
      const peerAgent = (registry.agents || []).find((a: any) => a.id === peer.id);
      return {
        id: peer.id,
        name: peerAgent?.name || peer.id,
        communicationInstruction: peer["communication-instruction"] || ""
      };
    })
  }));
}

function buildEntryAgentInstruction(agent: any, globalInstruction = "", caller: any = null) {
  const parts = [
    `<global_instruction>\n${globalInstruction || DEFAULT_AGENT_SYSTEM_INSTRUCTION}\n</global_instruction>`,
    `<your_info>\n${stringifyAgentSelfContext(agent)}\n</your_info>`
  ];

  const attachedItems = summarizeAgentAttachments(agent);
  if (attachedItems.length > 0) {
    parts.push(`<attached_items>\n${attachedItems.join("\n\n---\n\n")}\n</attached_items>`);
  }

  const relatedAgents = getAttachedAgentSummaries(agent);
  if (relatedAgents.length > 0) {
    parts.push(`<encouraged_direct_collaborators>\n${relatedAgents.map((item: any) => `- ${item.name} (${item.id || "no id"})`).join("\n")}\n</encouraged_direct_collaborators>`);
  }

  if (caller) {
    parts.push(`<caller_agent>\nname: ${caller.name || "Agent module"}\nid: ${caller.id}\ndescription: ${caller.description || ""}\nReturn your reply to this caller.\n</caller_agent>`);
  }

  return parts.join("\n\n");
}

function stringifyAgentSelfContext(agent: any) {
  const selfContext = {
    id: agent.id,
    name: agent.name || "Agent module",
    instruction: agent.description || "",
    attachments: Array.isArray(agent.attachments) ? agent.attachments : [],
    suggestedTools: Array.isArray(agent.toolHints) ? agent.toolHints : []
  };
  const raw = JSON.stringify(selfContext, null, 2);
  return raw.length > AGENT_ATTACHMENT_CONTEXT_MAX_CHARS
    ? `${raw.slice(0, AGENT_ATTACHMENT_CONTEXT_MAX_CHARS)}\n... [truncated]`
    : raw;
}

function summarizeAgentAttachments(agent: any) {
  return (agent.attachments || []).map((attachment: any) => {
    const summary = {
      kind: attachment.kind || "Attachment",
      title: attachment.title || attachment.kind || "Context",
      payload: attachment.payload || null
    };
    const raw = JSON.stringify(summary, null, 2);
    return raw.length > AGENT_ATTACHMENT_CONTEXT_MAX_CHARS
      ? `${raw.slice(0, AGENT_ATTACHMENT_CONTEXT_MAX_CHARS)}\n... [truncated]`
      : raw;
  });
}

function findAgentModule(registry: any, agentId: string) {
  const target = String(agentId || "").trim().toLowerCase();
  if (!target) return null;

  return (registry.agents || []).find((agent: any) =>
    String(agent.id || "").toLowerCase() === target
    || String(agent.name || "").toLowerCase() === target
  ) || null;
}

function getAttachedAgentSummaries(agent: any) {
  return (agent.attachments || [])
    .filter((attachment: any) => attachment.kind === "Agent Module")
    .map((attachment: any) => ({
      id: attachment.payload?.agent?.id,
      name: attachment.title || attachment.payload?.agent?.name || "Agent module"
    }));
}

async function queryConfiguredSource(sources: any[], sourceId: string, params = {}) {
  const source = findConfiguredSource(sources, sourceId);
  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  const baseUrl = getSourceQueryBaseUrl(source);
  if (!isHttpUrl(baseUrl)) {
    throw new Error(`Source ${source.name || source.id} does not have a valid query URL.`);
  }

  const mergedParams = {
    ...sourceParamsToObject(source.defaultParams || [], { omitTemplates: true }),
    ...sanitizeQueryParams(params)
  };
  const url = buildUrlWithParams(baseUrl, mergedParams);
  const result = await fetchQueryPayload(url);

  return {
    source: {
      id: source.id,
      name: source.name,
      type: source.type,
      description: source.description || ""
    },
    request: result.request,
    ok: result.ok,
    status: result.status,
    statusText: result.statusText,
    contentType: result.contentType,
    durationMs: result.durationMs,
    timestamp: result.timestamp,
    response: result.response,
    responsePreview: result.responsePreview,
    parseError: result.parseError
  };
}

function findConfiguredSource(sources: any[], sourceId: string) {
  const target = String(sourceId || "").trim().toLowerCase();
  if (!target) return null;
  return (sources || [])
    .filter((source) => !source.isDeleted)
    .find((source) =>
      String(source.id || "").toLowerCase() === target
      || String(source.name || "").toLowerCase() === target
    ) || null;
}

function getSourceQueryBaseUrl(source: any) {
  if (source.queryUrl) return source.queryUrl;

  const overviewUrl = String(source.overviewUrl || "").replace(/\/$/, "");
  if (!overviewUrl) return "";
  if (isSocrataSourceUrl(overviewUrl) || source.type === "socrata-dataset") {
    return normalizeSocrataResourceUrl(overviewUrl) || overviewUrl;
  }
  return `${overviewUrl}/query`;
}

function sourceParamsToObject(rows: any[], options: any = {}) {
  const params: any = {};
  (rows || []).forEach((row) => {
    const key = String(row.key || "").trim();
    const value = row.value;
    if (!key) return;
    if (options.omitTemplates && hasUnresolvedTemplate(value)) return;
    params[key] = value;
  });
  return params;
}

function sanitizeQueryParams(params: any) {
  if (!params || typeof params !== "object" || Array.isArray(params)) return {};

  return Object.fromEntries(
    Object.entries(params)
      .filter(([key, value]) => key && value !== undefined && value !== null)
      .map(([key, value]) => [key, typeof value === "object" ? JSON.stringify(value) : String(value)])
  );
}

function hasUnresolvedTemplate(value: any) {
  return /\{\{\s*[^}]+\s*\}\}/.test(String(value ?? ""));
}

function buildUrlWithParams(baseUrl: string, params: any) {
  const url = new URL(baseUrl);
  Object.entries(params || {}).forEach(([key, value]: any) => {
    if (key) url.searchParams.set(key, value);
  });
  return url.toString();
}

function isSocrataSourceUrl(url: string) {
  try {
    const { hostname, pathname } = new URL(url);
    return hostname.includes("socrata.com")
      || hostname.includes("opendata")
      || /\/resource\/[a-z0-9]{4}-[a-z0-9]{4}/i.test(pathname)
      || /\/api\/views\/[a-z0-9]{4}-[a-z0-9]{4}/i.test(pathname);
  } catch {
    return false;
  }
}

function normalizeSocrataResourceUrl(url: string) {
  const parts = getSocrataUrlParts(url);
  return parts ? `${parts.origin}/resource/${parts.id}.json` : "";
}

function getSocrataUrlParts(url: string) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/([a-z0-9]{4}-[a-z0-9]{4})(?:\.json)?/i);
    if (!match) return null;
    return { origin: parsed.origin, id: match[1].toLowerCase() };
  } catch {
    return null;
  }
}

async function fetchQueryPayload(queryUrl: string) {
  const startedAt = performance.now();
  const upstreamResponse = await fetch(queryUrl, {
    headers: {
      Accept: "application/json, application/geo+json, text/html;q=0.8, */*;q=0.5",
      "User-Agent": "research-agent/1.0"
    }
  });
  const durationMs = Math.round(performance.now() - startedAt);
  const contentType = upstreamResponse.headers.get("content-type") || "";
  const responseText = await upstreamResponse.text();
  const payload: any = {
    ok: upstreamResponse.ok,
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    contentType,
    durationMs,
    timestamp: new Date().toISOString(),
    request: {
      method: "GET",
      url: queryUrl
    }
  };

  if (isJsonContentType(contentType)) {
    try {
      payload.response = JSON.parse(responseText);
    } catch (error) {
      payload.ok = false;
      payload.parseError = errorMessage(error);
      payload.responsePreview = responseText.slice(0, 500);
    }
  } else if (contentType.includes("text/html")) {
    payload.responseType = "html";
    payload.responseText = responseText;
    payload.responsePreview = responseText.slice(0, 500);
  } else {
    payload.responsePreview = responseText.slice(0, 500);
  }

  return payload;
}

async function searchArcGIS(catalogUrl: string, query: string, bbox: string) {
  const limit = 8;
  const base = catalogUrl.replace(/\/$/, "");
  const host = new URL(base).hostname;
  const isHubSite = /(^|\.)hub\.arcgis\.com$/i.test(host) || /data\.gis\.ny\.gov$/i.test(host);
  const results = isHubSite
    ? await searchArcGISHub(base, query, limit)
    : await searchArcGISPortal(base, query, bbox, limit);

  return results.map((item: any) => ({
    id: item.id,
    title: item.title || "Untitled",
    snippet: item.snippet || "",
    url: item.url || "",
    type: item.type || "Feature Service",
    owner: item.owner || ""
  }));
}

async function searchArcGISPortal(base: string, query: string, bbox: string, limit: number) {
  const url = new URL(`${base}/sharing/rest/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("f", "json");
  url.searchParams.set("num", String(limit));
  url.searchParams.set("filter", `type:"Feature Service"`);
  if (bbox) url.searchParams.set("bbox", bbox);

  const res = await fetch(url.toString(), { headers: { "User-Agent": "research-agent/1.0", Accept: "application/json" } });
  if (!res.ok) throw new Error(`ArcGIS search returned ${res.status}`);
  const data = await readJsonResponse(res, "ArcGIS search");
  if (data.error) throw new Error(data.error.message || "ArcGIS search failed");
  return data.results || [];
}

async function searchArcGISHub(base: string, query: string, limit: number) {
  const url = new URL(`${base}/api/search/v1/collections/dataset/items`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), { headers: { "User-Agent": "research-agent/1.0", Accept: "application/json" } });
  if (!res.ok) throw new Error(`ArcGIS Hub search returned ${res.status}`);
  const data = await readJsonResponse(res, "ArcGIS Hub search");

  return (data.features || []).map((item: any) => {
    const attributes = item.properties || {};
    const links = Array.isArray(item.links) ? item.links : [];
    const self = links.find((link: any) => link.rel === "self")?.href;
    return {
      id: item.id || attributes.id || attributes.slug || attributes.name,
      title: attributes.name || attributes.title || "Untitled",
      snippet: stripHtml(attributes.description || attributes.snippet || attributes.summary || ""),
      url: attributes.url || attributes.itemUrl || self || "",
      type: attributes.type || "Feature Service",
      owner: attributes.owner || attributes.source || ""
    };
  });
}

async function searchSocrata(catalogUrl: string, query: string) {
  const url = new URL(`${catalogUrl.replace(/\/$/, "")}/api/catalog/v1`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  url.searchParams.set("domains", new URL(catalogUrl).hostname);

  const res = await fetch(url.toString(), { headers: { "User-Agent": "research-agent/1.0", Accept: "application/json" } });
  if (!res.ok) throw new Error(`Socrata search returned ${res.status}`);
  const data = await readJsonResponse(res, "Socrata search");

  return (data.results || []).map((item: any) => {
    const r = item.resource || {};
    return {
      id: r.id || item.link || String(Math.random()),
      title: r.name || "Untitled",
      snippet: r.description || "",
      url: item.permalink || item.link || "",
      type: r.type || "dataset",
      owner: item.metadata?.domain || catalogUrl
    };
  });
}

async function readJsonResponse(res: Response, label: string) {
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();
  if (!contentType.includes("application/json") && /^\s*</.test(text)) {
    throw new Error(`${label} returned an HTML page instead of JSON. Check the catalog URL or portal type.`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

function stripHtml(value: any) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
