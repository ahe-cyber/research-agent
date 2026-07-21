import { errorMessage } from "../../_lib/http";

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

export async function postProviderJson(
  url: string,
  {
    headers,
    body,
    timeoutMs,
    providerLabel,
    maxRetries = 2,
    baseDelayMs = 600
  }: {
    headers: Record<string, string>;
    body: unknown;
    timeoutMs: number;
    providerLabel: string;
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
      const message = errorBody.error?.message || errorText || upstream.statusText || `Unknown ${providerLabel} error`;

      if (RETRYABLE_STATUSES.has(upstream.status) && attempt < maxRetries) {
        await delay(baseDelayMs * 2 ** attempt);
        attempt++;
        continue;
      }

      const error: any = new Error(`${providerLabel} API returned ${upstream.status}: ${message}`);
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

      const wrapped: any = new Error(`${providerLabel} API request failed: ${errorMessage(error)}`);
      wrapped.status = aborted ? 504 : (error as any)?.status;
      wrapped.upstreamBody = { message: errorMessage(error), timeoutMs: aborted ? timeoutMs : undefined };
      throw wrapped;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function interactionToolToJsonSchemaTool(tool: any) {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters || {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  };
}

export function getMaxOutputTokens(body: any, fallback = 2048) {
  return Number(body?.generation_config?.max_output_tokens || body?.max_output_tokens || fallback);
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
