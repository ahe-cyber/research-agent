import { markdownToHtml } from "../utils/markdown.js";

const DEFAULT_SYSTEM_INSTRUCTION =
  "You are a GIS research assistant. Help the user analyze geographic data, property records, and datasets. Be concise and factual. When record data is provided in <context> tags, use it to answer the question.";

export function AgentPanel() {
  return (
    <aside className="agent-panel" aria-label="Secondary Side Bar">
      <header className="panel-header">
        <div>
          <span className="panel-kicker">Agent</span>
          <strong className="panel-title">Gemini</strong>
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
        <label className="field-label" htmlFor="agentSystemInstruction">System instruction</label>
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
  const form = document.getElementById("agentComposer");
  const input = document.getElementById("agentInput");
  const sendButton = form.querySelector(".agent-send");
  const attachmentsEl = document.getElementById("agentAttachments");
  const moreButton = document.getElementById("agentMoreButton");
  const instructionToolbar = document.getElementById("agentInstructionToolbar");
  const instructionInput = document.getElementById("agentSystemInstruction");

  // Each entry: { record, chip }
  const attachments = [];

  // Gemini multi-turn history: { role: "user" | "model", parts: [{ text }] }[]
  const geminiHistory = [];

  // ── System instruction toolbar ─────────────────────────────────────────────

  moreButton.addEventListener("click", () => {
    const open = instructionToolbar.hidden;
    instructionToolbar.hidden = !open;
    moreButton.classList.toggle("is-active", open);
    moreButton.setAttribute("aria-pressed", String(open));
  });

  // ── Attachment management ──────────────────────────────────────────────────

  function attachRecord(record) {
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

  // ── Submission ─────────────────────────────────────────────────────────────

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const text = input.value.trim();
    if (!text && attachments.length === 0) return;

    const records = attachments.map((a) => a.record);
    attachments.length = 0;
    attachmentsEl.replaceChildren();
    input.value = "";
    setComposerBusy(true);

    renderUserMessage(text, records);

    // Build context-enriched API text
    let apiText = text;
    if (records.length > 0) {
      const contextParts = records.map((r) => {
        const raw = JSON.stringify({ kind: r.kind, title: r.title, payload: r.payload }, null, 2);
        const safe = raw.length > CONTEXT_MAX_CHARS
          ? `${raw.slice(0, CONTEXT_MAX_CHARS)}\n… [truncated]`
          : raw;
        return `Record "${r.title}":\n${safe}`;
      });
      const contextBlock = `<context>\n${contextParts.join("\n\n---\n\n")}\n</context>`;
      apiText = text ? `${contextBlock}\n\n${text}` : contextBlock;
    }

    geminiHistory.push({ role: "user", parts: [{ text: apiText }] });

    const bubble = createAssistantBubble();

    try {
      const systemInstruction = instructionInput.value.trim() || DEFAULT_SYSTEM_INSTRUCTION;

      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [...geminiHistory], systemInstruction })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        setBubbleError(bubble, err.error || "Request failed");
        geminiHistory.pop();
        return;
      }

      const modelText = await streamIntoBubble(response.body, bubble);

      if (modelText) {
        geminiHistory.push({ role: "model", parts: [{ text: modelText }] });
      } else {
        setBubbleError(bubble, "Empty response from model");
        geminiHistory.pop();
      }
    } catch (error) {
      setBubbleError(bubble, error.message);
      geminiHistory.pop();
    } finally {
      setComposerBusy(false);
    }
  });

  // ── SSE streaming ──────────────────────────────────────────────────────────

  async function streamIntoBubble(responseBody, bubble) {
    const reader = responseBody.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = "";
    let fullText = "";
    let firstToken = true;

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
            const delta = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
            if (delta) {
              if (firstToken) {
                bubble.innerHTML = "";
                firstToken = false;
              }
              fullText += delta;
              bubble.innerHTML = markdownToHtml(fullText);
              thread.scrollTop = thread.scrollHeight;
            }
          } catch { /* skip malformed chunk */ }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullText;
  }

  // ── Thread helpers ─────────────────────────────────────────────────────────

  function renderUserMessage(text, records) {
    const message = document.createElement("div");
    message.className = "agent-message agent-message-user";

    if (records.length > 0) {
      const attachRow = document.createElement("div");
      attachRow.className = "agent-message-attachments";
      records.forEach((record) => {
        const badge = document.createElement("span");
        badge.className = "agent-message-attachment";
        badge.textContent = record.title || record.kind;
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

  return { addMessage, attachRecord };
}
