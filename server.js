import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT) || 3000;

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

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    let pathname = url.pathname;

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
    if (pathname === "/functional-foods" || pathname === "/functional-foods/") {
      pathname = "/functional-foods.html";
    }
    if (pathname === "/food-for-mood" || pathname === "/food-for-mood/") {
      pathname = "/food-for-mood.html";
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
  console.log(`Diet Plan running at http://localhost:${actualPort}`);
});
