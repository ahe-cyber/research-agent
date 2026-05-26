const express = require("express");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const app = express();
const httpServer = http.createServer(app);
const port = Number(process.env.PORT || 5173);
const rootDir = __dirname;
const datasetsPath = path.join(rootDir, "public", "resources", "datasets.json");

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
