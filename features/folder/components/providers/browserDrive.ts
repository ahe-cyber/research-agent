import { getFileExtension, type FileEntry, type FolderProvider } from "../../folder.schema";

const DB_NAME = "research-agent-browser-drive";
const DB_VERSION = 1;
const STORE_NAME = "files";

interface BrowserDriveRecord {
  key: string;
  name: string;
  path: string;
  type: string;
  size: number;
  updatedAt: number;
  data: Blob;
}

// Client
export const browserDriveProvider: FolderProvider = {
  id: "browser-drive",
  label: "Browser Drive",
  description: "Use IndexedDB-backed browser storage for project files.",
  isSupported() {
    return typeof window !== "undefined" && "indexedDB" in window;
  },
  async mount() {
    const db = await openBrowserDriveDb();
    const records = await readAllBrowserDriveRecords(db);
    db.close();
    return {
      id: crypto.randomUUID(),
      name: "Browser Drive",
      providerId: this.id,
      files: records.map((record) => ({
        key: record.key,
        name: record.name,
        path: record.path,
        ext: getFileExtension(record.name),
        size: record.size,
        providerId: this.id,
        source: { key: record.key }
      })),
      source: { store: "indexedDB" }
    };
  },
  async getFile(entry: FileEntry) {
    const db = await openBrowserDriveDb();
    const record = await readBrowserDriveRecord(db, String((entry.source as { key?: string })?.key || entry.key));
    db.close();
    if (!record) throw new Error(`${entry.name} is not available from Browser Drive.`);
    return new File([record.data], record.name, {
      type: record.type,
      lastModified: record.updatedAt
    });
  }
};

function openBrowserDriveDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Browser Drive failed to open."));
  });
}

function readAllBrowserDriveRecords(db: IDBDatabase): Promise<BrowserDriveRecord[]> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result || []) as BrowserDriveRecord[]);
    request.onerror = () => reject(request.error || new Error("Browser Drive failed to read files."));
  });
}

function readBrowserDriveRecord(db: IDBDatabase, key: string): Promise<BrowserDriveRecord | null> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve((request.result || null) as BrowserDriveRecord | null);
    request.onerror = () => reject(request.error || new Error("Browser Drive failed to read file."));
  });
}
