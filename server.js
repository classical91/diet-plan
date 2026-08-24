import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDinnerSync } from "./dinner-sync.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT) || 3000;
const dinnerSync = createDinnerSync();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

// Anthropic proxy. When ANTHROPIC_API_KEY is set the browser calls /api/ai and
// the key never leaves the server; without it the endpoint reports 501 and the
// planner falls back to a key the user types in.
const AI_BASE = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
const AI_MODEL = "claude-opus-4-8";
const AI_MAX_BODY = 64 * 1024;

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > AI_MAX_BODY) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function handleAi(request, response) {
  const key = process.env.ANTHROPIC_API_KEY;

  // Lets the page decide whether to ask the user for a key at all.
  if (request.method === "GET") return sendJson(response, 200, { configured: !!key });
  if (request.method !== "POST") return sendJson(response, 405, { error: { message: "Use POST." } });
  if (!key) return sendJson(response, 501, { error: { message: "No server API key configured." } });

  let body;
  try {
    body = JSON.parse(await readBody(request));
  } catch (error) {
    return sendJson(response, 400, { error: { message: "Invalid request body." } });
  }

  // Rebuild the payload rather than forwarding it — the client picks the prompt,
  // not the model, the token budget, or any header.
  const messages = Array.isArray(body.messages) ? body.messages.slice(0, 8) : [];
  if (!messages.length) return sendJson(response, 400, { error: { message: "No messages to send." } });
  const payload = {
    model: AI_MODEL,
    max_tokens: Math.min(Math.max(Number(body.max_tokens) || 1024, 1), 2048),
    messages,
  };
  if (typeof body.system === "string" && body.system) payload.system = body.system;

  try {
    const upstream = await fetch(`${AI_BASE}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });
    const text = await upstream.text();
    response.writeHead(upstream.status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    });
    response.end(text);
  } catch (error) {
    sendJson(response, 502, { error: { message: "Could not reach the Anthropic API." } });
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    let pathname = url.pathname;

    if (pathname === "/api/ai") {
      await handleAi(request, response);
      return;
    }
    if (pathname === "/api/dinner-plan") {
      if (!dinnerSync.configured) return sendJson(response, 503, { error: "Dinner sync is not configured." });
      await dinnerSync.handle(request, response, sendJson);
      return;
    }

    // Route / and /nutrition -> nutrition.html
    if (pathname === "/" || pathname === "") {
      pathname = "/nutrition.html";
    }
    if (pathname === "/nutrition" || pathname === "/nutrition/") {
      pathname = "/nutrition.html";
    }
    if (pathname === "/nutrition/rich-foods" || pathname === "/nutrition/rich-foods/") {
      pathname = "/rich-foods.html";
    }
    if (pathname === "/benefits" || pathname === "/benefits/") {
      pathname = "/benefits.html";
    }
    // /benefits/<slug> also serves benefits.html; the page reads the slug
    // from location.pathname and renders a per-food detail view.
    if (pathname.startsWith("/benefits/") && pathname !== "/benefits/") {
      pathname = "/benefits.html";
    }
    if (pathname === "/deficiencies" || pathname === "/deficiencies/") {
      pathname = "/deficiencies.html";
    }
    if (pathname === "/bodily-deficiencies" || pathname === "/bodily-deficiencies/") {
      pathname = "/bodily-deficiencies.html";
    }
    if (pathname === "/overview" || pathname === "/overview/") {
      pathname = "/overview.html";
    }
    // /overview/<slug> serves overview.html; the page reads the slug from
    // location.pathname and renders a per-nutrient detail view.
    if (pathname.startsWith("/overview/") && pathname !== "/overview/") {
      pathname = "/overview.html";
    }
    if (pathname === "/howto" || pathname === "/howto/") {
      pathname = "/howto.html";
    }
    if (pathname === "/diets" || pathname === "/diets/") {
      pathname = "/diets.html";
    }
    if (pathname === "/allergies" || pathname === "/allergies/") {
      pathname = "/allergies.html";
    }
    if (pathname === "/foodtypes" || pathname === "/foodtypes/") {
      pathname = "/foodtypes.html";
    }
    if (pathname === "/adaptogens" || pathname === "/adaptogens/") {
      pathname = "/adaptogens.html";
    }
    if (pathname === "/herbology" || pathname === "/herbology/") {
      pathname = "/herbology.html";
    }
    if (pathname === "/tea" || pathname === "/tea/") {
      pathname = "/tea.html";
    }
    if (pathname === "/spices" || pathname === "/spices/") {
      pathname = "/spices.html";
    }
    if (pathname === "/functional-foods" || pathname === "/functional-foods/") {
      pathname = "/functional-foods.html";
    }
    if (pathname === "/food-for-mood" || pathname === "/food-for-mood/") {
      pathname = "/food-for-mood.html";
    }
    if (pathname === "/nervous-system" || pathname === "/nervous-system/") {
      pathname = "/nervous-system.html";
    }
    if (pathname === "/studies" || pathname === "/studies/") {
      pathname = "/studies.html";
    }
    if (pathname === "/glossary" || pathname === "/glossary/") {
      pathname = "/glossary.html";
    }
    if (pathname === "/work-meals" || pathname === "/work-meals/") {
      pathname = "/work-meals.html";
    }
    if (pathname === "/weekly-calendar" || pathname === "/weekly-calendar/") {
      pathname = "/weekly-calendar.html";
    }
    if (pathname === "/seasonal-rotation" || pathname === "/seasonal-rotation/") {
      pathname = "/seasonal-rotation.html";
    }
    if (pathname === "/detox-types" || pathname === "/detox-types/") {
      pathname = "/detox-types.html";
    }
    if (pathname === "/electrolytes-minerals" || pathname === "/electrolytes-minerals/") {
      pathname = "/electrolytes-minerals.html";
    }
    if (pathname === "/elements-in-biology" || pathname === "/elements-in-biology/") {
      pathname = "/elements-in-biology.html";
    }
    if (pathname === "/hydration" || pathname === "/hydration/") {
      pathname = "/hydration.html";
    }
    if (pathname === "/superfoods" || pathname === "/superfoods/") {
      pathname = "/superfoods.html";
    }
    if (pathname === "/foods-dementia-risk" || pathname === "/foods-dementia-risk/") {
      pathname = "/foods-dementia-risk.html";
    }
    if (pathname === "/parasite-detox" || pathname === "/parasite-detox/") {
      pathname = "/parasite-detox.html";
    } else if (pathname.startsWith("/parasite-detox/")) {
      // /parasite-detox/<slug> serves parasite-detox-<slug>.html
      const slug = pathname.slice("/parasite-detox/".length).replace(/\/+$/, "");
      if (/^[a-z0-9-]+$/.test(slug)) {
        pathname = `/parasite-detox-${slug}.html`;
      }
    }

    const clean = pathname.replace(/^\/+/, "");
    const filePath = path.join(__dirname, clean);

    if (!filePath.startsWith(__dirname) || !existsSync(filePath)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`Server error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});

server.listen(port, () => {
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  console.log(`NutriMind running at http://localhost:${actualPort}`);
});
