import { errorMessage } from "../../_lib/http";
import type { AgentModelProvider } from "./types";

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const GEMINI_REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_REQUEST_TIMEOUT_MS || 45_000);

export const geminiProvider: AgentModelProvider = {
  id: "gemini",
  label: "Gemini",
  defaultModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  apiKeyLabel: "Gemini API key",
  emptyResponseMessage: "No response from Gemini.",
  errorResponseMessage(error) {
    return error?.status ? `Gemini API returned HTTP ${error.status}.` : "Failed to reach Gemini API.";
  },
  async createInteraction(apiKey, body) {
    return createGeminiInteraction(apiKey, body);
  }
};

async function createGeminiInteraction(apiKey: string, body: any, { maxRetries = 3, baseDelayMs = 600 } = {}) {
  let attempt = 0;
  while (true) {
    let upstream: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_REQUEST_TIMEOUT_MS);
    try {
      upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (error) {
      clearTimeout(timeout);
      const message = errorMessage(error);
      if (attempt < maxRetries) {
        const delay = baseDelayMs * 2 ** attempt;
        console.warn(`[Agent] Gemini request failed before response - retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`, {
          message
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
        continue;
      }

      const wrapped: any = new Error(`Gemini Interactions API request failed: ${message}`);
      wrapped.status = controller.signal.aborted ? 504 : undefined;
      wrapped.upstreamBody = { message, timeoutMs: controller.signal.aborted ? GEMINI_REQUEST_TIMEOUT_MS : undefined };
      throw wrapped;
    } finally {
      clearTimeout(timeout);
    }

    if (upstream.ok) return upstream.json();

    const errorText = await upstream.text().catch(() => "");
    let errorBody: any = {};
    try { errorBody = errorText ? JSON.parse(errorText) : {}; } catch {}
    const message = errorBody.error?.message || errorText || upstream.statusText || "Unknown Gemini error";

    if (RETRYABLE_STATUSES.has(upstream.status) && attempt < maxRetries) {
      const delay = baseDelayMs * 2 ** attempt;
      console.warn(`[Agent] Gemini ${upstream.status} - retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`, {
        message,
        body: errorBody.error || errorBody || errorText
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
      continue;
    }

    const error: any = new Error(`Gemini Interactions API returned ${upstream.status}: ${message}`);
    error.status = upstream.status;
    error.upstreamBody = errorBody.error || errorBody || errorText;
    throw error;
  }
}
