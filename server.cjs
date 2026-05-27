const express = require("express");
const fs = require("node:fs/promises");
const fssync = require("node:fs");
const http = require("node:http");
const path = require("node:path");

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
const port = Number(process.env.PORT || 5173);
const rootDir = __dirname;
const datasetsPath = path.join(rootDir, "public", "resources", "datasets.json");
const POSTMAN_API_BASE = "https://api.getpostman.com";

app.use(express.json({ limit: "1mb" }));

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

// ── Gemini agent ──────────────────────────────────────────────────────────────

app.post("/api/agent/chat", async (request, response) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    response.status(503).json({ error: "GEMINI_API_KEY is not configured." });
    return;
  }

  const { contents, systemInstruction } = request.body;

  if (!Array.isArray(contents) || contents.length === 0) {
    response.status(400).json({ error: "contents must be a non-empty array." });
    return;
  }

  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

  const resolvedInstruction = (typeof systemInstruction === "string" && systemInstruction.trim())
    ? systemInstruction.trim()
    : "You are a GIS research assistant. Help the user analyze geographic data, property records, and datasets. Be concise and factual. When record data is provided in <context> tags, use it to answer the question.";

  const geminiBody = {
    contents,
    systemInstruction: {
      parts: [{ text: resolvedInstruction }]
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048
    }
  };

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody)
    });

    if (!upstream.ok) {
      const errorBody = await upstream.json().catch(() => ({}));
      response.status(upstream.status).json({
        error: errorBody.error?.message || `Gemini API returned ${upstream.status}`
      });
      return;
    }

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");

    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!response.write(value)) {
          await new Promise((resolve) => response.once("drain", resolve));
        }
      }
    } finally {
      reader.releaseLock();
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
  if (process.env.NODE_ENV === "production") {
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
    console.log(`Research agent server running at http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
