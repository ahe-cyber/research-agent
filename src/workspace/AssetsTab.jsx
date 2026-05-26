const ASSET_URL_PATTERN = /https?:\/\/[^\s"'<>]+?\.(?:pdf|png|jpg|jpeg|gif|webp)(?:\?[^\s"'<>]*)?/gi;

export function AssetsTab({ active }) {
  return (
    <section className={`workspace-tab${active ? " is-active" : ""}`} id="assetsTab" data-tab-panel hidden={!active}>
      <h2 className="section-title">Assets</h2>
      <div className="asset-list" id="assetList" />
    </section>
  );
}

export function createAssetController() {
  const assetList = document.getElementById("assetList");
  const assets = [];

  function render() {
    assetList.replaceChildren();

    if (assets.length === 0) {
      const empty = document.createElement("div");
      empty.className = "agent-message agent-message-system";
      empty.textContent = "Retrieved PDFs and images will appear here.";
      assetList.appendChild(empty);
      return;
    }

    assets.forEach((asset) => {
      const item = document.createElement("article");
      item.className = "asset-item";

      const text = document.createElement("div");
      text.innerHTML = `<strong>${escapeHtml(asset.type.toUpperCase())}</strong><span>${escapeHtml(asset.url)}</span>`;

      const link = document.createElement("a");
      link.className = "icon-link-button";
      link.href = asset.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Go";
      link.setAttribute("aria-label", "Open asset");

      item.append(text, link);
      assetList.appendChild(item);
    });
  }

  function addFromRecord(record) {
    addUrls(extractAssetUrls(record.payload), record.id);
  }

  function addFromValue(value, recordId) {
    addUrls(extractAssetUrls(value), recordId);
  }

  function addUrls(urls, recordId) {
    urls.forEach((url) => {
      addUrl(url, recordId);
    });

    render();
  }

  function addUrl(url, recordId) {
    if (assets.some((asset) => asset.url === url)) {
      return;
    }

    const extension = url.split("?")[0].split(".").pop().toLowerCase();
    assets.unshift({
      url,
      type: extension === "pdf" ? "pdf" : "image",
      recordId
    });
  }

  render();

  return { addFromRecord, addFromValue };
}

function extractAssetUrls(value) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value) || "";
  return serialized.match(ASSET_URL_PATTERN) || [];
}

export function hasAssetUrls(value) {
  return extractAssetUrls(value).length > 0;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
