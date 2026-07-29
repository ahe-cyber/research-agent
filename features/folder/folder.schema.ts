import { z } from "zod";
import type { EditorField } from "@/lib/editorSchema";

export const folderProviderIdSchema = z.enum(["browser-drive", "local-drive", "google-drive"]);
export const supportedFolderExtensionSchema = z.enum(["pdf", "dxf", "ifc"]);
const SUPPORTED_FOLDER_EXTENSIONS: Record<string, SupportedExtension> = {
  pdf: "pdf",
  dxf: "dxf",
  ifc: "ifc"
};

export type FolderProviderId = z.infer<typeof folderProviderIdSchema>;
export type SupportedExtension = z.infer<typeof supportedFolderExtensionSchema>;
export type FolderFileExtension = SupportedExtension | string;

export const folderItemEditorFields = [
  { key: "id", label: "ID", readonly: true },
  { key: "name", label: "Name" },
  { key: "providerId", label: "Provider" },
  { key: "path", label: "Path" },
  { key: "description", label: "Description", multiline: true }
] satisfies readonly EditorField[];

export const folderSearchSourceEditorFields = [
  { key: "id", label: "ID", readonly: true },
  { key: "name", label: "Name" },
  { key: "description", label: "Description", multiline: true },
  { key: "costly", label: "Costly" }
] satisfies readonly EditorField[];

export interface FileEntry {
  key: string;
  name: string;
  path: string;
  ext: FolderFileExtension;
  size: number;
  providerId: FolderProviderId;
  source: unknown;
}

export interface MountedFolder {
  id: string;
  name: string;
  providerId: FolderProviderId;
  files: FileEntry[];
  source: unknown;
}

export interface FolderProvider {
  id: FolderProviderId;
  label: string;
  description?: string;
  requiresApiKey?: boolean;
  isSupported(): boolean;
  authorize?(config?: unknown): Promise<boolean>;
  mount(): Promise<MountedFolder | null>;
  getFile(entry: FileEntry): Promise<File>;
}

export interface PdfParseResult {
  type: "pdf";
  fileName: string;
  pageCount: number;
  pages: { page: number; text: string }[];
  fullText: string;
}

export interface DxfParseResult {
  type: "dxf";
  fileName: string;
  layers: string[];
  entityCounts: Record<string, number>;
  textContent: string[];
  blockCount: number;
}

export interface IfcParseResult {
  type: "ifc";
  fileName: string;
  schema: string;
  projectName: string;
  elementCounts: Record<string, number>;
  storeys: string[];
  spaces: string[];
}

export type ParseResult = PdfParseResult | DxfParseResult | IfcParseResult;

export function isSupportedParseExtension(ext: string): ext is SupportedExtension {
  return ext in SUPPORTED_FOLDER_EXTENSIONS;
}

export function getFileExtension(name: string): FolderFileExtension {
  return name.split(".").pop()?.toLowerCase() || "file";
}
