// Builds search-index.json from the site's content.
//
// Why this exists: the nav search runs in the browser and indexes pages it is
// NOT currently on by fetching their static HTML. Card pages (benefits,
// foodtypes, …) render their cards client-side from a JS data array, so the
// fetched static HTML has an empty grid — there are no per-item DOM nodes to
// read. To get *item-level* search results that deep-link to a specific food /
// diet / deficiency, we extract those data arrays at build time and emit one
// search entry per item, each pointing at that item's deep link.
//
// Run with: npm run build:search
// Re-run whenever a card page's data array changes.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// Keep this identical to the slugify() in each card page so generated deep
// links line up with the DOM ids those pages assign to their cards.
function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Pull a top-level `const NAME = [ ... ];` array literal out of page source and
// evaluate it. The arrays are plain JS object literals (unquoted keys, trailing
// commas, // comments), so JSON.parse won't do — but the Function constructor
// evaluates them fine. They contain only our own static data, no externals.
function extractArray(src, varName) {
  const decl = new RegExp(`const\\s+${varName}\\s*=\\s*\\[`);
  const m = decl.exec(src);
  if (!m) throw new Error(`Could not find "const ${varName} = [" in source`);

  let i = m.index + m[0].length - 1; // position of the opening [
  let depth = 0;
  let str = null; // current string delimiter, or null
  let end = -1;
  for (; i < src.length; i++) {
    const c = src[i];
    if (str) {
      if (c === "\\") { i++; continue; }
      if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { str = c; continue; }
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error(`Unbalanced brackets for ${varName}`);

  const literal = src.slice(m.index + m[0].length - 1, end + 1);
  // eslint-disable-next-line no-new-func
  return new Function(`return ${literal};`)();
}

// Recursively gather every string value in an item so the whole card is
// searchable (benefits, cautions, symptoms, tags, …) without enumerating fields.
function collectStrings(value, out) {
  if (value == null) return;
  if (typeof value === "string") { out.push(value); return; }
  if (typeof value === "number" || typeof value === "boolean") return;
  if (Array.isArray(value)) { value.forEach((v) => collectStrings(v, out)); return; }
  if (typeof value === "object") {
    for (const k of Object.keys(value)) collectStrings(value[k], out);
  }
}

function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

// Card pages: data array → one entry per item, linking to its deep link.
const CARD_PAGES = [
  { file: "benefits.html", context: "Food Benefits", vars: ["DATA"], link: (s) => `/benefits/${s}` },
  { file: "deficiencies.html", context: "Deficiencies", vars: ["DATA"], link: (s) => `/deficiencies#i-${s}` },
  { file: "allergies.html", context: "Allergies", vars: ["DATA"], link: (s) => `/allergies#i-${s}` },
  { file: "diets.html", context: "Diet Types", vars: ["DIETS"], link: (s) => `/diets#i-${s}` },
  { file: "foodtypes.html", context: "Food Categories", vars: ["FOODS"], link: (s) => `/foodtypes#i-${s}` },
  { file: "adaptogens.html", context: "Adaptogens", vars: ["ADAPTOGENS"], link: (s) => `/adaptogens#i-${s}` },
  { file: "overview.html", context: "Vitamins & Minerals", vars: ["NUTRIENTS"], link: (s) => `/overview/${s}` },
];

// Content pages: indexed whole-page (no per-item structure to deep-link into).
const CONTENT_PAGES = [
  { file: "nutrition.html", path: "/nutrition", title: "Nutrition Checklist" },
  { file: "howto.html", path: "/howto", title: "How-To" },
  { file: "seasonal-rotation.html", path: "/seasonal-rotation", title: "Seasonal Rotation" },
  { file: "parasite-detox.html", path: "/parasite-detox", title: "Parasite Detox" },
  { file: "parasite-detox-recommended.html", path: "/parasite-detox/recommended", title: "Parasite Detox · Recommended Blend" },
  { file: "parasite-detox-effects.html", path: "/parasite-detox/effects", title: "Parasite Detox · Effects" },
  { file: "parasite-detox-types.html", path: "/parasite-detox/types", title: "Parasite Detox · Types" },
  { file: "parasite-detox-herbs.html", path: "/parasite-detox/herbs", title: "Parasite Detox · Herbs" },
  { file: "parasite-detox-eggs.html", path: "/parasite-detox/eggs", title: "Parasite Detox · Egg Strategy" },
  { file: "parasite-detox-detox-library.html", path: "/parasite-detox/detox-library", title: "Parasite Detox · Detox Library" },
  { file: "parasite-detox-safe-plan.html", path: "/parasite-detox/safe-plan", title: "Parasite Detox · Safe Plan" },
  { file: "parasite-detox-tracker.html", path: "/parasite-detox/tracker", title: "Parasite Detox · Tracker" },
  { file: "parasite-detox-red-flags.html", path: "/parasite-detox/red-flags", title: "Parasite Detox · Red Flags" },
];

function pageText(src) {
  // Mirror the old in-browser extractor: drop styling/head, keep script bodies
  // (some pages embed searchable data there), strip tags and JS punctuation.
  const body = src
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ")
    .replace(/[{}\[\];`]/g, " ");
  return cleanText(body);
}

const entries = [];

for (const page of CARD_PAGES) {
  const src = readFileSync(path.join(root, page.file), "utf8");
  let items = [];
  for (const v of page.vars) items = items.concat(extractArray(src, v));
  for (const item of items) {
    if (!item || !item.name) continue;
    const slug = slugify(item.name);
    const strings = [];
    collectStrings(item, strings);
    entries.push({
      path: page.link(slug),
      title: item.name,
      context: page.context,
      text: cleanText(strings.join(" ")),
    });
  }
}

for (const page of CONTENT_PAGES) {
  const src = readFileSync(path.join(root, page.file), "utf8");
  entries.push({
    path: page.path,
    title: page.title,
    context: "",
    text: pageText(src),
  });
}

const out = path.join(root, "search-index.json");
writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 0) + "\n");
console.log(`Wrote ${entries.length} entries to ${path.relative(root, out)}`);
