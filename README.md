# NutriMind

NutriMind is a nutrition and wholefood reference app. The root serves the
nutrition guide, with linked libraries for food benefits, deficiencies,
vitamins &amp; minerals, diet types, herbs &amp; teas, adaptogens, and more.

## Run

1. `cd diet-plan`
2. `npm run dev`
3. Open `http://localhost:3000` (set `PORT` to override the default)

## Source

- [`index.html`](./index.html) is the root entry page and loads the planner directly.
- [`apps/aegean-week`](./apps/aegean-week) contains the planner source, data, tests, and standalone app files.
- `npm test` at the root runs the planner test suite from `apps/aegean-week`.

## Search

The top-nav search returns **item-level** results — searching e.g. "pumpkin"
or "cucurbitin" links straight to that food's page (`/benefits/pumpkin-seeds`)
or scrolls to and highlights the matching card (`/deficiencies#i-vitamin-d`).

Results are served from `search-index.json`, generated from each card page's
data by `npm run build:search`. **Re-run it whenever you edit a card page's
data array** (the `DATA` / `FOODS` / `DIETS` / `ADAPTOGENS` lists in
benefits, deficiencies, allergies, diets, foodtypes, adaptogens,
functional-foods) so the search stays in sync.

## Notes

- Older non-diet files from the copied workspace are still present, but the root app now points to the diet planner.
- If you want to run the planner from its own folder instead, use [`apps/aegean-week/server.js`](./apps/aegean-week/server.js) on port `30005`.
