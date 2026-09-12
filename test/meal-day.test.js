import test from "node:test";
import assert from "node:assert/strict";
import { dayIdFromDate, dayIdFromDateKey, describeDinner, summarizeDay } from "../meal-day.js";
import { dailyMealPlan } from "../daily-meal-plan.js";

const code = "desktop-mobile-private-code-123";

// One week as the planner stores it: a normal work day, a day eaten at home,
// a hidden lunch, and a night carrying leftovers of an earlier cook.
const plan = {
  selectedDay: "wed",
  foodLists: {
    morning: ["Eggs", "Oatmeal"],
    afternoon: ["Tuna or salmon wrap", "Mixed nuts + a piece of fruit"],
    night: []
  },
  days: {
    wed: {
      states: { morning: "work", afternoon: "work", night: "work" },
      checked: { "morning|eggs": true, "afternoon|tuna-or-salmon-wrap": true, "afternoon|mixed-nuts-a-piece-of-fruit": true },
      ai: {},
      dinner: { pick: true, name: "Chicken", meat: null, sides: ["rice", "veggies"] },
      leftovers: { morning: "", afternoon: "", night: "" }
    },
    thu: {
      states: { morning: "home", afternoon: "skip", night: "work" },
      checked: {},
      ai: {},
      dinner: { name: "Chicken", from: "wed" },
      leftovers: { morning: "", afternoon: "Chicken + rice", night: "" }
    },
    fri: { states: {}, checked: {}, ai: {}, dinner: null, leftovers: {} }
  }
};

test("a day reads as the three lines the calendar prints", () => {
  const day = summarizeDay(plan, "wed");

  assert.equal(day.label, "Wednesday");
  assert.equal(day.planned, true);
  assert.deepEqual(day.slots.map(slot => [slot.id, slot.text]), [
    ["morning", "Eggs"],
    ["afternoon", "Tuna or salmon wrap, Mixed nuts + a piece of fruit"],
    ["night", "Chicken — rice · veggies"]
  ]);
});

test("a slot set to Hide is left out of a summary, and kept for the calendar", () => {
  // The card reading this should be told about the meals that are happening,
  // not about the one deliberately turned off.
  assert.deepEqual(summarizeDay(plan, "thu").slots.map(slot => slot.id), ["morning", "night"]);

  const full = summarizeDay(plan, "thu", { includeHidden: true });
  assert.deepEqual(full.slots.map(slot => slot.id), ["morning", "afternoon", "night"]);
  assert.equal(full.slots[1].hidden, true);
  assert.equal(full.slots[1].text, "Hidden");
});

test("eating at home, a packed leftover lunch and a leftover dinner each say so", () => {
  const thursday = summarizeDay(plan, "thu", { includeHidden: true });
  assert.equal(thursday.slots[0].text, "Eating at home");
  // The lunch is hidden on Thursday, but the same leftover in a shown slot reads
  // as the planner wrote it.
  assert.equal(thursday.slots[1].text, "Hidden");
  assert.equal(thursday.slots[2].text, "Chicken — ♻️ Leftovers from Wednesday");
});

test("an empty day is answered as empty rather than left out", () => {
  const friday = summarizeDay(plan, "fri");
  assert.equal(friday.planned, false);
  assert.deepEqual(friday.slots.map(slot => slot.text), ["Not chosen yet", "Not chosen yet", "Nothing planned yet"]);

  // A day the planner has never touched at all answers the same way, rather
  // than throwing on a missing key.
  assert.equal(summarizeDay(plan, "sun").planned, false);
  assert.equal(summarizeDay({}, "sun").slots.length, 3);
});

test("ordering out and a night already eaten are dinners too", () => {
  assert.deepEqual(describeDinner({ type: "out" }), { main: "🍽️ Ordering out", sub: "" });
  assert.equal(describeDinner({ type: "full" }).main, "✅ Already full");
  assert.equal(describeDinner(null), null);
  assert.equal(describeDinner({}), null);
  // A dinner named after its own protein does not say the protein twice.
  assert.deepEqual(describeDinner({ name: "Beef", protein: "beef", carb: "rice" }), { main: "Beef", sub: "rice" });
});

test("the weekday comes from the date asked about, not this container's clock", () => {
  assert.equal(dayIdFromDateKey("2026-09-12"), "sat");
  assert.equal(dayIdFromDateKey("2026-09-14"), "mon");
  // Vancouver's Friday evening is already Saturday in UTC. The date sent is the
  // day it means, so it must not be re-read in the server's timezone.
  assert.equal(dayIdFromDateKey("2026-09-11"), "fri");
  assert.equal(dayIdFromDate(new Date(2026, 8, 12, 23, 30)), "sat");

  for (const bad of ["", null, "2026-9-12", "12-09-2026", "2026-02-30", "today"]) {
    assert.equal(dayIdFromDateKey(bad), null, `${bad} was read as a date`);
  }
});

// ─── The route ──────────────────────────────────────────────────────────────

const readPlan = async (syncCode) => {
  if (syncCode !== code) throw Object.assign(new Error("A valid sync code is required."), { status: 401 });
  return { plan, revision: 7, updatedAt: "2026-09-09T02:11:00.000Z" };
};

test("the day asked for is the day answered with", async () => {
  const answer = await dailyMealPlan({ method: "GET", dateKey: "2026-09-09", syncCode: code, readPlan });
  assert.equal(answer.status, 200);
  assert.equal(answer.payload.date, "2026-09-09");
  assert.equal(answer.payload.today.day, "wed");
  assert.equal(answer.payload.today.slots[0].text, "Eggs");
  assert.equal(answer.payload.revision, 7);
});

test("the week, the food lists and the dinner list never leave", async () => {
  const answer = await dailyMealPlan({ method: "GET", dateKey: "2026-09-09", syncCode: code, readPlan });
  const sent = JSON.stringify(answer.payload);

  assert.equal(answer.payload.today.days, undefined);
  assert.equal(answer.payload.plan, undefined);
  assert.equal(sent.includes("foodLists"), false);
  assert.equal(sent.includes("Oatmeal"), false, "a food that was never ticked was sent anyway");
  assert.equal(sent.includes(code), false, "the sync code came back in the answer");
});

test("a bad code, a missing plan and a bad date are told apart", async () => {
  assert.equal((await dailyMealPlan({ method: "GET", dateKey: null, syncCode: "nope", readPlan })).status, 401);
  assert.equal((await dailyMealPlan({ method: "GET", dateKey: "yesterday", syncCode: code, readPlan })).status, 400);
  assert.equal((await dailyMealPlan({ method: "PUT", dateKey: null, syncCode: code, readPlan })).status, 405);

  const empty = await dailyMealPlan({ method: "GET", dateKey: null, syncCode: code, readPlan: async () => null });
  assert.equal(empty.status, 404);
});

test("no date falls back to the server's own day", async () => {
  const answer = await dailyMealPlan({
    method: "GET", dateKey: null, syncCode: code, readPlan, now: new Date(2026, 8, 9, 8, 0)
  });
  assert.equal(answer.payload.today.day, "wed");
  assert.equal(answer.payload.date, null);
});
