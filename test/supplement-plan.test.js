import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import {
  starterPlan,
  blankSupplement,
  validDate,
  addDays,
  daysBetween,
  mondayOf,
  normalizeSupplementPlan,
  scheduleError,
  plannedStatus,
  cellStatus,
  toggleLog,
  endDate,
} from "../supplement-plan.js";
import { createDinnerSync, normalizePlan } from "../dinner-sync.js";
const item = (changes) => ({
  ...blankSupplement("test", "Test supplement"),
  mode: "daily",
  start: "2026-10-25",
  ...changes,
});

test("the supplied seven supplements start with no assumed dose or regimen", () => {
  const plan = starterPlan();
  assert.deepEqual(
    plan.supplements.map((s) => s.name),
    [
      "Ashwagandha",
      "Vitamin D",
      "Zinc",
      "Melatonin",
      "Immune complex (Purana)",
      "Calcium + magnesium",
      "Biotin",
    ],
  );
  for (const s of plan.supplements) {
    assert.equal(s.mode, "unset");
    assert.equal(s.dose, "");
    assert.equal(s.onDays, null);
    assert.equal(plannedStatus(s, "2026-10-25"), "unset");
  }
  assert.deepEqual(normalizeSupplementPlan(plan), plan);
});
test("date-only calculations handle DST, leap days, year transitions and local week anchors", () => {
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2024-02-29"), true);
  assert.equal(validDate("2026-2-03"), false);
  assert.equal(addDays("2026-10-31", 2), "2026-11-02");
  assert.equal(daysBetween("2026-10-25", "2026-11-08"), 14);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(mondayOf("2026-10-25"), "2026-10-19");
  assert.equal(mondayOf("2026-10-26"), "2026-10-26");
});
test("a fixed course includes day 1, stops after its last day and respects an earlier end date", () => {
  const s = item({ mode: "course", duration: 14 });
  assert.equal(endDate(s), "2026-11-07");
  assert.equal(plannedStatus(s, "2026-10-24"), "before");
  assert.equal(plannedStatus(s, "2026-10-25"), "planned");
  assert.equal(plannedStatus(s, "2026-11-07"), "planned");
  assert.equal(plannedStatus(s, "2026-11-08"), "ended");
  s.end = "2026-10-30";
  assert.equal(endDate(s), "2026-10-30");
  assert.equal(plannedStatus(s, "2026-10-31"), "ended");
});
test("cycles alternate on and break days across weeks using calendar days", () => {
  const s = item({ mode: "cycle", onDays: 14, offDays: 7 });
  assert.equal(plannedStatus(s, "2026-11-07"), "planned");
  assert.equal(plannedStatus(s, "2026-11-08"), "break");
  assert.equal(plannedStatus(s, "2026-11-14"), "break");
  assert.equal(plannedStatus(s, "2026-11-15"), "planned");
  s.end = "2026-11-13";
  assert.equal(plannedStatus(s, "2026-11-14"), "ended");
});
test("weekly, as-needed and paused schedules have distinct statuses", () => {
  const s = item({ mode: "weekdays", weekdays: [1, 3, 5] });
  assert.equal(plannedStatus(s, "2026-10-26"), "planned");
  assert.equal(plannedStatus(s, "2026-10-27"), "off");
  assert.equal(
    plannedStatus(item({ mode: "asneeded" }), "2026-10-25"),
    "asneeded",
  );
  assert.equal(plannedStatus(item({ mode: "paused" }), "2026-10-25"), "paused");
});
test("missing schedule inputs fail instead of inventing a dose or cycle", () => {
  assert.match(scheduleError(item({ mode: "cycle" })), /both on-days/);
  assert.match(scheduleError(item({ mode: "course" })), /number of days/);
  assert.match(
    scheduleError(item({ mode: "weekdays" })),
    /at least one weekday/,
  );
  assert.match(scheduleError(item({ start: "" })), /start date/);
  assert.match(scheduleError(item({ end: "2026-10-24" })), /on or after/);
  assert.equal(
    normalizeSupplementPlan({
      supplements: [item({ mode: "cycle" })],
      logs: {},
    }),
    null,
  );
});
test("taken, skipped and clear records are independent of schedule changes and future dates cannot be logged", () => {
  const s = item({ mode: "cycle", onDays: 2, offDays: 2 }),
    plan = { v: 1, supplements: [s], logs: {} };
  assert.equal(toggleLog(plan, s.id, "2026-10-27", "2026-10-28"), true);
  assert.equal(cellStatus(plan, s, "2026-10-27"), "taken");
  toggleLog(plan, s.id, "2026-10-27", "2026-10-28");
  assert.equal(cellStatus(plan, s, "2026-10-27"), "skipped");
  assert.equal(
    plannedStatus(s, "2026-10-29"),
    "planned",
    "skipping does not shift the cycle",
  );
  toggleLog(plan, s.id, "2026-10-27", "2026-10-28");
  assert.equal(cellStatus(plan, s, "2026-10-27"), "break");
  assert.equal(toggleLog(plan, s.id, "2026-10-29", "2026-10-28"), false);
  assert.equal(toggleLog(plan, s.id, "not-a-date", "2026-10-28"), false);
  toggleLog(plan, s.id, "2026-10-25", "2026-10-28");
  s.mode = "paused";
  assert.equal(cellStatus(plan, s, "2026-10-25"), "taken");
  s.archived = true;
  assert.equal(toggleLog(plan, s.id, "2026-10-26", "2026-10-28"), false);
  assert.equal(cellStatus(plan, s, "2026-10-25"), "taken");
});
test("normalization preserves empty lists and history, drops unknown log ids and rejects duplicate identities", () => {
  assert.deepEqual(normalizeSupplementPlan({ supplements: [], logs: {} }), {
    v: 1,
    supplements: [],
    logs: {},
  });
  const plan = {
    supplements: [item({ notes: "Product label", review: "2026-11-01" })],
    logs: {
      test: {
        "2026-10-25": "taken",
        "2026-10-26": "skipped",
        bad: "taken",
        "2026-10-27": "other",
      },
      unknown: { "2026-10-25": "taken" },
    },
  };
  const normalized = normalizeSupplementPlan(plan);
  assert.equal(normalized.supplements[0].notes, "Product label");
  assert.deepEqual(normalized.logs, {
    test: { "2026-10-25": "taken", "2026-10-26": "skipped" },
  });
  assert.deepEqual(
    normalizeSupplementPlan(JSON.parse(JSON.stringify(normalized))),
    normalized,
  );
  assert.equal(
    normalizeSupplementPlan({ supplements: [item(), item()], logs: {} }),
    null,
  );
  assert.equal(
    normalizeSupplementPlan({ supplements: [null], logs: {} }),
    null,
  );
  assert.equal(normalizeSupplementPlan(null), null);
});
const code = "private-calendar-sync-code-123";
function request(method, body, syncCode = code) {
  const req = Readable.from(
    body === undefined ? [] : [Buffer.from(JSON.stringify(body))],
  );
  req.method = method;
  req.headers = { "x-sync-code": syncCode };
  return req;
}
async function handle(sync, req) {
  let result;
  await sync.handle(req, {}, (_res, status, payload) => {
    result = { status, payload };
  });
  return result;
}
test("supplement sync uses its own table, normalization and revision checks", async () => {
  const calls = [],
    plan = starterPlan();
  const pool = {
    async query(sql, values) {
      calls.push({ sql, values });
      return sql.startsWith("CREATE")
        ? {}
        : {
            rowCount: 1,
            rows: [{ revision: "2", plan, updated_at: "2026-10-25" }],
          };
    },
  };
  const sync = createDinnerSync({ kind: "supplements", pool });
  assert.equal(
    (await handle(sync, request("PUT", { plan, revision: 1 }))).status,
    200,
  );
  assert.ok(calls.every((c) => c.sql.includes("supplement_plans")));
  assert.ok(calls.every((c) => !c.sql.includes("dinner_plans")));
  assert.deepEqual(JSON.parse(calls[1].values[1]), plan);
  assert.notEqual(calls[1].values[0], code);
  const read = await handle(sync, request("GET"));
  assert.deepEqual(read.payload.plan, plan);
  assert.equal(
    (await handle(sync, request("PUT", { plan: { days: {} }, revision: 2 })))
      .status,
    400,
  );
  assert.equal(
    (await handle(sync, request("GET", undefined, "short"))).status,
    401,
  );
  assert.equal((await handle(sync, request("PUT", null))).status, 400);
  assert.equal(normalizePlan({ days: {} }).supplements, undefined);
});
test("stale supplement writes are rejected and unknown store names cannot enter SQL", async () => {
  const sync = createDinnerSync({
    kind: "supplements",
    pool: {
      async query() {
        return { rowCount: 0, rows: [] };
      },
    },
  });
  assert.equal(
    (await handle(sync, request("PUT", { plan: starterPlan(), revision: 1 })))
      .status,
    409,
  );
  assert.throws(
    () => createDinnerSync({ kind: "untrusted; DROP TABLE dinner_plans" }),
    /Unknown sync store/,
  );
});
