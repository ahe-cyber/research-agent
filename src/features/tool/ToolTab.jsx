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

function normalizeToolDeclarations(declarations) {
  return declarations.map(({ name, description, parameters }) => {
    const props = parameters?.properties ?? {};
    const required = parameters?.required ?? [];
    const params = Object.entries(props).map(([pname, pdef]) => ({
      name: pname,
      type: (pdef.type ?? "string").toLowerCase(),
      required: required.includes(pname),
      description: pdef.description ?? ""
    }));
    return { name, description, params };
  });
}

export function ToolTab({ active }) {
  return (
    <section className={`workspace-tab${active ? " is-active" : ""}`} id="toolTab" data-tab-panel hidden={!active}>
      <h2 className="section-title">Tool</h2>
      <div className="formula-list" id="formulaList" />
    </section>
  );
}

export function createToolController(getAgentController = () => null) {
  const formulaList = document.getElementById("formulaList");
  const formulas = Object.fromEntries(FORMULAS.map((formula) => [formula.name, formula]));

  let tools = [];

  (async () => {
    try {
      const res = await fetch("/api/tool");
      if (res.ok) tools = normalizeToolDeclarations(await res.json());
    } catch { /* keep empty */ }
    render();
  })();

  function render() {
    formulaList.replaceChildren();

    tools.forEach((tool) => {
      const item = document.createElement("article");
      item.className = "formula-item tool-card";

      const attachBtn = document.createElement("button");
      attachBtn.className = "card-attach-button";
      attachBtn.type = "button";
      attachBtn.setAttribute("aria-label", `Suggest ${tool.name} to agent`);
      attachBtn.title = `Suggest ${tool.name} to agent`;
      attachBtn.addEventListener("click", () => getAgentController()?.suggestTool(tool.name));
      item.appendChild(attachBtn);

      const sig = document.createElement("div");
      sig.className = "tool-signature";

      const nameEl = document.createElement("code");
      nameEl.className = "tool-name";
      nameEl.textContent = tool.name;
      sig.appendChild(nameEl);

      if (tool.params.length > 0) {
        const open = document.createElement("span");
        open.className = "tool-paren";
        open.textContent = "(";
        sig.appendChild(open);

        tool.params.forEach((param, i) => {
          const paramEl = document.createElement("span");
          paramEl.className = "tool-param";
          paramEl.textContent = param.required ? param.name : `${param.name}?`;
          paramEl.title = `${param.type} — ${param.description}`;
          sig.appendChild(paramEl);

          if (i < tool.params.length - 1) {
            const sep = document.createElement("span");
            sep.className = "tool-paren";
            sep.textContent = ", ";
            sig.appendChild(sep);
          }
        });

        const close = document.createElement("span");
        close.className = "tool-paren";
        close.textContent = ")";
        sig.appendChild(close);
      } else {
        const parens = document.createElement("span");
        parens.className = "tool-paren";
        parens.textContent = "()";
        sig.appendChild(parens);
      }

      const desc = document.createElement("p");
      desc.className = "tool-card-description";
      desc.textContent = tool.description;

      item.append(sig, desc);
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
