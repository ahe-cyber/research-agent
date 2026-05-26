const FORMULAS = [
  {
    name: "tableToJson",
    description: "Convert an HTML table element into an array of row objects keyed by header text.",
    signature: "tableToJson(table)",
    inputs: [
      {
        name: "table",
        type: "object",
        description: "A parsed HTML table element."
      }
    ],
    outputs: [
      {
        name: "rows",
        type: "array",
        description: "One object per data row. Keys are the header cell texts."
      }
    ],
    apply(tableElement) {
      if (!tableElement || tableElement.tag !== "table") return null;

      const rows = getTableRowElements(tableElement);
      if (rows.length === 0) return [];

      const headers = getCellTexts(rows[0]);
      return rows.slice(1).map((row) => {
        const cells = getCellTexts(row);
        const obj = {};
        headers.forEach((header, i) => {
          if (header) obj[header] = cells[i] ?? "";
        });
        return obj;
      });
    }
  },
  {
    name: "splitBBL",
    description: "Split a NYC BBL into borough, block, and lot parts.",
    signature: "splitBBL(value)",
    inputs: [
      {
        name: "value",
        type: "string | number",
        description: "A 10-digit NYC BBL value. Shorter values are left-padded with zeroes."
      }
    ],
    outputs: [
      {
        name: "boro",
        type: "string",
        description: "The 1-digit borough code."
      },
      {
        name: "block",
        type: "string",
        description: "The 5-digit tax block."
      },
      {
        name: "lot",
        type: "string",
        description: "The 4-digit tax lot."
      }
    ],
    apply(value) {
      const bbl = String(value ?? "").padStart(10, "0");

      return {
        boro: bbl.slice(0, 1),
        block: bbl.slice(1, 6),
        lot: bbl.slice(6, 10)
      };
    }
  }
];

export function FormulasTab({ active }) {
  return (
    <section className={`workspace-tab${active ? " is-active" : ""}`} id="formulasTab" data-tab-panel hidden={!active}>
      <h2 className="section-title">Formulas</h2>
      <div className="formula-list" id="formulaList" />
    </section>
  );
}

export function createFormulaController() {
  const formulaList = document.getElementById("formulaList");
  const formulas = Object.fromEntries(FORMULAS.map((formula) => [formula.name, formula]));

  render();

  function render() {
    formulaList.replaceChildren();

    FORMULAS.forEach((formula) => {
      const item = document.createElement("details");
      const summary = document.createElement("summary");
      const text = document.createElement("div");
      const title = document.createElement("strong");
      const signature = document.createElement("code");
      const description = document.createElement("span");
      const body = document.createElement("div");

      item.className = "formula-item";
      summary.className = "formula-summary";
      body.className = "formula-body";
      title.textContent = formula.name;
      signature.textContent = formula.signature;
      description.textContent = formula.description;
      text.append(title, signature, description);
      summary.appendChild(text);
      body.append(createFormulaTable("Inputs", formula.inputs), createFormulaTable("Outputs", formula.outputs));
      item.append(summary, body);
      formulaList.appendChild(item);
    });
  }

  function applyFormula(name, value) {
    return formulas[name] ? formulas[name].apply(value) : undefined;
  }

  function hasFormula(name) {
    return Boolean(formulas[name]);
  }

  return { applyFormula, hasFormula };
}

function createFormulaTable(title, rows) {
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  const table = document.createElement("table");
  const body = document.createElement("tbody");

  section.className = "formula-detail-section";
  heading.textContent = title;

  rows.forEach((row) => {
    const tableRow = document.createElement("tr");
    const nameCell = document.createElement("td");
    const typeCell = document.createElement("td");
    const descriptionCell = document.createElement("td");

    nameCell.textContent = row.name;
    typeCell.textContent = row.type;
    descriptionCell.textContent = row.description;
    tableRow.append(nameCell, typeCell, descriptionCell);
    body.appendChild(tableRow);
  });

  table.appendChild(body);
  section.append(heading, table);
  return section;
}

function getTableRowElements(tableElement) {
  const rows = [];
  for (const child of (tableElement.children || [])) {
    if (child.tag === "tr") {
      rows.push(child);
    } else if (child.tag === "thead" || child.tag === "tbody" || child.tag === "tfoot") {
      for (const grandchild of (child.children || [])) {
        if (grandchild.tag === "tr") rows.push(grandchild);
      }
    }
  }
  return rows;
}

function getCellTexts(trElement) {
  return (trElement.children || [])
    .filter((c) => c.tag === "td" || c.tag === "th")
    .map(getDeepText);
}

function getDeepText(element) {
  if (!element || typeof element !== "object") return String(element ?? "");
  const parts = [];
  if (element.text) parts.push(element.text);
  for (const child of (element.children || [])) {
    const t = getDeepText(child);
    if (t) parts.push(t);
  }
  return parts.join(" ").trim();
}
