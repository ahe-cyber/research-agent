import type { SupportedExtension } from "../supportedExtensions";

export type FolderProviderId = "browser-drive" | "local-drive" | "google-drive";

export interface FileEntry {
  key: string;
  name: string;
  path: string;
  ext: SupportedExtension;
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
  mount(): Promise<MountedFolder | null>;
  getFile(entry: FileEntry): Promise<File>;
}
