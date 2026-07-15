import type { FolderFileExtension } from "../supportedExtensions";

export type FolderProviderId = "browser-drive" | "local-drive" | "google-drive";

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
