import { jsonResponse } from "../../_lib/files";
import { errorMessage } from "../../_lib/http";
import { POSTMAN_API_BASE, postmanJsonResponse } from "../../_services/postman";

export async function GET() {
  const apiKey = process.env.POSTMAN_API_KEY;
  const workspaceId = process.env.POSTMAN_WORKSPACE_ID;

  if (!apiKey) {
    return jsonResponse({ error: "POSTMAN_API_KEY is not configured." }, { status: 503 });
  }

  const url = workspaceId
    ? `${POSTMAN_API_BASE}/collections?workspace=${workspaceId}`
    : `${POSTMAN_API_BASE}/collections`;

  try {
    const upstream = await fetch(url, { headers: { "X-Api-Key": apiKey } });
    return postmanJsonResponse(upstream, "collections list");
  } catch (error) {
    console.error("[Postman] collections list failed", error);
    return jsonResponse({ error: "Failed to fetch Postman collections.", message: errorMessage(error) }, { status: 502 });
  }
}
