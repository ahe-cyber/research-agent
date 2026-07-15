import { markdownToHtml } from "../../../lib/markdown";
import { withBasePath } from "../../../lib/basePath";
import { createRoot } from "react-dom/client";
import { PageMenu } from "../editor/PageMenu";

function PostmanPageMenu({ status, onRefresh }) {
  return (
    <PageMenu
      left={
        <>
          <button
            className="section-tool-button"
            type="button"
            aria-label="Refresh collections"
            title="Refresh collections"
            onClick={onRefresh}
          >
            Refresh
          </button>
          <span className="postman-status">{status}</span>
        </>
      }
    />
  );
}

export function createPostmanController(editorTabController) {
  const postmanButton = document.getElementById("postmanCollectionsButton");

  // Build the panel — reuses editor-sources-panel layout
  const panel = document.createElement("div");
  panel.className = "editor-sources-panel";

  const pageMenu = document.createElement("div");
  const pageMenuRoot = createRoot(pageMenu);
  let statusMessage = "";

  const collectionList = document.createElement("div");
  collectionList.id = "postmanCollectionList";

  panel.append(pageMenu, collectionList);

  // Open tab + load on button click
  postmanButton.addEventListener("click", () => {
    editorTabController.openPostmanTab(panel);
    if (collectionList.childElementCount === 0) {
      loadCollections();
    }
  });

  // Tracks which collection UIDs the user has opened — persists across refreshes
  const openCollectionUids = new Set();

  renderPageMenu();

  // ── Data loading ─────────────────────────────────────────────────────────

  async function loadCollections() {
    collectionList.replaceChildren();
    setStatus("Loading…");

    try {
      const response = await fetch(withBasePath("/api/postman/collections"));
      const data = await parseJsonResponse(response);
      setStatus("");
      renderCollections(data.collections || []);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
      console.error("[Postman] Failed to load collections", error);
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  function renderCollections(collections) {
    if (collections.length === 0) {
      const empty = document.createElement("div");
      empty.className = "postman-empty";
      empty.textContent = "No collections found in this workspace.";
      collectionList.appendChild(empty);
      return;
    }

    collections.forEach((col) => {
      collectionList.appendChild(createCollectionCard(col));
    });
  }

  function createCollectionCard(col) {
    const card = document.createElement("details");
    card.className = "postman-collection-card";

    // Restore open state from before the refresh
    const wasOpen = openCollectionUids.has(col.uid);
    card.open = wasOpen;

    // ── Summary ──
    const summary = document.createElement("summary");
    summary.className = "postman-collection-summary";

    const summaryContent = document.createElement("div");
    summaryContent.className = "postman-collection-summary-content";

    const text = document.createElement("div");
    text.className = "postman-collection-text";

    const title = document.createElement("strong");
    title.textContent = col.name;

    const meta = document.createElement("span");
    if (col.updatedAt) {
      meta.textContent = `Updated ${new Date(col.updatedAt).toLocaleDateString()}`;
    } else {
      meta.textContent = col.uid || "";
    }

    text.append(title, meta);
    summaryContent.appendChild(text);
    summary.appendChild(summaryContent);

    // ── Body (loaded lazily on first open, re-fetched if already open on refresh) ──
    const body = document.createElement("div");
    body.className = "postman-collection-body";

    let loaded = false;
    let loading = false;

    async function loadDetail() {
      if (loaded || loading) return;
      loading = true;

      const loadingEl = document.createElement("div");
      loadingEl.className = "postman-loading";
      loadingEl.textContent = "Loading collection…";
      body.appendChild(loadingEl);

      try {
        const response = await fetch(withBasePath(`/api/postman/collections/${col.uid}`));
        const data = await parseJsonResponse(response);
        loadingEl.remove();
        renderCollectionDetail(body, data.collection);
        loaded = true;
      } catch (error) {
        loadingEl.textContent = `Failed to load: ${error.message}`;
        console.error("[Postman] Failed to load collection", col.uid, error);
      }

      loading = false;
    }

    card.addEventListener("toggle", () => {
      if (card.open) {
        openCollectionUids.add(col.uid);
        loadDetail();
      } else {
        openCollectionUids.delete(col.uid);
      }
    });

    // If the card is being restored open after a refresh, immediately load detail
    if (wasOpen) {
      loadDetail();
    }

    card.append(summary, body);
    return card;
  }

  function renderCollectionDetail(body, collection) {
    if (!collection) return;

    const info = collection.info || {};
    const items = collection.item || [];
    const variables = collection.variable || [];

    // Description
    if (info.description) {
      const section = createSection("Description");
      section.appendChild(renderMarkdown(info.description));
      body.appendChild(section);
    }

    // Requests / items
    if (items.length > 0) {
      const section = createSection(`Requests (${items.length})`);
      items.forEach((item) => {
        section.appendChild(createItemCard(item));
      });
      body.appendChild(section);
    }

    // Variables
    if (variables.length > 0) {
      const section = createSection("Variables");
      const table = document.createElement("table");
      table.className = "postman-vars-table";
      const tbody = document.createElement("tbody");

      variables.forEach((v) => {
        const row = document.createElement("tr");
        const keyCell = document.createElement("td");
        const valCell = document.createElement("td");
        keyCell.textContent = v.key || "";
        valCell.textContent = v.value || "";
        row.append(keyCell, valCell);
        tbody.appendChild(row);
      });

      table.appendChild(tbody);
      section.appendChild(table);
      body.appendChild(section);
    }

    if (!info.description && items.length === 0 && variables.length === 0) {
      const empty = document.createElement("p");
      empty.className = "postman-description";
      empty.textContent = "No details available for this collection.";
      body.appendChild(empty);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function createSection(title) {
    const section = document.createElement("div");
    section.className = "postman-section";
    const heading = document.createElement("h3");
    heading.className = "subsection-title";
    heading.textContent = title;
    section.appendChild(heading);
    return section;
  }

  function createItemCard(item) {
    const card = document.createElement("div");
    card.className = "postman-item-card";

    const name = document.createElement("strong");
    name.className = "postman-item-name";
    name.textContent = item.name || "Unnamed request";
    card.appendChild(name);

    const request = item.request;

    if (request) {
      const method = typeof request.method === "string" ? request.method : "GET";
      const rawUrl = typeof request.url === "string" ? request.url : (request.url?.raw || "");
      const description = typeof request.description === "string" ? request.description : "";

      if (rawUrl) {
        const meta = document.createElement("span");
        meta.className = "postman-item-meta";
        meta.textContent = `${method}  ${rawUrl}`;
        card.appendChild(meta);
      }

      if (description) {
        card.appendChild(renderMarkdown(description));
      }
    }

    return card;
  }

  function setStatus(message) {
    statusMessage = message;
    renderPageMenu();
  }

  function renderPageMenu() {
    pageMenuRoot.render(<PostmanPageMenu status={statusMessage} onRefresh={loadCollections} />);
  }
}

// ── Markdown renderer ─────────────────────────────────────────────────────

function renderMarkdown(text) {
  const el = document.createElement("div");
  el.className = "postman-markdown";
  el.innerHTML = markdownToHtml(text);
  return el;
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("Server returned a non-JSON response — restart the dev server and try again");
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}
