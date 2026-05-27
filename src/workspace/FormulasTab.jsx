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
    apply(args) {
      const [tableElement] = args;
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
    apply(args) {
      const [value] = args;
      const bbl = String(value ?? "").padStart(10, "0");

      return {
        boro: bbl.slice(0, 1),
        block: bbl.slice(1, 6),
        lot: bbl.slice(6, 10)
      };
    }
  },
  {
    name: "concatString",
    description: "Build an array of strings by concatenating fixed strings with one or more arrays. With multiple same-length arrays, defaults to cartesian product; set the last argument to 1 to zip element-wise instead. Different-length arrays always use cartesian product.",
    signature: "concatString(part1, part2, ..., [zipOrProduct])",
    inputs: [
      {
        name: "parts",
        type: "string | array, ...",
        description: "Any mix of string literals and arrays. String literals are appended as-is; arrays generate multiple output strings."
      },
      {
        name: "zipOrProduct",
        type: "number (optional)",
        description: "0 (default) = cartesian product, 1 = zip (element-wise, same-length arrays only)."
      }
    ],
    outputs: [
      {
        name: "result",
        type: "string | array",
        description: "A single string when no arrays are given, otherwise an array of concatenated strings."
      }
    ],
    apply(args) {
      let parts = args;
      let zipFlag = 0;

      const lastArg = args[args.length - 1];
      if (args.length > 0 && typeof lastArg === "number" && (lastArg === 0 || lastArg === 1)) {
        zipFlag = lastArg;
        parts = args.slice(0, -1);
      }

      const arrays = parts.filter((p) => Array.isArray(p));

      if (arrays.length === 0) {
        return parts.map((p) => String(p ?? "")).join("");
      }

      const allSameSize = arrays.every((a) => a.length === arrays[0].length);
      const useZip = allSameSize && zipFlag === 1;

      if (useZip) {
        const length = arrays[0].length;
        return Array.from({ length }, (_, i) =>
          parts.map((p) => (Array.isArray(p) ? String(p[i] ?? "") : String(p ?? ""))).join("")
        );
      }

      const arrayLengths = arrays.map((a) => a.length);
      const totalCombinations = arrayLengths.reduce((a, b) => a * b, 1);

      return Array.from({ length: totalCombinations }, (_, comboIdx) => {
        const arrayIndices = [];
        let remaining = comboIdx;
        for (let i = arrayLengths.length - 1; i >= 0; i--) {
          arrayIndices[i] = remaining % arrayLengths[i];
          remaining = Math.floor(remaining / arrayLengths[i]);
        }

        let arrayIdx = 0;
        return parts.map((p) => {
          if (Array.isArray(p)) return String(p[arrayIndices[arrayIdx++]] ?? "");
          return String(p ?? "");
        }).join("");
      });
    }
  },
  {
    name: "appendField",
    description: "Return a copy of an array of objects with a new field added to each item from a corresponding values array.",
    signature: "appendField(array, fieldName, values)",
    inputs: [
      {
        name: "array",
        type: "array",
        description: "Array of objects to extend."
      },
      {
        name: "fieldName",
        type: "string",
        description: "Name of the new field to add to each object."
      },
      {
        name: "values",
        type: "array | any",
        description: "Array of values (one per item) or a single value applied to all items."
      }
    ],
    outputs: [
      {
        name: "result",
        type: "array",
        description: "New array where each object has the added field."
      }
    ],
    apply(args) {
      const [array, fieldName, values] = args;
      if (!Array.isArray(array) || typeof fieldName !== "string") return array;
      return array.map((item, i) => ({
        ...(item && typeof item === "object" ? item : {}),
        [fieldName]: Array.isArray(values) ? values[i] : values
      }));
    }
  },
  {
    name: "arrayToObject",
    description: "Convert an array of objects into a single object keyed by a chosen field's value.",
    signature: "arrayToObject(array, keyField)",
    inputs: [
      {
        name: "array",
        type: "array",
        description: "Array of objects to index."
      },
      {
        name: "keyField",
        type: "string",
        description: "The field whose value becomes the key in the resulting object."
      }
    ],
    outputs: [
      {
        name: "result",
        type: "object",
        description: "Object where each key is the value of keyField from the corresponding item."
      }
    ],
    apply(args) {
      const [array, keyField] = args;
      if (!Array.isArray(array) || typeof keyField !== "string") return {};
      const result = {};
      array.forEach((item) => {
        if (item && typeof item === "object") {
          const key = String(item[keyField] ?? "");
          result[key] = item;
        }
      });
      return result;
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

  function applyFormula(name, args) {
    return formulas[name] ? formulas[name].apply(Array.isArray(args) ? args : [args]) : undefined;
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
