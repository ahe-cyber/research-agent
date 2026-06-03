export function isHttpUrl(value: unknown): value is string {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isJsonContentType(contentType: string) {
  return contentType.includes("application/json") || contentType.includes("geo+json");
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
