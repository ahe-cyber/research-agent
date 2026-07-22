import {
  IFCBEAM,
  IFCBUILDINGSTOREY,
  IFCCOLUMN,
  IFCDOOR,
  IFCFURNISHINGELEMENT,
  IFCPROJECT,
  IFCROOF,
  IFCSLAB,
  IFCSPACE,
  IFCSTAIR,
  IFCWALL,
  IFCWINDOW,
} from "web-ifc";
import type { IfcParseResult } from "../../folder.schema";

const ELEMENT_TYPES: [string, number][] = [
  ["Wall", IFCWALL],
  ["Slab", IFCSLAB],
  ["Column", IFCCOLUMN],
  ["Beam", IFCBEAM],
  ["Door", IFCDOOR],
  ["Window", IFCWINDOW],
  ["Stair", IFCSTAIR],
  ["Roof", IFCROOF],
  ["Furnishing", IFCFURNISHINGELEMENT],
];

let ifcApiPromise: Promise<import("web-ifc").IfcAPI> | null = null;

async function getIfcApi() {
  if (!ifcApiPromise) {
    ifcApiPromise = (async () => {
      const { IfcAPI } = await import("web-ifc");
      const api = new IfcAPI();
      api.SetWasmPath("/", true);
      await api.Init();
      return api;
    })();
  }
  return ifcApiPromise;
}

// Client
export async function parseIfc(file: File): Promise<IfcParseResult> {
  const api = await getIfcApi();
  const buffer = await file.arrayBuffer();
  const modelID = api.OpenModel(new Uint8Array(buffer));

  try {
    const schema = readSchema(await file.text());
    const projectName = readProjectName(api, modelID);
    const elementCounts = readElementCounts(api, modelID);
    const storeys = readNames(api, modelID, IFCBUILDINGSTOREY);
    const spaces = readNames(api, modelID, IFCSPACE);

    return {
      type: "ifc",
      fileName: file.name,
      schema,
      projectName,
      elementCounts,
      storeys,
      spaces,
    };
  } finally {
    api.CloseModel(modelID);
  }
}

function readSchema(rawText: string): string {
  const m = rawText.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/);
  return m?.[1] ?? "Unknown";
}

function readProjectName(api: import("web-ifc").IfcAPI, modelID: number): string {
  try {
    const ids = api.GetLineIDsWithType(modelID, IFCPROJECT);
    if (ids.size() === 0) return "";
    const line = api.GetLine(modelID, ids.get(0));
    return line?.Name?.value ?? line?.LongName?.value ?? "";
  } catch {
    return "";
  }
}

function readElementCounts(
  api: import("web-ifc").IfcAPI,
  modelID: number
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [label, typeCode] of ELEMENT_TYPES) {
    try {
      const ids = api.GetLineIDsWithType(modelID, typeCode);
      if (ids.size() > 0) counts[label] = ids.size();
    } catch {
      // type not present in this model
    }
  }
  return counts;
}

function readNames(
  api: import("web-ifc").IfcAPI,
  modelID: number,
  typeCode: number
): string[] {
  const names: string[] = [];
  try {
    const ids = api.GetLineIDsWithType(modelID, typeCode);
    for (let i = 0; i < ids.size(); i++) {
      const line = api.GetLine(modelID, ids.get(i));
      const name =
        line?.LongName?.value ??
        line?.Name?.value ??
        null;
      if (name) names.push(name);
    }
  } catch {
    // ignore
  }
  return names;
}
