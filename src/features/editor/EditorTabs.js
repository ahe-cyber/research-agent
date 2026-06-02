import { markdownToHtml } from "../../lib/markdown";
import { loadWorkspaceState, saveWorkspaceState } from "../../lib/workspaceState.js";

export function createEditorTabController({ onMapActivated = () => {} } = {}) {
  const tabBar = document.getElementById("editorTabBar");
  const viewport = document.getElementById("editorViewport");
  const mapPanel = document.getElementById("map");

  let activeTabId = "map";
  const tabs = [{ id: "map", label: "Map", closeable: false }];
  const panelMap = {};

  function persistEditorState() {
    saveWorkspaceState({
      openEditorTabs: tabs.map(({ id, label }) => ({ id, label })),
      activeEditorTab: activeTabId,
    });
  }

  function render() {
    tabBar.replaceChildren();

    tabs.forEach((tab) => {
      const tabEl = document.createElement("button");
      tabEl.className = `editor-tab${tab.id === activeTabId ? " is-active" : ""}`;
      tabEl.type = "button";

      const label = document.createElement("span");
      label.textContent = tab.label;
      tabEl.appendChild(label);
      tabEl.addEventListener("click", () => activateTab(tab.id));

      if (tab.closeable) {
        const closeBtn = document.createElement("button");
        closeBtn.className = "editor-tab-close";
        closeBtn.type = "button";
        closeBtn.setAttribute("aria-label", `Close ${tab.label}`);
        closeBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          closeTab(tab.id);
        });
        tabEl.appendChild(closeBtn);
      }

      tabBar.appendChild(tabEl);
    });

    mapPanel.hidden = activeTabId !== "map";

    Object.entries(panelMap).forEach(([id, panel]) => {
      panel.hidden = id !== activeTabId;
    });
  }

  function activateTab(id) {
    activeTabId = id;
    render();
    persistEditorState();
    if (id === "map") {
      onMapActivated();
    }
  }

  function closeTab(id) {
    const index = tabs.findIndex((t) => t.id === id);
    if (index <= 0) return;

    tabs.splice(index, 1);
    updateTabButtons(id, false);

    if (panelMap[id]) {
      if (id === "sources-editor" || id === "postman-collections" || id === "catalog-results" || id === "agents-editor") {
        panelMap[id].hidden = true;
      } else {
        panelMap[id].remove();
        delete panelMap[id];
      }
    }

    if (activeTabId === id) {
      activeTabId = tabs[Math.max(0, index - 1)].id;
    }

    render();
    persistEditorState();
  }

  function openTableTab(record, variableName, element) {
    const tabId = `table-${record.id}-${variableName}`;

    if (tabs.find((t) => t.id === tabId)) {
      activateTab(tabId);
      return;
    }

    tabs.push({ id: tabId, label: variableName, closeable: true });

    const panel = document.createElement("div");
    panel.className = "editor-table-panel";
    panel.hidden = true;
    panel.appendChild(renderHtmlElement(element));
    viewport.appendChild(panel);
    panelMap[tabId] = panel;

    updateTabButtons(tabId, true);
    activateTab(tabId);
  }

  function openSourcesTab(editorPanel) {
    const tabId = "sources-editor";

    if (tabs.find((t) => t.id === tabId)) {
      activateTab(tabId);
      return;
    }

    tabs.push({ id: tabId, label: "Sources", closeable: true });

    if (!panelMap[tabId]) {
      editorPanel.hidden = true;
      viewport.appendChild(editorPanel);
      panelMap[tabId] = editorPanel;
    }

    activateTab(tabId);
  }

  function openPostmanTab(postmanPanel) {
    const tabId = "postman-collections";

    if (tabs.find((t) => t.id === tabId)) {
      activateTab(tabId);
      return;
    }

    tabs.push({ id: tabId, label: "Collections", closeable: true });

    if (!panelMap[tabId]) {
      postmanPanel.hidden = true;
      viewport.appendChild(postmanPanel);
      panelMap[tabId] = postmanPanel;
    }

    activateTab(tabId);
  }

  function openLayerSourcesTab(layerSourcesPanel) {
    const tabId = "layer-sources";

    if (tabs.find((t) => t.id === tabId)) {
      activateTab(tabId);
      return;
    }

    tabs.push({ id: tabId, label: "Layer Sources", closeable: true });
    layerSourcesPanel.hidden = true;
    viewport.appendChild(layerSourcesPanel);
    panelMap[tabId] = layerSourcesPanel;
    activateTab(tabId);
  }

  function openPdfTab(url, label) {
    const tabId = `pdf::${url}`;
    const existing = tabs.find((t) => t.id === tabId);

    if (existing) {
      activateTab(tabId);
      return;
    }

    tabs.push({ id: tabId, label: label || "PDF", url, closeable: true });

    const panel = document.createElement("div");
    panel.className = "editor-pdf-panel";
    panel.hidden = true;

    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.title = label || "PDF document";
    panel.appendChild(iframe);
    viewport.appendChild(panel);
    panelMap[tabId] = panel;

    updateTabButtons(tabId, true);
    activateTab(tabId);
  }

  function updateTabButtons(tabId, isActive) {
    document.querySelectorAll(`[data-tab-id="${tabId}"]`).forEach((button) => {
      button.classList.toggle("is-active", isActive);
    });
  }

  function openAgentsTab(agentsPanel) {
    const tabId = "agents-editor";

    if (tabs.find((t) => t.id === tabId)) {
      activateTab(tabId);
      return;
    }

    tabs.push({ id: tabId, label: "Agent Modules", closeable: true });

    if (!panelMap[tabId]) {
      agentsPanel.hidden = true;
      viewport.appendChild(agentsPanel);
      panelMap[tabId] = agentsPanel;
    }

    activateTab(tabId);
  }

  function openCatalogResultsTab(resultsPanel) {
    const tabId = "catalog-results";

    if (tabs.find((t) => t.id === tabId)) {
      activateTab(tabId);
      return;
    }

    tabs.push({ id: tabId, label: "Catalog", closeable: true });

    if (!panelMap[tabId]) {
      resultsPanel.hidden = true;
      viewport.appendChild(resultsPanel);
      panelMap[tabId] = resultsPanel;
    }

    activateTab(tabId);
  }

  function openCatalogDatasetTab(item, detailPanel) {
    const tabId = `catalog-dataset-${item.id}`;

    if (tabs.find((t) => t.id === tabId)) {
      activateTab(tabId);
      return;
    }

    tabs.push({ id: tabId, label: item.title || "Dataset", closeable: true });

    detailPanel.hidden = true;
    viewport.appendChild(detailPanel);
    panelMap[tabId] = detailPanel;

    activateTab(tabId);
  }

  function openReportTab(address) {
    const tabId = `report-${address.title}`;

    if (tabs.find((t) => t.id === tabId)) {
      activateTab(tabId);
      return panelMap[tabId]._reportController;
    }

    tabs.push({ id: tabId, label: address.title, closeable: true });

    const panel = document.createElement("div");
    panel.className = "editor-report-panel";
    panel.hidden = true;

    const toolbar = document.createElement("div");
    toolbar.className = "report-toolbar";

    [
      { cmd: "bold", label: "B", title: "Bold" },
      { cmd: "italic", label: "I", title: "Italic" },
      { cmd: "insertUnorderedList", label: "•", title: "Bullet list" },
      { cmd: "insertOrderedList", label: "1.", title: "Numbered list" },
    ].forEach(({ cmd, label, title }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "report-toolbar-btn";
      btn.textContent = label;
      btn.title = title;
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        document.execCommand(cmd, false, null);
      });
      toolbar.appendChild(btn);
    });

    ["H2", "H3", "P"].forEach((tag) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "report-toolbar-btn";
      btn.textContent = tag.toLowerCase();
      btn.title = tag === "P" ? "Paragraph" : `Heading ${tag[1]}`;
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        document.execCommand("formatBlock", false, tag);
      });
      toolbar.appendChild(btn);
    });

    const editor = document.createElement("div");
    editor.className = "report-editor";
    editor.contentEditable = "true";

    const h1 = document.createElement("h1");
    h1.textContent = address.title;
    editor.appendChild(h1);

    if (address.subtitle) {
      const sub = document.createElement("p");
      sub.className = "report-subtitle";
      sub.textContent = address.subtitle;
      editor.appendChild(sub);
    }

    panel.appendChild(toolbar);
    panel.appendChild(editor);
    viewport.appendChild(panel);
    panelMap[tabId] = panel;

    const reportController = {
      append(heading, content) {
        if (heading) {
          const h = document.createElement("h2");
          h.textContent = heading;
          editor.appendChild(h);
        }
        const div = document.createElement("div");
        div.innerHTML = markdownToHtml(content);
        editor.appendChild(div);
        editor.scrollTop = editor.scrollHeight;
      },
      getContent() {
        return editor.innerText.trim();
      }
    };

    panel._reportController = reportController;

    activateTab(tabId);
    return reportController;
  }

  render();
  return { openTableTab, openPdfTab, openSourcesTab, openPostmanTab, openLayerSourcesTab, openCatalogResultsTab, openCatalogDatasetTab, openReportTab, openAgentsTab };
}

function renderHtmlElement(element) {
  if (!element || typeof element !== "object" || !element.tag) {
    return document.createTextNode(String(element ?? ""));
  }

  const el = document.createElement(element.tag);

  Object.entries(element.attributes || {}).forEach(([attr, value]) => {
    if (!attr.startsWith("on")) {
      el.setAttribute(attr, value);
    }
  });

  if (element.text) {
    el.appendChild(document.createTextNode(element.text));
  }

  (element.children || []).forEach((child) => {
    el.appendChild(renderHtmlElement(child));
  });

  return el;
}
