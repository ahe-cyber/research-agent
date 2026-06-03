import { jsonResponse } from "../../../_shared/files";
import { errorMessage } from "../../../_shared/http";
import { POSTMAN_API_BASE, postmanJsonResponse } from "../_shared";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const apiKey = process.env.POSTMAN_API_KEY;

  if (!apiKey) {
    return jsonResponse({ error: "POSTMAN_API_KEY is not configured." }, { status: 503 });
  }

  const { id } = await context.params;

  try {
    const upstream = await fetch(`${POSTMAN_API_BASE}/collections/${encodeURIComponent(id)}`, {
      headers: { "X-Api-Key": apiKey }
    });
    return postmanJsonResponse(upstream, "collection detail");
  } catch (error) {
    console.error("[Postman] collection detail failed", error);
    return jsonResponse({ error: "Failed to fetch Postman collection.", message: errorMessage(error) }, { status: 502 });
  }
}
