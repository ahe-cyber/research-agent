import { jsonResponse } from "../../_shared/files";
import { errorMessage } from "../../_shared/http";

export const POSTMAN_API_BASE = "https://api.getpostman.com";

export async function postmanJsonResponse(upstream: Response, label: string) {
  try {
    const body = await upstream.json();
    return jsonResponse(body, { status: upstream.status });
  } catch (error) {
    console.error(`[Postman] ${label} returned invalid JSON`, error);
    return jsonResponse({
      error: `Failed to parse Postman ${label} response.`,
      message: errorMessage(error)
    }, { status: 502 });
  }
}
