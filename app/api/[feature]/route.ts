import * as addressHandlers from "@/features/address/server/handler";
import * as agentHandlers from "@/features/agent/server/handler";
import * as datasetHandlers from "@/features/dataset/server/handler";
import * as folderHandlers from "@/features/folder/server/handler";
import * as mapHandlers from "@/features/map/server/handler";
import * as projectHandlers from "@/features/project/server/handler";
import * as recordHandlers from "@/features/record/server/handler";
import * as skillHandlers from "@/features/skill/server/handler";
import * as toolHandlers from "@/features/tool/server/handler";

type FeatureRouteContext = {
  params: Promise<{ feature: string }> | { feature: string };
};

type FeatureHandler = (request: Request) => Response | Promise<Response>;
type FeatureHandlers = Partial<Record<"GET" | "POST" | "PUT", FeatureHandler>>;

const FEATURE_HANDLERS: Record<string, FeatureHandlers> = {
  address: addressHandlers,
  agent: agentHandlers,
  dataset: datasetHandlers,
  folder: folderHandlers,
  map: mapHandlers,
  project: projectHandlers,
  record: recordHandlers,
  skill: skillHandlers,
  tool: toolHandlers
};

async function handleFeatureRequest(request: Request, context: FeatureRouteContext, method: keyof FeatureHandlers) {
  const { feature } = await context.params;
  const featureHandlers = FEATURE_HANDLERS[feature];
  const handler = featureHandlers?.[method];

  if (!featureHandlers) {
    return Response.json({ error: `Unknown feature: ${feature}` }, { status: 404 });
  }

  if (!handler) {
    return Response.json({ error: `${method} is not supported for ${feature}.` }, { status: 405 });
  }

  return handler(request);
}

export function GET(request: Request, context: FeatureRouteContext) {
  return handleFeatureRequest(request, context, "GET");
}

export function POST(request: Request, context: FeatureRouteContext) {
  return handleFeatureRequest(request, context, "POST");
}

export function PUT(request: Request, context: FeatureRouteContext) {
  return handleFeatureRequest(request, context, "PUT");
}
