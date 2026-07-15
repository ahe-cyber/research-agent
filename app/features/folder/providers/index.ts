import { googleDriveProvider } from "./googleDrive";
import { browserDriveProvider } from "./browserDrive";
import { localDriveProvider } from "./localDrive";
import type { FileEntry, FolderProvider, FolderProviderId } from "./types";

export type { FileEntry, FolderProvider, FolderProviderId, MountedFolder } from "./types";

export const folderProviders: FolderProvider[] = [
  browserDriveProvider,
  localDriveProvider,
  googleDriveProvider
];

export function getFolderProvider(providerId: FolderProviderId): FolderProvider | undefined {
  return folderProviders.find((provider) => provider.id === providerId);
}

export async function getProviderFile(entry: FileEntry): Promise<File> {
  const provider = getFolderProvider(entry.providerId);
  if (!provider) throw new Error(`Unknown folder provider: ${entry.providerId}`);
  return provider.getFile(entry);
}
