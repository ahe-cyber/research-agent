import DxfParser from "dxf-parser";
import type { IEntity, IDxf } from "dxf-parser";
import type { DxfParseResult } from "../../folder.schema";

// Client
export async function parseDxf(file: File): Promise<DxfParseResult> {
  const text = await file.text();
  const parser = new DxfParser();
  const dxf: IDxf = parser.parseSync(text);

  const layers = Object.keys(dxf.tables?.layer?.layers ?? {});

  const entityCounts: Record<string, number> = {};
  for (const entity of dxf.entities ?? []) {
    entityCounts[entity.type] = (entityCounts[entity.type] ?? 0) + 1;
  }

  const textContent = extractText(dxf.entities ?? []);

  return {
    type: "dxf",
    fileName: file.name,
    layers,
    entityCounts,
    textContent,
    blockCount: Object.keys(dxf.blocks ?? {}).length,
  };
}

function extractText(entities: IEntity[]): string[] {
  const texts: string[] = [];
  for (const entity of entities) {
    const e = entity as unknown as Record<string, unknown>;
    if (
      (entity.type === "TEXT" || entity.type === "MTEXT") &&
      typeof e.text === "string" &&
      e.text.trim()
    ) {
      texts.push(e.text.trim());
    }
  }
  return texts;
}
