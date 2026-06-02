const express = require("express");
const fs = require("node:fs/promises");
const fssync = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const Lerc = require("lerc");
const sharp = require("sharp");

// Load .env file variables into process.env (if not already set)
try {
  const envContent = fssync.readFileSync(path.join(__dirname, ".env"), "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
        process.env[key] = value;
      }
    }
  }
} catch { /* .env not found or unreadable — skip */ }

const app = express();
const httpServer = http.createServer(app);
const API_ONLY = process.env.API_ONLY === "true";
const port = Number(process.env.PORT || (API_ONLY ? 3001 : 5173));
const rootDir = __dirname;
const datasetsPath = path.join(rootDir, "public", "data", "datasets.json");
const POSTMAN_API_BASE = "https://api.getpostman.com";
const DEFAULT_AGENT_SYSTEM_INSTRUCTION = "You are a GIS research assistant.";
const AGENT_ATTACHMENT_CONTEXT_MAX_CHARS = 8_000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const NYC_TOPOBATHYMETRIC_DEM_URL = "https://elevation.its.ny.gov/arcgis/rest/services/NYC_TopoBathymetric_2017_1_meter/ImageServer/exportImage";
const WEB_MERCATOR_HALF_WORLD = 20037508.342789244;
const NYC_TOPOBATHYMETRIC_DEM_BOUNDS = {
  xmin: -8266307.1821361203,
  ymin: 4937589.791525625,
  xmax: -8204027.307190664,
  ymax: 5000028.37647827
};
const TERRAIN_TILE_SIZE = 256;
const TERRAIN_RGB_ZERO_ELEVATION = 100000;

app.use(express.json({ limit: "1mb" }));

app.get("/api/terrain/nyc-topobathymetric-2017/:z/:x/:y.png", async (request, response) => {
  const z = Number(request.params.z);
  const x = Number(request.params.x);
  const y = Number(request.params.y);

  if (![z, x, y].every(Number.isInteger) || z < 0 || z > 18) {
    response.status(400).json({ error: "Invalid terrain tile coordinates." });
    return;
  }

  const tileCount = 2 ** z;
  if (x < 0 || x >= tileCount || y < 0 || y >= tileCount) {
    response.status(404).end();
    return;
  }

  try {
    const tileWidth = (WEB_MERCATOR_HALF_WORLD * 2) / tileCount;
    const xmin = -WEB_MERCATOR_HALF_WORLD + x * tileWidth;
    const xmax = xmin + tileWidth;
    const ymax = WEB_MERCATOR_HALF_WORLD - y * tileWidth;
    const ymin = ymax - tileWidth;
    const clippedBounds = {
      xmin: Math.max(xmin, NYC_TOPOBATHYMETRIC_DEM_BOUNDS.xmin),
      ymin: Math.max(ymin, NYC_TOPOBATHYMETRIC_DEM_BOUNDS.ymin),
      xmax: Math.min(xmax, NYC_TOPOBATHYMETRIC_DEM_BOUNDS.xmax),
      ymax: Math.min(ymax, NYC_TOPOBATHYMETRIC_DEM_BOUNDS.ymax)
    };
    const terrainRgb = createFlatTerrainRgbTile();
    if (clippedBounds.xmin >= clippedBounds.xmax || clippedBounds.ymin >= clippedBounds.ymax) {
      response
        .set("Cache-Control", "public, max-age=86400")
        .type("png")
        .send(await encodeTerrainRgbTile(terrainRgb));
      return;
    }

    const pixelWidth = tileWidth / TERRAIN_TILE_SIZE;
    const left = Math.max(0, Math.floor((clippedBounds.xmin - xmin) / pixelWidth));
    const right = Math.min(TERRAIN_TILE_SIZE, Math.ceil((clippedBounds.xmax - xmin) / pixelWidth));
    const top = Math.max(0, Math.floor((ymax - clippedBounds.ymax) / pixelWidth));
    const bottom = Math.min(TERRAIN_TILE_SIZE, Math.ceil((ymax - clippedBounds.ymin) / pixelWidth));
    const exportBounds = {
      xmin: xmin + left * pixelWidth,
      ymin: ymax - bottom * pixelWidth,
      xmax: xmin + right * pixelWidth,
      ymax: ymax - top * pixelWidth
    };
    const params = new URLSearchParams({
      bbox: `${exportBounds.xmin},${exportBounds.ymin},${exportBounds.xmax},${exportBounds.ymax}`,
      bboxSR: "3857",
      imageSR: "3857",
      size: `${right - left},${bottom - top}`,
      format: "lerc",
      pixelType: "F32",
      interpolation: "RSP_BilinearInterpolation",
      f: "image"
    });
    const upstream = await fetch(`${NYC_TOPOBATHYMETRIC_DEM_URL}?${params}`);
    if (!upstream.ok) {
      throw new Error(`ImageServer responded with ${upstream.status}`);
    }

    await Lerc.load();
    const { width, height, pixels, mask } = Lerc.decode(await upstream.arrayBuffer());
    const elevations = pixels[0];

    for (let pixel = 0; pixel < width * height; pixel++) {
      const elevation = elevations[pixel];
      const encoded = (!mask || mask[pixel]) && Number.isFinite(elevation)
        ? Math.max(0, Math.min(16777215, Math.round((elevation + 10000) * 10)))
        : TERRAIN_RGB_ZERO_ELEVATION;
      const sourceX = pixel % width;
      const sourceY = Math.floor(pixel / width);
      writeTerrainRgbPixel(terrainRgb, (top + sourceY) * TERRAIN_TILE_SIZE + left + sourceX, encoded);
    }

    response
      .set("Cache-Control", "public, max-age=86400")
      .type("png")
      .send(await encodeTerrainRgbTile(terrainRgb));
  } catch (error) {
    console.error("[Terrain] Failed to build NYC topobathymetric tile", error);
    try {
      response
        .set("Cache-Control", "public, max-age=300")
        .type("png")
        .send(await encodeTerrainRgbTile(createFlatTerrainRgbTile()));
    } catch {
      response.status(502).json({ error: "Failed to build terrain tile." });
    }
  }
});

function createFlatTerrainRgbTile() {
  const tile = Buffer.alloc(TERRAIN_TILE_SIZE * TERRAIN_TILE_SIZE * 3);
  for (let pixel = 0; pixel < TERRAIN_TILE_SIZE * TERRAIN_TILE_SIZE; pixel++) {
    writeTerrainRgbPixel(tile, pixel, TERRAIN_RGB_ZERO_ELEVATION);
  }
  return tile;
}

function writeTerrainRgbPixel(tile, pixel, encoded) {
  tile[pixel * 3] = Math.floor(encoded / 65536);
  tile[pixel * 3 + 1] = Math.floor((encoded % 65536) / 256);
  tile[pixel * 3 + 2] = encoded % 256;
}

function encodeTerrainRgbTile(tile) {
  return sharp(tile, {
    raw: { width: TERRAIN_TILE_SIZE, height: TERRAIN_TILE_SIZE, channels: 3 }
  }).png().toBuffer();
}

app.get("/api/datasets", async (request, response) => {
  try {
    response.type("json").send(await fs.readFile(datasetsPath, "utf8"));
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Failed to read datasets." });
  }
});

app.put("/api/datasets", async (request, response) => {
  if (!Array.isArray(request.body)) {
    response.status(400).json({ error: "Datasets payload must be an array." });
    return;
  }

  try {
    const content = `${JSON.stringify(request.body, null, 2)}\n`;
    await fs.writeFile(datasetsPath, content, "utf8");
    response.json({ ok: true });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Failed to write datasets." });
  }
});

app.post("/api/query", async (request, response) => {
  const queryUrl = request.body && request.body.url;

  if (!isHttpUrl(queryUrl)) {
    response.status(400).json({ error: "Query URL must be an http or https URL." });
    return;
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
    const payload = {
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
        payload.parseError = error.message;
        payload.responsePreview = responseText.slice(0, 500);
      }
    } else if (contentType.includes("text/html")) {
      payload.responseType = "html";
      payload.responseText = responseText;
      payload.responsePreview = responseText.slice(0, 500);
    } else {
      payload.responsePreview = responseText.slice(0, 500);
    }

    response.json(payload);
  } catch (error) {
    response.status(502).json({
      error: "Server-side query failed.",
      message: error.message,
      url: queryUrl,
      durationMs: Math.round(performance.now() - startedAt)
    });
  }
});

app.get("/api/postman/collections", async (request, response) => {
  const apiKey = process.env.POSTMAN_API_KEY;
  const workspaceId = process.env.POSTMAN_WORKSPACE_ID;

  if (!apiKey) {
    response.status(503).json({ error: "POSTMAN_API_KEY is not configured." });
    return;
  }

  const url = workspaceId
    ? `${POSTMAN_API_BASE}/collections?workspace=${workspaceId}`
    : `${POSTMAN_API_BASE}/collections`;

  try {
    const upstream = await fetch(url, { headers: { "X-Api-Key": apiKey } });
    const body = await upstream.json();
    response.status(upstream.status).json(body);
  } catch (error) {
    console.error("[Postman] collections list failed", error);
    response.status(502).json({ error: "Failed to fetch Postman collections.", message: error.message });
  }
});

app.get("/api/postman/collections/:id", async (request, response) => {
  const apiKey = process.env.POSTMAN_API_KEY;

  if (!apiKey) {
    response.status(503).json({ error: "POSTMAN_API_KEY is not configured." });
    return;
  }

  try {
    const upstream = await fetch(`${POSTMAN_API_BASE}/collections/${request.params.id}`, {
      headers: { "X-Api-Key": apiKey }
    });
    const body = await upstream.json();
    response.status(upstream.status).json(body);
  } catch (error) {
    console.error("[Postman] collection detail failed", error);
    response.status(502).json({ error: "Failed to fetch Postman collection.", message: error.message });
  }
});

// ── Agent instruction ─────────────────────────────────────────────────────────

app.get("/api/instruction", async (request, response) => {
  try {
    const data = JSON.parse(await fs.readFile(agentsPath, "utf8"));
    response.json({ instruction: data.globalInstruction || "" });
  } catch {
    response.json({ instruction: "" });
  }
});

app.put("/api/instruction", async (request, response) => {
  const { instruction } = request.body;
  if (typeof instruction !== "string") {
    response.status(400).json({ error: "instruction must be a string." });
    return;
  }
  try {
    let data = { globalInstruction: "", agents: [], connections: [] };
    try { data = JSON.parse(await fs.readFile(agentsPath, "utf8")); } catch {}
    data.globalInstruction = instruction;
    await fs.writeFile(agentsPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    response.json({ ok: true });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Failed to write instruction." });
  }
});

// ── Tool declarations ─────────────────────────────────────────────────────────

const TOOL_DECLARATIONS = [
  {
    name: "list_catalogs",
    description: "List all configured GIS data catalogs. Call this before search_catalog to see which catalogs and URLs are available."
  },
  {
    name: "list_sources",
    description: "List all configured data sources (pre-built queries with known endpoints). Returns id, name, type, description, query URL, and default params for each."
  },
  {
    name: "query_source",
    description: "Execute one configured data source by id or name. Use list_sources first when you need available source ids. Provide params to override or add query parameters such as geometry, where, outFields, or limit.",
    parameters: {
      type: "OBJECT",
      properties: {
        sourceId: { type: "STRING", description: "Configured source id or exact/source display name from list_sources." },
        params: {
          type: "OBJECT",
          description: "Optional query parameter overrides. Values should be strings, numbers, or booleans.",
          additionalProperties: {
            anyOf: [{ type: "STRING" }, { type: "NUMBER" }, { type: "BOOLEAN" }]
          }
        }
      },
      required: ["sourceId"]
    }
  },
  {
    name: "list_agents",
    description: "List configured agent modules available for delegation. Returns id, name, instruction summary, attached direct collaborators, and suggested tools."
  },
  {
    name: "call_agent",
    description: "Call an agent module directly by id or name. Use this to delegate a focused task to an attached or configured specialist agent and get its response. The result contains a `text` field with the agent's reply — always relay that text to the user verbatim or quoted.",
    parameters: {
      type: "OBJECT",
      properties: {
        agentId: { type: "STRING", description: "Agent module id or exact name." },
        callerId: { type: "STRING", description: "Caller agent id." },
        message: { type: "STRING", description: "The task, question, or context to send to that agent module." },
        blind: { type: "BOOLEAN", description: "When true, the call starts a fresh conversation with no history and the result is not saved. Use for one-off lookups that should not affect ongoing context." }
      },
      required: ["agentId", "callerId", "message"]
    }
  },
  {
    name: "create_agent",
    description: "Create a new agent module with a name and optional instruction. Use this when the user asks to add or create a new agent.",
    parameters: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING", description: "Display name for the new agent." },
        description: { type: "STRING", description: "Optional system instruction / description for the agent." }
      },
      required: ["name"]
    }
  },
  {
    name: "edit_agent",
    description: "Edit a single agent module's instruction by id or name. Call multiple times to edit multiple agents.",
    parameters: {
      type: "OBJECT",
      properties: {
        agentId: { type: "STRING", description: "Agent module id or exact name to edit." },
        instruction: { type: "STRING", description: "Instruction text to apply." },
        mode: { type: "STRING", description: "Use replace to overwrite the instruction, or append to add to the current instruction. Defaults to replace." }
      },
      required: ["agentId", "instruction"]
    }
  },
  {
    name: "edit_communication",
    description: "Set or update the communication instruction on the connection from one agent to another. Describes how the sender should communicate with the receiver. Creates the connection if it does not exist.",
    parameters: {
      type: "OBJECT",
      properties: {
        senderId: { type: "STRING", description: "Id or name of the agent that sends." },
        receiverId: { type: "STRING", description: "Id or name of the agent that receives." },
        instruction: { type: "STRING", description: "Communication instruction for this direction." }
      },
      required: ["senderId", "receiverId", "instruction"]
    }
  },
  {
    name: "search_catalog",
    description: "Search a GIS data catalog for datasets matching a query. Call list_catalogs first to get available hub URLs.",
    parameters: {
      type: "OBJECT",
      properties: {
        query:  { type: "STRING", description: "Search query terms" },
        hubUrl: { type: "STRING", description: "Catalog base URL from list_catalogs" },
        bbox:   { type: "STRING", description: "Optional bounding box as 'minLng,minLat,maxLng,maxLat' for spatial filtering" }
      },
      required: ["query", "hubUrl"]
    }
  },
  {
    name: "get_report",
    description: "Get the current content of the research report for the active property."
  },
  {
    name: "update_report",
    description: "Add structured findings to the research report. Use this for property data, zoning info, ownership details, and key findings. Keep chat conversational — save structure for the report.",
    parameters: {
      type: "OBJECT",
      properties: {
        content: { type: "STRING", description: "Markdown content to add to the report" },
        heading: { type: "STRING", description: "Optional section heading for this content" }
      },
      required: ["content"]
    }
  }
];

app.get("/api/tools", (_request, response) => {
  response.json(TOOL_DECLARATIONS);
});

// ── Agent modules registry ────────────────────────────────────────────────────

const agentsPath = path.join(rootDir, "public", "data", "agents.json");

app.get("/api/agents", async (request, response) => {
  try {
    response.type("json").send(await fs.readFile(agentsPath, "utf8"));
  } catch {
    response.json({ agents: [] });
  }
});

app.put("/api/agents", async (request, response) => {
  const body = request.body;
  if (!body || !Array.isArray(body.agents)) {
    response.status(400).json({ error: "Agents payload must have an agents array." });
    return;
  }
  try {
    await fs.writeFile(agentsPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
    response.json({ ok: true });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Failed to write agents." });
  }
});

// ── Hub catalog registry ──────────────────────────────────────────────────────

const hubsPath = path.join(rootDir, "public", "data", "hubs.json");

app.get("/api/hubs", async (request, response) => {
  try {
    const registry = JSON.parse(await fs.readFile(hubsPath, "utf8"));
    response.json(normalizeHubRegistry(registry));
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Failed to read hubs." });
  }
});

app.put("/api/hubs", async (request, response) => {
  if (!isHubRegistry(request.body)) {
    response.status(400).json({ error: "Hubs must be grouped by type." });
    return;
  }
  try {
    await fs.writeFile(hubsPath, `${JSON.stringify(normalizeHubRegistry(request.body), null, 2)}\n`, "utf8");
    response.json({ ok: true });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Failed to write hubs." });
  }
});

function normalizeHubRegistry(registry) {
  if (!isHubRegistry(registry)) {
    throw new Error("Invalid hubs registry.");
  }

  return Object.fromEntries(
    Object.entries(registry).map(([type, group]) => [
      type,
      {
        supportedInputParams: group.supportedInputParams,
        items: group.items.map(stripHubType)
      }
    ])
  );
}

function isHubRegistry(value) {
  return Boolean(value)
    && !Array.isArray(value)
    && typeof value === "object"
    && Object.values(value).every((group) =>
      group
      && typeof group === "object"
      && Array.isArray(group.supportedInputParams)
      && Array.isArray(group.items)
    );
}

function stripHubType(hub) {
  const { type, ...rest } = hub || {};
  return rest;
}

async function searchArcGIS(hubUrl, query, bbox) {
  const base = hubUrl.replace(/\/$/, "");
  const isHubSite = /(^|\.)hub\.arcgis\.com$/i.test(new URL(base).hostname) || /data\.gis\.ny\.gov$/i.test(new URL(base).hostname);
  const results = isHubSite
    ? await searchArcGISHub(base, query)
    : await searchArcGISPortal(base, query, bbox);

  return results.map((item) => ({
    id: item.id,
    title: item.title || "Untitled",
    snippet: item.snippet || "",
    url: item.url || "",
    type: item.type || "Feature Service",
    owner: item.owner || ""
  }));
}

async function searchArcGISPortal(base, query, bbox) {
  const url = new URL(`${base}/sharing/rest/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("f", "json");
  url.searchParams.set("num", "8");
  url.searchParams.set("filter", `type:"Feature Service"`);
  if (bbox) url.searchParams.set("bbox", bbox);

  const res = await fetch(url.toString(), { headers: { "User-Agent": "research-agent/1.0", Accept: "application/json" } });
  if (!res.ok) throw new Error(`ArcGIS search returned ${res.status}`);
  const data = await readJsonResponse(res, "ArcGIS search");
  if (data.error) throw new Error(data.error.message || "ArcGIS search failed");
  return data.results || [];
}

async function searchArcGISHub(base, query) {
  const url = new URL(`${base}/api/search/v1`);
  url.searchParams.set("q", query);
  url.searchParams.set("filter[term]", query);
  url.searchParams.set("filter[type]", "Feature Service");
  url.searchParams.set("page[size]", "8");

  const res = await fetch(url.toString(), { headers: { "User-Agent": "research-agent/1.0", Accept: "application/json" } });
  if (!res.ok) throw new Error(`ArcGIS Hub search returned ${res.status}`);
  const data = await readJsonResponse(res, "ArcGIS Hub search");

  return (data.data || data.results || []).map((item) => {
    const attributes = item.attributes || item;
    const links = item.links || {};
    return {
      id: item.id || attributes.id || attributes.slug || attributes.name,
      title: attributes.name || attributes.title || "Untitled",
      snippet: stripHtml(attributes.description || attributes.snippet || ""),
      url: links.self || attributes.url || attributes.itemUrl || "",
      type: attributes.type || "Feature Service",
      owner: attributes.owner || attributes.source || ""
    };
  });
}

async function searchSocrata(hubUrl, query) {
  const url = new URL(`${hubUrl.replace(/\/$/, "")}/api/catalog/v1`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  url.searchParams.set("domains", new URL(hubUrl).hostname);

  const res = await fetch(url.toString(), { headers: { "User-Agent": "research-agent/1.0", Accept: "application/json" } });
  if (!res.ok) throw new Error(`Socrata search returned ${res.status}`);
  const data = await readJsonResponse(res, "Socrata search");

  return (data.results || []).map((item) => {
    const r = item.resource || {};
    return {
      id: r.id || item.link || String(Math.random()),
      title: r.name || "Untitled",
      snippet: r.description || "",
      url: item.permalink || item.link || "",
      type: r.type || "dataset",
      owner: item.metadata?.domain || hubUrl
    };
  });
}

async function readJsonResponse(res, label) {
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();
  if (!contentType.includes("application/json") && /^\s*</.test(text)) {
    throw new Error(`${label} returned an HTML page instead of JSON. Check the catalog URL or portal type.`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function queryConfiguredSource(sources, sourceId, params = {}) {
  const source = findConfiguredSource(sources, sourceId);
  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  const baseUrl = getSourceQueryBaseUrl(source);
  if (!isHttpUrl(baseUrl)) {
    throw new Error(`Source ${source.name || source.id} does not have a valid query URL.`);
  }

  const mergedParams = {
    ...sourceParamsToObject(source.defaultParams || [], { omitTemplates: true }),
    ...sanitizeQueryParams(params)
  };
  const url = buildUrlWithParams(baseUrl, mergedParams);
  const result = await fetchQueryPayload(url);

  return {
    source: {
      id: source.id,
      name: source.name,
      type: source.type,
      description: source.description || ""
    },
    request: result.request,
    ok: result.ok,
    status: result.status,
    statusText: result.statusText,
    contentType: result.contentType,
    durationMs: result.durationMs,
    timestamp: result.timestamp,
    response: result.response,
    responsePreview: result.responsePreview,
    parseError: result.parseError
  };
}

function findConfiguredSource(sources, sourceId) {
  const target = String(sourceId || "").trim().toLowerCase();
  if (!target) return null;
  return (sources || [])
    .filter((source) => !source.isDeleted)
    .find((source) =>
      String(source.id || "").toLowerCase() === target
      || String(source.name || "").toLowerCase() === target
    ) || null;
}

function getSourceQueryBaseUrl(source) {
  if (source.queryUrl) return source.queryUrl;

  const overviewUrl = String(source.overviewUrl || "").replace(/\/$/, "");
  if (!overviewUrl) return "";
  if (isSocrataSourceUrl(overviewUrl) || source.type === "socrata-dataset") {
    return normalizeSocrataResourceUrl(overviewUrl) || overviewUrl;
  }
  return `${overviewUrl}/query`;
}

function sourceParamsToObject(rows, options = {}) {
  const params = {};
  (rows || []).forEach((row) => {
    const key = String(row.key || "").trim();
    const value = row.value;
    if (!key) return;
    if (options.omitTemplates && hasUnresolvedTemplate(value)) return;
    params[key] = value;
  });
  return params;
}

function sanitizeQueryParams(params) {
  if (!params || typeof params !== "object" || Array.isArray(params)) return {};

  return Object.fromEntries(
    Object.entries(params)
      .filter(([key, value]) => key && value !== undefined && value !== null)
      .map(([key, value]) => [key, typeof value === "object" ? JSON.stringify(value) : String(value)])
  );
}

function hasUnresolvedTemplate(value) {
  return /\{\{\s*[^}]+\s*\}\}/.test(String(value ?? ""));
}

function buildUrlWithParams(baseUrl, params) {
  const url = new URL(baseUrl);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (key) url.searchParams.set(key, value);
  });
  return url.toString();
}

function isSocrataSourceUrl(url) {
  try {
    const { hostname, pathname } = new URL(url);
    return hostname.includes("socrata.com")
      || hostname.includes("opendata")
      || /\/resource\/[a-z0-9]{4}-[a-z0-9]{4}/i.test(pathname)
      || /\/api\/views\/[a-z0-9]{4}-[a-z0-9]{4}/i.test(pathname);
  } catch {
    return false;
  }
}

function normalizeSocrataResourceUrl(url) {
  const parts = getSocrataUrlParts(url);
  return parts ? `${parts.origin}/resource/${parts.id}.json` : "";
}

function getSocrataUrlParts(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/([a-z0-9]{4}-[a-z0-9]{4})(?:\.json)?/i);
    if (!match) return null;
    return { origin: parsed.origin, id: match[1].toLowerCase() };
  } catch {
    return null;
  }
}

async function fetchQueryPayload(queryUrl) {
  const startedAt = performance.now();
  const upstreamResponse = await fetch(queryUrl, {
    headers: {
      Accept: "application/json, application/geo+json, text/html;q=0.8, */*;q=0.5",
      "User-Agent": "research-agent/1.0"
    }
  });
  const durationMs = Math.round(performance.now() - startedAt);
  const contentType = upstreamResponse.headers.get("content-type") || "";
  const responseText = await upstreamResponse.text();
  const payload = {
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
      payload.parseError = error.message;
      payload.responsePreview = responseText.slice(0, 500);
    }
  } else if (contentType.includes("text/html")) {
    payload.responseType = "html";
    payload.responseText = responseText;
    payload.responsePreview = responseText.slice(0, 500);
  } else {
    payload.responsePreview = responseText.slice(0, 500);
  }

  return payload;
}

const RETRYABLE_STATUSES = new Set([429, 502, 503]);

async function createInteraction(apiKey, body, { maxRetries = 3, baseDelayMs = 600 } = {}) {
  let attempt = 0;
  while (true) {
    console.dir({ "[Gemini request]": body }, { depth: null });
    const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(body)
    });

    if (upstream.ok) return upstream.json();

    const errorText = await upstream.text().catch(() => "");
    let errorBody = {};
    try { errorBody = errorText ? JSON.parse(errorText) : {}; } catch { /* keep raw */ }
    const message = errorBody.error?.message || errorText || upstream.statusText || "Unknown Gemini error";

    if (RETRYABLE_STATUSES.has(upstream.status) && attempt < maxRetries) {
      const delay = baseDelayMs * 2 ** attempt;
      console.warn(`[Agent] Gemini ${upstream.status} — retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
      continue;
    }

    const error = new Error(`Gemini Interactions API returned ${upstream.status}: ${message}`);
    error.status = upstream.status;
    error.upstreamBody = errorBody.error || errorBody || errorText;
    throw error;
  }
}

function contentHistoryToInteractionInput(contents) {
  const turns = (contents || []).map((turn) => {
    const role = turn.role === "model" ? "Assistant" : "User";
    const text = (turn.parts || [])
      .map((part) => part.text || "")
      .filter(Boolean)
      .join("\n");
    return text ? `${role}: ${text}` : "";
  }).filter(Boolean);

  if (turns.length === 1 && turns[0].startsWith("User: ")) {
    return turns[0].slice("User: ".length);
  }

  return turns.join("\n\n");
}

function appMessagesToInteractionInput(messages) {
  const turns = (messages || []).map((message) => {
    const sender = String(message.sender || "unknown").trim() || "unknown";
    const replyTo = String(message.replyTo || "").trim();
    const content = String(message.content || "").trim();
    const contextText = serializeMessageContext(message.context);
    const route = replyTo ? `${sender} -> ${replyTo}` : sender;
    const parts = [`From: ${route}`];
    if (contextText) parts.push(contextText);
    if (content) parts.push(content);
    return parts.join("\n\n");
  }).filter(Boolean);

  return turns.length === 1 ? turns[0] : turns.join("\n\n---\n\n");
}

function serializeMessageContext(context = {}) {
  const parts = [];
  const toolHints = Array.isArray(context.toolHints)
    ? context.toolHints.map((hint) => String(hint || "").trim()).filter(Boolean)
    : [];
  if (toolHints.length > 0) {
    parts.push(`<tool_suggestion>${toolHints.join(", ")}</tool_suggestion>`);
  }

  const attachments = Array.isArray(context.attachments) ? context.attachments : [];
  if (attachments.length > 0) {
    const attachmentText = attachments.map((attachment) => {
      const title = attachment.title || attachment.kind || "Context";
      const payload = typeof attachment.payload === "string"
        ? attachment.payload
        : JSON.stringify(attachment.payload || attachment, null, 2);
      return `Attachment "${title}":\n${payload}`;
    });
    parts.push(`<context>\n${attachmentText.join("\n\n---\n\n")}\n</context>`);
  }

  return parts.join("\n\n");
}

function normalizeAppMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .map((message) => ({
      sender: String(message?.sender || "").trim(),
      content: String(message?.content || ""),
      replyTo: message?.replyTo ? String(message.replyTo).trim() : "",
      context: message?.context && typeof message.context === "object" ? message.context : {}
    }))
    .filter((message) =>
      message.sender
      && (message.content.trim()
        || (Array.isArray(message.context.attachments) && message.context.attachments.length > 0)
        || (Array.isArray(message.context.toolHints) && message.context.toolHints.length > 0))
    );
}

function getReportContentFromMessages(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const report = messages[i]?.context?.report;
    if (typeof report === "string") return report;
  }
  return null;
}

function getAddressedAgentId(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.sender === "user" && message.replyTo) return message.replyTo;
  }
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.replyTo) return messages[i].replyTo;
  }
  return "";
}

function getInteractionOutputText(interaction) {
  if (typeof interaction.output_text === "string") return interaction.output_text;
  if (Array.isArray(interaction.outputs)) {
    const lastText = interaction.outputs
      .filter((output) => output.type === "text" && output.text)
      .at(-1);
    if (lastText) return lastText.text;
  }

  const modelOutputs = (interaction.steps || []).filter((step) => step.type === "model_output");
  const lastOutput = modelOutputs.at(-1);
  return (lastOutput?.content || [])
    .filter((content) => content.type === "text" && content.text)
    .map((content) => content.text)
    .join("");
}

function getInteractionFunctionCalls(interaction) {
  const stepCalls = (interaction.steps || [])
    .filter((step) => step.type === "function_call")
    .map((step) => ({
      id: step.id,
      name: step.name,
      args: step.arguments || {}
    }));
  if (stepCalls.length > 0) return stepCalls;

  return (interaction.outputs || [])
    .filter((output) => output.type === "function_call")
    .map((output) => ({
      id: output.id,
      name: output.name,
      args: output.arguments || {}
    }));
}

function toInteractionTools(functionDeclarations) {
  return functionDeclarations.map((declaration) => ({
    type: "function",
    name: declaration.name,
    description: declaration.description,
    parameters: normalizeJsonSchema(declaration.parameters || {
      type: "OBJECT",
      properties: {},
      additionalProperties: false
    })
  }));
}

function normalizeJsonSchema(schema) {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(normalizeJsonSchema);

  const normalized = {};
  Object.entries(schema).forEach(([key, value]) => {
    normalized[key] = key === "type" && typeof value === "string"
      ? value.toLowerCase()
      : normalizeJsonSchema(value);
  });
  return normalized;
}

// Tracks the last Gemini interaction id per agent so follow-up calls continue the same conversation.
const agentInteractionIds = new Map();

async function callAgentModule(apiKey, registry, agentId, message, callerId = "", blind = false) {
  const agent = findAgentModule(registry, agentId);
  if (!agent) {
    throw new Error(`Agent module not found: ${agentId}`);
  }

  const prompt = String(message || "").trim();
  if (!prompt) {
    throw new Error("call_agent requires a message.");
  }

  const caller = findAgentModule(registry, callerId);

  const fromTo = caller
    ? `From: ${caller.name || caller.id} -> To: ${agent.name || agent.id}\n\n`
    : `To: ${agent.name || agent.id}\n\n`;

  const pairKey = `${callerId || "__root__"}:${agent.id}`;
  const previousInteractionId = blind ? null : agentInteractionIds.get(pairKey) ?? null;

  const interaction = await createInteraction(apiKey, {
    model: GEMINI_MODEL,
    input: fromTo + prompt,
    ...(previousInteractionId ? { previous_interaction_id: previousInteractionId } : {}),
    system_instruction: buildEntryAgentInstruction(agent, "", caller),
    generation_config: { temperature: 0.7, max_output_tokens: 2048 },
    store: !blind
  });

  if (blind) return { blind: true, agent: { id: agent.id, name: agent.name || "Agent module" } };

  agentInteractionIds.set(pairKey, interaction.id);

  const text = getInteractionOutputText(interaction);
  return {
    agent: { id: agent.id, name: agent.name || "Agent module" },
    caller: caller ? { id: caller.id, name: caller.name || "Agent module" } : null,
    text
  };
}

async function createAgentModule(registry, args) {
  const name = String(args.name || "").trim();
  if (!name) throw new Error("create_agent requires a name.");

  const id = `agent-${Date.now().toString(36)}`;
  const description = String(args.description || "").trim();

  const agent = { id, name, description, x: 100, y: 100, attachments: [], toolHints: [] };
  registry.agents.push(agent);
  await fs.writeFile(agentsPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  return { registry, agent };
}

async function editAgentInstructions(registry, args) {
  const instruction = String(args.instruction || "").trim();
  if (!instruction) throw new Error("edit_agent requires instruction text.");

  const target = String(args.agentId || "").trim();
  if (!target) throw new Error("edit_agent requires agentId.");

  const agent = findAgentModule(registry, target);
  if (!agent) throw new Error(`Agent module not found: ${target}`);

  const mode = String(args.mode || "replace").toLowerCase();
  if (mode === "append") {
    agent.description = [agent.description, instruction].filter(Boolean).join("\n\n");
  } else {
    agent.description = instruction;
  }

  await fs.writeFile(agentsPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  return { registry, edited: { id: agent.id, name: agent.name || "Agent module", instruction: agent.description } };
}

async function editCommunication(registry, args) {
  const instruction = String(args.instruction || "").trim();
  if (!instruction) throw new Error("edit_communication requires instruction text.");

  const sender = findAgentModule(registry, String(args.senderId || "").trim());
  if (!sender) throw new Error(`Sender agent not found: ${args.senderId}`);

  const receiver = findAgentModule(registry, String(args.receiverId || "").trim());
  if (!receiver) throw new Error(`Receiver agent not found: ${args.receiverId}`);

  if (!Array.isArray(sender.agentPeers)) sender.agentPeers = [];
  if (!Array.isArray(receiver.agentPeers)) receiver.agentPeers = [];

  let senderPeer = sender.agentPeers.find((p) => p.id === receiver.id);
  if (!senderPeer) {
    senderPeer = { id: receiver.id, "communication-instruction": "" };
    sender.agentPeers.push(senderPeer);
    if (!receiver.agentPeers.find((p) => p.id === sender.id)) {
      receiver.agentPeers.push({ id: sender.id, "communication-instruction": "" });
    }
  }
  senderPeer["communication-instruction"] = instruction;

  await fs.writeFile(agentsPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  return { ok: true, senderId: sender.id, receiverId: receiver.id };
}

function summarizeAgentModules(registry) {
  return (registry.agents || []).map((agent) => ({
    id: agent.id,
    name: agent.name || "Agent module",
    instruction: String(agent.description || "").slice(0, 500),
    tools: Array.isArray(agent.toolHints) ? agent.toolHints : [],
    encouragedAgents: getAttachedAgentSummaries(agent),
    peers: (agent.agentPeers || []).map((peer) => {
      const peerAgent = (registry.agents || []).find((a) => a.id === peer.id);
      return {
        id: peer.id,
        name: peerAgent?.name || peer.id,
        communicationInstruction: peer["communication-instruction"] || ""
      };
    })
  }));
}

function buildEntryAgentInstruction(agent, globalInstruction = "", caller = null) {
  const parts = [
    `<global_instruction>\n${globalInstruction || DEFAULT_AGENT_SYSTEM_INSTRUCTION}\n</global_instruction>`,
    `<your_info>\n${stringifyAgentSelfContext(agent)}\n</your_info>`
  ];

  const attachedItems = summarizeAgentAttachments(agent);
  if (attachedItems.length > 0) {
    parts.push(`<attached_items>\n${attachedItems.join("\n\n---\n\n")}\n</attached_items>`);
  }

  const relatedAgents = getAttachedAgentSummaries(agent);
  if (relatedAgents.length > 0) {
    parts.push(`<encouraged_direct_collaborators>\n${relatedAgents.map((item) => `- ${item.name} (${item.id || "no id"})`).join("\n")}\n</encouraged_direct_collaborators>`);
  }

  if (caller) {
    parts.push(`<caller_agent>\nname: ${caller.name || "Agent module"}\nid: ${caller.id}\ndescription: ${caller.description || ""}\nReturn your reply to this caller.\n</caller_agent>`);
  }

  return parts.join("\n\n");
}

function stringifyAgentSelfContext(agent) {
  const selfContext = {
    id: agent.id,
    name: agent.name || "Agent module",
    instruction: agent.description || "",
    attachments: Array.isArray(agent.attachments) ? agent.attachments : [],
    suggestedTools: Array.isArray(agent.toolHints) ? agent.toolHints : []
  };
  const raw = JSON.stringify(selfContext, null, 2);
  return raw.length > AGENT_ATTACHMENT_CONTEXT_MAX_CHARS
    ? `${raw.slice(0, AGENT_ATTACHMENT_CONTEXT_MAX_CHARS)}\n... [truncated]`
    : raw;
}

function summarizeAgentAttachments(agent) {
  return (agent.attachments || []).map((attachment) => {
    const summary = {
      kind: attachment.kind || "Attachment",
      title: attachment.title || attachment.kind || "Context",
      payload: attachment.payload || null
    };
    const raw = JSON.stringify(summary, null, 2);
    return raw.length > AGENT_ATTACHMENT_CONTEXT_MAX_CHARS
      ? `${raw.slice(0, AGENT_ATTACHMENT_CONTEXT_MAX_CHARS)}\n... [truncated]`
      : raw;
  });
}

function findAgentModule(registry, agentId) {
  const target = String(agentId || "").trim().toLowerCase();
  if (!target) return null;

  return (registry.agents || []).find((agent) =>
    String(agent.id || "").toLowerCase() === target
    || String(agent.name || "").toLowerCase() === target
  ) || null;
}

function getAttachedAgentSummaries(agent) {
  return (agent.attachments || [])
    .filter((attachment) => attachment.kind === "Agent Module")
    .map((attachment) => ({
      id: attachment.payload?.agent?.id,
      name: attachment.title || attachment.payload?.agent?.name || "Agent module"
    }));
}

// ── Gemini agent ──────────────────────────────────────────────────────────────

app.post("/api/agent/chat", async (request, response) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    response.status(503).json({ error: "GEMINI_API_KEY is not configured." });
    return;
  }

  const { contents, messages, systemInstruction } = request.body;
  const appMessages = normalizeAppMessages(messages);
  const legacyContents = Array.isArray(contents) ? contents : [];

  if (appMessages.length === 0 && legacyContents.length === 0) {
    response.status(400).json({ error: "messages must be a non-empty array." });
    return;
  }

  // Load hubs and sources from disk once per request (used by tool handlers)
  let flatHubs = [];
  let datasetSources = [];
  let agentRegistry = { agents: [], connections: [] };
  try {
    const registry = JSON.parse(await fs.readFile(hubsPath, "utf8"));
    flatHubs = Object.entries(registry).flatMap(([type, group]) =>
      (group.items || []).map((item) => ({ id: item.id, name: item.name, url: item.url, type }))
    );
  } catch { /* no hubs configured */ }
  try {
    datasetSources = JSON.parse(await fs.readFile(datasetsPath, "utf8"));
  } catch { /* no sources configured */ }
  try {
    const loadedAgents = JSON.parse(await fs.readFile(agentsPath, "utf8"));
    if (loadedAgents && Array.isArray(loadedAgents.agents)) {
      agentRegistry = loadedAgents;
    }
  } catch { /* no agent modules configured */ }

  const activeAgent = findAgentModule(agentRegistry, getAddressedAgentId(appMessages));
  const globalInstruction = (typeof systemInstruction === "string" && systemInstruction.trim())
    ? systemInstruction.trim()
    : DEFAULT_AGENT_SYSTEM_INSTRUCTION;
  const baseInstruction = activeAgent
    ? buildEntryAgentInstruction(activeAgent, globalInstruction)
    : globalInstruction;
  const reportContent = getReportContentFromMessages(appMessages) || request.body.reportContent || "";

  const functionDeclarations = TOOL_DECLARATIONS;
  const interactionTools = toInteractionTools(functionDeclarations);
  const seenIds = new Set();
  let maxTurns = 10;

  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache");
  response.setHeader("Connection", "keep-alive");

  function send(obj) {
    if (!response.writableEnded) response.write(`data: ${JSON.stringify(obj)}\n\n`);
  }

  async function executeAgentTool(name, args = {}) {
    if (name === "list_catalogs") {
      return { catalogs: flatHubs };
    }

    if (name === "list_sources") {
      const summary = datasetSources
        .filter((s) => !s.isDeleted)
        .map((s) => ({
          id: s.id,
          name: s.name,
          description: (s.description || "").slice(0, 300),
          type: s.type,
          queryUrl: s.queryUrl || getSourceQueryBaseUrl(s),
          defaultParams: sourceParamsToObject(s.defaultParams || [])
        }));
      return { sources: summary };
    }

    if (name === "query_source") {
      try {
        return await queryConfiguredSource(datasetSources, args.sourceId, args.params || {});
      } catch (error) {
        console.error("[Agent source query] Failed:", error.message);
        return { error: error.message };
      }
    }

    if (name === "list_agents") {
      return { agents: summarizeAgentModules(agentRegistry) };
    }

    if (name === "call_agent") {
      try {
        return await callAgentModule(apiKey, agentRegistry, args.agentId, args.message || "", args.callerId || activeAgent?.id || "", Boolean(args.blind));
      } catch (error) {
        console.error("[Agent module call] Failed:", error.message);
        return { error: error.message };
      }
    }

    if (name === "create_agent") {
      try {
        const result = await createAgentModule(agentRegistry, args);
        agentRegistry = result.registry;
        send({ type: "agents_updated" });
        return { created: { id: result.agent.id, name: result.agent.name } };
      } catch (error) {
        console.error("[Agent module create] Failed:", error.message);
        return { error: error.message };
      }
    }

    if (name === "edit_agent") {
      try {
        const result = await editAgentInstructions(agentRegistry, args);
        agentRegistry = result.registry;
        send({ type: "agents_updated" });
        return { edited: result.edited, ok: true };
      } catch (error) {
        console.error("[Agent module edit] Failed:", error.message);
        return { error: error.message };
      }
    }

    if (name === "edit_communication") {
      try {
        const result = await editCommunication(agentRegistry, args);
        agentRegistry = JSON.parse(await fs.readFile(agentsPath, "utf8"));
        send({ type: "agents_updated" });
        return result;
      } catch (error) {
        console.error("[Edit communication] Failed:", error.message);
        return { error: error.message };
      }
    }

    if (name === "get_report") {
      return { content: reportContent || "" };
    }

    if (name === "update_report") {
      send({ type: "report_append", heading: args.heading || null, content: args.content });
      return { appended: true };
    }

    if (name !== "search_catalog") {
      return { error: `Unknown tool: ${name}` };
    }

    const hub = flatHubs.find((h) => h.url === args.hubUrl || args.hubUrl?.startsWith(h.url));
    const hubUrl = hub?.url || args.hubUrl;
    const hubType = hub?.type || "arcgis";
    const hubName = hub?.name || hubUrl;

    send({ type: "search_start", query: args.query, hubName, hubUrl });

    try {
      const results = hubType === "socrata"
        ? await searchSocrata(hubUrl, args.query)
        : await searchArcGIS(hubUrl, args.query, args.bbox);

      for (const item of results) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          send({ type: "result", item: { ...item, hubName, portalType: hubType } });
        }
      }

      return {
        results: results.map((r) => ({ id: r.id, title: r.title, snippet: (r.snippet || "").slice(0, 200) })),
        count: results.length
      };
    } catch (error) {
      console.error("[Agent catalog search] Failed:", error.message);
      send({ type: "search_error", query: args.query, hubName, message: error.message });
      return { error: error.message, results: [], count: 0 };
    }
  }

  function buildInteractionBody(input, previousInteractionId = null) {
    return {
      model: GEMINI_MODEL,
      input,
      ...(previousInteractionId ? { previous_interaction_id: previousInteractionId } : {}),
      tools: interactionTools,
      system_instruction: baseInstruction,
      generation_config: { temperature: 0.7, max_output_tokens: 2048 }
    };
  }

  try {
    const interactionInput = appMessages.length > 0
      ? appMessagesToInteractionInput(appMessages)
      : contentHistoryToInteractionInput(legacyContents);
    let interaction = await createInteraction(apiKey, buildInteractionBody(interactionInput));

    while (maxTurns-- > 0) {
      const functionCalls = getInteractionFunctionCalls(interaction);
      const text = getInteractionOutputText(interaction);

      if (functionCalls.length === 0) {
        if (!text) send({ type: "error", message: "No response from Gemini." });
        for (let i = 0; i < text.length; i += 60) send({ type: "text", delta: text.slice(i, i + 60) });
        break;
      }

      const functionResults = [];
      for (const call of functionCalls) {
        const result = await executeAgentTool(call.name, call.args);
        functionResults.push({
          type: "function_result",
          call_id: call.id,
          name: call.name,
          result: [{ type: "text", text: JSON.stringify(result) }]
        });
      }

      if (functionResults.length === 0) break;
      interaction = await createInteraction(apiKey, buildInteractionBody(
        functionResults.length === 1 ? functionResults[0] : functionResults,
        interaction.id
      ));
    }

    response.end();
  } catch (error) {
    console.error("[Agent] Gemini request failed", error);
    if (!response.headersSent) {
      response.status(502).json({ error: "Failed to reach Gemini API.", message: error.message });
    } else {
      response.end();
    }
  }
});


function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isJsonContentType(contentType) {
  return contentType.includes("application/json") || contentType.includes("geo+json");
}

async function start() {
  if (API_ONLY) {
    // API-only mode: no frontend, used alongside Next.js dev server
  } else if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(rootDir, "dist")));
    app.get("*", (request, response) => {
      response.sendFile(path.join(rootDir, "dist", "index.html"));
    });
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer
        }
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Research agent server running at http://localhost:${port}${API_ONLY ? " (API only)" : ""}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
