import type { PdfParseResult } from "./parsers/pdf";
import type { DxfParseResult } from "./parsers/dxf";
import type { IfcParseResult } from "./parsers/ifc";
import { getProviderFile } from "./providers";
import type { FileEntry, MountedFolder } from "./providers";
import type { SupportedExtension } from "./supportedExtensions";

export type ParseResult = PdfParseResult | DxfParseResult | IfcParseResult;

export type { FileEntry, MountedFolder } from "./providers";
export type { SupportedExtension } from "./supportedExtensions";

export async function parseFile(entry: FileEntry): Promise<ParseResult> {
  const file = await getProviderFile(entry);
  switch (entry.ext) {
    case "pdf": {
      const { parsePdf } = await import("./parsers/pdf");
      return parsePdf(file);
    }
    case "dxf": {
      const { parseDxf } = await import("./parsers/dxf");
      return parseDxf(file);
    }
    case "ifc": {
      const { parseIfc } = await import("./parsers/ifc");
      return parseIfc(file);
    }
  }
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
