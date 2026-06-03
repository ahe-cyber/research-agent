import { jsonResponse } from "../_shared/files";
import { errorMessage, isHttpUrl, isJsonContentType } from "../_shared/http";

interface QueryPayload {
  ok: boolean;
  status: number;
  statusText: string;
  contentType: string;
  durationMs: number;
  timestamp: string;
  request: {
    method: "GET";
    url: string;
  };
  response?: unknown;
  responsePreview?: string;
  responseText?: string;
  responseType?: "html";
  parseError?: string;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const queryUrl = body?.url;

  if (!isHttpUrl(queryUrl)) {
    return jsonResponse({ error: "Query URL must be an http or https URL." }, { status: 400 });
  }

  const startedAt = performance.now();

  try {
    const upstreamResponse = await fetch(queryUrl, {
      headers: {
        Accept: "application/json, application/geo+json, text/html;q=0.8, */*;q=0.5",
        "User-Agent": "research-agent/1.0"
      }
    });
    const durationMs = Math.round(performance.now() - startedAt);
    const contentType = upstreamResponse.headers.get("content-type") || "";
    const responseText = await upstreamResponse.text();
    const payload: QueryPayload = {
      ok: upstreamResponse.ok,
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      contentType,
      durationMs,
      timestamp: new Date().toISOString(),
      request: {
        method: "GET",
        url: queryUrl
      }
    };

    if (isJsonContentType(contentType)) {
      try {
        payload.response = JSON.parse(responseText);
      } catch (error) {
        payload.ok = false;
        payload.parseError = errorMessage(error);
        payload.responsePreview = responseText.slice(0, 500);
      }
    } else if (contentType.includes("text/html")) {
      payload.responseType = "html";
      payload.responseText = responseText;
      payload.responsePreview = responseText.slice(0, 500);
    } else {
      payload.responsePreview = responseText.slice(0, 500);
    }

    return jsonResponse(payload);
  } catch (error) {
    return jsonResponse({
      error: "Server-side query failed.",
      message: errorMessage(error),
      url: queryUrl,
      durationMs: Math.round(performance.now() - startedAt)
    }, { status: 502 });
  }
}
