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
