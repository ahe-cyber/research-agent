import type { FolderProvider } from "./types";

export const googleDriveProvider: FolderProvider = {
  id: "google-drive",
  label: "Google Drive",
  description: "Connect a Google Drive account or API key when cloud mounting is configured.",
  requiresApiKey: true,
  isSupported() {
    return false;
  },
  async mount() {
    throw new Error("Google Drive mounting is not configured yet.");
  },
  async getFile() {
    throw new Error("Google Drive file reads are not configured yet.");
  }
};
