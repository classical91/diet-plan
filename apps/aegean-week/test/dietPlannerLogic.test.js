import test from "node:test";
import assert from "node:assert/strict";

import { boosterFoods, dinnerTitles, goalPresets, mealLibrary, weeklyPlan } from "../src/dietPlannerData.js";
import {
  buildDinnerIdeas,
  buildGroceryList,
  buildStaples,
  countProteins,
  createMealLookup,
  formatGroceryListText,
  generateWeek,
  mealFitsSlot,
  normalizeCustomMeals,
  normalizeManualFoods,
  suggestBoosters,
  suggestQuickPicks,
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

test("buildGroceryList attaches portion text using the portion map", () => {
  const list = buildGroceryList(weeklyPlan, mealLookup, { "Greek yogurt": "¾ cup" });
  const produce = list.find((g) => g.category === "Dairy");
  const yogurt = produce.items.find((i) => i.name === "Greek yogurt");
  assert.ok(yogurt, "Greek yogurt should appear in dairy");
  assert.ok(yogurt.count > 1);
  assert.equal(yogurt.portionText, `${yogurt.count} × ¾ cup`);
});

test("buildGroceryList falls back to portion-count text when no map", () => {
  const list = buildGroceryList(weeklyPlan, mealLookup);
  const anyItem = list[0].items[0];
  assert.match(anyItem.portionText, /portion/);
});

test("formatGroceryListText produces a plain-text shopping list", () => {
  const list = buildGroceryList(weeklyPlan, mealLookup, { "Greek yogurt": "¾ cup" });
  const text = formatGroceryListText(list);
  assert.match(text, /Greek yogurt — \d+ × ¾ cup/);
  assert.ok(text.includes("Protein") || text.includes("Produce"));
});

test("normalizeCustomMeals returns null for non-object input", () => {
  assert.equal(normalizeCustomMeals(null), null);
  assert.equal(normalizeCustomMeals("nope"), null);
  assert.equal(normalizeCustomMeals(42), null);
});

test("normalizeCustomMeals returns null when no usable meals", () => {
  assert.equal(normalizeCustomMeals({ work: {}, home: {} }), null);
  assert.equal(normalizeCustomMeals({ work: { breakfast: [{ id: "x" }] } }), null);
});

test("normalizeCustomMeals keeps valid meals and coerces missing nutrients", () => {
  const raw = {
    work: {
      breakfast: [
        {
          id: "w-b-1",
          title: "Eggs and toast",
          subtitle: "Quick",
          protein: "Vegetarian",
          ingredients: [{ name: "Eggs", group: "Protein" }],
          nutrients: { potassium: 200, magnesium: 30, protein: 18 }
        }
      ],
      lunch: [], dinner: [], snack: []
    },
    home: { breakfast: [], lunch: [], dinner: [], snack: [] }
  };
  const result = normalizeCustomMeals(raw);
  assert.ok(result);
  const meal = result.work.breakfast[0];
  assert.equal(meal.id, "w-b-1");
  assert.equal(meal.nutrients.calories, 0);
  assert.equal(meal.nutrients.fiber, 0);
  assert.equal(meal.nutrients.protein, 18);
});

test("normalizeCustomMeals drops meals with no valid ingredients", () => {
  const raw = {
    work: {
      breakfast: [
        { id: "ok", title: "Has ingredient", ingredients: [{ name: "Eggs", group: "Protein" }] },
        { id: "bad", title: "No ingredients", ingredients: [] },
        { id: "bad2", title: "Garbage", ingredients: [{ name: "", group: "Pantry" }] }
      ],
      lunch: [], dinner: [], snack: []
    },
    home: { breakfast: [], lunch: [], dinner: [], snack: [] }
  };
  const result = normalizeCustomMeals(raw);
  assert.equal(result.work.breakfast.length, 1);
  assert.equal(result.work.breakfast[0].id, "ok");
});

test("normalizeCustomMeals renames duplicate meal ids", () => {
  const raw = {
    work: {
      breakfast: [
        { id: "dup", title: "A", ingredients: [{ name: "Eggs", group: "Protein" }] },
        { id: "dup", title: "B", ingredients: [{ name: "Eggs", group: "Protein" }] }
      ],
      lunch: [], dinner: [], snack: []
    },
    home: { breakfast: [], lunch: [], dinner: [], snack: [] }
  };
  const result = normalizeCustomMeals(raw);
  const ids = result.work.breakfast.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("normalizeCustomMeals coerces unknown protein and group to safe defaults", () => {
  const raw = {
    work: {
      breakfast: [
        {
          id: "w-b-1",
          title: "Mystery",
          protein: "Alien",
          ingredients: [{ name: "Unknown", group: "Spacefood" }]
        }
      ],
      lunch: [], dinner: [], snack: []
    },
    home: { breakfast: [], lunch: [], dinner: [], snack: [] }
  };
  const result = normalizeCustomMeals(raw);
  assert.equal(result.work.breakfast[0].protein, "Vegetarian");
  assert.equal(result.work.breakfast[0].ingredients[0].group, "Various");
});

test("normalizeManualFoods keeps valid slots and defaults empty slots to Snack", () => {
  const raw = [
    {
      id: "food-beyond",
      title: "Beyond Meat sausage",
      slots: ["Dinner", "Lunch", "Dinner", "Brunch"],
      ingredients: [{ name: "Beyond Meat sausage", group: "Protein" }]
    },
    {
      id: "food-carrots",
      title: "Baby carrots",
      slots: ["Brunch"],
      ingredients: [{ name: "Baby carrots", group: "Vegetable" }]
    },
    { id: "food-broken", title: "", slots: ["Dinner"], ingredients: [] }
  ];
  const foods = normalizeManualFoods(raw);

  assert.equal(foods.length, 2);
  assert.deepEqual(foods[0].slots, ["Dinner", "Lunch"]);
  assert.equal(foods[0].slot, "Dinner");
  assert.deepEqual(foods[1].slots, ["Snack"]);
});

test("mealFitsSlot matches both single-slot meals and multi-slot foods", () => {
  const libraryMeal = { id: "a", slot: "Dinner" };
  const manualFood = { id: "b", slot: "Lunch", slots: ["Lunch", "Dinner"] };

  assert.equal(mealFitsSlot(libraryMeal, "Dinner"), true);
  assert.equal(mealFitsSlot(libraryMeal, "Lunch"), false);
  assert.equal(mealFitsSlot(manualFood, "Dinner"), true);
  assert.equal(mealFitsSlot(manualFood, "Breakfast"), false);
});

test("suggestQuickPicks returns two night items preferring the user's own foods", () => {
  const manual = [
    { id: "food-beyond", title: "Beyond sausage", slot: "Dinner", slots: ["Dinner"] },
    { id: "food-hummus", title: "Hummus cup", slot: "Snack", slots: ["Snack"] },
    { id: "food-toast", title: "Morning toast", slot: "Breakfast", slots: ["Breakfast"] }
  ];
  const fallback = [
    { id: "lib-dinner", title: "Fish plate", slot: "Dinner" },
    { id: "lib-snack", title: "Nuts", slot: "Snack" }
  ];
  const picks = suggestQuickPicks(manual, fallback, "night", { random: () => 0 });

  assert.equal(picks.length, 2);
  assert.equal(picks.every((p) => p.id.startsWith("food-")), true);
  assert.equal(picks.some((p) => p.id === "food-toast"), false);
});

test("suggestQuickPicks tops up from the fallback library for daytime", () => {
  const manual = [
    { id: "food-smoothie", title: "Green smoothie", slot: "Lunch", slots: ["Lunch"] }
  ];
  const fallback = [
    { id: "lib-breakfast", title: "Oats", slot: "Breakfast" },
    { id: "lib-dinner", title: "Beef plate", slot: "Dinner" }
  ];
  const picks = suggestQuickPicks(manual, fallback, "day", { random: () => 0 });

  assert.equal(picks.length, 2);
  assert.equal(picks[0].id, "food-smoothie");
  assert.equal(picks[1].id, "lib-breakfast");
});

test("buildDinnerIdeas turns the whole title bank into unique dinner meals", () => {
  const ideas = buildDinnerIdeas(dinnerTitles);

  assert.equal(ideas.length, dinnerTitles.length);
  assert.equal(new Set(ideas.map((i) => i.id)).size, ideas.length);
  assert.equal(ideas.every((i) => i.slot === "Dinner"), true);
  assert.equal(ideas.every((i) => i.ingredients.length > 0), true);
  const lookup = createMealLookup(ideas);
  assert.equal(ideas.every((i) => lookup.has(i.id)), true);
});

test("buildDinnerIdeas infers protein, side, and vegetable from the title", () => {
  const [idea] = buildDinnerIdeas(["Chicken Broccoli"]);
  assert.equal(idea.protein, "Chicken");
  assert.deepEqual(idea.ingredients.map((i) => i.name), ["Chicken", "Broccoli"]);
  assert.ok(idea.nutrients.calories > 0);
  assert.ok(idea.nutrients.potassium > 0);
});

test("buildDinnerIdeas keeps green beans a vegetable, not the legume bean", () => {
  const [greenBean] = buildDinnerIdeas(["Green Bean Rice"]);
  assert.equal(greenBean.protein, "Vegetarian");
  assert.deepEqual(greenBean.ingredients.map((i) => i.name), ["Rice", "Green beans"]);

  const [burrito] = buildDinnerIdeas(["Bean Rice Burrito"]);
  assert.equal(burrito.ingredients.some((i) => i.name === "Beans" && i.group === "Legume"), true);
});

test("buildDinnerIdeas falls back to the title when no keyword matches", () => {
  const [idea] = buildDinnerIdeas(["Mystery Plate"]);
  assert.equal(idea.ingredients.length, 1);
  assert.equal(idea.ingredients[0].name, "Mystery Plate");
  assert.ok(idea.nutrients.calories > 0);
});

test("buildDinnerIdeas disambiguates duplicate titles with suffixes", () => {
  const ideas = buildDinnerIdeas(["Tuna", "Tuna"]);
  assert.equal(ideas.length, 2);
  assert.notEqual(ideas[0].id, ideas[1].id);
});
