import type { PdfParseResult } from "./parsers/pdf";
import type { DxfParseResult } from "./parsers/dxf";
import type { IfcParseResult } from "./parsers/ifc";

export type ParseResult = PdfParseResult | DxfParseResult | IfcParseResult;

export type SupportedExtension = "pdf" | "dxf" | "ifc";

const SUPPORTED: Record<string, SupportedExtension> = {
  pdf: "pdf",
  dxf: "dxf",
  ifc: "ifc",
};

export interface FileEntry {
  key: string;
  name: string;
  path: string;
  ext: SupportedExtension;
  size: number;
  handle: FileSystemFileHandle;
}

export interface MountedFolder {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
  files: FileEntry[];
}

export function isFolderMountSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function mountFolder(): Promise<MountedFolder | null> {
  try {
    const handle = await (window as any).showDirectoryPicker({ mode: "read" });
    const files = await scanDirectory(handle, handle.name);
    return {
      id: crypto.randomUUID(),
      name: handle.name,
      handle,
      files,
    };
  } catch (err) {
    if ((err as Error).name === "AbortError") return null;
    throw err;
  }
}

async function scanDirectory(
  dir: FileSystemDirectoryHandle,
  basePath: string,
  depth = 0
): Promise<FileEntry[]> {
  if (depth > 5) return [];
  const entries: FileEntry[] = [];

  for await (const [name, handle] of (dir as any).entries()) {
    if (handle.kind === "directory") {
      const nested = await scanDirectory(
        handle as FileSystemDirectoryHandle,
        `${basePath}/${name}`,
        depth + 1
      );
      entries.push(...nested);
    } else if (handle.kind === "file") {
      const ext = name.split(".").pop()?.toLowerCase() ?? "";
      if (ext in SUPPORTED) {
        const file = await (handle as FileSystemFileHandle).getFile();
        entries.push({
          key: `${basePath}/${name}`,
          name,
          path: `${basePath}/${name}`,
          ext: SUPPORTED[ext],
          size: file.size,
          handle: handle as FileSystemFileHandle,
        });
      }
    }
  }

  return entries;
}

export async function parseFile(entry: FileEntry): Promise<ParseResult> {
  const file = await entry.handle.getFile();
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
