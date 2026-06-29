import { createRoot } from "react-dom/client";
import { useEffect, useRef } from "react";
import { withBasePath } from "../../lib/basePath";
import { DomSlot } from "../editor/DomSlot";
import { PageMenu } from "../editor/PageMenu";
import { createSearchWidget } from "../search/SearchWidget";
import { SourceDropdownSlot } from "../workspace/SourceDropdownSlot";
import { AGENT_PROVIDER_OPTIONS } from "./providers";

const CARD_WIDTH = 220;
const SVG_NS = "http://www.w3.org/2000/svg";
const ATTACHMENT_CONTEXT_MAX_CHARS = 30_000;
const AGENT_API_KEY_STORAGE_KEY = "research-agent.agentApiKey";
const GEMINI_API_KEY_STORAGE_KEY = "research-agent.geminiApiKey";
const AGENT_PROVIDER_STORAGE_KEY = "research-agent.agentProvider";
const AGENT_MODEL_STORAGE_KEY = "research-agent.agentModel";
const AGENT_PROVIDER_CONFIG_STORAGE_KEY = "research-agent.agentProviderConfig";
let activeModuleAttachmentTarget = null;

export function AgentTab({ active }) {
  const modelSearchRef = useRef(null);
  const providerConfigs = typeof window !== "undefined" ? loadProviderConfigs() : {};
  const initialProviderId = typeof window !== "undefined"
    ? localStorage.getItem(AGENT_PROVIDER_STORAGE_KEY) || "gemini"
    : "gemini";
  const initialModel = typeof window !== "undefined"
    ? localStorage.getItem(AGENT_MODEL_STORAGE_KEY) || ""
    : "";

  useEffect(() => {
    if (!modelSearchRef.current) return;
    const widget = createSearchWidget({
      placeholder: "Search custom models",
      inputName: "agent-model-query",
      onQuery(query) {
        const model = query.trim();
        localStorage.setItem(AGENT_MODEL_STORAGE_KEY, model);
        window.dispatchEvent(new CustomEvent("research-agent:agent-model-changed", {
          detail: { model }
        }));
      },
      onSubmit(query) {
        const model = query.trim();
        localStorage.setItem(AGENT_MODEL_STORAGE_KEY, model);
        window.dispatchEvent(new CustomEvent("research-agent:agent-model-changed", {
          detail: { model }
        }));
      }
    });
    widget.setQuery(initialModel);
    modelSearchRef.current.replaceChildren(widget.shellElement);
  }, [initialModel]);

  return (
    <section
      className={`workspace-tab${active ? " is-active" : ""}`}
      id="agentTab"
      data-tab-panel
      hidden={!active}
    >
      <div className="section-title-row">
        <h2 className="section-title">Agent</h2>
        <SourceDropdownSlot
          className="agent-provider-dropdown"
          options={AGENT_PROVIDER_OPTIONS.map((provider) => ({
            id: provider.id,
            label: provider.label,
            costly: Boolean(providerConfigs[provider.id]?.costly || providerConfigs[provider.id]?.apiKey)
          }))}
          selectedId={initialProviderId}
          onChange={(provider) => {
            const providerId = provider?.id || "gemini";
            localStorage.setItem(AGENT_PROVIDER_STORAGE_KEY, providerId);
            window.dispatchEvent(new CustomEvent("research-agent:agent-provider-changed", {
              detail: { providerId }
            }));
          }}
          onEdit={() => window.dispatchEvent(new CustomEvent("research-agent:edit-agent-providers"))}
          editLabel="Edit agent sources"
        />
      </div>
      <div className="agent-model-search-widget" id="agentSidebarModelSearch" ref={modelSearchRef} />
      <div id="agentCompact" />
    </section>
  );
}

export function createAgentTabController(editorTabController, agentController = null) {
  const compactList = document.getElementById("agentCompact");
  const editButton = document.getElementById("editAgentButton");
  const attachmentTargetOwner = Symbol("agent-module-controller");

  // ── Build editor panel ────────────────────────────────────────────────────

  const editorPanel = document.createElement("div");
  editorPanel.className = "agent-editor-panel";

  const addBtn = document.createElement("button");
  addBtn.className = "section-tool-button add-source-button";
  addBtn.type = "button";
  addBtn.setAttribute("aria-label", "Add agent");
  addBtn.title = "Add agent";

  const exportBtn = document.createElement("button");
  exportBtn.className = "section-tool-button";
  exportBtn.type = "button";
  exportBtn.textContent = "Export";

  const pageMenu = document.createElement("div");
  createRoot(pageMenu).render(<PageMenu left={<DomSlot nodes={[addBtn, exportBtn]} />} />);

  const wrapper = document.createElement("div");
  wrapper.className = "agent-canvas-wrapper";

  const canvas = document.createElement("div");
  canvas.className = "agent-canvas";
  canvas.style.transformOrigin = "0 0";

  // ── SVG connections layer ─────────────────────────────────────────────────

  const svgEl = document.createElementNS(SVG_NS, "svg");
  svgEl.classList.add("agent-connections-svg");
  svgEl.style.pointerEvents = "none";


  canvas.appendChild(svgEl);

  // ── Selection box overlay (lives in screen space on wrapper) ──────────────
  const selectionBox = document.createElement("div");
  selectionBox.className = "agent-selection-box";

  // ── Fit-to-viewport button ────────────────────────────────────────────────
  const fitBtn = document.createElement("button");
  fitBtn.className = "agent-fit-btn";
  fitBtn.type = "button";
  fitBtn.textContent = "Z";
  fitBtn.title = "Fit all to viewport";

  wrapper.appendChild(canvas);
  wrapper.appendChild(selectionBox);
  wrapper.appendChild(fitBtn);
  editorPanel.append(pageMenu, wrapper);

  // ── State ─────────────────────────────────────────────────────────────────

  let data = { agents: [] };
  const cardElements = {};
  let selectedAgentId = null;
  let selectedAgentIds = new Set();

  let dragAgentId = null;
  let dragMouseStart = { x: 0, y: 0 };
  let dragCardStart = { x: 0, y: 0 };
  let dragHasMoved = false;
  let pendingSelectId = null;
  let dragSelectedAgentsStart = {};

  let isPanning = false;
  let panStart = { x: 0, y: 0, tx: 0, ty: 0 };

  let isBoxSelecting = false;
  let boxSelectStartScreen = { x: 0, y: 0 };

  let viewTransform = { x: 0, y: 0, scale: 1 };

  let isConnecting = false;
  let connectingFromId = null;
  let connectingFromSide = null;
  let tempPath = null;
  let isDraggingEndpoint = false;
  let endpointDrag = null; // { pair, movingAgentId, anchorAgentId, anchorPt, anchorSide }
  let endpointTempPath = null;
  let liveSaveTimer = null;
  let liveSaveInFlight = false;
  let liveSaveQueued = false;
  let activeLabelEditorDone = null;
  const agentDeleteTimers = {};
  const agentDeleteCountdownTimers = {};

  // ── Load ──────────────────────────────────────────────────────────────────

  loadAgents();
  addBtn.addEventListener("click", addAgent);
  exportBtn.addEventListener("click", exportAgents);
  fitBtn.addEventListener("click", fitToViewport);
  editButton.addEventListener("click", () => {
    editorTabController.openAgentTab(editorPanel);
    // Re-render after the panel is visible so offsetLeft/offsetTop are correct
    requestAnimationFrame(renderConnections);
  });
  window.addEventListener("research-agent:edit-agent-providers", () => {
    editorTabController.openAgentProviderTab(createAgentProviderEditorPanel());
  });

  document.addEventListener("mousemove", onDocMouseMove);
  document.addEventListener("mouseup", onDocMouseUp);

  // Zoom to mouse position on wheel (skip when hovering a textarea)
  wrapper.addEventListener("wheel", (e) => {
    if (e.target.tagName === "TEXTAREA") return;
    e.preventDefault();
    const rect = wrapper.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newScale = Math.max(0.08, Math.min(4, viewTransform.scale * factor));
    viewTransform.x = mx - (mx - viewTransform.x) * (newScale / viewTransform.scale);
    viewTransform.y = my - (my - viewTransform.y) * (newScale / viewTransform.scale);
    viewTransform.scale = newScale;
    applyTransform();
  }, { passive: false });

  wrapper.addEventListener("mousedown", (e) => {
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY, tx: viewTransform.x, ty: viewTransform.y };
      wrapper.style.cursor = "grabbing";
    } else if (e.button === 0 && e.target !== fitBtn) {
      if (activeLabelEditorDone) activeLabelEditorDone(true);
      e.preventDefault();
      deselectAgent();
      const rect = wrapper.getBoundingClientRect();
      boxSelectStartScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      isBoxSelecting = true;
      selectionBox.style.cssText = `display:block; left:${boxSelectStartScreen.x}px; top:${boxSelectStartScreen.y}px; width:0; height:0;`;
    }
  });

  wrapper.addEventListener("contextmenu", (e) => e.preventDefault());
  wrapper.addEventListener("auxclick", (e) => { if (e.button === 1) e.preventDefault(); });
  wrapper.addEventListener("mouseleave", () => {
    Object.values(cardElements).forEach((el) => el.classList.remove("ports-visible"));
  });

  // ── Data I/O ──────────────────────────────────────────────────────────────

  async function loadAgents() {
    let needsSave = false;
    try {
      const res = await fetch(withBasePath("/api/agent"));
      if (res.ok) {
        const loaded = await res.json();
        const loadedAgents = Array.isArray(loaded) ? loaded : (loaded.agents || []);
        const legacyConnections = Array.isArray(loaded?.connections) ? loaded.connections : [];
        // Migrate old top-level connections array to agentPeers
        if (legacyConnections.length > 0) {
          for (const conn of legacyConnections) {
            const fromAgent = loadedAgents.find((a) => a.id === conn.from);
            const toAgent = loadedAgents.find((a) => a.id === conn.to);
            if (!fromAgent || !toAgent) continue;
            if (!Array.isArray(fromAgent.agentPeers)) fromAgent.agentPeers = [];
            if (!Array.isArray(toAgent.agentPeers)) toAgent.agentPeers = [];
            if (!fromAgent.agentPeers.find((p) => p.id === conn.to)) {
              fromAgent.agentPeers.push({ id: conn.to, "communication-instruction": conn.labelLR || "", side: "right" });
            }
            if (!toAgent.agentPeers.find((p) => p.id === conn.from)) {
              toAgent.agentPeers.push({ id: conn.from, "communication-instruction": conn.labelRL || "", side: "left" });
            }
          }
          needsSave = true;
        }
        data = { agents: loadedAgents };
      }
    } catch {
      data = { agents: [] };
    }
    render();
    if (needsSave) queueAgentSync();
  }

  function queueAgentSync() {
    liveSaveQueued = true;
    clearTimeout(liveSaveTimer);
    liveSaveTimer = setTimeout(syncAgentsNow, 350);
  }

  async function syncAgentsNow() {
    if (liveSaveInFlight) return;
    if (!liveSaveQueued) return;

    liveSaveQueued = false;
    liveSaveInFlight = true;
    try {
      const res = await fetch(withBasePath("/api/agent"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.agents)
      });
      if (!res.ok) throw new Error("Sync failed");
      agentController?.refreshAgentTargets?.();
    } catch (error) {
      console.error("[Agents] Live sync failed", error);
      liveSaveQueued = true;
    } finally {
      liveSaveInFlight = false;
      if (liveSaveQueued) {
        clearTimeout(liveSaveTimer);
        liveSaveTimer = setTimeout(syncAgentsNow, 1000);
      }
    }
  }

  function exportAgents() {
    const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `agent-modules-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  // ── Agent CRUD ────────────────────────────────────────────────────────────

  function addAgent() {
    const id = `agent-${Date.now().toString(36)}`;
    const cx = (wrapper.clientWidth / 2 - viewTransform.x) / viewTransform.scale;
    const cy = (wrapper.clientHeight / 2 - viewTransform.y) / viewTransform.scale;
    const x = cx - CARD_WIDTH / 2 + (data.agents.length % 6) * 30;
    const y = cy - 60 + (data.agents.length % 6) * 30;
    data.agents.push({ id, name: "New Agent", description: "Agent description", x, y });
    queueAgentSync();
    render();
    selectAgent(id);
  }

  function deleteAgent(agentId) {
    const agent = data.agents.find((candidate) => candidate.id === agentId);
    if (!agent) return;
    agent.isDeleted = true;
    agent.deletePendingUntil = Date.now() + 10_000;
    if (selectedAgentId === agentId) selectedAgentId = null;
    selectedAgentIds.delete(agentId);
    clearTimeout(agentDeleteTimers[agentId]);
    agentDeleteTimers[agentId] = setTimeout(() => permanentlyDeleteAgent(agentId), 10_000);
    render();
  }

  function revertAgentDelete(agentId) {
    const agent = data.agents.find((candidate) => candidate.id === agentId);
    if (!agent) return;
    delete agent.isDeleted;
    delete agent.deletePendingUntil;
    clearTimeout(agentDeleteTimers[agentId]);
    clearInterval(agentDeleteCountdownTimers[agentId]);
    delete agentDeleteTimers[agentId];
    delete agentDeleteCountdownTimers[agentId];
    render();
  }

  function permanentlyDeleteAgent(agentId) {
    clearTimeout(agentDeleteTimers[agentId]);
    clearInterval(agentDeleteCountdownTimers[agentId]);
    delete agentDeleteTimers[agentId];
    delete agentDeleteCountdownTimers[agentId];
    data.agents = data.agents.filter((a) => a.id !== agentId);
    for (const agent of data.agents) {
      agent.agentPeers = (agent.agentPeers || []).filter((p) => p.id !== agentId);
    }
    queueAgentSync();
    render();
  }

  // connId is canonical key "idA~~idB" (sorted)
  function deleteConnection(connId) {
    const [id1, id2] = connId.split("~~");
    const a1 = data.agents.find((a) => a.id === id1);
    const a2 = data.agents.find((a) => a.id === id2);
    if (a1) a1.agentPeers = (a1.agentPeers || []).filter((p) => p.id !== id2);
    if (a2) a2.agentPeers = (a2.agentPeers || []).filter((p) => p.id !== id1);
    queueAgentSync();
    renderConnections();
  }

  function connectionExists(from, to) {
    const fromAgent = data.agents.find((a) => a.id === from);
    const toAgent = data.agents.find((a) => a.id === to);
    return !!(fromAgent?.agentPeers?.some((p) => p.id === to) ||
              toAgent?.agentPeers?.some((p) => p.id === from));
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  function selectAgent(id) {
    selectedAgentId = id;
    selectedAgentIds = new Set(id ? [id] : []);
    editorPanel.dataset.selectedAgentId = id || "";
    setActiveModuleAttachmentTarget(id);
    updateSelectionVisuals();
    if (id) {
      requestAnimationFrame(() => {
        cardElements[id]?.querySelectorAll("textarea").forEach((ta) => ta._autoResize?.());
      });
    }
  }

  function deselectAgent() {
    selectedAgentId = null;
    selectedAgentIds = new Set();
    delete editorPanel.dataset.selectedAgentId;
    if (activeModuleAttachmentTarget?.owner === attachmentTargetOwner) {
      activeModuleAttachmentTarget = null;
    }
    updateSelectionVisuals();
  }

  function updateSelectionVisuals() {
    Object.entries(cardElements).forEach(([aid, el]) => {
      el.classList.toggle("is-selected", aid === selectedAgentId);
      el.classList.toggle("in-selection", selectedAgentIds.has(aid) && aid !== selectedAgentId);
    });
    requestAnimationFrame(renderConnections);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function render() {
    Object.values(agentDeleteCountdownTimers).forEach((timer) => clearInterval(timer));
    Object.keys(agentDeleteCountdownTimers).forEach((key) => delete agentDeleteCountdownTimers[key]);
    Object.values(cardElements).forEach((el) => el.remove());
    Object.keys(cardElements).forEach((k) => delete cardElements[k]);

    data.agents.forEach((agent) => {
      const card = agent.isDeleted ? createDeletedAgentCard(agent) : createAgentCard(agent);
      canvas.appendChild(card);
      cardElements[agent.id] = card;
    });

    renderConnections();
    renderCompact();
  }

  function createAgentCard(agent) {
    const card = document.createElement("div");
    card.className = "agent-module-card";
    card.style.left = `${agent.x}px`;
    card.style.top = `${agent.y}px`;
    card.dataset.agentId = agent.id;

    // Connection ports — shown on proximity, hidden by default
    const SIDES = ["left", "right", "top", "bottom"];
    const ports = SIDES.map((side) => {
      const port = document.createElement("div");
      port.className = `agent-module-port agent-module-port-${side}`;
      port.dataset.side = side;
      port.title = "Drag to connect";
      port.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        e.preventDefault();
        startConnecting(agent.id, side);
      });
      return port;
    });

    // Header
    const header = document.createElement("div");
    header.className = "agent-module-card-header";

    const nameDisplay = document.createElement("strong");
    nameDisplay.className = "agent-module-name-display";
    nameDisplay.textContent = agent.name;

    const nameInput = document.createElement("input");
    nameInput.className = "agent-module-name-input";
    nameInput.type = "text";
    nameInput.value = agent.name;
    nameInput.placeholder = "Agent name";

    header.append(nameDisplay, nameInput);

    // Body — "Module Instruction" field
    const body = document.createElement("div");
    body.className = "agent-module-card-body";

    const instrLabel = document.createElement("span");
    instrLabel.className = "agent-module-instr-label";
    instrLabel.textContent = "Module Instruction";

    const descDisplay = document.createElement("p");
    descDisplay.className = "agent-module-desc-display";
    descDisplay.textContent = agent.description;

    const compactAttachments = document.createElement("div");
    compactAttachments.className = "agent-module-attachments agent-module-attachments--compact";
    renderModuleAttachments(compactAttachments, agent, false);

    const descInput = document.createElement("textarea");
    descInput.className = "agent-module-desc-input";
    descInput.value = agent.description;
    descInput.placeholder = "Module instruction…";
    descInput.rows = 1;

    function autoResizeDescInput() {
      descInput.style.height = "auto";
      descInput.style.height = `${descInput.scrollHeight}px`;
    }
    descInput._autoResize = autoResizeDescInput;

    body.append(instrLabel, descDisplay, compactAttachments, descInput);

    // Actions row
    const actions = document.createElement("div");
    actions.className = "agent-module-card-actions";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "circle-icon-button delete-source-button agent-module-delete-btn";
    deleteBtn.type = "button";
    deleteBtn.title = "Delete agent";
    deleteBtn.setAttribute("aria-label", "Delete agent");

    const expandedAttachments = document.createElement("div");
    expandedAttachments.className = "agent-module-attachments agent-module-attachments--expanded";
    renderModuleAttachments(expandedAttachments, agent, true);

    actions.append(deleteBtn, expandedAttachments);

    card.append(...ports, header, body, actions);

    // ── Card events ────────────────────────────────────────────────────────

    card.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      if (e.target.classList?.contains("agent-module-port")) return;
      if (
        e.target !== nameInput
        && e.target !== descInput
        && e.target !== deleteBtn
        && !e.target.closest(".agent-module-attachments")
      ) {
        pendingSelectId = agent.id;
        startDrag(agent, e);
      }
    });

    nameInput.addEventListener("input", (e) => {
      e.stopPropagation();
      agent.name = nameInput.value;
      nameDisplay.textContent = nameInput.value || "New Agent";
      renderCompact();
      queueAgentSync();
    });

    nameInput.addEventListener("keydown", (e) => e.stopPropagation());
    nameInput.addEventListener("click", (e) => {
      e.stopPropagation();
      selectAgent(agent.id);
    });
    nameInput.addEventListener("focus", () => selectAgent(agent.id));

    descInput.addEventListener("input", (e) => {
      e.stopPropagation();
      agent.description = descInput.value;
      descDisplay.textContent = descInput.value;
      autoResizeDescInput();
      renderCompact();
      queueAgentSync();
    });

    descInput.addEventListener("keydown", (e) => e.stopPropagation());
    descInput.addEventListener("click", (e) => {
      e.stopPropagation();
      selectAgent(agent.id);
    });
    descInput.addEventListener("focus", () => selectAgent(agent.id));

    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteAgent(agent.id);
    });

    return card;
  }

  function createDeletedAgentCard(agent) {
    const card = document.createElement("div");
    card.className = "agent-module-card agent-module-card--deleted";
    card.style.left = `${agent.x}px`;
    card.style.top = `${agent.y}px`;
    card.dataset.agentId = agent.id;

    const title = document.createElement("strong");
    title.textContent = `Deleted: ${agent.name || "Agent"}`;

    const meta = document.createElement("span");
    meta.className = "agent-module-delete-countdown";
    updateAgentDeleteCountdown(agent, meta);
    agentDeleteCountdownTimers[agent.id] = setInterval(() => {
      updateAgentDeleteCountdown(agent, meta);
    }, 250);

    const revertButton = document.createElement("button");
    revertButton.className = "circle-icon-button revert-source-button agent-module-revert-btn";
    revertButton.type = "button";
    revertButton.setAttribute("aria-label", `Restore ${agent.name || "agent"}`);
    revertButton.title = `Restore ${agent.name || "agent"}`;
    revertButton.addEventListener("click", (event) => {
      event.stopPropagation();
      revertAgentDelete(agent.id);
    });

    card.append(title, meta, revertButton);
    return card;
  }

  function updateAgentDeleteCountdown(agent, element) {
    const remainingMs = Math.max(0, Number(agent.deletePendingUntil || 0) - Date.now());
    element.textContent = `${Math.ceil(remainingMs / 1000)}s until removal`;
  }

  // ── Module attachments ───────────────────────────────────────────────────

  function attachRecordToSelectedAgent(record) {
    const targetAgentId = getSelectedAgentId();
    if (!targetAgentId) return false;

    return attachRecordToAgent(targetAgentId, record);
  }

  function suggestToolToSelectedAgent(name) {
    const targetAgentId = getSelectedAgentId();
    if (!targetAgentId) return false;

    return suggestToolToAgent(targetAgentId, name);
  }

  function attachRecordToAgent(agentId, record) {
    const agent = data.agents.find((item) => item.id === agentId);
    if (!agent) return false;
    if (record.payload?.agent?.id === agentId) return true;

    const attachments = getAgentAttachments(agent);
    if (attachments.some((attachment) => attachment.id === record.id)) return true;

    attachments.push(record);
    agent.attachments = attachments;
    queueAgentSync();
    render();
    selectAgent(agent.id);
    return true;
  }

  function suggestToolToAgent(agentId, name) {
    const agent = data.agents.find((item) => item.id === agentId);
    if (!agent) return false;

    const toolHints = getAgentToolHints(agent);
    if (toolHints.includes(name)) return true;

    toolHints.push(name);
    agent.toolHints = toolHints;
    queueAgentSync();
    render();
    selectAgent(agent.id);
    return true;
  }

  function getAttachmentTarget() {
    return activeModuleAttachmentTarget;
  }

  function setActiveModuleAttachmentTarget(agentId) {
    activeModuleAttachmentTarget = agentId
      ? {
          type: "agent-module",
          owner: attachmentTargetOwner,
          agentId,
          attachRecord: (record) => attachRecordToAgent(agentId, record),
          suggestTool: (name) => suggestToolToAgent(agentId, name)
        }
      : null;
  }

  function getSelectedAgentId() {
    if (selectedAgentId) return selectedAgentId;

    const selectedCard = editorPanel.querySelector(".agent-module-card.is-selected");
    const selectedCardId = selectedCard?.dataset?.agentId;
    if (selectedCardId) {
      selectedAgentId = selectedCardId;
      editorPanel.dataset.selectedAgentId = selectedCardId;
      setActiveModuleAttachmentTarget(selectedCardId);
      return selectedCardId;
    }

    const panelSelectedId = editorPanel.dataset.selectedAgentId;
    if (panelSelectedId && data.agents.some((agent) => agent.id === panelSelectedId)) {
      selectedAgentId = panelSelectedId;
      setActiveModuleAttachmentTarget(panelSelectedId);
      return panelSelectedId;
    }

    return null;
  }

  function detachRecordFromAgent(agent, record) {
    agent.attachments = getAgentAttachments(agent).filter((attachment) => attachment.id !== record.id);
    queueAgentSync();
    render();
    selectAgent(agent.id);
  }

  function removeToolFromAgent(agent, name) {
    agent.toolHints = getAgentToolHints(agent).filter((toolName) => toolName !== name);
    queueAgentSync();
    render();
    selectAgent(agent.id);
  }

  function getAgentAttachments(agent) {
    if (!Array.isArray(agent.attachments)) {
      agent.attachments = [];
    }
    return agent.attachments;
  }

  function getAgentToolHints(agent) {
    if (!Array.isArray(agent.toolHints)) {
      agent.toolHints = [];
    }
    return agent.toolHints;
  }

  function renderModuleAttachments(container, agent, detachable) {
    const attachments = getAgentAttachments(agent);
    const toolHints = getAgentToolHints(agent);
    container.replaceChildren();
    container.hidden = attachments.length === 0 && toolHints.length === 0;
    attachments.forEach((record) => {
      container.appendChild(buildAttachmentChip(agent, record, detachable));
    });
    toolHints.forEach((name) => {
      container.appendChild(buildToolChip(agent, name, detachable));
    });
  }

  function buildAttachmentChip(agent, record, detachable) {
    const isError = record.payload?.ok === false || Boolean(record.payload?.response?.error);
    const chip = document.createElement("div");
    chip.className = `agent-attachment-chip agent-module-attachment-chip${isError ? " is-error" : ""}`;
    chip.title = buildAttachmentTitle(record);

    const label = document.createElement("span");
    label.className = "agent-attachment-label";
    label.textContent = record.title || record.kind || "Context";
    chip.appendChild(label);

    if (detachable) {
      const removeBtn = document.createElement("button");
      removeBtn.className = "agent-attachment-remove";
      removeBtn.type = "button";
      removeBtn.setAttribute("aria-label", "Remove attachment");
      removeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        detachRecordFromAgent(agent, record);
      });
      chip.appendChild(removeBtn);
    }

    return chip;
  }

  function buildToolChip(agent, name, detachable) {
    const chip = document.createElement("div");
    chip.className = "agent-attachment-chip agent-attachment-chip--tool agent-module-attachment-chip";

    const label = document.createElement("span");
    label.className = "agent-attachment-label";
    label.textContent = name;
    chip.appendChild(label);

    if (detachable) {
      const removeBtn = document.createElement("button");
      removeBtn.className = "agent-attachment-remove";
      removeBtn.type = "button";
      removeBtn.setAttribute("aria-label", "Remove tool suggestion");
      removeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        removeToolFromAgent(agent, name);
      });
      chip.appendChild(removeBtn);
    }

    return chip;
  }

  function buildAttachmentTitle(record) {
    const raw = JSON.stringify({ kind: record.kind, title: record.title, payload: record.payload }, null, 2);
    const safe = raw.length > ATTACHMENT_CONTEXT_MAX_CHARS
      ? `${raw.slice(0, ATTACHMENT_CONTEXT_MAX_CHARS)}\n... [truncated]`
      : raw;
    return `Record "${record.title || record.kind || "Context"}":\n${safe}`;
  }

  function createAgentAttachment(agent) {
    return {
      id: `agent-module-attachment-${agent.id}`,
      kind: "Agent Module",
      title: agent.name || "Agent module",
      payload: {
        agent: {
          id: agent.id,
          name: agent.name || "Agent module",
          instruction: agent.description || "",
          toolHints: getAgentToolHints(agent),
          encouragedAgents: getAgentAttachments(agent)
            .filter((attachment) => attachment.kind === "Agent Module")
            .map((attachment) => ({
              id: attachment.payload?.agent?.id,
              name: attachment.title || attachment.payload?.agent?.name || "Agent module"
            }))
        }
      }
    };
  }

  // ── Drag ──────────────────────────────────────────────────────────────────

  function startDrag(agent, e) {
    dragAgentId = agent.id;
    dragMouseStart = canvasPos(e);
    dragCardStart = { x: agent.x, y: agent.y };
    dragHasMoved = false;
    dragSelectedAgentsStart = {};

    // Prepare group drag if this card is in a multi-selection
    if (selectedAgentIds.has(agent.id) && selectedAgentIds.size > 1) {
      for (const id of selectedAgentIds) {
        const a = data.agents.find((ag) => ag.id === id);
        if (a) dragSelectedAgentsStart[id] = { x: a.x, y: a.y };
      }
    }
  }

  // ── Connecting ────────────────────────────────────────────────────────────

  function startConnecting(agentId, fromSide) {
    isConnecting = true;
    connectingFromId = agentId;
    connectingFromSide = fromSide || "right";
    canvas.classList.add("is-connecting");
    tempPath = document.createElementNS(SVG_NS, "path");
    tempPath.setAttribute("stroke", "#2f6fed");
    tempPath.setAttribute("stroke-width", "2");
    tempPath.setAttribute("stroke-dasharray", "6 3");
    tempPath.setAttribute("fill", "none");
    tempPath.style.pointerEvents = "none";
    svgEl.appendChild(tempPath);
  }

  function startEndpointDrag(pair, movingAgentId, anchorAgentId) {
    const anchorCard = cardElements[anchorAgentId];
    const anchorAgent = data.agents.find((a) => a.id === anchorAgentId);
    const anchorSide = getPeerSide(anchorAgentId, movingAgentId);
    const anchorPt = (anchorCard && anchorAgent)
      ? getPortEndpoint(anchorCard, anchorAgent, anchorSide)
      : null;

    isDraggingEndpoint = true;
    endpointDrag = { pair, movingAgentId, anchorAgentId, anchorPt, anchorSide };
    canvas.classList.add("is-connecting");

    const grp = svgEl.querySelector(`[data-conn-id="${pair.id}"]`);
    grp?.classList.add("is-being-edited");

    endpointTempPath = document.createElementNS(SVG_NS, "path");
    endpointTempPath.setAttribute("stroke", "#2f6fed");
    endpointTempPath.setAttribute("stroke-width", "2");
    endpointTempPath.setAttribute("stroke-dasharray", "6 3");
    endpointTempPath.setAttribute("fill", "none");
    endpointTempPath.style.pointerEvents = "none";
    svgEl.appendChild(endpointTempPath);
  }

  // ── Document mouse handlers ───────────────────────────────────────────────

  function onDocMouseMove(e) {
    if (!isPanning && !isBoxSelecting && !dragAgentId) {
      updatePortVisibility(canvasPos(e));
    }

    if (isPanning) {
      viewTransform.x = panStart.tx + (e.clientX - panStart.x);
      viewTransform.y = panStart.ty + (e.clientY - panStart.y);
      applyTransform();
      return;
    }

    if (isBoxSelecting) {
      const rect = wrapper.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const x = Math.min(boxSelectStartScreen.x, cx);
      const y = Math.min(boxSelectStartScreen.y, cy);
      const w = Math.abs(cx - boxSelectStartScreen.x);
      const h = Math.abs(cy - boxSelectStartScreen.y);
      selectionBox.style.left = `${x}px`;
      selectionBox.style.top = `${y}px`;
      selectionBox.style.width = `${w}px`;
      selectionBox.style.height = `${h}px`;
      return;
    }

    if (!dragAgentId && !isConnecting && !isDraggingEndpoint) return;
    const pos = canvasPos(e);

    if (isDraggingEndpoint && endpointTempPath) {
      const { anchorPt, anchorSide } = endpointDrag;
      if (anchorPt) {
        const anchorDir = getSideTangent(anchorSide);
        const dist = Math.sqrt((pos.x - anchorPt.x) ** 2 + (pos.y - anchorPt.y) ** 2);
        const cp = Math.max(60, dist * 0.45);
        endpointTempPath.setAttribute("d",
          `M ${anchorPt.x} ${anchorPt.y} C ${anchorPt.x + anchorDir.dx * cp} ${anchorPt.y + anchorDir.dy * cp}, ${pos.x} ${pos.y}, ${pos.x} ${pos.y}`
        );
      }
      return;
    }

    if (dragAgentId) {
      const dx = pos.x - dragMouseStart.x;
      const dy = pos.y - dragMouseStart.y;

      if (!dragHasMoved && Math.sqrt(dx * dx + dy * dy) > 5) {
        dragHasMoved = true;
        cardElements[dragAgentId]?.classList.add("is-dragging");
      }

      if (dragHasMoved) {
        const groupIds = Object.keys(dragSelectedAgentsStart);
        if (groupIds.length > 1) {
          for (const id of groupIds) {
            const start = dragSelectedAgentsStart[id];
            const a = data.agents.find((ag) => ag.id === id);
            if (a) {
              a.x = start.x + dx;
              a.y = start.y + dy;
              const card = cardElements[id];
              if (card) {
                card.style.left = `${a.x}px`;
                card.style.top = `${a.y}px`;
              }
            }
          }
        } else {
          const agent = data.agents.find((a) => a.id === dragAgentId);
          if (agent) {
            agent.x = dragCardStart.x + dx;
            agent.y = dragCardStart.y + dy;
            const card = cardElements[dragAgentId];
            card.style.left = `${agent.x}px`;
            card.style.top = `${agent.y}px`;
          }
        }
        renderConnections();
      }
    }

    if (isConnecting && tempPath) {
      const fromCard = cardElements[connectingFromId];
      const fromAgent = data.agents.find((a) => a.id === connectingFromId);
      if (fromCard && fromAgent) {
        const fp = getPortEndpoint(fromCard, fromAgent, connectingFromSide);
        const dir = getSideTangent(connectingFromSide);
        const dist = Math.sqrt((pos.x - fp.x) ** 2 + (pos.y - fp.y) ** 2);
        const cp = Math.max(60, dist * 0.45);
        tempPath.setAttribute("d", `M ${fp.x} ${fp.y} C ${fp.x + dir.dx * cp} ${fp.y + dir.dy * cp}, ${pos.x} ${pos.y}, ${pos.x} ${pos.y}`);
      }
    }
  }

  function onDocMouseUp(e) {
    if (isDraggingEndpoint) {
      const pos = canvasPos(e);
      const { pair, movingAgentId, anchorAgentId } = endpointDrag;
      let newSide = null;

      if (e.target.classList?.contains("agent-module-port")) {
        const portCard = e.target.closest("[data-agent-id]");
        if (portCard && portCard.dataset.agentId === movingAgentId) {
          newSide = e.target.dataset.side;
        }
      }

      if (!newSide) {
        const movingCard = cardElements[movingAgentId];
        const movingAgent = data.agents.find((a) => a.id === movingAgentId);
        if (movingCard && movingAgent) {
          const expand = 40;
          const cl = movingCard.offsetLeft - expand;
          const ct = movingCard.offsetTop - expand;
          const cr = movingCard.offsetLeft + movingCard.offsetWidth + expand;
          const cb = movingCard.offsetTop + movingCard.offsetHeight + expand;
          if (pos.x >= cl && pos.x <= cr && pos.y >= ct && pos.y <= cb) {
            newSide = closestSide(pos, movingCard, movingAgent);
          }
        }
      }

      if (newSide) {
        const movingAgent = data.agents.find((a) => a.id === movingAgentId);
        const peerEntry = movingAgent?.agentPeers?.find((p) => p.id === anchorAgentId);
        if (peerEntry) {
          peerEntry.side = newSide;
          queueAgentSync();
        }
      }

      const grp = svgEl.querySelector(`[data-conn-id="${pair.id}"]`);
      grp?.classList.remove("is-being-edited");
      endpointTempPath?.remove();
      endpointTempPath = null;
      isDraggingEndpoint = false;
      endpointDrag = null;
      canvas.classList.remove("is-connecting");
      renderConnections();
      return;
    }

    if (isPanning) {
      isPanning = false;
      wrapper.style.cursor = "";
      return;
    }

    if (isBoxSelecting) {
      isBoxSelecting = false;
      selectionBox.style.display = "none";

      const rect = wrapper.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const boxLeft = Math.min(boxSelectStartScreen.x, cx);
      const boxTop = Math.min(boxSelectStartScreen.y, cy);
      const boxRight = Math.max(boxSelectStartScreen.x, cx);
      const boxBottom = Math.max(boxSelectStartScreen.y, cy);

      if (boxRight - boxLeft > 4 || boxBottom - boxTop > 4) {
        const worldLeft = (boxLeft - viewTransform.x) / viewTransform.scale;
        const worldTop = (boxTop - viewTransform.y) / viewTransform.scale;
        const worldRight = (boxRight - viewTransform.x) / viewTransform.scale;
        const worldBottom = (boxBottom - viewTransform.y) / viewTransform.scale;

        const newSelected = new Set();
        for (const agent of data.agents) {
          const card = cardElements[agent.id];
          if (!card) continue;
          const cr = agent.x + card.offsetWidth;
          const cb = agent.y + card.offsetHeight;
          if (cr > worldLeft && agent.x < worldRight && cb > worldTop && agent.y < worldBottom) {
            newSelected.add(agent.id);
          }
        }

        if (newSelected.size >= 1) {
          selectedAgentId = null;
          selectedAgentIds = newSelected;
          delete editorPanel.dataset.selectedAgentId;
          if (activeModuleAttachmentTarget?.owner === attachmentTargetOwner) {
            activeModuleAttachmentTarget = null;
          }
          updateSelectionVisuals();
        }
      }
      return;
    }

    if (dragAgentId) {
      if (dragHasMoved) {
        queueAgentSync();
      } else if (pendingSelectId) {
        selectAgent(pendingSelectId);
      }
      cardElements[dragAgentId]?.classList.remove("is-dragging");
      dragAgentId = null;
      dragHasMoved = false;
      pendingSelectId = null;
      dragSelectedAgentsStart = {};
    }

    if (isConnecting) {
      const pos = canvasPos(e);
      let targetId = null;
      let targetSide = null;

      // Check if dropped directly on a port element
      if (e.target.classList?.contains("agent-module-port")) {
        const portCard = e.target.closest("[data-agent-id]");
        if (portCard && portCard.dataset.agentId !== connectingFromId) {
          targetId = portCard.dataset.agentId;
          targetSide = e.target.dataset.side;
        }
      }

      if (!targetId) {
        for (const [aid, card] of Object.entries(cardElements)) {
          if (aid === connectingFromId) continue;
          const cl = card.offsetLeft;
          const ct = card.offsetTop;
          const cr = cl + card.offsetWidth;
          const cb = ct + card.offsetHeight;
          if (pos.x >= cl && pos.x <= cr && pos.y >= ct && pos.y <= cb) {
            targetId = aid;
            break;
          }
        }
      }

      if (targetId && !targetSide) {
        const targetCard = cardElements[targetId];
        const targetAgent = data.agents.find((a) => a.id === targetId);
        if (targetCard && targetAgent) targetSide = closestSide(pos, targetCard, targetAgent);
      }

      if (targetId && !connectionExists(connectingFromId, targetId)) {
        const fromAgent = data.agents.find((a) => a.id === connectingFromId);
        const toAgent = data.agents.find((a) => a.id === targetId);
        if (fromAgent && toAgent) {
          if (!Array.isArray(fromAgent.agentPeers)) fromAgent.agentPeers = [];
          if (!Array.isArray(toAgent.agentPeers)) toAgent.agentPeers = [];
          fromAgent.agentPeers.push({ id: targetId, "communication-instruction": "", side: connectingFromSide });
          toAgent.agentPeers.push({ id: connectingFromId, "communication-instruction": "", side: targetSide || "left" });
          queueAgentSync();
          renderConnections();
        }
      }

      tempPath?.remove();
      tempPath = null;
      isConnecting = false;
      connectingFromId = null;
      connectingFromSide = null;
      canvas.classList.remove("is-connecting");
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function canvasPos(e) {
    const rect = wrapper.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - viewTransform.x) / viewTransform.scale,
      y: (e.clientY - rect.top - viewTransform.y) / viewTransform.scale
    };
  }

  function applyTransform() {
    canvas.style.transform = `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`;
    // Sync dot grid with pan/zoom so it feels attached to the canvas
    const dotSpacing = 24 * viewTransform.scale;
    const ox = ((viewTransform.x % dotSpacing) + dotSpacing) % dotSpacing;
    const oy = ((viewTransform.y % dotSpacing) + dotSpacing) % dotSpacing;
    wrapper.style.backgroundSize = `${dotSpacing}px ${dotSpacing}px`;
    wrapper.style.backgroundPosition = `${ox}px ${oy}px`;
  }

  function fitToViewport() {
    if (data.agents.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    data.agents.forEach((agent) => {
      const h = cardElements[agent.id]?.offsetHeight ?? 120;
      minX = Math.min(minX, agent.x);
      minY = Math.min(minY, agent.y);
      maxX = Math.max(maxX, agent.x + CARD_WIDTH);
      maxY = Math.max(maxY, agent.y + h);
    });
    const pad = 48;
    const contentW = maxX - minX || 1;
    const contentH = maxY - minY || 1;
    const scale = Math.min(
      (wrapper.clientWidth - pad * 2) / contentW,
      (wrapper.clientHeight - pad * 2) / contentH,
      2
    );
    viewTransform.scale = scale;
    viewTransform.x = (wrapper.clientWidth - contentW * scale) / 2 - minX * scale;
    viewTransform.y = (wrapper.clientHeight - contentH * scale) / 2 - minY * scale;
    applyTransform();
  }

  function bezierCp(fx, tx) {
    const dx = tx - fx;
    return Math.max(60, Math.abs(dx) * 0.5);
  }

  function bezierPoint(fp, c1, c2, tp, t) {
    const mt = 1 - t;
    return {
      x: mt*mt*mt*fp.x + 3*mt*mt*t*c1.x + 3*mt*t*t*c2.x + t*t*t*tp.x,
      y: mt*mt*mt*fp.y + 3*mt*mt*t*c1.y + 3*mt*t*t*c2.y + t*t*t*tp.y,
    };
  }

  function getPortEndpoint(card, agent, side) {
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    switch (side) {
      case "left":   return { x: agent.x,         y: agent.y + h / 2 };
      case "right":  return { x: agent.x + w,      y: agent.y + h / 2 };
      case "top":    return { x: agent.x + w / 2,  y: agent.y };
      case "bottom": return { x: agent.x + w / 2,  y: agent.y + h };
      default:       return { x: agent.x + w,      y: agent.y + h / 2 };
    }
  }

  function getSideTangent(side) {
    switch (side) {
      case "left":   return { dx: -1, dy: 0 };
      case "right":  return { dx: 1,  dy: 0 };
      case "top":    return { dx: 0,  dy: -1 };
      case "bottom": return { dx: 0,  dy: 1 };
      default:       return { dx: 1,  dy: 0 };
    }
  }

  function closestSide(pos, card, agent) {
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const candidates = {
      left:   { x: agent.x,        y: agent.y + h / 2 },
      right:  { x: agent.x + w,    y: agent.y + h / 2 },
      top:    { x: agent.x + w / 2, y: agent.y },
      bottom: { x: agent.x + w / 2, y: agent.y + h },
    };
    let best = "left", bestD = Infinity;
    for (const [side, pt] of Object.entries(candidates)) {
      const d = (pos.x - pt.x) ** 2 + (pos.y - pt.y) ** 2;
      if (d < bestD) { bestD = d; best = side; }
    }
    return best;
  }

  function getPeerSide(agentId, peerId) {
    return data.agents.find((a) => a.id === agentId)
      ?.agentPeers?.find((p) => p.id === peerId)
      ?.side || "right";
  }

  function updatePortVisibility(worldPos) {
    const THRESHOLD = 80;
    for (const agent of data.agents) {
      const card = cardElements[agent.id];
      if (!card) continue;
      const w = card.offsetWidth;
      const h = card.offsetHeight;
      const dx = Math.max(agent.x - worldPos.x, 0, worldPos.x - (agent.x + w));
      const dy = Math.max(agent.y - worldPos.y, 0, worldPos.y - (agent.y + h));
      card.classList.toggle("ports-visible", Math.sqrt(dx * dx + dy * dy) < THRESHOLD);
    }
  }

  function openLabelEditor(conn, midX, midY, field) {
    if (activeLabelEditorDone) activeLabelEditorDone(true);

    // Measure and remove the existing static label so textarea takes its place
    const existingLabel = canvas.querySelector(`[data-conn-id="${conn.id}"][data-field="${field}"]`);
    const measuredWidth = existingLabel?.offsetWidth ?? null;
    existingLabel?.remove();

    const currentValue = field === "labelLR"
      ? getPeerInstruction(conn.fromId, conn.toId)
      : getPeerInstruction(conn.toId, conn.fromId);

    const input = document.createElement("textarea");
    input.className = "agent-connection-label-input";
    input.value = currentValue;
    input.placeholder = "Communication…";
    input.rows = 1;
    input.style.left = `${midX}px`;
    input.style.top = `${midY}px`;
    input.style.transform = field === "labelLR" ? "translate(-50%, -100%)" : "translate(-50%, 0%)";
    if (measuredWidth) input.style.width = `${measuredWidth}px`;
    canvas.appendChild(input);

    function autoResize() {
      input.style.height = "auto";
      input.style.height = `${input.scrollHeight}px`;
    }

    let done = false;

    function close(save) {
      if (done) return;
      done = true;
      activeLabelEditorDone = null;
      if (save) {
        const val = input.value.trim();
        const [writerId, peerId] = field === "labelLR"
          ? [conn.fromId, conn.toId]
          : [conn.toId, conn.fromId];
        const writer = data.agents.find((a) => a.id === writerId);
        const peerEntry = writer?.agentPeers?.find((p) => p.id === peerId);
        if (peerEntry) {
          peerEntry["communication-instruction"] = val;
          queueAgentSync();
        }
      }
      input.remove();
      renderConnections();
    }

    activeLabelEditorDone = close;

    input.addEventListener("input", autoResize);
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") { e.preventDefault(); close(false); }
    });
    input.addEventListener("blur", () => close(true));
    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("mousedown", (e) => e.stopPropagation());
    input.addEventListener("dblclick", (e) => e.stopPropagation());

    requestAnimationFrame(() => { autoResize(); input.focus(); input.select(); });
  }

  // Derive connection pairs from agentPeers (each pair rendered once)
  function deriveConnPairs() {
    const seen = new Set();
    const pairs = [];
    for (const agent of data.agents) {
      for (const peer of (agent.agentPeers || [])) {
        const peerAgent = data.agents.find((a) => a.id === peer.id);
        if (!peerAgent) continue;
        const key = agent.id < peer.id
          ? `${agent.id}~~${peer.id}`
          : `${peer.id}~~${agent.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const [fromId, toId] = agent.id < peer.id
          ? [agent.id, peer.id]
          : [peer.id, agent.id];
        pairs.push({ id: key, fromId, toId });
      }
    }
    return pairs;
  }

  function getPeerInstruction(agentId, peerId) {
    return data.agents.find((a) => a.id === agentId)
      ?.agentPeers?.find((p) => p.id === peerId)
      ?.["communication-instruction"] || "";
  }

  function renderConnections() {
    if (isDraggingEndpoint) return;
    Array.from(svgEl.children).forEach((el) => {
      if (el !== tempPath && el !== endpointTempPath) el.remove();
    });
    canvas.querySelectorAll(".agent-connection-label").forEach((el) => el.remove());

    const LABEL_GAP = 8;

    for (const pair of deriveConnPairs()) {
      const fromCard = cardElements[pair.fromId];
      const toCard = cardElements[pair.toId];
      const fromAgent = data.agents.find((a) => a.id === pair.fromId);
      const toAgent = data.agents.find((a) => a.id === pair.toId);
      if (!fromCard || !toCard || !fromAgent || !toAgent) continue;

      const fromSide = getPeerSide(pair.fromId, pair.toId);
      const toSide = getPeerSide(pair.toId, pair.fromId);
      const fp = getPortEndpoint(fromCard, fromAgent, fromSide);
      const tp = getPortEndpoint(toCard, toAgent, toSide);
      const fromDir = getSideTangent(fromSide);
      const toDir = getSideTangent(toSide);
      const dist = Math.sqrt((tp.x - fp.x) ** 2 + (tp.y - fp.y) ** 2);
      const cp = Math.max(60, dist * 0.45);

      // Control points
      const c1x = fp.x + fromDir.dx * cp;
      const c1y = fp.y + fromDir.dy * cp;
      const c2x = tp.x + toDir.dx * cp;
      const c2y = tp.y + toDir.dy * cp;

      const d = `M ${fp.x} ${fp.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tp.x} ${tp.y}`;

      // Bezier t=0.5 midpoint: B(0.5) = (P0 + 3P1 + 3P2 + P3) / 8
      const midX = (fp.x + 3 * c1x + 3 * c2x + tp.x) / 8;
      const midY = (fp.y + 3 * c1y + 3 * c2y + tp.y) / 8;

      const lrText = getPeerInstruction(pair.fromId, pair.toId);
      const rlText = getPeerInstruction(pair.toId, pair.fromId);
      const hasInstructions = lrText || rlText;

      const visPath = document.createElementNS(SVG_NS, "path");
      visPath.setAttribute("d", d);
      visPath.setAttribute("stroke", "#2f6fed");
      visPath.setAttribute("stroke-width", "2");
      visPath.setAttribute("fill", "none");
      visPath.style.pointerEvents = "none";

      const hitPath = document.createElementNS(SVG_NS, "path");
      hitPath.setAttribute("d", d);
      hitPath.setAttribute("stroke", "transparent");
      hitPath.setAttribute("stroke-width", "14");
      hitPath.setAttribute("fill", "none");
      hitPath.style.pointerEvents = "stroke";
      hitPath.style.cursor = hasInstructions ? "default" : "pointer";
      hitPath.title = hasInstructions ? "Remove instructions first to disconnect" : "Right-click to remove";

      hitPath.addEventListener("mousedown", (e) => e.stopPropagation());
      hitPath.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!hasInstructions) deleteConnection(pair.id);
      });

      // Endpoint drag handles — placed on the curve, away from card edges
      const c1 = { x: c1x, y: c1y };
      const c2 = { x: c2x, y: c2y };
      const mkHandle = (pt, moverId, anchorId) => {
        const c = document.createElementNS(SVG_NS, "circle");
        c.setAttribute("cx", pt.x);
        c.setAttribute("cy", pt.y);
        c.setAttribute("r", "6");
        c.classList.add("agent-connection-endpoint");
        c.addEventListener("mousedown", (e) => {
          e.stopPropagation();
          e.preventDefault();
          startEndpointDrag(pair, moverId, anchorId);
        });
        return c;
      };
      const fromHandle = mkHandle(bezierPoint(fp, c1, c2, tp, 0.18), pair.fromId, pair.toId);
      const toHandle   = mkHandle(bezierPoint(fp, c1, c2, tp, 0.82), pair.toId,   pair.fromId);

      const connGroup = document.createElementNS(SVG_NS, "g");
      connGroup.classList.add("agent-connection-group");
      connGroup.setAttribute("data-conn-id", pair.id);
      connGroup.appendChild(visPath);
      connGroup.appendChild(hitPath);
      connGroup.appendChild(fromHandle);
      connGroup.appendChild(toHandle);
      svgEl.appendChild(connGroup);

      // ── LR label (above): bottom edge sits LABEL_GAP above midY ────────────
      const lrEl = document.createElement("div");
      lrEl.className = `agent-connection-label${lrText ? "" : " is-empty"}`;
      lrEl.dataset.connId = pair.id;
      lrEl.dataset.field = "labelLR";
      lrEl.style.left = `${midX}px`;
      lrEl.style.top = `${midY - LABEL_GAP}px`;
      lrEl.style.transform = "translate(-50%, -100%)";
      if (lrText) lrEl.textContent = lrText;
      lrEl.addEventListener("mousedown", (e) => e.stopPropagation());
      lrEl.addEventListener("click", (e) => {
        e.stopPropagation();
        openLabelEditor(pair, midX, midY - LABEL_GAP, "labelLR");
      });
      canvas.appendChild(lrEl);

      // ── RL label (below): top edge sits LABEL_GAP below midY ───────────────
      const rlEl = document.createElement("div");
      rlEl.className = `agent-connection-label${rlText ? "" : " is-empty"}`;
      rlEl.dataset.connId = pair.id;
      rlEl.dataset.field = "labelRL";
      rlEl.style.left = `${midX}px`;
      rlEl.style.top = `${midY + LABEL_GAP}px`;
      rlEl.style.transform = "translate(-50%, 0%)";
      if (rlText) rlEl.textContent = rlText;
      rlEl.addEventListener("mousedown", (e) => e.stopPropagation());
      rlEl.addEventListener("click", (e) => {
        e.stopPropagation();
        openLabelEditor(pair, midX, midY + LABEL_GAP, "labelRL");
      });
      canvas.appendChild(rlEl);
    }
  }

  function renderCompact() {
    compactList.replaceChildren();
    if (data.agents.length === 0) {
      const empty = document.createElement("p");
      empty.className = "agent-compact-empty";
      empty.textContent = "No agents configured. Use the edit button to add agents.";
      compactList.appendChild(empty);
      return;
    }
    data.agents.forEach((agent) => {
      if (agent.isDeleted) return;
      const card = document.createElement("div");
      card.className = "agent-compact-card";
      const attachBtn = document.createElement("button");
      attachBtn.className = "card-attach-button agent-module-card-attach-button";
      attachBtn.type = "button";
      attachBtn.title = `Attach ${agent.name || "agent"}`;
      attachBtn.setAttribute("aria-label", `Attach ${agent.name || "agent"}`);
      attachBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        agentController?.attachRecord(createAgentAttachment(agent));
      });
      const name = document.createElement("strong");
      name.textContent = agent.name;
      const desc = document.createElement("span");
      desc.textContent = agent.description;
      const attachments = document.createElement("div");
      attachments.className = "agent-module-attachments agent-module-attachments--summary";
      renderModuleAttachments(attachments, agent, false);
      card.append(attachBtn, name, desc, attachments);
      compactList.appendChild(card);
    });
  }

  return { attachRecordToSelectedAgent, suggestToolToSelectedAgent, getAttachmentTarget, reload: loadAgents };
}

export function createAgentProviderEditorPanel() {
  const panel = document.createElement("div");
  panel.className = "editor-sources-panel provider-editor-panel";

  const list = document.createElement("div");
  list.className = "search-sources-list provider-editor-list";
  panel.appendChild(list);

  const configs = loadProviderConfigs();
  AGENT_PROVIDER_OPTIONS.forEach((provider) => {
    list.appendChild(createAgentProviderCard(provider, configs));
  });

  return panel;
}

function createAgentProviderCard(provider, configs) {
  const config = configs[provider.id] || {};
  const storedApiKey = config.apiKey || getStoredAgentProviderApiKey(provider.id);
  const card = document.createElement("details");
  card.className = "source-editor search-source-card provider-editor-card";

  const summary = document.createElement("summary");
  summary.className = "source-editor-summary";

  const summaryContent = document.createElement("div");
  summaryContent.className = "source-editor-summary-content";

  const summaryMain = document.createElement("div");
  summaryMain.className = "source-editor-summary-main";

  const summaryText = document.createElement("div");
  summaryText.className = "source-editor-summary-text";
  const summaryEdit = document.createElement("div");
  summaryEdit.className = "source-summary-edit";

  const title = document.createElement("strong");
  title.textContent = config.label || provider.label;
  title.classList.toggle("has-money-icon", Boolean(config.costly || storedApiKey));

  const subtitle = document.createElement("span");
  subtitle.textContent = config.description || provider.placeholder;

  const titleInput = document.createElement("input");
  titleInput.className = "source-title-input";
  titleInput.type = "text";
  titleInput.value = config.label || provider.label;

  const descInput = document.createElement("textarea");
  descInput.className = "source-description-input";
  descInput.rows = 3;
  descInput.value = config.description || subtitle.textContent;

  [titleInput, descInput].forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("input", () => {
      configs[provider.id] = {
        ...(configs[provider.id] || {}),
        label: titleInput.value,
        description: descInput.value
      };
      title.textContent = titleInput.value.trim() || provider.label;
      subtitle.textContent = descInput.value.trim() || provider.placeholder;
      saveProviderConfigs(configs);
    });
  });

  const deleteButton = document.createElement("button");
  deleteButton.className = "circle-icon-button delete-source-button source-editor-delete-button";
  deleteButton.type = "button";
  deleteButton.setAttribute("aria-label", `Delete ${provider.label}`);
  deleteButton.title = `Delete ${provider.label}`;
  deleteButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    replaceAgentProviderWithDeletedRow(card, provider.label);
  });

  const closeButton = document.createElement("button");
  closeButton.className = "circle-icon-button source-editor-close-button";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close");
  closeButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    card.open = false;
  });

  const sideButtons = document.createElement("div");
  sideButtons.className = "source-editor-side-buttons";
  sideButtons.appendChild(deleteButton);

  summaryText.append(title, subtitle);
  summaryEdit.append(titleInput, descInput);
  summaryMain.append(sideButtons, summaryText, summaryEdit, closeButton);
  summaryContent.appendChild(summaryMain);
  summary.appendChild(summaryContent);

  const body = document.createElement("div");
  body.className = "source-editor-body provider-editor-body";
  const typeRow = document.createElement("div");
  typeRow.className = "search-source-type-row";
  const typeSelect = document.createElement("select");
  typeSelect.className = "search-source-row-select";
  AGENT_PROVIDER_OPTIONS.forEach((optionProvider) => {
    const option = document.createElement("option");
    option.value = optionProvider.id;
    option.textContent = optionProvider.label;
    option.selected = optionProvider.id === provider.id;
    typeSelect.appendChild(option);
  });
  typeSelect.addEventListener("change", () => {
    configs[provider.id] = { ...(configs[provider.id] || {}), type: typeSelect.value };
    saveProviderConfigs(configs);
  });
  const costlyLabel = document.createElement("label");
  costlyLabel.className = "search-source-row-costly";
  const costlyCheck = document.createElement("input");
  costlyCheck.type = "checkbox";
  costlyCheck.checked = Boolean(config.costly || storedApiKey);
  costlyCheck.addEventListener("change", () => {
    configs[provider.id] = { ...(configs[provider.id] || {}), costly: costlyCheck.checked };
    title.classList.toggle("has-money-icon", costlyCheck.checked);
    saveProviderConfigs(configs);
  });
  costlyLabel.append(costlyCheck, " Costly");
  const apiKeyField = createProviderField(provider.apiKeyLabel, "password", storedApiKey, (value) => {
    configs[provider.id] = { ...(configs[provider.id] || {}), apiKey: value };
    title.classList.toggle("has-money-icon", costlyCheck.checked || Boolean(value));
    saveProviderConfigs(configs);
    if (localStorage.getItem(AGENT_PROVIDER_STORAGE_KEY) === provider.id) {
      localStorage.setItem(AGENT_API_KEY_STORAGE_KEY, value);
      if (provider.id === "gemini") localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, value);
      window.dispatchEvent(new CustomEvent("research-agent:agent-provider-config-saved"));
    }
  });
  typeRow.append(typeSelect, costlyLabel, apiKeyField);

  body.append(typeRow);

  card.append(summary, body);
  return card;
}

function replaceAgentProviderWithDeletedRow(card, label) {
  const row = document.createElement("div");
  const line = document.createElement("div");
  const deletedLabel = document.createElement("span");
  const countdown = document.createElement("span");
  const revertButton = document.createElement("button");
  let remaining = 10;

  row.className = "source-deleted-row";
  line.className = "source-deleted-line";
  deletedLabel.className = "source-deleted-label";
  countdown.className = "source-delete-countdown";
  deletedLabel.textContent = `Deleted: ${label}`;
  countdown.textContent = `${remaining}s`;
  line.append(deletedLabel, countdown);
  revertButton.className = "circle-icon-button revert-source-button";
  revertButton.type = "button";
  revertButton.setAttribute("aria-label", `Restore ${label}`);
  revertButton.title = `Restore ${label}`;
  row.append(line, revertButton);

  const parent = card.parentElement;
  if (!parent) return;
  parent.replaceChild(row, card);
  const timer = window.setInterval(() => {
    remaining -= 1;
    countdown.textContent = `${Math.max(0, remaining)}s`;
    if (remaining <= 0) {
      window.clearInterval(timer);
      row.remove();
    }
  }, 1000);
  revertButton.addEventListener("click", () => {
    window.clearInterval(timer);
    parent.replaceChild(card, row);
  });
}

function createProviderField(label, type, value, onInput) {
  const field = document.createElement("label");
  field.className = "search-source-row-api-key provider-editor-field";
  const text = document.createElement("span");
  text.textContent = label;
  const input = document.createElement("input");
  input.type = type;
  input.autocomplete = "off";
  input.spellcheck = false;
  input.value = value;
  input.addEventListener("input", () => onInput(input.value));
  field.append(text, input);
  return field;
}

function loadProviderConfigs() {
  try {
    return JSON.parse(localStorage.getItem(AGENT_PROVIDER_CONFIG_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function getStoredAgentProviderApiKey(providerId) {
  if (providerId === localStorage.getItem(AGENT_PROVIDER_STORAGE_KEY)) {
    return localStorage.getItem(AGENT_API_KEY_STORAGE_KEY) || "";
  }
  if (providerId === "gemini") {
    return localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || "";
  }
  return "";
}

function saveProviderConfigs(configs) {
  localStorage.setItem(AGENT_PROVIDER_CONFIG_STORAGE_KEY, JSON.stringify(configs));
}
