import { mealLibrary, usualMealsLibrary, weeklyPlan } from "./dietPlannerData.js";
import {
  buildGroceryList,
  createMealLookup,
  formatMetric,
  generateWeek,
  percentText,
  summarizeWeek
} from "./dietPlannerLogic.js";

const PLANNER_KEY = "planner:v2";
const CUSTOM_MEALS_KEY = "my-meals-custom:v1";
const API_KEY_KEY = "nutrimind-openai-key";

const mealLookup = createMealLookup(mealLibrary);

const PORTION_MAP = {
  "Greek yogurt": "¾ cup", "Rolled oats": "½ cup", "Banana": "1 medium", "Chia seeds": "1 tbsp",
  "Orange": "1 medium", "Eggs": "3 large", "Spinach": "1 cup", "Tomatoes": "½ cup",
  "Feta": "2 tbsp", "Whole grain toast": "2 slices", "Kefir": "1 cup", "Figs": "2 medium",
  "Walnuts": "¼ cup", "Berries": "½ cup", "Flaxseed": "1 tbsp", "Kiwi": "2 medium",
  "Pumpkin seeds": "2 tbsp", "Cottage cheese": "½ cup", "Melon": "1 cup", "Cucumber": "½ cup",
  "Olives": "¼ cup", "Avocado": "½ medium", "Sourdough": "2 slices", "Salmon": "150g",
  "Farro": "½ cup", "Chickpeas": "½ cup", "Lean beef": "150g", "Lentils": "½ cup",
  "Bell peppers": "1 medium", "Parsley": "2 tbsp", "Chicken breast": "150g", "Quinoa": "½ cup",
  "Mint": "2 tbsp", "Tahini": "1 tbsp", "Sardines": "1 tin", "White beans": "½ cup",
  "Arugula": "1 cup", "Bulgur": "½ cup", "Hummus": "3 tbsp", "Carrots": "½ cup",
  "Grapes": "½ cup", "Romaine": "2 cups", "Pita": "1 piece", "Chicken thigh": "150g",
  "Kale": "1 cup", "Garlic": "2 cloves", "Olive oil": "1 tbsp", "Cod": "180g",
  "Fennel": "½ cup", "Rosemary": "1 tsp", "Tuna": "180g", "Potatoes": "2 medium",
  "Green beans": "½ cup", "Capers": "1 tbsp", "Barley": "½ cup", "Mushrooms": "½ cup",
  "Zucchini": "½ cup", "Eggplant": "½ cup", "Trout": "180g", "Swiss chard": "1 cup",
  "Lemon": "½", "Dill": "1 tbsp", "Oregano": "1 tsp", "Sweet potato": "1 medium",
  "Dates": "3 pieces", "Almond butter": "1 tbsp", "Cocoa": "1 tbsp", "Edamame": "½ cup",
  "Cocoa nibs": "2 tbsp", "Skyr": "¾ cup", "Honey": "1 tsp", "Pistachios": "¼ cup",
  "Dried apricots": "4 pieces", "Orange zest": "1 tsp", "Pear": "1 medium",
  "Dark chocolate": "1 square", "Cheese": "2 slices", "Fruit": "½ cup", "Nuts": "¼ cup",
  "Seeds": "1 tbsp", "Granola": "½ cup", "Yogurt": "¾ cup", "Chicken": "150g",
  "Bread": "2 slices", "Lettuce": "2 leaves", "Sauce": "1 tbsp", "Rice": "½ cup",
  "Vegetables": "½ cup", "Beef": "180g", "Fish": "180g", "Mixed vegetables": "1 cup",
  "Leftovers": "1 portion"
};

function loadCustomMeals() {
  try {
    const raw = window.localStorage.getItem(CUSTOM_MEALS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch { return null; }
}

function flattenCustomMeals(custom) {
  if (!custom) return [];
  const seen = new Set();
  const result = [];
  const slotNames = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
  for (const dayType of ["work", "home"]) {
    for (const [slotKey, slotName] of Object.entries(slotNames)) {
      for (const meal of (custom[dayType]?.[slotKey] ?? [])) {
        if (!seen.has(meal.id)) {
          seen.add(meal.id);
          result.push({ ...meal, slot: slotName });
        }
      }
    }
  }
  return result;
}

function buildAllMealsLookup() {
  return createMealLookup([...mealLibrary, ...usualMealsLibrary, ...flattenCustomMeals(customMeals)]);
}

let customMeals = loadCustomMeals();
let allMealsLookup = buildAllMealsLookup();

const app = document.querySelector("#app");
const DEFAULT_GOALS = { potassium: 4700, magnesium: 420 };

// ── Planner state ─────────────────────────────────────────────────────────────

const WEEKEND = new Set(["sat", "sun"]);

function defaultPlannerState() {
  const plan = {};
  const dayTypes = {};
  for (const day of weeklyPlan) {
    plan[day.id] = { ...day.meals };
    dayTypes[day.id] = WEEKEND.has(day.id) ? "home" : "work";
  }
  return { plan, dayTypes, selectedDayId: weeklyPlan[0].id, pickerSlot: null };
}

function generatePlanFromCustomMeals(dayTypes) {
  const plan = {};
  for (const day of weeklyPlan) {
    const dayType = dayTypes[day.id] ?? "work";
    const pool = customMeals[dayType] ?? customMeals.work ?? {};
    plan[day.id] = {};
    for (const slotKey of ["breakfast", "lunch", "dinner", "snack"]) {
      const options = pool[slotKey] ?? [];
      plan[day.id][slotKey] = options.length > 0
        ? options[Math.floor(Math.random() * options.length)].id
        : day.meals[slotKey];
    }
  }
  return plan;
}

function generatedPlannerState(currentDayTypes = null) {
  const dayTypes = {};
  for (const day of weeklyPlan) {
    dayTypes[day.id] = currentDayTypes?.[day.id] ?? (WEEKEND.has(day.id) ? "home" : "work");
  }
  let plan;
  if (customMeals) {
    plan = generatePlanFromCustomMeals(dayTypes);
  } else {
    const generated = generateWeek(weeklyPlan, mealLibrary);
    plan = {};
    for (const day of generated) plan[day.id] = { ...day.meals };
  }
  return { plan, dayTypes, selectedDayId: weeklyPlan[0].id, pickerSlot: null };
}

function loadPlannerState() {
  try {
    const raw = window.localStorage.getItem(PLANNER_KEY);
    if (!raw) return generatedPlannerState();
    const parsed = JSON.parse(raw);
    const base = defaultPlannerState();
    if (parsed.plan && typeof parsed.plan === "object") {
      for (const day of weeklyPlan) {
        const candidate = parsed.plan[day.id];
        if (!candidate || typeof candidate !== "object") continue;
        const slots = {};
        let ok = true;
        for (const slotKey of Object.keys(day.meals)) {
          const mealId = candidate[slotKey];
          if (typeof mealId !== "string" || !allMealsLookup.has(mealId)) { ok = false; break; }
          slots[slotKey] = mealId;
        }
        if (ok) base.plan[day.id] = slots;
      }
    }
    if (parsed.dayTypes && typeof parsed.dayTypes === "object") {
      for (const day of weeklyPlan) {
        const dt = parsed.dayTypes[day.id];
        if (dt === "work" || dt === "home") base.dayTypes[day.id] = dt;
      }
    }
    if (weeklyPlan.some((d) => d.id === parsed.selectedDayId)) {
      base.selectedDayId = parsed.selectedDayId;
    }
    return base;
  } catch {
    return generatedPlannerState();
  }
}

function savePlannerState() {
  const { selectedDayId: _s, pickerSlot: _p, ...toSave } = planner;
  window.localStorage.setItem(PLANNER_KEY, JSON.stringify(toSave));
}

const planner = loadPlannerState();
const collapsedPanels = new Set();

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusTone(ratio) {
  if (ratio >= 1) return "hit";
  if (ratio >= 0.9) return "near";
  return "low";
}

function getActivePlan() {
  return weeklyPlan.map((day) => ({
    ...day,
    meals: planner.plan[day.id] ?? day.meals
  }));
}

function resetPlanner() {
  window.localStorage.removeItem(PLANNER_KEY);
  const fresh = defaultPlannerState();
  Object.assign(planner, fresh);
  render();
}

function regenerateWeek() {
  const fresh = generatedPlannerState(planner.dayTypes);
  Object.assign(planner, { plan: fresh.plan, pickerSlot: null });
  savePlannerState();
  render();
}

// ── GPT meal setup ────────────────────────────────────────────────────────────

const setupState = { loading: false, error: null, success: false, workText: "", homeText: "" };

async function callGPT(apiKey, model, workText, homeText) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a meal planning assistant. Convert meal descriptions into a structured JSON meal library. Return ONLY valid JSON."
        },
        {
          role: "user",
          content: `Create a meal library from these descriptions.\n\nWork day meals: ${workText}\nHome day meals: ${homeText}\n\nReturn a JSON object:\n{\n  "work": {\n    "breakfast": [{"id":"w-b-1","title":"Meal Name","subtitle":"Brief description","protein":"Chicken","ingredients":[{"name":"Chicken","group":"Protein"}],"nutrients":{"potassium":400,"magnesium":50,"protein":25,"fiber":3,"calories":350}}],\n    "lunch": [...], "dinner": [...], "snack": [...]\n  },\n  "home": { "breakfast": [...], "lunch": [...], "dinner": [...], "snack": [...] }\n}\n\nRules: 2-4 options per slot. protein must be one of: Chicken, Beef, Fish, Vegetarian. ingredient groups: Protein, Dairy, Fruit, Vegetable, Greens, Whole grain, Legume, Nut, Seed, Fat, Herb, Pantry, Various. Estimate nutrients realistically. IDs must be unique (w-b-1, w-l-1, h-b-1, etc.).`
        }
      ]
    })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `API error ${response.status}`);
  }
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

async function handleGenerateMeals() {
  const apiKey = document.getElementById("setupApiKey")?.value.trim() ?? "";
  const model = document.getElementById("setupModel")?.value.trim() || "gpt-4o";
  const workText = document.getElementById("setupWorkText")?.value.trim() ?? "";
  const homeText = document.getElementById("setupHomeText")?.value.trim() ?? "";

  if (!apiKey) { setupState.error = "Please enter your OpenAI API key."; render(); return; }
  if (!workText && !homeText) { setupState.error = "Please describe at least one day type."; render(); return; }

  window.localStorage.setItem(API_KEY_KEY, apiKey);
  setupState.workText = workText;
  setupState.homeText = homeText;
  setupState.loading = true;
  setupState.error = null;
  setupState.success = false;
  render();

  try {
    const result = await callGPT(apiKey, model, workText || homeText, homeText || workText);
    customMeals = result;
    window.localStorage.setItem(CUSTOM_MEALS_KEY, JSON.stringify(result));
    allMealsLookup = buildAllMealsLookup();
    setupState.success = true;
    setupState.loading = false;
    regenerateWeek();
  } catch (err) {
    setupState.error = err.message;
    setupState.loading = false;
    render();
  }
}

// ── Render helpers ────────────────────────────────────────────────────────────

function renderHeadlineStat(label, value, note) {
  return `
    <div class="headline-stat">
      <span class="headline-label">${label}</span>
      <strong>${value}</strong>
      <span class="headline-note">${note}</span>
    </div>
  `;
}

function renderDayButton(day) {
  const potassiumTone = statusTone(day.coverage.potassium);
  const magnesiumTone = statusTone(day.coverage.magnesium);
  return `
    <button
      class="day-button ${day.id === planner.selectedDayId ? "is-active" : ""}"
      type="button" data-day="${day.id}"
      role="tab" aria-selected="${day.id === planner.selectedDayId}"
    >
      <span class="day-topline">
        <span>${day.label}</span>
        <span>${formatMetric(day.totals.calories)} kcal</span>
      </span>
      <span class="meter-track mini ${potassiumTone}">
        <span class="meter-fill sea" style="width:${Math.min(day.coverage.potassium * 100, 100)}%"></span>
      </span>
      <span class="meter-track mini ${magnesiumTone}">
        <span class="meter-fill copper" style="width:${Math.min(day.coverage.magnesium * 100, 100)}%"></span>
      </span>
      <span class="day-bottomline">
        <span>K ${percentText(day.coverage.potassium)}</span>
        <span>Mg ${percentText(day.coverage.magnesium)}</span>
      </span>
    </button>
  `;
}

function renderMealSlot(entry, dayId) {
  const { slotKey, meal } = entry;
  const isPickerOpen = planner.pickerSlot === slotKey;
  const slotLabels = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
  const defaultMealId = weeklyPlan.find((d) => d.id === dayId)?.meals[slotKey];
  const isModified = planner.plan[dayId]?.[slotKey] !== defaultMealId;

  return `
    <div class="my-meal-slot ${isPickerOpen ? "picker-open" : ""}">
      <div class="my-slot-header">
        <span class="meal-slot-label">${slotLabels[slotKey] ?? meal.slot}</span>
        <div class="slot-actions">
          <button type="button" class="slot-btn" data-my-replace="${slotKey}">Replace</button>
          ${isModified ? `<button type="button" class="slot-btn slot-btn-reset" data-my-reset="${dayId}:${slotKey}">Reset</button>` : ""}
        </div>
      </div>
      <div class="my-meal-card">
        <div class="my-meal-title">
          <strong>${meal.title}</strong>
          <span class="protein-pill">${meal.protein}</span>
        </div>
        <p class="meal-copy">${meal.subtitle}</p>
        <div class="ingredient-row">
          ${meal.ingredients.map((i) => {
            const portion = PORTION_MAP[i.name] ?? (i.portion ?? "");
            return `<span>${i.name}${portion ? `<em class="ingredient-portion">${portion}</em>` : ""}</span>`;
          }).join("")}
        </div>
      </div>
      ${isPickerOpen ? renderMealPicker(dayId, slotKey) : ""}
    </div>
  `;
}

function renderMealPicker(dayId, slotKey) {
  const slotName = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" }[slotKey];
  const dayType = planner.dayTypes[dayId] ?? "work";
  const currentMealId = planner.plan[dayId]?.[slotKey];

  const seen = new Set();
  const available = [];

  if (customMeals) {
    for (const meal of (customMeals[dayType]?.[slotKey] ?? [])) {
      if (!seen.has(meal.id)) { seen.add(meal.id); available.push(meal); }
    }
  }
  for (const meal of mealLibrary) {
    if (meal.slot === slotName && !seen.has(meal.id)) { seen.add(meal.id); available.push(meal); }
  }
  for (const meal of usualMealsLibrary) {
    if (meal.slot === slotName && !seen.has(meal.id)) { seen.add(meal.id); available.push(meal); }
  }

  return `
    <div class="meal-picker">
      <p class="picker-label">Pick a ${slotName.toLowerCase()}</p>
      <div class="picker-grid">
        ${available.map((meal) => `
          <button type="button" class="picker-meal-btn ${meal.id === currentMealId ? "is-current" : ""}" data-my-pick="${dayId}:${slotKey}:${meal.id}">
            <strong>${meal.title}</strong>
            <span>${meal.subtitle}</span>
            <div class="picker-tags">
              ${meal.ingredients.slice(0, 3).map((i) => `<span>${i.name}</span>`).join("")}
            </div>
          </button>
        `).join("")}
      </div>
      <button type="button" class="reset-btn" data-my-picker-close style="margin-top:10px">Cancel</button>
    </div>
  `;
}

function renderGroceryGroup(group) {
  return `
    <div class="grocery-group">
      <p class="grocery-category">${group.category}</p>
      <ul class="grocery-items">
        ${group.items.map((item) => `
          <li class="grocery-item">
            <span class="grocery-name">${item.name}</span>
            ${item.count > 1 ? `<span class="grocery-count">×${item.count}</span>` : ""}
          </li>
        `).join("")}
      </ul>
    </div>
  `;
}

function renderPanel(id, labelLine, heading, body) {
  const collapsed = collapsedPanels.has(id);
  return `
    <section class="inspector-panel ${id} ${collapsed ? "is-collapsed" : ""}">
      <button class="section-heading compact panel-toggle" data-panel-toggle="${id}" type="button" aria-expanded="${!collapsed}">
        <div>
          <p class="label-line">${labelLine}</p>
          <h2>${heading}</h2>
        </div>
        <span class="panel-chevron">${collapsed ? "+" : "−"}</span>
      </button>
      <div class="panel-body">
        ${body}
      </div>
    </section>
  `;
}

function renderSetupPanel() {
  const savedApiKey = window.localStorage.getItem(API_KEY_KEY) ?? "";
  const hasCustomMeals = Boolean(customMeals);
  const body = `
    <div class="setup-form">
      <label class="field">
        <span>OpenAI API Key</span>
        <input type="password" id="setupApiKey" value="${savedApiKey}" placeholder="sk-…" autocomplete="off" />
      </label>
      <label class="field">
        <span>Model</span>
        <input type="text" id="setupModel" value="gpt-4o" placeholder="gpt-4o" />
      </label>
      <label class="field">
        <span>Work day meals</span>
        <textarea id="setupWorkText" class="setup-textarea" placeholder="e.g. Breakfast: eggs with toast or yogurt. Lunch: chicken sandwich, pasta. Dinner: chicken and rice, beef stir fry. Snacks: fruit, nuts.">${setupState.workText}</textarea>
      </label>
      <label class="field">
        <span>Home day meals</span>
        <textarea id="setupHomeText" class="setup-textarea" placeholder="e.g. Breakfast: full omelette, pancakes. Lunch: homemade soup, leftovers. Dinner: grilled fish, lamb chops. Snacks: yogurt, fruit.">${setupState.homeText}</textarea>
      </label>
      ${setupState.error ? `<p class="setup-msg setup-error">${setupState.error}</p>` : ""}
      ${setupState.success ? `<p class="setup-msg setup-success">Done! Your week has been updated with your meals.</p>` : ""}
      <div class="setup-actions">
        <button type="button" class="reset-btn setup-btn" data-action="generate-meals" ${setupState.loading ? "disabled" : ""}>
          ${setupState.loading ? "Generating…" : hasCustomMeals ? "Regenerate from description" : "Generate my meal plan"}
        </button>
        ${hasCustomMeals ? `<button type="button" class="reset-btn" data-action="clear-custom-meals">Clear</button>` : ""}
      </div>
      ${hasCustomMeals ? `<p class="setup-active-note">Using your custom meals. Work and home days get different meals based on your descriptions.</p>` : ""}
    </div>
  `;
  return renderPanel("setup-panel", "GPT powered", "Meal Setup", body);
}

// ── Main view ─────────────────────────────────────────────────────────────────

function renderPlannerView() {
  const plan = getActivePlan();
  const week = summarizeWeek(plan, allMealsLookup, DEFAULT_GOALS);
  const selectedDay = week.days.find((d) => d.id === planner.selectedDayId) ?? week.days[0];
  const isHome = planner.dayTypes[selectedDay.id] === "home";
  const groceryList = buildGroceryList(plan, allMealsLookup);

  return `
    <header class="masthead">
      <div class="masthead-copy">
        <p class="eyebrow">Weekly Mediterranean diet planner</p>
        <h1>Aegean Week</h1>
        <p class="lead">Fish, beef, and chicken arranged into a mineral-forward week with steady potassium and magnesium support.</p>
        <div class="planner-actions" role="group" aria-label="Planner actions">
          <button type="button" class="reset-btn" data-action="regenerate">Regenerate week</button>
          <button type="button" class="reset-btn" data-action="reset">Reset planner</button>
        </div>
      </div>
    </header>

    <main class="my-workspace">
      <section class="my-planner-panel">
        <div class="section-heading">
          <div>
            <p class="label-line">Week view</p>
            <h2>Dial in each day</h2>
          </div>
          <p class="section-copy">The week stays Mediterranean at the base: legumes, greens, yogurt, fruit, whole grains, olive oil, and rotating animal proteins.</p>
        </div>
        <div class="day-strip" role="tablist" aria-label="Days of the week">
          ${week.days.map((day) => renderDayButton(day)).join("")}
        </div>
        <div class="day-focus">
          <div class="day-identity">
            <div>
              <p class="label-line">${selectedDay.label} — ${selectedDay.name}</p>
              <p class="day-note">${selectedDay.focus}</p>
            </div>
            <div>
              <div class="day-type-toggle" role="group" aria-label="Day type">
                <button type="button" class="day-type-btn ${!isHome ? "is-active" : ""}" data-my-day-type="${selectedDay.id}:work">Work</button>
                <button type="button" class="day-type-btn ${isHome ? "is-active" : ""}" data-my-day-type="${selectedDay.id}:home">Home</button>
              </div>
              ${selectedDay.prep ? `
                <div class="prep-note" style="margin-top:12px">
                  <span class="prep-label">Prep edge</span>
                  <p>${selectedDay.prep}</p>
                </div>
              ` : ""}
            </div>
          </div>
          <div class="my-slots-grid" style="margin-top:24px">
            ${selectedDay.slots.map((entry) => renderMealSlot(entry, selectedDay.id)).join("")}
          </div>
        </div>
      </section>

      <aside class="my-inspector">
        ${renderSetupPanel()}
        ${renderPanel("grocery-panel", "This week", "Grocery List", `
          <div class="grocery-list">
            ${groceryList.map((group) => renderGroceryGroup(group)).join("")}
          </div>
        `)}
      </aside>
    </main>
  `;
}

// ── Main render ───────────────────────────────────────────────────────────────

function render() {
  document.title = "Aegean Week";
  app.innerHTML = `<div class="app-shell">${renderPlannerView()}</div>`;
}

// ── Event handling ────────────────────────────────────────────────────────────

app.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;

  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const action = actionButton.dataset.action;
    if (action === "regenerate") { regenerateWeek(); return; }
    if (action === "generate-meals") { handleGenerateMeals(); return; }
    if (action === "clear-custom-meals") {
      customMeals = null;
      window.localStorage.removeItem(CUSTOM_MEALS_KEY);
      allMealsLookup = buildAllMealsLookup();
      setupState.success = false;
      regenerateWeek();
      return;
    }
    if (action === "reset") {
      const ok = typeof window.confirm === "function"
        ? window.confirm("Reset the planner to defaults? This clears your saved meals and restores the original Mediterranean plan.")
        : true;
      if (ok) resetPlanner();
      return;
    }
  }

  const panelToggle = event.target.closest("[data-panel-toggle]");
  if (panelToggle) {
    const id = panelToggle.dataset.panelToggle;
    collapsedPanels.has(id) ? collapsedPanels.delete(id) : collapsedPanels.add(id);
    render();
    return;
  }

  const dayButton = event.target.closest("[data-day]");
  if (dayButton) {
    planner.selectedDayId = dayButton.dataset.day;
    render();
    if (window.innerWidth <= 768) {
      const dayFocus = document.querySelector(".day-focus");
      if (dayFocus) dayFocus.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return;
  }

  const dayTypeBtn = event.target.closest("[data-my-day-type]");
  if (dayTypeBtn) {
    const [dayId, type] = dayTypeBtn.dataset.myDayType.split(":");
    planner.dayTypes[dayId] = type;
    savePlannerState();
    render();
    return;
  }

  const replaceBtn = event.target.closest("[data-my-replace]");
  if (replaceBtn) {
    const slotKey = replaceBtn.dataset.myReplace;
    planner.pickerSlot = planner.pickerSlot === slotKey ? null : slotKey;
    render();
    return;
  }

  if (event.target.closest("[data-my-picker-close]")) {
    planner.pickerSlot = null;
    render();
    return;
  }

  const pickBtn = event.target.closest("[data-my-pick]");
  if (pickBtn) {
    const [dayId, slotKey, mealId] = pickBtn.dataset.myPick.split(":");
    if (!planner.plan[dayId]) planner.plan[dayId] = {};
    planner.plan[dayId][slotKey] = mealId;
    planner.pickerSlot = null;
    savePlannerState();
    render();
    return;
  }

  const resetSlotBtn = event.target.closest("[data-my-reset]");
  if (resetSlotBtn) {
    const [dayId, slotKey] = resetSlotBtn.dataset.myReset.split(":");
    const defaultDay = weeklyPlan.find((d) => d.id === dayId);
    if (defaultDay) {
      if (!planner.plan[dayId]) planner.plan[dayId] = {};
      planner.plan[dayId][slotKey] = defaultDay.meals[slotKey];
    }
    savePlannerState();
    render();
    return;
  }
});

app.addEventListener("input", (event) => {
  if (event.target.id === "setupWorkText") { setupState.workText = event.target.value; }
  if (event.target.id === "setupHomeText") { setupState.homeText = event.target.value; }
});

render();
