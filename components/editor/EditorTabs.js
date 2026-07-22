import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { markdownToHtml } from "@/lib/markdown";
import { loadWorkspaceState, saveWorkspaceState } from "@/lib/workspaceState.js";
import { createEmptyPagePanel } from "./EmptyPagePanel.jsx";
import { EditorRawView } from "./EditorRawView";
import { FileViewer } from "@/features/folder/components/FileViewer.tsx";
import { RecordGraphView } from "@/features/record/components/RecordGraphView.tsx";

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

  function getPageStatus() {
    const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0];
    return {
      activePageTab: activeTab ? {
        id: activeTab.id,
        label: activeTab.label,
        closeable: Boolean(activeTab.closeable)
      } : null,
      openPageTabs: tabs.map((tab) => ({
        id: tab.id,
        label: tab.label,
        closeable: Boolean(tab.closeable)
      }))
    };
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
    window.dispatchEvent(new CustomEvent("research-agent:active-page", { detail: getPageStatus() }));
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
      if (
        id === "dataset-editor" ||
        id === "search-catalog-results" ||
        id === "agent-editor" ||
        id === "folder-provider-editor" ||
        id === "agent-provider-editor"
      ) {
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

  function openDatasetTab(editorPanel) {
    const tabId = "dataset-editor";

    if (tabs.find((t) => t.id === tabId)) {
      activateTab(tabId);
      return;
    }

    tabs.push({ id: tabId, label: "Dataset Sources", closeable: true });

    if (!panelMap[tabId]) {
      editorPanel.hidden = true;
      viewport.appendChild(editorPanel);
      panelMap[tabId] = editorPanel;
    }

    activateTab(tabId);
  }

  function openLayerSourcesTab(layerSourcesPanel) {
    const tabId = "layer-sources";

    if (tabs.find((t) => t.id === tabId)) {
      activateTab(tabId);
      return;
    }

    tabs.push({ id: tabId, label: "Map Setup", closeable: true });
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

  function openRecordGraphTab(record, options = {}) {
    const tabId = `record-graph-${record.id}`;

    if (tabs.find((t) => t.id === tabId)) {
      activateTab(tabId);
      return;
    }

    tabs.push({ id: tabId, label: `${record.title || record.kind || "Record"} Graph`, closeable: true });

    const panel = document.createElement("div");
    panel.className = "editor-record-graph-panel";
    panel.hidden = true;
    createRoot(panel).render(createElement(RecordGraphView, { record, ...options }));
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

  function openAgentTab(agentsPanel) {
    const tabId = "agent-editor";

    if (tabs.find((t) => t.id === tabId)) {
      activateTab(tabId);
      return;
    }

    tabs.push({ id: tabId, label: "Agent", closeable: true });

    if (!panelMap[tabId]) {
      agentsPanel.hidden = true;
      viewport.appendChild(agentsPanel);
      panelMap[tabId] = agentsPanel;
    }

    activateTab(tabId);
  }

  function openFolderProviderTab(providerPanel) {
    const tabId = "folder-provider-editor";

    if (tabs.find((t) => t.id === tabId)) {
      activateTab(tabId);
      return;
    }

    tabs.push({ id: tabId, label: "Folder Sources", closeable: true });

    if (!panelMap[tabId]) {
      providerPanel.hidden = true;
      viewport.appendChild(providerPanel);
      panelMap[tabId] = providerPanel;
    }

    activateTab(tabId);
  }

  function openAgentProviderTab(providerPanel) {
    const tabId = "agent-provider-editor";

    if (tabs.find((t) => t.id === tabId)) {
      activateTab(tabId);
      return;
    }

    tabs.push({ id: tabId, label: "Agent Sources", closeable: true });

    if (!panelMap[tabId]) {
      providerPanel.hidden = true;
      viewport.appendChild(providerPanel);
      panelMap[tabId] = providerPanel;
    }

    activateTab(tabId);
  }

  function openAddressSearchTab(searchSourcesPanel) {
    const tabId = "address-search-editor";

    if (tabs.find((t) => t.id === tabId)) {
      activateTab(tabId);
      return;
    }

    tabs.push({ id: tabId, label: "Address Sources", closeable: true });

    if (!panelMap[tabId]) {
      searchSourcesPanel.hidden = true;
      viewport.appendChild(searchSourcesPanel);
      panelMap[tabId] = searchSourcesPanel;
    }

    activateTab(tabId);
  }

  function openSearchCatalogResultsTab(resultsPanel) {
    const tabId = "search-catalog-results";

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

  function openSearchCatalogDatasetTab(item, detailPanel) {
    const tabId = `search-catalog-dataset-${item.id}`;

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

  function openFileViewerTab(entry) {
    const tabId = `file::${entry.key}`;

    if (tabs.find((t) => t.id === tabId)) {
      activateTab(tabId);
      return;
    }

    tabs.push({ id: tabId, label: entry.name, closeable: true });

    const panel = document.createElement("div");
    panel.className = "editor-file-panel";
    panel.hidden = true;
    createRoot(panel).render(createElement(FileViewer, { entry }));
    viewport.appendChild(panel);
    panelMap[tabId] = panel;

    activateTab(tabId);
  }

  function openEmptyPageTab(tabId, label) {
    if (tabs.find((t) => t.id === tabId)) {
      activateTab(tabId);
      return;
    }

    tabs.push({ id: tabId, label, closeable: true });

    const panel = createEmptyPagePanel();
    viewport.appendChild(panel);
    panelMap[tabId] = panel;

    activateTab(tabId);
  }

  function openRawJsonTab(tabId, label, value) {
    if (tabs.find((t) => t.id === tabId)) {
      activateTab(tabId);
      return;
    }

    tabs.push({ id: tabId, label, closeable: true });

    const panel = document.createElement("div");
    panel.className = "editor-raw-panel";
    panel.hidden = true;
    createRoot(panel).render(createElement(EditorRawView, { value }));
    viewport.appendChild(panel);
    panelMap[tabId] = panel;

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
        updateReportSection(editor, { heading, content, mode: "append" });
      },
      update(update) {
        updateReportSection(editor, update);
      },
      getContent() {
        return reportEditorToMarkdown(editor).trim();
      },
      getStatus() {
        return getReportStatus(editor);
      }
    };

    panel._reportController = reportController;

    activateTab(tabId);
    return reportController;
  }

  function updateReportSection(editor, { heading = "", content = "", mode = "", sectionIndex = null } = {}) {
    const cleanHeading = String(heading || "").trim();
    const cleanContent = String(content || "").trim();
    const resolvedMode = normalizeReportUpdateMode(mode, cleanHeading);

    if (!cleanHeading && !cleanContent) return;

    if (resolvedMode === "append" || !cleanHeading) {
      appendReportBlock(editor, cleanHeading, cleanContent);
      return;
    }

    const headingElement = findReportHeading(editor, cleanHeading, sectionIndex) || appendReportHeading(editor, cleanHeading);

    if (resolvedMode === "replace_section") {
      removeSectionBody(headingElement);
    }

    if (cleanContent) {
      insertSectionContent(headingElement, cleanContent);
    }

    editor.scrollTop = editor.scrollHeight;
  }

  function normalizeReportUpdateMode(mode, heading) {
    const value = String(mode || "").trim().toLowerCase().replace(/[-\s]+/g, "_");
    if (value === "append" || value === "append_to_section" || value === "replace_section") return value;
    return heading ? "replace_section" : "append";
  }

  function appendReportBlock(editor, heading, content) {
    if (heading) appendReportHeading(editor, heading);
    if (content) {
      const div = document.createElement("div");
      div.innerHTML = markdownToHtml(content);
      editor.appendChild(div);
    }
    editor.scrollTop = editor.scrollHeight;
  }

  function appendReportHeading(editor, heading) {
    const h = document.createElement("h2");
    h.textContent = heading;
    editor.appendChild(h);
    return h;
  }

  function findReportHeading(editor, heading, sectionIndex = null) {
    const headings = Array.from(editor.querySelectorAll("h1,h2,h3,h4,h5,h6"));
    if (Number.isInteger(sectionIndex) && headings[sectionIndex]) return headings[sectionIndex];
    return headings.find((item) => item.innerText.trim().toLowerCase() === heading.toLowerCase()) || null;
  }

  function removeSectionBody(heading) {
    const level = Number(heading.tagName.slice(1));
    let node = heading.nextElementSibling;
    while (node && !isSectionBoundary(node, level)) {
      const next = node.nextElementSibling;
      node.remove();
      node = next;
    }
  }

  function insertSectionContent(heading, content) {
    const level = Number(heading.tagName.slice(1));
    const div = document.createElement("div");
    div.innerHTML = markdownToHtml(content);

    let boundary = heading.nextElementSibling;
    while (boundary && !isSectionBoundary(boundary, level)) {
      boundary = boundary.nextElementSibling;
    }

    if (boundary) {
      heading.parentElement.insertBefore(div, boundary);
    } else {
      heading.parentElement.appendChild(div);
    }
  }

  function getReportStatus(editor) {
    const headings = Array.from(editor.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((heading, index) => {
      const level = Number(heading.tagName.slice(1));
      const title = heading.innerText.trim();
      const bodyParts = [];
      let node = heading.nextElementSibling;

      while (node && !isSectionBoundary(node, level)) {
        if (!/^H[1-6]$/.test(node.tagName)) {
          const text = reportNodeToMarkdown(node).trim();
          if (text) bodyParts.push(text);
        }
        node = node.nextElementSibling;
      }

      const bodyText = bodyParts.join("\n").trim();
      return {
        index,
        level,
        title,
        isEmpty: bodyText.length === 0,
        characterCount: bodyText.length,
        preview: bodyText.slice(0, 240)
      };
    });

    const titleCounts = headings.reduce((counts, heading) => {
      const key = heading.title.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});

    return {
      outline: headings.map((heading) => ({
        ...heading,
        isDuplicate: titleCounts[heading.title.toLowerCase()] > 1
      })),
      emptySections: headings.filter((heading) => heading.isEmpty).map((heading) => heading.title),
      duplicateSections: Object.entries(titleCounts)
        .filter(([, count]) => count > 1)
        .map(([title, count]) => ({ title, count }))
    };
  }

  function isSectionBoundary(node, level) {
    const match = node.tagName?.match(/^H([1-6])$/);
    return Boolean(match && Number(match[1]) <= level);
  }

  function reportEditorToMarkdown(editor) {
    return Array.from(editor.children)
      .map((node) => reportNodeToMarkdown(node).trim())
      .filter(Boolean)
      .join("\n\n");
  }

  function reportNodeToMarkdown(node) {
    if (!node) return "";
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const tag = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag.slice(1));
      return `${"#".repeat(level)} ${reportInlineMarkdown(node).trim()}`;
    }
    if (tag === "p") return reportInlineMarkdown(node).trim();
    if (tag === "div" || tag === "section" || tag === "article") {
      return Array.from(node.childNodes)
        .map((child) => reportNodeToMarkdown(child).trim())
        .filter(Boolean)
        .join("\n\n") || reportInlineMarkdown(node).trim();
    }
    if (tag === "ul" || tag === "ol") return reportListToMarkdown(node, tag === "ol");
    if (tag === "blockquote") {
      return reportNodeChildrenToMarkdown(node)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    }
    if (tag === "table") return reportTableToMarkdown(node);
    if (tag === "pre") return `\`\`\`\n${node.innerText.replace(/\n$/, "")}\n\`\`\``;
    if (tag === "hr") return "---";
    if (tag === "br") return "\n";
    return reportInlineMarkdown(node).trim();
  }

  function reportNodeChildrenToMarkdown(node) {
    return Array.from(node.childNodes)
      .map((child) => reportNodeToMarkdown(child).trim())
      .filter(Boolean)
      .join("\n\n");
  }

  function reportInlineMarkdown(node) {
    return Array.from(node.childNodes).map((child) => {
      if (child.nodeType === Node.TEXT_NODE) return child.textContent || "";
      if (child.nodeType !== Node.ELEMENT_NODE) return "";

      const tag = child.tagName.toLowerCase();
      const text = reportInlineMarkdown(child);
      if (tag === "strong" || tag === "b") return `**${text}**`;
      if (tag === "em" || tag === "i") return `*${text}*`;
      if (tag === "del" || tag === "s") return `~~${text}~~`;
      if (tag === "code") return `\`${child.innerText}\``;
      if (tag === "br") return "\n";
      if (tag === "a") {
        const href = child.getAttribute("href") || "";
        return href ? `[${text || href}](${href})` : text;
      }
      if (tag === "img") {
        const alt = child.getAttribute("alt") || "";
        const src = child.getAttribute("src") || "";
        return src ? `![${alt}](${src})` : "";
      }
      return reportNodeToMarkdown(child) || text;
    }).join("").replace(/[ \t]+\n/g, "\n");
  }

  function reportListToMarkdown(list, ordered) {
    return Array.from(list.children).map((item, index) => {
      const marker = ordered ? `${index + 1}.` : "-";
      const content = reportInlineMarkdown(item).trim();
      return `${marker} ${content}`;
    }).join("\n");
  }

  function reportTableToMarkdown(table) {
    const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
      Array.from(row.children).map((cell) => reportInlineMarkdown(cell).trim().replace(/\|/g, "\\|"))
    );
    if (!rows.length) return "";
    const width = Math.max(...rows.map((row) => row.length));
    const normalized = rows.map((row) => Array.from({ length: width }, (_, index) => row[index] || ""));
    const header = normalized[0];
    const body = normalized.slice(1);
    return [
      `| ${header.join(" | ")} |`,
      `| ${header.map(() => "---").join(" | ")} |`,
      ...body.map((row) => `| ${row.join(" | ")} |`)
    ].join("\n");
  }

  render();
  return { openTableTab, openPdfTab, openRecordGraphTab, openDatasetTab, openLayerSourcesTab, openSearchCatalogResultsTab, openSearchCatalogDatasetTab, openReportTab, openAgentTab, openFolderProviderTab, openAgentProviderTab, openAddressSearchTab, openEmptyPageTab, openRawJsonTab, openFileViewerTab, getPageStatus };
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
