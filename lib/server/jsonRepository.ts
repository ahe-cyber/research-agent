import { readFile } from "node:fs/promises";
import { writeJsonFile as writeJsonFileToDisk } from "./files";

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFile(filePath: string, body: unknown) {
  return writeJsonFileToDisk(filePath, body);
}
