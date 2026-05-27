export function createEditorTabController() {
  const tabBar = document.getElementById("editorTabBar");
  const viewport = document.getElementById("editorViewport");
  const mapPanel = document.getElementById("map");

  let activeTabId = "map";
  const tabs = [{ id: "map", label: "Map", closeable: false }];
  const panelMap = {};

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
  }

  function closeTab(id) {
    const index = tabs.findIndex((t) => t.id === id);
    if (index <= 0) return;

    tabs.splice(index, 1);
    updateTabButtons(id, false);

    if (panelMap[id]) {
      if (id === "sources-editor" || id === "postman-collections") {
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

  render();
  return { openTableTab, openPdfTab, openSourcesTab, openPostmanTab };
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
