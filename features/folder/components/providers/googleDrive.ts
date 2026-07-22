import { getFileExtension, type FileEntry, type FolderProvider, type MountedFolder } from "@/features/folder/folder.schema";

const CONFIG_STORAGE_KEY = "research-agent.folderProviderConfig";
const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const DRIVE_DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";

interface GoogleDriveConfig {
  apiKey?: string;
  clientId?: string;
  appId?: string;
}

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
}

interface GoogleDriveEntrySource {
  fileId: string;
  mimeType: string;
  accessToken: string;
}

declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

let librariesPromise: Promise<void> | null = null;
let tokenClient: any = null;
let accessToken: string | null = null;

// Client
export const googleDriveProvider: FolderProvider = {
  id: "google-drive",
  label: "Google Drive",
  description: "Mount a selected Google Drive folder using Picker and read-only Drive API access.",
  requiresApiKey: true,
  isSupported() {
    return typeof window !== "undefined";
  },
  async authorize(configOverride) {
    const config = {
      ...getGoogleDriveConfig(),
      ...normalizeGoogleDriveConfig(configOverride)
    };
    validateConfig(config);
    await loadGoogleLibraries();
    await requestAccessToken(config);
    return true;
  },
  async mount() {
    const config = getGoogleDriveConfig();
    validateConfig(config);
    await loadGoogleLibraries();
    const token = await requestAccessToken(config);
    const folder = await pickGoogleDriveFolder(config, token);
    if (!folder) return null;
    const files = await scanDriveFolder(folder.id, folder.name, token);
    return {
      id: crypto.randomUUID(),
      name: folder.name,
      providerId: this.id,
      files,
      source: { folderId: folder.id }
    } satisfies MountedFolder;
  },
  async getFile(entry) {
    const source = entry.source as GoogleDriveEntrySource;
    const res = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(source.fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${source.accessToken}` }
    });
    if (!res.ok) {
      throw new Error(`Google Drive failed to download ${entry.name} (${res.status}).`);
    }
    const blob = await res.blob();
    return new File([blob], entry.name, {
      type: source.mimeType,
      lastModified: Date.now()
    });
  }
};

function getGoogleDriveConfig(): GoogleDriveConfig {
  try {
    const configs = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) || "{}");
    return configs[googleDriveProvider.id] || {};
  } catch {
    return {};
  }
}

function normalizeGoogleDriveConfig(config: unknown): GoogleDriveConfig {
  if (!config || typeof config !== "object") return {};
  const raw = config as Record<string, unknown>;
  return {
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey.trim() : undefined,
    clientId: typeof raw.clientId === "string" ? raw.clientId.trim() : undefined,
    appId: typeof raw.appId === "string" ? raw.appId.trim() : undefined
  };
}

function validateConfig(config: GoogleDriveConfig) {
  const missing = [
    !config.apiKey && "API key",
    !config.clientId && "OAuth client ID",
    !config.appId && "Google Cloud project number"
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Google Drive needs ${missing.join(", ")}. Add them in Folder Sources first.`);
  }
}

async function loadGoogleLibraries() {
  librariesPromise ??= Promise.all([
    loadScript("https://apis.google.com/js/api.js"),
    loadScript("https://accounts.google.com/gsi/client")
  ]).then(async () => {
    await new Promise<void>((resolve, reject) => {
      window.gapi.load("client:picker", {
        callback: resolve,
        onerror: () => reject(new Error("Google API client failed to load."))
      });
    });
    await window.gapi.client.load(DRIVE_DISCOVERY_DOC);
  });
  return librariesPromise;
}

function loadScript(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing?.dataset.loaded === "true") return Promise.resolve();
  if (existing) return waitForScript(existing);

  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
  return waitForScript(script);
}

function waitForScript(script: HTMLScriptElement): Promise<void> {
  return new Promise((resolve, reject) => {
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`${script.src} failed to load.`)), { once: true });
  });
}

function requestAccessToken(config: GoogleDriveConfig): Promise<string> {
  return new Promise((resolve, reject) => {
    tokenClient ??= window.google.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: DRIVE_READONLY_SCOPE,
      callback: ""
    });
    tokenClient.callback = (response: { access_token?: string; error?: string }) => {
      if (response.error || !response.access_token) {
        reject(new Error(response.error || "Google authorization failed."));
        return;
      }
      accessToken = response.access_token;
      resolve(response.access_token);
    };
    tokenClient.requestAccessToken({ prompt: accessToken ? "" : "consent" });
  });
}

function pickGoogleDriveFolder(config: GoogleDriveConfig, token: string): Promise<{ id: string; name: string } | null> {
  return new Promise((resolve) => {
    const docsView = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true);
    const picker = new window.google.picker.PickerBuilder()
      .setDeveloperKey(config.apiKey)
      .setAppId(config.appId)
      .setOAuthToken(token)
      .addView(docsView)
      .setTitle("Select a Google Drive folder")
      .setCallback((data: any) => {
        if (data.action === window.google.picker.Action.CANCEL) {
          resolve(null);
          return;
        }
        if (data.action !== window.google.picker.Action.PICKED) return;
        const doc = data[window.google.picker.Response.DOCUMENTS]?.[0];
        resolve(doc ? {
          id: doc[window.google.picker.Document.ID],
          name: doc[window.google.picker.Document.NAME]
        } : null);
      })
      .build();
    picker.setVisible(true);
  });
}

async function scanDriveFolder(
  folderId: string,
  basePath: string,
  token: string,
  depth = 0
): Promise<FileEntry[]> {
  if (depth > 5) return [];
  const files: FileEntry[] = [];
  let pageToken = "";

  do {
    const params = new URLSearchParams({
      q: `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false`,
      fields: "nextPageToken, files(id,name,mimeType,size)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true"
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${DRIVE_FILES_URL}?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Google Drive folder scan failed (${res.status}).`);

    const data = await res.json();
    for (const file of (data.files || []) as GoogleDriveFile[]) {
      if (file.mimeType === FOLDER_MIME_TYPE) {
        files.push(...await scanDriveFolder(file.id, `${basePath}/${file.name}`, token, depth + 1));
      } else if (!file.mimeType.startsWith("application/vnd.google-apps.")) {
        files.push({
          key: file.id,
          name: file.name,
          path: `${basePath}/${file.name}`,
          ext: getFileExtension(file.name),
          size: Number(file.size || 0),
          providerId: googleDriveProvider.id,
          source: { fileId: file.id, mimeType: file.mimeType, accessToken: token } satisfies GoogleDriveEntrySource
        });
      }
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return files;
}
