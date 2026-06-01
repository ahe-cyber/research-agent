import { markdownToHtml } from "../../lib/markdown.js";

const DEFAULT_SYSTEM_INSTRUCTION =
  `You are a GIS research assistant. Help the user analyze geographic data, property records, and datasets. Be conversational in chat — talk like a colleague, not a report. Avoid bullet lists and headers in chat responses; save those for the report.

When record data is provided in <context> tags, use it to answer the question.

You can search configured GIS data catalogs when the user asks for datasets, layers, spatial data, infrastructure, environmental, zoning, land use, utilities, flood, soil, or similar sources. Use the search_datasets tool for catalog discovery. Make 2-5 targeted searches when useful, prefer Feature Service results for ArcGIS portals. After searching, analyze all results and present only the 3 most relevant datasets, each with a one-sentence explanation of why it matches the user's question.

Use update_report to add structured findings, property details, and key data to the research report. When you have data worth saving — field values, zoning info, ownership, key findings — write it to the report rather than pasting it into chat.`;

export function AgentPanel() {
  return (
    <aside className="agent-panel" aria-label="Secondary Side Bar">
      <header className="panel-header">
        <div>
          <span className="panel-kicker">Agent</span>
          <select className="panel-title agent-target-select" id="agentTargetSelect" aria-label="Agent">
          </select>
        </div>
        <button
          className="section-tool-button agent-more-button"
          type="button"
          id="agentMoreButton"
          aria-pressed="false"
          aria-label="System instruction"
          title="System instruction"
        />
      </header>

      <div className="agent-instruction-toolbar" id="agentInstructionToolbar" hidden>
        <div className="agent-instruction-header">
          <label className="field-label" htmlFor="agentSystemInstruction">System instruction</label>
          <button className="section-tool-button agent-instruction-save" id="agentInstructionSave" type="button">Save</button>
        </div>
        <textarea
          className="agent-instruction-input"
          id="agentSystemInstruction"
          defaultValue={DEFAULT_SYSTEM_INSTRUCTION}
        />
      </div>

      <div className="agent-thread" id="agentThread">
        <div className="agent-message agent-message-system">
          Ask the agent to interpret selected places, records, and datasets.
        </div>
      </div>
      <form className="agent-composer" id="agentComposer">
        <div id="agentAttachments" className="agent-attachments" />
        <textarea
          className="agent-input"
          id="agentInput"
          rows="4"
          placeholder="Ask about this place or dataset trail"
        />
        <label className="agent-blind-toggle" htmlFor="agentBlindMode">
          <input id="agentBlindMode" type="checkbox" />
          <span className="agent-blind-switch" aria-hidden="true" />
          <span>Blind</span>
        </label>
        <button className="agent-send" type="submit">
          Send
        </button>
      </form>
    </aside>
  );
}

// Records are truncated before being serialized into the context block so a
// single large GeoJSON response doesn't blow out the prompt.
const CONTEXT_MAX_CHARS = 30_000;

export function createAgentController() {
  const thread = document.getElementById("agentThread");
  const systemThreadMessage = thread.querySelector(".agent-message-system");
  const form = document.getElementById("agentComposer");
  const input = document.getElementById("agentInput");
  const sendButton = form.querySelector(".agent-send");
  const attachmentsEl = document.getElementById("agentAttachments");
  const blindModeInput = document.getElementById("agentBlindMode");
  const moreButton = document.getElementById("agentMoreButton");
  const instructionToolbar = document.getElementById("agentInstructionToolbar");
  const instructionInput = document.getElementById("agentSystemInstruction");
  const saveInstructionButton = document.getElementById("agentInstructionSave");
  const agentSelect = document.getElementById("agentTargetSelect");

  // Each entry: { record, chip }
  const attachments = [];
  // Each entry: { name, chip }
  const toolHints = [];

  // App-level conversation state, scoped per selected agent module.
  const conversations = new Map();
  let catalogContextProvider = null;
  let catalogEventHandler = null;
  let reportController = null;
  let attachmentTargetProvider = null;
  let modulesRefresher = null;
  let lastStreamReportAppends = 0;
  let selectedAgentId = "";
  let activeConversationKey = "__unassigned_agent__";

  // ── Instruction persistence ────────────────────────────────────────────────

  (async () => {
    try {
      const res = await fetch("/api/instruction");
      if (res.ok) {
        const { instruction } = await res.json();
        if (instruction) instructionInput.value = instruction;
      }
    } catch { /* ignore */ }
  })();

  saveInstructionButton.addEventListener("click", async () => {
    const instruction = instructionInput.value.trim() || DEFAULT_SYSTEM_INSTRUCTION;
    saveInstructionButton.disabled = true;
    try {
      await fetch("/api/instruction", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction })
      });
    } catch { /* ignore */ } finally {
      saveInstructionButton.disabled = false;
    }
  });

  refreshAgentTargets();
  agentSelect.addEventListener("change", () => {
    switchAgentConversation(agentSelect.value);
  });

  // ── System instruction toolbar ─────────────────────────────────────────────

  moreButton.addEventListener("click", () => {
    const open = instructionToolbar.hidden;
    instructionToolbar.hidden = !open;
    moreButton.classList.toggle("is-active", open);
    moreButton.setAttribute("aria-pressed", String(open));
  });

  blindModeInput.addEventListener("change", () => {
    if (blindModeInput.checked) {
      saveActiveThread();
      currentConversation().messageHistory.length = 0;
      thread.replaceChildren(systemThreadMessage);
    } else {
      const conversation = currentConversation();
      thread.replaceChildren(systemThreadMessage, ...conversation.nodes);
      thread.scrollTop = thread.scrollHeight;
    }
  });

  // ── Attachment management ──────────────────────────────────────────────────

  function attachRecord(record) {
    if (attachmentTargetProvider?.()?.attachRecord?.(record)) return;

    if (attachments.some((a) => a.record.id === record.id)) return;
    const chip = buildChip(record);
    attachments.push({ record, chip });
    attachmentsEl.appendChild(chip);
  }

  function detachRecord(record) {
    const index = attachments.findIndex((a) => a.record.id === record.id);
    if (index === -1) return;
    attachments[index].chip.remove();
    attachments.splice(index, 1);
  }

  function buildChip(record) {
    const isError = record.payload?.ok === false || Boolean(record.payload?.response?.error);

    const chip = document.createElement("div");
    chip.className = `agent-attachment-chip${isError ? " is-error" : ""}`;

    const label = document.createElement("span");
    label.className = "agent-attachment-label";
    label.textContent = record.title || record.kind || "Context";

    const removeBtn = document.createElement("button");
    removeBtn.className = "agent-attachment-remove";
    removeBtn.type = "button";
    removeBtn.setAttribute("aria-label", "Remove attachment");
    removeBtn.addEventListener("click", () => detachRecord(record));

    chip.append(label, removeBtn);
    return chip;
  }

  function suggestTool(name) {
    if (attachmentTargetProvider?.()?.suggestTool?.(name)) return;

    if (toolHints.some((h) => h.name === name)) return;
    const chip = document.createElement("div");
    chip.className = "agent-attachment-chip agent-attachment-chip--tool";

    const label = document.createElement("span");
    label.className = "agent-attachment-label";
    label.textContent = name;

    const removeBtn = document.createElement("button");
    removeBtn.className = "agent-attachment-remove";
    removeBtn.type = "button";
    removeBtn.setAttribute("aria-label", "Remove tool suggestion");
    removeBtn.addEventListener("click", () => {
      const i = toolHints.findIndex((h) => h.name === name);
      if (i !== -1) { toolHints[i].chip.remove(); toolHints.splice(i, 1); }
    });

    chip.append(label, removeBtn);
    toolHints.push({ name, chip });
    attachmentsEl.appendChild(chip);
  }

  // ── Submission ─────────────────────────────────────────────────────────────

  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.isComposing) return;
    event.preventDefault();
    form.requestSubmit();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const text = input.value.trim();
    if (!text && attachments.length === 0 && toolHints.length === 0) return;

    const records = attachments.map((a) => a.record);
    const hints = toolHints.map((h) => h.name);
    attachments.length = 0;
    toolHints.length = 0;
    attachmentsEl.replaceChildren();
    input.value = "";
    setComposerBusy(true);

    renderUserMessage(text, records, hints);

    const targetAgentId = selectedAgentId;
    const blindMode = blindModeInput.checked;
    const reportContent = reportController?.getContent?.() || null;
    const currentMessage = buildAppMessage({
      sender: "user",
      content: text,
      replyTo: targetAgentId || null,
      records,
      hints,
      reportContent
    });
    const storedUserMessage = buildAppMessage({
      sender: "user",
      content: text,
      replyTo: targetAgentId || null,
      records,
      hints
    });
    const conversation = currentConversation();
    const requestMessages = blindMode ? [currentMessage] : [...conversation.messageHistory, currentMessage];

    if (!blindMode) conversation.messageHistory.push(storedUserMessage);

    const bubble = createAssistantBubble();

    try {
      const systemInstruction = instructionInput.value.trim() || DEFAULT_SYSTEM_INSTRUCTION;

      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: requestMessages,
          systemInstruction
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        setBubbleError(bubble, err.error || "Request failed");
        if (!blindMode) conversation.messageHistory.pop();
        return;
      }

      lastStreamReportAppends = 0;
      const modelText = await streamIntoBubble(response.body, bubble);
      const hadReportAppends = lastStreamReportAppends > 0;

      const effectiveText = modelText || (hadReportAppends ? "Added to report." : "");

      if (effectiveText && !blindMode) {
        if (!modelText && hadReportAppends) {
          bubble.textContent = "";
          const p = document.createElement("p");
          p.className = "agent-message-text";
          p.textContent = effectiveText;
          bubble.appendChild(p);
        }
        conversation.messageHistory.push({
          sender: targetAgentId || "agent",
          content: effectiveText,
          replyTo: "user"
        });
      } else if (!effectiveText) {
        setBubbleError(bubble, "Empty response from model");
        if (!blindMode) conversation.messageHistory.pop();
      }
    } catch (error) {
      setBubbleError(bubble, error.message);
      if (!blindMode) conversation.messageHistory.pop();
    } finally {
      setComposerBusy(false);
    }
  });

  function conversationKey(agentId = selectedAgentId) {
    return agentId || "__unassigned_agent__";
  }

  function currentConversation() {
    return getConversation(conversationKey());
  }

  function getConversation(key) {
    if (!conversations.has(key)) {
      conversations.set(key, {
        messageHistory: [],
        nodes: []
      });
    }
    return conversations.get(key);
  }

  function saveActiveThread() {
    if (!activeConversationKey) return;
    getConversation(activeConversationKey).nodes = [...thread.children]
      .filter((node) => node !== systemThreadMessage);
  }

  function switchAgentConversation(agentId) {
    saveActiveThread();
    selectedAgentId = agentId || "";
    activeConversationKey = conversationKey(selectedAgentId);
    const conversation = getConversation(activeConversationKey);
    thread.replaceChildren(systemThreadMessage, ...conversation.nodes);
    thread.scrollTop = thread.scrollHeight;
  }

  function buildAppMessage({ sender, content, replyTo, records = [], hints = [], reportContent = null }) {
    return {
      sender,
      content,
      replyTo,
      context: {
        attachments: records.map(serializeRecordForMessage),
        toolHints: hints,
        report: reportContent
      }
    };
  }

  function serializeRecordForMessage(record) {
    const raw = JSON.stringify({ kind: record.kind, title: record.title, payload: record.payload }, null, 2);
    const payload = raw.length > CONTEXT_MAX_CHARS
      ? `${raw.slice(0, CONTEXT_MAX_CHARS)}\n… [truncated]`
      : raw;
    return {
      id: record.id || null,
      kind: record.kind || "Context",
      title: record.title || record.kind || "Context",
      payload
    };
  }

  // ── SSE streaming ──────────────────────────────────────────────────────────

  async function streamIntoBubble(responseBody, bubble) {
    const reader = responseBody.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = "";
    let fullText = "";
    let firstToken = true;
    let textEl = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data || data === "[DONE]") continue;

          try {
            const chunk = JSON.parse(data);
            if (chunk.type === "search_start" || chunk.type === "search_error" || chunk.type === "result") {
              catalogEventHandler?.(chunk, bubble, thread);
              continue;
            }

            if (chunk.type === "report_append") {
              reportController?.append(chunk.heading, chunk.content);
              lastStreamReportAppends++;
              continue;
            }

            if (chunk.type === "agents_updated") {
              refreshAgentTargets();
              modulesRefresher?.();
              continue;
            }

            if (chunk.type === "text") {
              fullText += chunk.delta || "";
              renderAssistantText();
              thread.scrollTop = thread.scrollHeight;
              continue;
            }

            if (chunk.type === "error") {
              setBubbleError(bubble, chunk.message || "Request failed");
              continue;
            }

            const delta = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
            if (delta) {
              fullText += delta;
              renderAssistantText();
              thread.scrollTop = thread.scrollHeight;
            }
          } catch { /* skip malformed chunk */ }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullText;

    function renderAssistantText() {
      if (firstToken && bubble.textContent === "Thinking…") {
        bubble.textContent = "";
      }
      firstToken = false;
      if (!textEl) {
        textEl = document.createElement("div");
        textEl.className = "agent-message-text";
        bubble.appendChild(textEl);
      }
      textEl.innerHTML = markdownToHtml(fullText);
    }
  }

  // ── Thread helpers ─────────────────────────────────────────────────────────

  function renderUserMessage(text, records, hints = []) {
    const message = document.createElement("div");
    message.className = "agent-message agent-message-user";

    if (records.length > 0 || hints.length > 0) {
      const attachRow = document.createElement("div");
      attachRow.className = "agent-message-attachments";
      records.forEach((record) => {
        const badge = document.createElement("span");
        badge.className = "agent-message-attachment";
        badge.textContent = record.title || record.kind;
        attachRow.appendChild(badge);
      });
      hints.forEach((name) => {
        const badge = document.createElement("span");
        badge.className = "agent-message-attachment agent-message-attachment--tool";
        badge.textContent = name;
        attachRow.appendChild(badge);
      });
      message.appendChild(attachRow);
    }

    if (text) {
      const textEl = document.createElement("p");
      textEl.className = "agent-message-text";
      textEl.textContent = text;
      message.appendChild(textEl);
    }

    thread.appendChild(message);
    thread.scrollTop = thread.scrollHeight;
  }

  function createAssistantBubble() {
    const bubble = document.createElement("div");
    bubble.className = "agent-message agent-message-assistant";
    bubble.textContent = "Thinking…";
    thread.appendChild(bubble);
    thread.scrollTop = thread.scrollHeight;
    return bubble;
  }

  function setBubbleError(bubble, message) {
    bubble.className = "agent-message agent-message-error";
    bubble.textContent = `Error: ${message}`;
    thread.scrollTop = thread.scrollHeight;
  }

  function setComposerBusy(busy) {
    input.disabled = busy;
    sendButton.disabled = busy;
  }

  function addMessage(text, type) {
    const message = document.createElement("div");
    message.className = `agent-message agent-message-${type}`;
    const p = document.createElement("p");
    p.className = "agent-message-text";
    p.textContent = text;
    message.appendChild(p);
    thread.appendChild(message);
    thread.scrollTop = thread.scrollHeight;
  }

  function setCatalogContextProvider(provider) {
    catalogContextProvider = provider;
  }

  function setCatalogEventHandler(handler) {
    catalogEventHandler = handler;
  }

  function setReportController(controller) {
    reportController = controller;
  }

  function setAttachmentTargetProvider(provider) {
    attachmentTargetProvider = typeof provider === "function" ? provider : null;
  }

  function setModulesRefresher(fn) {
    modulesRefresher = typeof fn === "function" ? fn : null;
  }

  async function refreshAgentTargets() {
    const current = selectedAgentId || agentSelect.value;
    try {
      const res = await fetch("/api/agents");
      if (!res.ok) return;
      const registry = await res.json();
      const agents = Array.isArray(registry.agents) ? registry.agents : [];
      agentSelect.replaceChildren();
      agents.forEach((agent) => {
        agentSelect.appendChild(new Option(agent.name || "Agent module", agent.id));
      });
      const nextAgentId = agents.some((agent) => agent.id === current) ? current : (agents[0]?.id || "");
      agentSelect.value = nextAgentId;
      switchAgentConversation(nextAgentId);
    } catch { /* keep current menu */ }
  }

  function focusComposer(placeholder = "Ask about this place or dataset trail") {
    document.querySelector(".agent-panel .panel-kicker").textContent = "Agent";
    input.placeholder = placeholder;
    sendButton.textContent = "Send";
    input.focus();
  }

  return {
    addMessage,
    attachRecord,
    suggestTool,
    setCatalogContextProvider,
    setCatalogEventHandler,
    focusComposer,
    setReportController,
    setAttachmentTargetProvider,
    setModulesRefresher,
    refreshAgentTargets
  };
}
