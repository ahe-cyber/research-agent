import { jsonResponse } from "@/lib/server/files";
import { getRecordEditorSchema, listRecordData, listRecordSearchSources, updateRecordData, updateRecordSearchSources } from "./service";

export function GET(request: Request) {
  const resource = new URL(request.url).searchParams.get("resource");
  if (resource === "schema") return getRecordEditorSchema(new URL(request.url).searchParams.get("target") || "item");
  if (resource === "suggest" || resource === "retrieve") {
    return jsonResponse({ error: `${resource} is not implemented for record.` }, { status: 501 });
  }
  return resource === "sources" ? listRecordSearchSources() : listRecordData();
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body)) {
    return jsonResponse({ error: "Record payload must be an array." }, { status: 400 });
  }
  return new URL(request.url).searchParams.get("resource") === "sources"
    ? updateRecordSearchSources(body)
    : updateRecordData(body);
}
