# NutriMind

NutriMind is a nutrition and wholefood reference app. The root serves the
nutrition guide, with linked libraries for food benefits, deficiencies,
vitamins &amp; minerals, diet types, herbs &amp; teas, adaptogens, and more.

## Run

1. `cd diet-plan`
2. `npm run dev`
3. Open `http://localhost:3000` (set `PORT` to override the default)

### Optional AI features

The Daily Meal Planner's two AI panels call the Anthropic Messages API. Set
`ANTHROPIC_API_KEY` before starting the server and the browser posts to
`/api/ai`, which adds the key server-side — the key never reaches the page.
Without it the panels ask each visitor for their own key, which is then held in
that browser's `localStorage` and sent directly to `api.anthropic.com`; the
panel says so, and a **Forget key** button clears it. Prefer the server key on
anything shared or public. `ANTHROPIC_BASE_URL` overrides the upstream host for
testing.

### Your own food lists

Every list in the planner belongs to the reader. Morning and Afternoon each hold a
list of foods you tick off; Night holds your dinners. **Edit list** in any of the
three reveals a ✕ on each entry, a field for adding one, and **Reset to defaults**.

A browser that has never opened the planner is seeded once — the morning and
afternoon foods from `FOOD_SEEDS`, and seven dinners from `DINNER_SEEDS`, both at
the top of [`work-meals-app.js`](./work-meals-app.js). After that the seeds are
never consulted again, so a removed entry stays removed. The live lists are saved
under `work-meals:v3` and travel with the cross-device sync below.

Dinners carry a little more than a name. `sides` are the optional extras a dinner
offers (rice, veggies) and `on` is what it starts with; `meats` is a choice between
two versions of the same dinner, which is how the hamburger switches between beef
and chicken. A dinner you add by hand gets the rice and veggies toggles, both off.
`Fill blank nights` and `Replace week` draw from your dinner list and never repeat
one two nights running, and bulk cooking makes a single cook cover the days after it.

### Cross-device dinner-plan sync

The Daily Meal Planner remains offline-first: `work-meals:v3` in browser
`localStorage` is always updated immediately. To sync desktop and mobile, attach
a Postgres service and expose its `DATABASE_URL` to the NutriMind service. The
server creates the same `dinner_plans` table defined in
`migrations/001_create_dinner_plans.sql` with `CREATE TABLE IF NOT EXISTS`.

Enter the same private sync code (20-128 letters, numbers, `_` or `-`) on both
devices. The code itself is never stored in Postgres; a SHA-256 hash identifies
the row. On the first connection, an existing local plan is uploaded only when
no remote row exists. Later devices download that row. Revision checks reject
stale writes rather than silently overwriting a newer device, and the local copy
continues working when offline. Treat the sync code like a password.

Railway setup:

1. Add a Railway Postgres service to the NutriMind project.
2. Add `DATABASE_URL=${{Postgres.DATABASE_URL}}` (using the actual Postgres
   service name) to the NutriMind service.
3. Redeploy from the merged source, then enter one private code on desktop and
   the same code on mobile. No manual data import is required.

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
