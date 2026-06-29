import type { FileEntry, FolderProvider, MountedFolder } from "./types";
import { getSupportedExtension } from "../supportedExtensions";

interface LocalFileEntrySource {
  handle: FileSystemFileHandle;
}

interface LocalFolderSource {
  handle: FileSystemDirectoryHandle;
}

export const localDriveProvider: FolderProvider = {
  id: "local-drive",
  label: "Local Drive",
  description: "Mount files from a local folder using the browser file system picker.",
  isSupported() {
    return typeof window !== "undefined" && "showDirectoryPicker" in window;
  },
  async mount() {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: "read" });
      const files = await scanDirectory(handle, handle.name);
      return {
        id: crypto.randomUUID(),
        name: handle.name,
        providerId: this.id,
        files,
        source: { handle } satisfies LocalFolderSource
      };
    } catch (err) {
      if ((err as Error).name === "AbortError") return null;
      throw err;
    }
  },
  async getFile(entry) {
    const source = entry.source as LocalFileEntrySource;
    return source.handle.getFile();
  }
};

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
      const ext = getSupportedExtension(name);
      if (ext) {
        const file = await (handle as FileSystemFileHandle).getFile();
        entries.push({
          key: `${basePath}/${name}`,
          name,
          path: `${basePath}/${name}`,
          ext,
          size: file.size,
          providerId: localDriveProvider.id,
          source: { handle: handle as FileSystemFileHandle } satisfies LocalFileEntrySource
        });
      }
    }
  }

  return entries;
}
