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

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

export async function postJsonWithRetry(
  url: string,
  {
    headers,
    body,
    timeoutMs,
    label,
    maxRetries = 2,
    baseDelayMs = 600
  }: {
    headers: Record<string, string>;
    body: unknown;
    timeoutMs: number;
    label: string;
    maxRetries?: number;
    baseDelayMs?: number;
  }
) {
  let attempt = 0;

  while (true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const upstream = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (upstream.ok) return upstream.json();

      const errorText = await upstream.text().catch(() => "");
      let errorBody: any = {};
      try { errorBody = errorText ? JSON.parse(errorText) : {}; } catch {}
      const message = errorBody.error?.message || errorText || upstream.statusText || `Unknown ${label} error`;

      if (RETRYABLE_STATUSES.has(upstream.status) && attempt < maxRetries) {
        await delay(baseDelayMs * 2 ** attempt);
        attempt++;
        continue;
      }

      const error: any = new Error(`${label} API returned ${upstream.status}: ${message}`);
      error.status = upstream.status;
      error.upstreamBody = errorBody.error || errorBody || errorText;
      throw error;
    } catch (error) {
      const aborted = controller.signal.aborted;
      if (!aborted && (error as any)?.status) throw error;

      if (attempt < maxRetries) {
        await delay(baseDelayMs * 2 ** attempt);
        attempt++;
        continue;
      }

      const wrapped: any = new Error(`${label} API request failed: ${errorMessage(error)}`);
      wrapped.status = aborted ? 504 : (error as any)?.status;
      wrapped.upstreamBody = { message: errorMessage(error), timeoutMs: aborted ? timeoutMs : undefined };
      throw wrapped;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
