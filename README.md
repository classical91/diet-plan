# Diet Plan

This workspace now opens the Mediterranean diet planner from the root.

## Run

1. `cd "C:\Users\JAson\Documents\codex\diet-plan"`
2. `npm run dev`
3. Open `http://localhost:3004`

## Source

- [`index.html`](./index.html) is the root entry page and loads the planner directly.
- [`apps/aegean-week`](./apps/aegean-week) contains the planner source, data, tests, and standalone app files.
- `npm test` at the root runs the planner test suite from `apps/aegean-week`.

## Notes

- Older non-diet files from the copied workspace are still present, but the root app now points to the diet planner.
- If you want to run the planner from its own folder instead, use [`apps/aegean-week/server.js`](./apps/aegean-week/server.js) on port `30005`.
