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
  { file: "herbology.html", context: "Herbology", vars: ["HERBS"], link: (s) => `/herbology#i-${s}` },
  { file: "functional-foods.html", context: "Functional Foods", vars: ["FOODS"], link: (s) => `/functional-foods#i-${s}` },
  { file: "overview.html", context: "Vitamins & Minerals", vars: ["NUTRIENTS"], link: (s) => `/overview/${s}` },
];

// Content pages: indexed whole-page (no per-item structure to deep-link into).
const CONTENT_PAGES = [
  { file: "nutrition.html", path: "/nutrition", title: "Nutrition Checklist" },
  { file: "rich-foods.html", path: "/nutrition/rich-foods", title: "Rich Foods for Key Nutrients" },
  { file: "superfoods.html", path: "/superfoods", title: "Superfoods" },
  { file: "food-for-mood.html", path: "/food-for-mood", title: "Food for Mood" },
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

const STATIC_ENTRIES = [
  {
    path: "/overview#inflammation",
    title: "Vitamins & Minerals That Fight Inflammation",
    context: "Vitamins & Minerals",
    text: "Vitamin C antioxidant neutralizes free radicals and reduces oxidative stress. Vitamin D regulates immune activity and supports anti-inflammatory effects. Vitamin E protects cell membranes from oxidative damage. Magnesium supports immune regulation and anti-inflammatory effects. Zinc supports immune function and balanced inflammatory response. Omega-3 fatty acids from fatty fish, nuts, and seeds help resolve inflammation. Selenium is an antioxidant mineral that protects cells from oxidative stress. Use balanced food sources whenever possible and consult a healthcare professional for appropriate amounts and supplement guidance."
  },
  {
    path: "/overview#focus",
    title: "Vitamins & Minerals for Focus",
    context: "Vitamins & Minerals",
    text: "Focus nutrients vitamins minerals attention concentration brain function fatigue cognitive support. Iron supports oxygen transport to the brain and helps prevent fatigue and cognitive impairment when low. Omega-3 fatty acids DHA EPA support brain function focus attention mood. B vitamins especially B12 and B6 support brain function nerve function neurotransmitters red blood cells and may reduce fatigue when deficient. Magnesium supports nerve and muscle function sleep stress regulation and attention. Vitamin D supports brain development function mood immune health and cognitive performance. Food-first balanced diet is best; consult a healthcare professional before supplements."
  },
  {
    path: "/howto#lymph-antioxidant-shake",
    title: "Lymph & Antioxidant Support Shake",
    context: "How-To",
    text: "Lymph antioxidant support shake smoothie recipe kale spinach blueberries pineapple beet chia seeds ground flaxseed ginger turmeric coconut water almond milk optional plant-based protein powder. Food-first nutrient-dense support for antioxidants inflammation balance immune nutrition hydration fiber omega-3 plant foods. Not a cancer treatment. If in active cancer treatment ask oncology team or registered dietitian about turmeric ginger antioxidants protein powders supplements and interactions."
  },
  {
    path: "/herbology#antiviral",
    title: "Antiviral & Immune-Season Herbs",
    context: "Herbology",
    text: "Antiviral herbs immune season phytotherapy. Elderberry may support cold and flu symptom burden. Echinacea supports immune response at first sign of cold. Garlic contains allicin-related sulfur compounds for immune and antimicrobial food support. Ginger gingerol supports inflammation balance nausea and respiratory-season teas. Licorice root glycyrrhizin has been studied for antiviral activity and throat support. Oregano carvacrol thymol antimicrobial activity oregano oil caution. Lemon balm calming herb studied topically for herpes simplex cold sores. Antiviral herbs are supportive tools, not substitutes for vaccination testing antivirals antibiotics or medical care."
  },
  {
    path: "/herbology#ethnobotanicals",
    title: "Ethnobotanicals",
    context: "Herbology",
    text: "Ethnobotanicals plants used traditionally for medicinal psychoactive ceremonial spiritual or therapeutic properties. Ayahuasca Banisteriopsis caapi Psychotria viridis South American ceremonial use DMT legal risk. Kava Piper methysticum calming South Pacific liver safety sedatives alcohol. Kratom Mitragyna speciosa stimulant pain-related effects dependence FDA warning. Peyote Lophophora williamsii Native American ceremonial cactus mescaline legal protected religious context. San Pedro Echinopsis pachanoi Andean ceremonial cactus. Iboga Tabernanthe iboga Central African spiritual practice cardiac risk. Salvia divinorum Mazatec shamanism dissociative effects. Mimosa hostilis DMT-containing root bark legal risk. Turmeric Rhodiola Ginseng Ginger Cacao Burdock St. John's Wort Echinacea Ginkgo biloba traditional medicinal plants. Educational cultural safety reference only; not preparation dosing sourcing or legal advice."
  },
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

entries.push(...STATIC_ENTRIES);

const out = path.join(root, "search-index.json");
writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 0) + "\n");
console.log(`Wrote ${entries.length} entries to ${path.relative(root, out)}`);
