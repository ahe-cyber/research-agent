export type SupportedExtension = "pdf" | "dxf" | "ifc";
export type FolderFileExtension = SupportedExtension | string;

const SUPPORTED: Record<string, SupportedExtension> = {
  pdf: "pdf",
  dxf: "dxf",
  ifc: "ifc"
};

export function getSupportedExtension(name: string): SupportedExtension | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return SUPPORTED[ext] ?? null;
}

export function getFileExtension(name: string): FolderFileExtension {
  return name.split(".").pop()?.toLowerCase() || "file";
}
