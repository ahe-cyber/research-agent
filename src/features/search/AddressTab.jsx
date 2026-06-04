import { createRoot } from "react-dom/client";
import { DomSlot } from "../editor/DomSlot";
import { PageMenu } from "../editor/PageMenu";

export function AddressTab({ active }) {
  return (
    <section className={`workspace-tab${active ? " is-active" : ""}`} id="addressTab" data-tab-panel hidden={!active}>
      <div className="section-title-row">
        <h2 className="section-title">Address</h2>
        <div id="searchSourceSelector" />
      </div>
      <div id="placeSearchBox" />
      <div className="address-list" id="addressList" />
    </section>
  );
}

export function createAddressController({ onAddressClick } = {}) {
  const addressList = document.getElementById("addressList");
  const addresses = [];

  function add(searchResult) {
    const feature = searchResult.features && searchResult.features[0];
    const properties = feature && feature.properties ? feature.properties : {};
    const title = properties.full_address || properties.name || properties.address || "Selected place";
    const subtitle = properties.place_formatted || properties.context?.place?.name || "Search result";
    const address = { title, subtitle };

    addresses.unshift(address);
    render();
    return address;
  }

  function getCurrentAddress() {
    return addresses[0] || null;
  }

  function render() {
    addressList.replaceChildren();

    addresses.forEach((address) => {
      const item = document.createElement("article");
      item.className = `address-item${onAddressClick ? " is-clickable" : ""}`;

      if (onAddressClick) {
        item.addEventListener("click", () => onAddressClick(address));
      }

      const text = document.createElement("div");
      const title = document.createElement("strong");
      const subtitle = document.createElement("span");

      title.textContent = address.title;
      subtitle.textContent = address.subtitle;
      text.append(title, subtitle);
      item.appendChild(text);
      addressList.appendChild(item);
    });
  }

  render();

  return { add, getCurrentAddress };
}

export function createSearchSourceEditorPanel(onSaved) {
  const panel = document.createElement("div");
  panel.className = "editor-sources-panel search-sources-editor-panel";

  let sources = [];
  let saveTimer = null;
  let sourceIdToOpen = "";

  const addBtn = document.createElement("button");
  addBtn.className = "section-tool-button add-source-button";
  addBtn.type = "button";
  addBtn.setAttribute("aria-label", "Add search source");
  addBtn.title = "Add search source";

  const statusEl = document.createElement("span");
  statusEl.className = "search-sources-save-status";

  const pageMenu = document.createElement("div");
  createRoot(pageMenu).render(<PageMenu left={<DomSlot nodes={[addBtn, statusEl]} />} />);

  const list = document.createElement("div");
  list.className = "search-sources-list";

  panel.append(pageMenu, list);

  loadSources();

  async function loadSources() {
    try {
      const res = await fetch("/api/search?activity=address");
      if (res.ok) {
        const data = await res.json();
        sources = Array.isArray(data)
          ? data.map(s => ({ ...s, outputs: Array.isArray(s.outputs) ? s.outputs.map(o => ({ ...o })) : [] }))
          : [];
        render();
      }
    } catch {}
  }

  function render() {
    list.replaceChildren();
    sources.forEach((source, i) => list.appendChild(createCard(source, i)));
  }

  function createCard(source, i) {
    const card = document.createElement("details");
    card.className = "source-editor search-source-card";
    card.open = source.id === sourceIdToOpen;
    if (card.open) sourceIdToOpen = "";

    const summary = document.createElement("summary");
    summary.className = "source-editor-summary";

    const summaryContent = document.createElement("div");
    summaryContent.className = "source-editor-summary-content";

    const summaryMain = document.createElement("div");
    summaryMain.className = "source-editor-summary-main";

    const summaryText = document.createElement("div");
    summaryText.className = "source-editor-summary-text";

    const title = document.createElement("strong");
    title.textContent = source.label || "New source";

    const description = document.createElement("span");
    description.textContent = source.description || "New search source description";

    const summaryEdit = document.createElement("div");
    summaryEdit.className = "source-summary-edit";

    const titleInput = document.createElement("input");
    titleInput.className = "source-title-input";
    titleInput.type = "text";
    titleInput.value = source.label;
    titleInput.placeholder = "Source name";

    const descInput = document.createElement("textarea");
    descInput.className = "source-description-input";
    descInput.rows = 3;
    descInput.value = source.description || "";
    descInput.placeholder = "Description of this search source";

    [titleInput, descInput].forEach((input) => {
      input.addEventListener("click", (event) => event.stopPropagation());
      input.addEventListener("keydown", (event) => {
        event.stopPropagation();

        if (event.key === " ") {
          event.preventDefault();
          insertTextAtCursor(input, " ");
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
      input.addEventListener("keyup", (event) => {
        event.stopPropagation();

        if (event.key === " ") event.preventDefault();
      });
      input.addEventListener("input", () => {
        source.label = titleInput.value;
        source.description = descInput.value;
        title.textContent = source.label.trim() || "New source";
        description.textContent = source.description.trim() || "New search source description";
        scheduleSave();
      });
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "circle-icon-button delete-source-button source-editor-delete-button";
    deleteBtn.type = "button";
    deleteBtn.setAttribute("aria-label", "Delete source");
    deleteBtn.title = "Delete source";
    deleteBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      sources.splice(i, 1);
      render();
      scheduleSave();
    });

    const sideButtons = document.createElement("div");
    sideButtons.className = "source-editor-side-buttons";
    sideButtons.appendChild(deleteBtn);

    const closeBtn = document.createElement("button");
    closeBtn.className = "circle-icon-button source-editor-close-button";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      card.open = false;
    });

    summary.addEventListener("click", (event) => {
      if (card.open) event.preventDefault();
    });

    summaryText.append(title, description);
    summaryEdit.append(titleInput, descInput);
    summaryMain.append(sideButtons, summaryText, summaryEdit, closeBtn);
    summaryContent.appendChild(summaryMain);
    summary.appendChild(summaryContent);

    const body = document.createElement("div");
    body.className = "source-editor-body";

    const typeRow = document.createElement("div");
    typeRow.className = "search-source-type-row";

    const typeSelect = document.createElement("select");
    typeSelect.className = "search-source-row-select";
    [["geosearch", "NYC GeoSearch"], ["mapbox", "Mapbox"], ["google", "Google Places"]].forEach(([value, label]) => {
      const opt = document.createElement("option");
      opt.value = value; opt.textContent = label; opt.selected = value === source.type;
      typeSelect.appendChild(opt);
    });
    typeSelect.addEventListener("change", () => { source.type = typeSelect.value; scheduleSave(); });

    const costlyLabel = document.createElement("label");
    costlyLabel.className = "search-source-row-costly";
    const costlyCheck = document.createElement("input");
    costlyCheck.type = "checkbox";
    costlyCheck.checked = !!source.costly;
    costlyCheck.addEventListener("change", () => { source.costly = costlyCheck.checked; scheduleSave(); });
    costlyLabel.append(costlyCheck, " Costly");

    typeRow.append(typeSelect, costlyLabel);

    const outputHeading = document.createElement("h3");
    outputHeading.className = "subsection-title";
    outputHeading.textContent = "Output Settings";

    const gridHeading = document.createElement("div");
    gridHeading.className = "source-grid source-grid-heading";
    const varSpan = document.createElement("span"); varSpan.textContent = "Variable";
    const pathSpan = document.createElement("span"); pathSpan.textContent = "Path";
    gridHeading.append(varSpan, pathSpan, document.createElement("span"));

    const gridRows = document.createElement("div");
    gridRows.className = "source-grid";

    const variableFooter = createOutputVariableFooter(source);
    const onOutputChange = () => {
      updateOutputVariableFooter(variableFooter, source);
      scheduleSave();
    };

    source.outputs.forEach(outputObj => appendOutputRow(gridRows, outputObj, source, onOutputChange));

    const addOutputBtn = document.createElement("button");
    addOutputBtn.className = "record-action";
    addOutputBtn.type = "button";
    addOutputBtn.textContent = "Add output";
    addOutputBtn.addEventListener("click", () => {
      const outputObj = { variable: "", path: "" };
      source.outputs.push(outputObj);
      appendOutputRow(gridRows, outputObj, source, onOutputChange);
      onOutputChange();
    });

    summaryContent.appendChild(variableFooter);
    body.append(typeRow, outputHeading, gridHeading, gridRows, addOutputBtn);
    card.append(summary, body);
    return card;
  }

  function createOutputVariableFooter(source) {
    const footer = document.createElement("div");
    footer.className = "source-variable-footer search-source-variable-footer";
    updateOutputVariableFooter(footer, source);
    return footer;
  }

  function updateOutputVariableFooter(footer, source) {
    const outputList = document.createElement("div");
    outputList.className = "source-variable-list";

    const heading = document.createElement("strong");
    heading.textContent = "Outputs";

    const table = document.createElement("table");
    source.outputs.map((output) => output.variable).filter(Boolean).forEach((variable) => {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.textContent = variable;
      row.appendChild(cell);
      table.appendChild(row);
    });

    outputList.append(heading, table);
    footer.replaceChildren(outputList);
  }

  function appendOutputRow(gridRows, outputObj, source, onChange) {
    const varInput = document.createElement("input");
    const pathInput = document.createElement("input");
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "row-delete-button";
    deleteBtn.type = "button";
    deleteBtn.setAttribute("aria-label", "Remove row");

    varInput.type = "text"; varInput.value = outputObj.variable;
    pathInput.type = "text"; pathInput.value = outputObj.path;

    varInput.addEventListener("input", () => { outputObj.variable = varInput.value; onChange(); });
    pathInput.addEventListener("input", () => { outputObj.path = pathInput.value; onChange(); });
    deleteBtn.addEventListener("click", () => {
      const idx = source.outputs.indexOf(outputObj);
      if (idx !== -1) source.outputs.splice(idx, 1);
      varInput.remove(); pathInput.remove(); deleteBtn.remove();
      onChange();
    });

    gridRows.append(varInput, pathInput, deleteBtn);
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 600);
  }

  async function save() {
    try {
      const res = await fetch("/api/search?activity=address", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sources)
      });
      if (res.ok) {
        statusEl.textContent = "Saved";
        statusEl.classList.add("is-saved");
        setTimeout(() => { statusEl.textContent = ""; statusEl.classList.remove("is-saved"); }, 2000);
        onSaved?.();
      }
    } catch {}
  }

  addBtn.addEventListener("click", () => {
    const source = { id: `src-${Date.now()}`, label: "New source", type: "geosearch", costly: false, description: "", outputs: [] };
    sources.push(source);
    sourceIdToOpen = source.id;
    render();
    list.querySelectorAll(".source-editor").item(sources.length - 1)?.querySelector(".source-title-input")?.focus();
    scheduleSave();
  });

  return { panel };
}

function insertTextAtCursor(input, text) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.setRangeText(text, start, end, "end");
}
