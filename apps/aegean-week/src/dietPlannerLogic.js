export function createMealLookup(mealLibrary) {
  return new Map(mealLibrary.map((meal) => [meal.id, meal]));
}

function sumNutrients(current, addition) {
  return {
    potassium: current.potassium + addition.potassium,
    magnesium: current.magnesium + addition.magnesium,
    protein: current.protein + addition.protein,
    fiber: current.fiber + addition.fiber,
    calories: current.calories + addition.calories
  };
}

export function summarizeDay(day, mealLookup, goals) {
  const slots = Object.entries(day.meals).map(([slotKey, mealId]) => {
    const meal = mealLookup.get(mealId);

    if (!meal) {
      throw new Error(`Unknown meal id "${mealId}" in ${day.id}`);
    }

    return { slotKey, meal };
  });

  const totals = slots.reduce(
    (current, entry) => sumNutrients(current, entry.meal.nutrients),
    { potassium: 0, magnesium: 0, protein: 0, fiber: 0, calories: 0 }
  );

  const shortfall = {
    potassium: Math.max(goals.potassium - totals.potassium, 0),
    magnesium: Math.max(goals.magnesium - totals.magnesium, 0)
  };

  const coverage = {
    potassium: totals.potassium / goals.potassium,
    magnesium: totals.magnesium / goals.magnesium
  };

  return {
    ...day,
    slots,
    totals,
    shortfall,
    coverage,
    meetsPotassium: shortfall.potassium === 0,
    meetsMagnesium: shortfall.magnesium === 0,
    meetsBoth: shortfall.potassium === 0 && shortfall.magnesium === 0
  };
}

export function summarizeWeek(weekPlan, mealLookup, goals) {
  const days = weekPlan.map((day) => summarizeDay(day, mealLookup, goals));
  const totalDays = Math.max(days.length, 1);
  const totals = days.reduce(
    (current, day) => sumNutrients(current, day.totals),
    { potassium: 0, magnesium: 0, protein: 0, fiber: 0, calories: 0 }
  );

  const averages = {
    potassium: Math.round(totals.potassium / totalDays),
    magnesium: Math.round(totals.magnesium / totalDays),
    protein: Math.round(totals.protein / totalDays),
    fiber: Math.round(totals.fiber / totalDays),
    calories: Math.round(totals.calories / totalDays)
  };

  const hits = {
    both: days.filter((day) => day.meetsBoth).length,
    potassium: days.filter((day) => day.meetsPotassium).length,
    magnesium: days.filter((day) => day.meetsMagnesium).length
  };

  return { days, totals, averages, hits };
}

export function suggestBoosters(daySummary, boosters, limit = 3) {
  const needsPotassium = daySummary.shortfall.potassium;
  const needsMagnesium = daySummary.shortfall.magnesium;
  const hasGap = needsPotassium > 0 || needsMagnesium > 0;

  const ranked = boosters
    .map((booster) => {
      const remainingPotassium = Math.max(needsPotassium - booster.nutrients.potassium, 0);
      const remainingMagnesium = Math.max(needsMagnesium - booster.nutrients.magnesium, 0);
      const potassiumCoverage =
        needsPotassium > 0 ? 1 - remainingPotassium / needsPotassium : 0.35;
      const magnesiumCoverage =
        needsMagnesium > 0 ? 1 - remainingMagnesium / needsMagnesium : 0.35;
      const efficiency =
        (booster.nutrients.potassium + booster.nutrients.magnesium * 4) / booster.nutrients.calories;
      const score = (potassiumCoverage + magnesiumCoverage) * 2 + efficiency;

      return {
        ...booster,
        score,
        potassiumCoverage,
        magnesiumCoverage,
        catchesUp: booster.nutrients.potassium >= needsPotassium && booster.nutrients.magnesium >= needsMagnesium,
        reason: hasGap
          ? buildGapReason(booster, needsPotassium, needsMagnesium)
          : "Optional support if you swap a meal or need extra volume."
      };
    })
    .sort((left, right) => right.score - left.score);

  return ranked.slice(0, limit);
}

function buildGapReason(booster, needsPotassium, needsMagnesium) {
  const potassiumText =
    needsPotassium > 0
      ? `${Math.min(100, Math.round((booster.nutrients.potassium / needsPotassium) * 100))}% of the potassium gap`
      : "extra potassium support";
  const magnesiumText =
    needsMagnesium > 0
      ? `${Math.min(100, Math.round((booster.nutrients.magnesium / needsMagnesium) * 100))}% of the magnesium gap`
      : "extra magnesium support";

  return `${potassiumText}, ${magnesiumText}.`;
}

export function buildStaples(weekPlan, mealLookup, limit = 14) {
  const counts = new Map();

  for (const day of weekPlan) {
    for (const mealId of Object.values(day.meals)) {
      const meal = mealLookup.get(mealId);
      if (!meal) {
        continue;
      }

      for (const ingredient of meal.ingredients) {
        const entry = counts.get(ingredient.name) ?? {
          name: ingredient.name,
          group: ingredient.group,
          count: 0
        };
        entry.count += 1;
        counts.set(ingredient.name, entry);
      }
    }
  }

  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, limit);
}

export function countProteins(weekPlan, mealLookup) {
  const counts = { Fish: 0, Chicken: 0, Beef: 0 };

  for (const day of weekPlan) {
    for (const mealId of Object.values(day.meals)) {
      const meal = mealLookup.get(mealId);
      if (!meal || !(meal.protein in counts)) {
        continue;
      }
      counts[meal.protein] += 1;
    }
  }

  return counts;
}

export function formatMetric(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function percentText(value) {
  return `${Math.round(value * 100)}%`;
}

const GROCERY_CATEGORY_MAP = {
  Protein: "Protein",
  Legume: "Protein",
  "Whole grain": "Carbs",
  Vegetable: "Produce",
  Greens: "Produce",
  Fruit: "Produce",
  Dairy: "Dairy",
  Nut: "Snacks & Nuts",
  Seed: "Snacks & Nuts",
  Fat: "Pantry",
  Herb: "Pantry",
  Pantry: "Pantry",
  Various: "Other"
};

const GROCERY_ORDER = ["Protein", "Carbs", "Produce", "Dairy", "Snacks & Nuts", "Pantry", "Other"];

export function buildGroceryList(weekPlan, mealLookup, portionMap = null) {
  const items = new Map();
  for (const day of weekPlan) {
    for (const mealId of Object.values(day.meals)) {
      const meal = mealLookup.get(mealId);
      if (!meal) continue;
      for (const ingredient of meal.ingredients) {
        const key = ingredient.name.toLowerCase();
        const entry = items.get(key) ?? {
          name: ingredient.name,
          group: ingredient.group,
          category: GROCERY_CATEGORY_MAP[ingredient.group] ?? "Other",
          count: 0,
          portion: portionMap?.[ingredient.name] ?? ingredient.portion ?? null
        };
        entry.count += 1;
        items.set(key, entry);
      }
    }
  }

  for (const item of items.values()) {
    item.portionText = formatPortionText(item.count, item.portion);
  }

  const byCategory = new Map();
  for (const item of items.values()) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category).push(item);
  }
  for (const list of byCategory.values()) {
    list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  return GROCERY_ORDER
    .filter((cat) => byCategory.has(cat))
    .map((cat) => ({ category: cat, items: byCategory.get(cat) }));
}

function formatPortionText(count, portion) {
  if (!portion) return count > 1 ? `${count} portions` : "1 portion";
  if (count <= 1) return portion;
  return `${count} × ${portion}`;
}

export function formatGroceryListText(groceryList) {
  return groceryList
    .map((group) => {
      const lines = group.items.map((item) => `- ${item.name} — ${item.portionText}`);
      return `${group.category}\n${lines.join("\n")}`;
    })
    .join("\n\n");
}

const ALLOWED_PROTEINS = new Set(["Chicken", "Beef", "Fish", "Vegetarian"]);
const ALLOWED_GROUPS = new Set([
  "Protein", "Dairy", "Fruit", "Vegetable", "Greens", "Whole grain",
  "Legume", "Nut", "Seed", "Fat", "Herb", "Pantry", "Various"
]);
const SLOT_KEYS = ["breakfast", "lunch", "dinner", "snack"];
const NUTRIENT_KEYS = ["potassium", "magnesium", "protein", "fiber", "calories"];

function coerceNonNegativeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function normalizeIngredient(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return null;
  const group = ALLOWED_GROUPS.has(raw.group) ? raw.group : "Various";
  const ingredient = { name, group };
  if (typeof raw.portion === "string" && raw.portion.trim()) {
    ingredient.portion = raw.portion.trim();
  }
  return ingredient;
}

function normalizeMeal(raw, seenIds) {
  if (!raw || typeof raw !== "object") return null;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) return null;
  const ingredientsRaw = Array.isArray(raw.ingredients) ? raw.ingredients : [];
  const ingredients = ingredientsRaw.map(normalizeIngredient).filter(Boolean);
  if (ingredients.length === 0) return null;

  let id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `meal-${seenIds.size + 1}`;
  if (seenIds.has(id)) {
    let suffix = 2;
    while (seenIds.has(`${id}-${suffix}`)) suffix += 1;
    id = `${id}-${suffix}`;
  }
  seenIds.add(id);

  const protein = ALLOWED_PROTEINS.has(raw.protein) ? raw.protein : "Vegetarian";
  const subtitle = typeof raw.subtitle === "string" ? raw.subtitle.trim() : "";

  const nutrientsRaw = raw.nutrients && typeof raw.nutrients === "object" ? raw.nutrients : {};
  const nutrients = {};
  for (const key of NUTRIENT_KEYS) {
    nutrients[key] = coerceNonNegativeNumber(nutrientsRaw[key]);
  }

  return { id, title, subtitle, protein, ingredients, nutrients };
}

export function normalizeCustomMeals(raw) {
  if (!raw || typeof raw !== "object") return null;
  const seenIds = new Set();
  const result = {};
  let totalMeals = 0;

  for (const dayType of ["work", "home"]) {
    const section = raw[dayType] && typeof raw[dayType] === "object" ? raw[dayType] : {};
    result[dayType] = {};
    for (const slotKey of SLOT_KEYS) {
      const arr = Array.isArray(section[slotKey]) ? section[slotKey] : [];
      const cleaned = arr.map((m) => normalizeMeal(m, seenIds)).filter(Boolean);
      result[dayType][slotKey] = cleaned;
      totalMeals += cleaned.length;
    }
  }

  if (totalMeals === 0) return null;
  return result;
}

const ALLOWED_SLOT_NAMES = new Set(["Breakfast", "Lunch", "Dinner", "Snack"]);

export function normalizeManualFoods(raw) {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set();
  const foods = [];
  for (const item of raw) {
    const meal = normalizeMeal(item, seenIds);
    if (!meal) continue;
    const slotsRaw = Array.isArray(item.slots) ? item.slots : [item.slot];
    const slots = [...new Set(slotsRaw.filter((s) => ALLOWED_SLOT_NAMES.has(s)))];
    if (slots.length === 0) slots.push("Snack");
    foods.push({ ...meal, slot: slots[0], slots });
  }
  return foods;
}

export function mealFitsSlot(meal, slotName) {
  return meal.slot === slotName || (Array.isArray(meal.slots) && meal.slots.includes(slotName));
}

const PERIOD_SLOTS = {
  day: ["Breakfast", "Lunch", "Snack"],
  night: ["Dinner", "Snack"]
};

export function suggestQuickPicks(primary, fallback, period, options = {}) {
  const { count = 2, random = Math.random } = options;
  const slots = PERIOD_SLOTS[period] ?? PERIOD_SLOTS.night;
  const fits = (meal) => slots.some((slotName) => mealFitsSlot(meal, slotName));
  const ranked = [
    ...shuffle(primary.filter(fits), random),
    ...shuffle(fallback.filter(fits), random)
  ];

  const picks = [];
  for (const meal of ranked) {
    if (picks.length >= count) break;
    if (!picks.some((p) => p.id === meal.id)) picks.push(meal);
  }
  return picks;
}

function groupMealsBySlot(mealLibrary) {
  const grouped = new Map();
  for (const meal of mealLibrary) {
    if (!grouped.has(meal.slot)) {
      grouped.set(meal.slot, []);
    }
    grouped.get(meal.slot).push(meal);
  }
  return grouped;
}

function shuffle(items, random) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateWeek(basePlan, mealLibrary, options = {}) {
  const { random = Math.random } = options;
  const mealLookup = createMealLookup(mealLibrary);
  const grouped = groupMealsBySlot(mealLibrary);
  const shuffledBySlot = new Map();

  for (const [slotName, meals] of grouped) {
    shuffledBySlot.set(slotName, shuffle(meals, random));
  }

  const cursors = new Map();

  return basePlan.map((day) => {
    const meals = {};
    for (const [slotKey, mealId] of Object.entries(day.meals)) {
      const original = mealLookup.get(mealId);
      const slotName = original?.slot;
      const pool = slotName ? shuffledBySlot.get(slotName) : null;
      if (!pool || pool.length === 0) {
        meals[slotKey] = mealId;
        continue;
      }
      const cursor = cursors.get(slotName) ?? 0;
      meals[slotKey] = pool[cursor % pool.length].id;
      cursors.set(slotName, cursor + 1);
    }
    return { ...day, meals };
  });
}

// ── Dinner idea bank ────────────────────────────────────────────────────────
// Turns simple dinner title strings (e.g. "Chicken Broccoli") into pickable
// dinner meals by matching known protein/side/vegetable keywords. Nutrients are
// rough estimates so day totals and the grocery list still work when picked.

const PROTEIN_KEYWORDS = [
  { match: ["chicken"], label: "Chicken", protein: "Chicken", ingredient: { name: "Chicken", group: "Protein" }, nutrients: { potassium: 620, magnesium: 40, protein: 40, fiber: 0, calories: 280 } },
  { match: ["turkey"], label: "Turkey", protein: "Turkey", ingredient: { name: "Turkey", group: "Protein" }, nutrients: { potassium: 600, magnesium: 38, protein: 38, fiber: 0, calories: 260 } },
  { match: ["bolognese", "cabbage roll", "beef"], label: "Beef", protein: "Beef", ingredient: { name: "Beef", group: "Protein" }, nutrients: { potassium: 560, magnesium: 32, protein: 36, fiber: 0, calories: 320 } },
  { match: ["salmon"], label: "Salmon", protein: "Fish", ingredient: { name: "Salmon", group: "Protein" }, nutrients: { potassium: 700, magnesium: 45, protein: 40, fiber: 0, calories: 300 } },
  { match: ["tuna"], label: "Tuna", protein: "Fish", ingredient: { name: "Tuna", group: "Protein" }, nutrients: { potassium: 500, magnesium: 40, protein: 42, fiber: 0, calories: 200 } },
  { match: ["beyond"], label: "Beyond", protein: "Vegetarian", ingredient: { name: "Beyond Meat", group: "Protein" }, nutrients: { potassium: 500, magnesium: 30, protein: 20, fiber: 3, calories: 260 } },
  { match: ["egg"], label: "Egg", protein: "Vegetarian", ingredient: { name: "Eggs", group: "Protein" }, nutrients: { potassium: 200, magnesium: 24, protein: 18, fiber: 0, calories: 180 } },
  { match: ["lentil"], label: "Lentil", protein: "Vegetarian", ingredient: { name: "Lentils", group: "Legume" }, nutrients: { potassium: 730, magnesium: 71, protein: 18, fiber: 15, calories: 230 } },
  { match: ["bean", "burrito"], label: "Bean", protein: "Vegetarian", ingredient: { name: "Beans", group: "Legume" }, nutrients: { potassium: 600, magnesium: 60, protein: 15, fiber: 12, calories: 240 } }
];

const SIDE_KEYWORDS = [
  { match: ["mac cheese"], ingredient: { name: "Macaroni and cheese", group: "Whole grain" }, nutrients: { potassium: 200, magnesium: 30, protein: 14, fiber: 2, calories: 350 } },
  { match: ["perogy", "perogies"], ingredient: { name: "Perogies", group: "Whole grain" }, nutrients: { potassium: 400, magnesium: 40, protein: 8, fiber: 3, calories: 300 } },
  { match: ["potato"], ingredient: { name: "Potatoes", group: "Vegetable" }, nutrients: { potassium: 620, magnesium: 50, protein: 6, fiber: 4, calories: 200 } },
  { match: ["pasta"], ingredient: { name: "Pasta", group: "Whole grain" }, nutrients: { potassium: 180, magnesium: 50, protein: 12, fiber: 4, calories: 280 } },
  { match: ["rice"], ingredient: { name: "Rice", group: "Whole grain" }, nutrients: { potassium: 110, magnesium: 25, protein: 5, fiber: 1, calories: 220 } }
];

const VEG_KEYWORDS = [
  { match: ["mixed veg"], ingredient: { name: "Mixed vegetables", group: "Vegetable" }, nutrients: { potassium: 300, magnesium: 30, protein: 5, fiber: 6, calories: 80 } },
  { match: ["green bean"], ingredient: { name: "Green beans", group: "Vegetable" }, nutrients: { potassium: 210, magnesium: 25, protein: 2, fiber: 4, calories: 35 } },
  { match: ["broccoli"], ingredient: { name: "Broccoli", group: "Vegetable" }, nutrients: { potassium: 460, magnesium: 30, protein: 4, fiber: 5, calories: 55 } },
  { match: ["corn"], ingredient: { name: "Corn", group: "Vegetable" }, nutrients: { potassium: 270, magnesium: 40, protein: 5, fiber: 4, calories: 130 } },
  { match: ["peas"], ingredient: { name: "Peas", group: "Vegetable" }, nutrients: { potassium: 240, magnesium: 33, protein: 8, fiber: 7, calories: 120 } },
  { match: ["sauerkraut"], ingredient: { name: "Sauerkraut", group: "Vegetable" }, nutrients: { potassium: 170, magnesium: 13, protein: 1, fiber: 3, calories: 25 } },
  { match: ["cabbage"], ingredient: { name: "Cabbage", group: "Vegetable" }, nutrients: { potassium: 170, magnesium: 12, protein: 1, fiber: 2, calories: 22 } },
  { match: ["salsa"], ingredient: { name: "Salsa", group: "Vegetable" }, nutrients: { potassium: 290, magnesium: 20, protein: 2, fiber: 2, calories: 40 } },
  { match: ["tomato"], ingredient: { name: "Tomatoes", group: "Vegetable" }, nutrients: { potassium: 290, magnesium: 20, protein: 2, fiber: 2, calories: 40 } }
];

function slugifyTitle(title) {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function firstMatch(keywords, haystack) {
  for (const entry of keywords) {
    if (entry.match.some((needle) => haystack.includes(needle))) return entry;
  }
  return null;
}

function addNutrients(target, addition) {
  for (const key of NUTRIENT_KEYS) {
    target[key] += addition[key] ?? 0;
  }
}

// Display/rotation category for a dinner idea, derived from its title. The last
// entry is a catch-all, so this always returns a label.
export const DINNER_CATEGORIES = [
  { label: "Chicken", test: (t) => t.includes("chicken") },
  { label: "Turkey", test: (t) => t.includes("turkey") },
  { label: "Beef", test: (t) => t.includes("beef") || t.includes("bolognese") || t.includes("cabbage roll") },
  { label: "Fish", test: (t) => t.includes("salmon") || t.includes("tuna") },
  { label: "Plant-based", test: (t) => t.includes("beyond") },
  { label: "Eggs", test: (t) => t.includes("egg") },
  { label: "Legumes", test: (t) => t.includes("lentil") || t.includes("bean") || t.includes("burrito") },
  { label: "Bowls & sides", test: () => true }
];

export function dinnerCategory(title) {
  // Strip "green bean" so it never trips the Legumes bucket — it's a vegetable,
  // matching how buildDinnerIdeas classifies its ingredients.
  const haystack = String(title).toLowerCase().replace(/green bean/g, "");
  return (DINNER_CATEGORIES.find((c) => c.test(haystack)) ?? DINNER_CATEGORIES.at(-1)).label;
}

export function buildDinnerIdeas(titles) {
  if (!Array.isArray(titles)) return [];
  const seenIds = new Set();
  const ideas = [];

  for (const rawTitle of titles) {
    if (typeof rawTitle !== "string" || !rawTitle.trim()) continue;
    const title = rawTitle.trim();
    // Strip "green bean" before scanning the legume "bean" keyword so they don't collide.
    const haystack = title.toLowerCase();
    const legumeSafe = haystack.replace(/green bean/g, "");

    const ingredients = [];
    const nutrients = { potassium: 0, magnesium: 0, protein: 0, fiber: 0, calories: 0 };

    // "Green bean" is a vegetable, not the legume "bean", so the Bean protein
    // keyword scans a copy with "green bean" removed.
    const proteinEntry = PROTEIN_KEYWORDS.find((entry) => {
      const scan = entry.label === "Bean" ? legumeSafe : haystack;
      return entry.match.some((needle) => scan.includes(needle));
    });

    let protein = "Vegetarian";
    if (proteinEntry) {
      protein = proteinEntry.protein;
      ingredients.push({ ...proteinEntry.ingredient });
      addNutrients(nutrients, proteinEntry.nutrients);
    }

    const sideEntry = firstMatch(SIDE_KEYWORDS, haystack);
    if (sideEntry) {
      ingredients.push({ ...sideEntry.ingredient });
      addNutrients(nutrients, sideEntry.nutrients);
    }

    const vegEntry = firstMatch(VEG_KEYWORDS, haystack);
    if (vegEntry) {
      ingredients.push({ ...vegEntry.ingredient });
      addNutrients(nutrients, vegEntry.nutrients);
    }

    if (ingredients.length === 0) {
      // Fallback so grocery list and totals still have something to show.
      ingredients.push({ name: title, group: "Various" });
      addNutrients(nutrients, { potassium: 300, magnesium: 25, protein: 15, fiber: 3, calories: 250 });
    }

    let id = `dinner-idea-${slugifyTitle(title)}`;
    if (seenIds.has(id)) {
      let suffix = 2;
      while (seenIds.has(`${id}-${suffix}`)) suffix += 1;
      id = `${id}-${suffix}`;
    }
    seenIds.add(id);

    const subtitle = ingredients.map((i) => i.name).join(", ") + ".";
    ideas.push({ id, slot: "Dinner", title, subtitle, protein, category: dinnerCategory(title), ingredients, nutrients });
  }

  return ideas;
}

// Assigns one dinner idea to each day, rotating through the chosen categories for
// variety and avoiding repeats until the pool is exhausted. Returns a plain object
// mapping day id -> dinner idea id. Days whose category pool is empty are skipped.
export function generateDinnerWeek(days, dinnerIdeas, options = {}) {
  const { categories = null, random = Math.random } = options;
  if (!Array.isArray(days) || !Array.isArray(dinnerIdeas)) return {};

  const wanted = categories && categories.length > 0 ? new Set(categories) : null;
  const pool = dinnerIdeas.filter((idea) => !wanted || wanted.has(idea.category));
  if (pool.length === 0) return {};

  // Group the pool by category, in the order categories first appear, and shuffle each.
  const byCategory = new Map();
  for (const idea of pool) {
    if (!byCategory.has(idea.category)) byCategory.set(idea.category, []);
    byCategory.get(idea.category).push(idea);
  }
  const order = [...byCategory.keys()];
  for (const label of order) byCategory.set(label, shuffle(byCategory.get(label), random));

  const cursors = new Map(order.map((label) => [label, 0]));
  const usedIds = new Set();
  const assignment = {};

  days.forEach((day, index) => {
    // Try each category once, starting at the rotating offset, preferring an unused idea.
    let picked = null;
    for (let step = 0; step < order.length && !picked; step += 1) {
      const label = order[(index + step) % order.length];
      const list = byCategory.get(label);
      for (let scan = 0; scan < list.length; scan += 1) {
        const cursor = (cursors.get(label) + scan) % list.length;
        const candidate = list[cursor];
        if (!usedIds.has(candidate.id)) {
          picked = candidate;
          cursors.set(label, cursor + 1);
          break;
        }
      }
    }
    // Every idea used already: fall back to the rotating category's next item.
    if (!picked) {
      const label = order[index % order.length];
      const list = byCategory.get(label);
      const cursor = cursors.get(label) % list.length;
      picked = list[cursor];
      cursors.set(label, cursor + 1);
    }
    usedIds.add(picked.id);
    assignment[day.id] = picked.id;
  });

  return assignment;
}
