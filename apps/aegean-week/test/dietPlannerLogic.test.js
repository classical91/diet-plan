import test from "node:test";
import assert from "node:assert/strict";

import { boosterFoods, goalPresets, mealLibrary, weeklyPlan } from "../src/dietPlannerData.js";
import {
  buildStaples,
  countProteins,
  createMealLookup,
  generateWeek,
  suggestBoosters,
  summarizeDay,
  summarizeWeek
} from "../src/dietPlannerLogic.js";

const mealLookup = createMealLookup(mealLibrary);

test("summarizeDay totals Monday correctly", () => {
  const monday = weeklyPlan[0];
  const summary = summarizeDay(monday, mealLookup, goalPresets[0]);

  assert.equal(summary.totals.potassium, 5100);
  assert.equal(summary.totals.magnesium, 697);
  assert.equal(summary.totals.protein, 141);
  assert.equal(summary.totals.fiber, 52);
  assert.equal(summary.meetsBoth, true);
});

test("summarizeWeek counts FDA potassium hits across the week", () => {
  const summary = summarizeWeek(weeklyPlan, mealLookup, goalPresets[0]);

  assert.equal(summary.days.length, 7);
  assert.equal(summary.hits.potassium, 6);
  assert.equal(summary.hits.magnesium, 7);
  assert.equal(summary.hits.both, 6);
  assert.equal(summary.averages.potassium, 4719);
});

test("suggestBoosters ranks a potassium booster for Friday", () => {
  const friday = summarizeDay(weeklyPlan[4], mealLookup, goalPresets[0]);
  const suggestions = suggestBoosters(friday, boosterFoods, 3);

  assert.equal(friday.shortfall.potassium, 450);
  assert.equal(friday.shortfall.magnesium, 0);
  assert.equal(suggestions[0].id, "bean-spinach-cup");
  assert.match(suggestions[0].reason, /potassium gap/i);
});

test("buildStaples finds the most repeated ingredients in the week", () => {
  const staples = buildStaples(weeklyPlan, mealLookup, 5);

  assert.deepEqual(
    staples.map((item) => item.name),
    ["Tomatoes", "Greek yogurt", "Cucumber", "Rolled oats", "Banana"]
  );
});

test("countProteins tallies main animal proteins used in meals", () => {
  const counts = countProteins(weeklyPlan, mealLookup);

  assert.deepEqual(counts, { Fish: 6, Chicken: 5, Beef: 3 });
});

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

test("generateWeek preserves day metadata and keeps slot assignments valid", () => {
  const generated = generateWeek(weeklyPlan, mealLibrary, { random: seededRandom(7) });

  assert.equal(generated.length, weeklyPlan.length);

  generated.forEach((day, index) => {
    const base = weeklyPlan[index];
    assert.equal(day.id, base.id);
    assert.equal(day.name, base.name);
    assert.equal(day.focus, base.focus);
    assert.deepEqual(Object.keys(day.meals), Object.keys(base.meals));

    for (const [slotKey, mealId] of Object.entries(day.meals)) {
      const meal = mealLookup.get(mealId);
      const originalMeal = mealLookup.get(base.meals[slotKey]);
      assert.ok(meal, `meal id ${mealId} should resolve`);
      assert.equal(meal.slot, originalMeal.slot);
    }
  });
});

test("generateWeek does not repeat a meal within the same week", () => {
  const generated = generateWeek(weeklyPlan, mealLibrary, { random: seededRandom(42) });
  const used = [];
  for (const day of generated) {
    for (const mealId of Object.values(day.meals)) {
      used.push(mealId);
    }
  }
  assert.equal(new Set(used).size, used.length);
});

test("generateWeek output still summarizes to full-week coverage", () => {
  const generated = generateWeek(weeklyPlan, mealLibrary, { random: seededRandom(123) });
  const summary = summarizeWeek(generated, mealLookup, goalPresets[0]);
  assert.equal(summary.days.length, 7);
  assert.ok(summary.averages.potassium > 0);
  assert.ok(summary.averages.magnesium > 0);
});
