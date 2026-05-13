import { boosterFoods, goalPresets, mealLibrary, myWeekTemplate, usualMealsLibrary, weeklyPlan } from "./dietPlannerData.js";
import {
  buildGroceryList,
  buildStaples,
  countProteins,
  createMealLookup,
  formatMetric,
  generateWeek,
  percentText,
  suggestBoosters,
  summarizeWeek
} from "./dietPlannerLogic.js";

const STORAGE_KEY = "aegean-week-planner:v1";
const MY_KEY = "my-weekly-planner:v1";

const mealLookup = createMealLookup(mealLibrary);
const allMealsLookup = createMealLookup([...mealLibrary, ...usualMealsLibrary]);

const app = document.querySelector("#app");
const defaultPreset = goalPresets[0];

// ── Mediterranean planner state ───────────────────────────────────────────────

function defaultState() {
  return {
    selectedDayId: weeklyPlan[0].id,
    presetId: defaultPreset.id,
    goals: { potassium: defaultPreset.potassium, magnesium: defaultPreset.magnesium },
    planOverride: null,
    activeView: "mediterranean"
  };
}

function sanitizePlanOverride(value) {
  if (!value || typeof value !== "object") return null;
  const sanitized = {};
  let hasEntry = false;
  for (const day of weeklyPlan) {
    const candidate = value[day.id];
    if (!candidate || typeof candidate !== "object") continue;
    const slots = {};
    let slotsMatch = true;
    for (const slotKey of Object.keys(day.meals)) {
      const mealId = candidate[slotKey];
      if (typeof mealId !== "string" || !mealLookup.has(mealId)) { slotsMatch = false; break; }
      slots[slotKey] = mealId;
    }
    if (!slotsMatch) continue;
    sanitized[day.id] = slots;
    hasEntry = true;
  }
  return hasEntry ? sanitized : null;
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      selectedDayId: weeklyPlan.some((d) => d.id === parsed.selectedDayId) ? parsed.selectedDayId : weeklyPlan[0].id,
      presetId: typeof parsed.presetId === "string" ? parsed.presetId : defaultPreset.id,
      goals: {
        potassium: clampGoal(parsed.goals?.potassium, defaultPreset.potassium),
        magnesium: clampGoal(parsed.goals?.magnesium, defaultPreset.magnesium)
      },
      planOverride: sanitizePlanOverride(parsed.planOverride),
      activeView: parsed.activeView === "my-planner" ? "my-planner" : "mediterranean"
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const state = loadState();
const collapsedPanels = new Set();

// ── My Planner state ──────────────────────────────────────────────────────────

function defaultMyPlannerState() {
  const plan = {};
  const dayTypes = {};
  for (const day of myWeekTemplate) {
    plan[day.id] = { ...day.meals };
    dayTypes[day.id] = day.dayType ?? "work";
  }
  return { plan, dayTypes, selectedDayId: myWeekTemplate[0].id, pickerSlot: null };
}

function loadMyPlannerState() {
  try {
    const raw = window.localStorage.getItem(MY_KEY);
    if (!raw) return defaultMyPlannerState();
    const parsed = JSON.parse(raw);
    const base = defaultMyPlannerState();
    if (parsed.plan && typeof parsed.plan === "object") {
      for (const day of myWeekTemplate) {
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
      for (const day of myWeekTemplate) {
        const dt = parsed.dayTypes[day.id];
        if (dt === "work" || dt === "home") base.dayTypes[day.id] = dt;
      }
    }
    return base;
  } catch {
    return defaultMyPlannerState();
  }
}

function saveMyPlannerState() {
  const { selectedDayId: _s, pickerSlot: _p, ...toSave } = myPlanner;
  window.localStorage.setItem(MY_KEY, JSON.stringify(toSave));
}

const myPlanner = loadMyPlannerState();

// ── Helpers ───────────────────────────────────────────────────────────────────

function clampGoal(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(n);
}

function getActivePreset() {
  return goalPresets.find((p) => p.id === state.presetId) ?? {
    id: "custom", label: "Custom targets", note: "Manual values let you personalize the plan."
  };
}

function statusTone(ratio) {
  if (ratio >= 1) return "hit";
  if (ratio >= 0.9) return "near";
  return "low";
}

function activeWeekPlan() {
  if (!state.planOverride) return weeklyPlan;
  return weeklyPlan.map((day) => ({ ...day, meals: state.planOverride[day.id] ?? day.meals }));
}

function extractPlanOverride(plan) {
  const override = {};
  for (const day of plan) override[day.id] = { ...day.meals };
  return override;
}

function resetPlanner() {
  window.localStorage.removeItem(STORAGE_KEY);
  Object.assign(state, defaultState());
  render();
}

function regenerateWeek() {
  const generated = generateWeek(weeklyPlan, mealLibrary);
  state.planOverride = extractPlanOverride(generated);
  saveState();
  render();
}

// ── Shared render helpers ─────────────────────────────────────────────────────

function renderNav() {
  return `
    <nav class="nav-bar" aria-label="Primary">
      <a href="/" class="nav-link active">Diet Plan</a>
      <a href="/nutrition" class="nav-link">Checklist</a>
      <a href="/nutrition#s-reminders" class="nav-link">Reminders</a>
      <a href="/benefits" class="nav-link">Benefits</a>
      <a href="/deficiencies" class="nav-link">Deficiencies</a>
      <a href="/overview" class="nav-link">Overview</a>
      <a href="/howto" class="nav-link">How-To</a>
      <a href="/diets" class="nav-link">Diet Types</a>
      <a href="/allergies" class="nav-link">Allergies</a>
      <a href="/foodtypes" class="nav-link">Food Categories</a>
      <a href="https://workout-tracker-production-0ec7.up.railway.app" class="nav-link" target="_blank" rel="noreferrer">Workout</a>
    </nav>
  `;
}

function renderViewTabs() {
  return `
    <div class="view-tabs" role="tablist" aria-label="Planner views">
      <button class="view-tab ${state.activeView === "mediterranean" ? "is-active" : ""}" data-view="mediterranean" role="tab" aria-selected="${state.activeView === "mediterranean"}">
        Mediterranean Plan
      </button>
      <button class="view-tab ${state.activeView === "my-planner" ? "is-active" : ""}" data-view="my-planner" role="tab" aria-selected="${state.activeView === "my-planner"}">
        My Weekly Planner
      </button>
    </div>
  `;
}

function renderHeadlineStat(label, value, note) {
  return `
    <div class="headline-stat">
      <span class="headline-label">${label}</span>
      <strong>${value}</strong>
      <span class="headline-note">${note}</span>
    </div>
  `;
}

function renderMeter(label, value, goal, tone) {
  const ratio = value / goal;
  return `
    <article class="meter-card ${statusTone(ratio)}">
      <div class="meter-ring ${tone}" style="--progress:${Math.min(ratio * 100, 100)}">
        <span>${percentText(ratio)}</span>
      </div>
      <div class="meter-copy">
        <strong>${label}</strong>
        <span>${formatMetric(value)} / ${formatMetric(goal)} mg</span>
        <span class="meter-state">${ratio >= 1 ? "Goal covered" : `${formatMetric(goal - value)} mg still open`}</span>
      </div>
    </article>
  `;
}

function renderMicroStat(label, value) {
  return `
    <div class="micro-stat">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderBooster(booster) {
  return `
    <article class="booster-card">
      <div class="booster-head">
        <strong>${booster.name}</strong>
        <span>${booster.portion}</span>
      </div>
      <p>${booster.reason}</p>
      <div class="nutrient-tags compact">
        <span>${formatMetric(booster.nutrients.potassium)} mg K</span>
        <span>${formatMetric(booster.nutrients.magnesium)} mg Mg</span>
        <span>${formatMetric(booster.nutrients.calories)} kcal</span>
      </div>
      <small>${booster.note}</small>
    </article>
  `;
}

function renderStaple(item) {
  return `
    <article class="staple-item">
      <div>
        <strong>${item.name}</strong>
        <span>${item.group}</span>
      </div>
      <span class="staple-count">${item.count} meals</span>
    </article>
  `;
}

function renderPresetOptions() {
  const options = goalPresets.map(
    (p) => `<option value="${p.id}" ${p.id === state.presetId ? "selected" : ""}>${p.label}</option>`
  );
  if (!goalPresets.some((p) => p.id === state.presetId)) {
    options.push('<option value="custom" selected>Custom targets</option>');
  } else {
    options.push('<option value="custom">Custom targets</option>');
  }
  return options.join("");
}

function renderDayButton(day) {
  const potassiumTone = statusTone(day.coverage.potassium);
  const magnesiumTone = statusTone(day.coverage.magnesium);
  return `
    <button
      class="day-button ${day.id === state.selectedDayId ? "is-active" : ""}"
      type="button" data-day="${day.id}"
      role="tab" aria-selected="${day.id === state.selectedDayId}"
    >
      <span class="day-topline">
        <span>${day.label}</span>
        <span>${formatMetric(day.totals.calories)} kcal</span>
      </span>
      <strong>${day.name}</strong>
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

function renderMealCard(meal) {
  return `
    <article class="meal-card">
      <div class="meal-heading">
        <div>
          <p class="meal-slot">${meal.slot}</p>
          <h4>${meal.title}</h4>
        </div>
        <span class="protein-pill">${meal.protein}</span>
      </div>
      <p class="meal-copy">${meal.subtitle}</p>
      <div class="nutrient-tags">
        <span>${formatMetric(meal.nutrients.potassium)} mg K</span>
        <span>${formatMetric(meal.nutrients.magnesium)} mg Mg</span>
        <span>${formatMetric(meal.nutrients.protein)} g protein</span>
        <span>${formatMetric(meal.nutrients.fiber)} g fiber</span>
      </div>
      <div class="ingredient-row">
        ${meal.ingredients.map((i) => `<span>${i.name}</span>`).join("")}
      </div>
    </article>
  `;
}

function renderPanel(id, labelLine, heading, body, extraClass = "") {
  const collapsed = collapsedPanels.has(id);
  return `
    <section class="inspector-panel ${id} ${extraClass} ${collapsed ? "is-collapsed" : ""}">
      <div class="section-heading compact panel-toggle" data-panel-toggle="${id}">
        <div>
          <p class="label-line">${labelLine}</p>
          <h2>${heading}</h2>
        </div>
        <span class="panel-chevron">${collapsed ? "+" : "−"}</span>
      </div>
      <div class="panel-body">
        ${body}
      </div>
    </section>
  `;
}

// ── Mediterranean view ────────────────────────────────────────────────────────

function renderMediterraneanView() {
  const plan = activeWeekPlan();
  const week = summarizeWeek(plan, mealLookup, state.goals);
  const selectedDay = week.days.find((d) => d.id === state.selectedDayId) ?? week.days[0];
  const boosters = suggestBoosters(selectedDay, boosterFoods);
  const staples = buildStaples(plan, mealLookup);
  const proteins = countProteins(plan, mealLookup);
  const activePreset = getActivePreset();
  const isCustomPlan = Boolean(state.planOverride);

  return `
    <header class="masthead">
      <div class="masthead-copy">
        <p class="eyebrow">Weekly Mediterranean diet planner</p>
        <h1>Aegean Week</h1>
        <p class="lead">Fish, beef, and chicken arranged into a mineral-forward week with steady potassium and magnesium support.</p>
        <div class="chip-row" aria-label="Plan tags">
          <span class="chip">Mediterranean leaning</span>
          <span class="chip">Fish / chicken / beef</span>
          <span class="chip">Potassium + magnesium first</span>
          ${isCustomPlan ? '<span class="chip chip-accent">Regenerated week</span>' : ""}
        </div>
        <div class="planner-actions" role="group" aria-label="Planner actions">
          <button type="button" class="reset-btn" data-action="regenerate">Regenerate week</button>
          <button type="button" class="reset-btn" data-action="reset">Reset planner</button>
        </div>
      </div>
      <div class="masthead-stats">
        ${renderHeadlineStat("Both goals hit", `${week.hits.both}/7`, "days this week")}
        ${renderHeadlineStat("Avg potassium", `${formatMetric(week.averages.potassium)} mg`, "per day")}
        ${renderHeadlineStat("Avg magnesium", `${formatMetric(week.averages.magnesium)} mg`, "per day")}
      </div>
    </header>

    <main class="workspace">
      <section class="planner-panel">
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
              <p class="label-line">${selectedDay.label}</p>
              <h3>${selectedDay.name}</h3>
              <p class="day-note">${selectedDay.focus}</p>
            </div>
            <div class="prep-note">
              <span class="prep-label">Prep edge</span>
              <p>${selectedDay.prep}</p>
            </div>
          </div>
          <div class="meal-grid">
            ${selectedDay.slots.map((entry) => renderMealCard(entry.meal)).join("")}
          </div>
        </div>
      </section>

      <aside class="inspector">
        ${renderPanel("goal-panel", "Targets", "Goal preset", `
          <label class="field">
            <span>Reference</span>
            <select name="presetId">${renderPresetOptions()}</select>
          </label>
          <div class="goal-grid">
            <label class="field">
              <span>Potassium goal (mg)</span>
              <input type="number" min="1" step="50" name="potassium" value="${state.goals.potassium}" />
            </label>
            <label class="field">
              <span>Magnesium goal (mg)</span>
              <input type="number" min="1" step="10" name="magnesium" value="${state.goals.magnesium}" />
            </label>
          </div>
          <p class="field-note">${activePreset.note}</p>
        `)}
        ${renderPanel("metrics-panel", "Today", selectedDay.name, `
          <div class="meter-grid">
            ${renderMeter("Potassium", selectedDay.totals.potassium, state.goals.potassium, "sea")}
            ${renderMeter("Magnesium", selectedDay.totals.magnesium, state.goals.magnesium, "copper")}
          </div>
          <div class="macro-strip">
            ${renderMicroStat("Protein", `${formatMetric(selectedDay.totals.protein)} g`)}
            ${renderMicroStat("Fiber", `${formatMetric(selectedDay.totals.fiber)} g`)}
            ${renderMicroStat("Energy", `${formatMetric(selectedDay.totals.calories)} kcal`)}
          </div>
        `)}
        ${renderPanel("booster-panel", "Catch-up options", "Smart boosters", `
          <div class="booster-list">
            ${boosters.map((b) => renderBooster(b)).join("")}
          </div>
        `)}
        ${renderPanel("staples-panel", "Shopping rhythm", "Weekly staples", `
          <div class="staples-list">
            ${staples.map((item) => renderStaple(item)).join("")}
          </div>
        `)}
        ${renderPanel("source-panel", "Pattern", "Protein rotation", `
          <div class="protein-grid">
            ${renderMicroStat("Fish meals", String(proteins.Fish))}
            ${renderMicroStat("Chicken meals", String(proteins.Chicken))}
            ${renderMicroStat("Beef meals", String(proteins.Beef))}
          </div>
          <p class="source-note">Meal values are directional estimates for planning. If you have kidney disease, blood pressure treatment, or supplement concerns, personalize targets with a clinician.</p>
        `)}
      </aside>
    </main>
  `;
}

// ── My Planner view ───────────────────────────────────────────────────────────

function renderMyPlannerView() {
  const selectedDayId = myPlanner.selectedDayId ?? myWeekTemplate[0].id;
  const selectedDay = myWeekTemplate.find((d) => d.id === selectedDayId) ?? myWeekTemplate[0];
  const isHome = myPlanner.dayTypes[selectedDayId] === "home";

  const weekPlanForGrocery = myWeekTemplate.map((day) => ({
    ...day,
    meals: myPlanner.plan[day.id] ?? day.meals
  }));
  const groceryList = buildGroceryList(weekPlanForGrocery, allMealsLookup);

  const dayTabs = myWeekTemplate.map((day) => {
    const dt = myPlanner.dayTypes[day.id];
    return `
      <button
        class="my-day-tab ${day.id === selectedDayId ? "is-active" : ""}"
        type="button"
        data-my-day="${day.id}"
      >
        <span class="day-tab-label">${day.label}</span>
        <span class="day-type-badge ${dt === "home" ? "home" : "work"}" data-my-toggle-type="${day.id}" role="button" tabindex="0" title="Toggle work/home">${dt === "home" ? "Home" : "Work"}</span>
      </button>
    `;
  }).join("");

  const slotKeys = ["breakfast", "lunch", "dinner", "snack"];
  const slotLabels = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

  const mealSlots = slotKeys.map((slotKey) => {
    const mealId = myPlanner.plan[selectedDay.id]?.[slotKey] ?? selectedDay.meals[slotKey];
    const meal = allMealsLookup.get(mealId);
    const isPickerOpen = myPlanner.pickerSlot === slotKey;
    if (!meal) return "";

    return `
      <div class="my-meal-slot ${isPickerOpen ? "picker-open" : ""}">
        <div class="my-slot-header">
          <span class="meal-slot-label">${slotLabels[slotKey]}</span>
          <div class="slot-actions">
            <button type="button" class="slot-btn" data-my-replace="${slotKey}">Replace</button>
            <button type="button" class="slot-btn slot-btn-reset" data-my-reset="${selectedDay.id}:${slotKey}">Reset</button>
          </div>
        </div>
        <div class="my-meal-card">
          <div class="my-meal-title">
            <strong>${meal.title}</strong>
            <span class="protein-pill">${meal.protein}</span>
          </div>
          <p class="meal-copy">${meal.subtitle}</p>
          <div class="ingredient-row">
            ${meal.ingredients.map((i) => `<span>${i.name}</span>`).join("")}
          </div>
        </div>
        ${isPickerOpen ? renderMealPicker(selectedDay.id, slotKey) : ""}
      </div>
    `;
  }).join("");

  return `
    <div class="my-planner-shell">
      <header class="my-planner-header">
        <div>
          <p class="eyebrow">Personal weekly planner</p>
          <h1 class="my-planner-title">My Week</h1>
          <p class="lead">Tap a day, swap meals from your usual library, generate a grocery list.</p>
        </div>
        <div class="my-header-actions">
          <button type="button" class="reset-btn" data-action="reset-my-planner">Reset to defaults</button>
        </div>
      </header>

      <div class="my-workspace">
        <section class="my-planner-panel">
          <div class="my-day-tabs" role="tablist" aria-label="Days of the week">
            ${dayTabs}
          </div>

          <div class="my-day-view">
            <div class="my-day-header">
              <div>
                <h2 class="my-day-name">${selectedDay.name}</h2>
                <p class="day-type-hint">${isHome ? "Home day — home lunch options available." : "Work day — work lunch options available."}</p>
              </div>
              <div class="day-type-toggle" role="group" aria-label="Day type">
                <button type="button" class="day-type-btn ${!isHome ? "is-active" : ""}" data-my-day-type="${selectedDay.id}:work">Work day</button>
                <button type="button" class="day-type-btn ${isHome ? "is-active" : ""}" data-my-day-type="${selectedDay.id}:home">Home day</button>
              </div>
            </div>
            <div class="my-slots-grid">
              ${mealSlots}
            </div>
          </div>
        </section>

        <aside class="my-inspector">
          ${renderPanel("my-grocery-panel", "This week", "Grocery List", `
            <div class="grocery-list">
              ${groceryList.map((group) => renderGroceryGroup(group)).join("")}
            </div>
          `, "my-grocery-panel")}
          ${renderPanel("usual-library-panel", "Your meals", "Usual Meals", `
            <p class="field-note">Tap "Replace" on any slot to pick from these.</p>
            ${renderUsualMealsLibrary()}
          `, "usual-library-panel")}
        </aside>
      </div>
    </div>
  `;
}

function renderMealPicker(dayId, slotKey) {
  const slotName = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" }[slotKey];
  const available = usualMealsLibrary.filter((m) => m.slot === slotName);
  const currentMealId = myPlanner.plan[dayId]?.[slotKey];

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

function renderUsualMealsLibrary() {
  const slots = [
    { key: "Breakfast", label: "Breakfast" },
    { key: "Lunch", label: "Lunch" },
    { key: "Dinner", label: "Dinner" },
    { key: "Snack", label: "Snacks" }
  ];
  return slots.map(({ key, label }) => {
    const meals = usualMealsLibrary.filter((m) => m.slot === key);
    return `
      <div class="library-group">
        <p class="library-slot-label">${label}</p>
        <div class="library-meals">
          ${meals.map((meal) => `
            <div class="library-meal-item">
              <strong>${meal.title}</strong>
              <span>${meal.ingredients.map((i) => i.name).join(", ")}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

// ── Main render ───────────────────────────────────────────────────────────────

function render() {
  document.title = state.activeView === "my-planner" ? "My Weekly Planner" : "Aegean Week";
  const body = state.activeView === "my-planner" ? renderMyPlannerView() : renderMediterraneanView();
  app.innerHTML = `<div class="app-shell">${renderNav()}${renderViewTabs()}${body}</div>`;
}

// ── Event handling ────────────────────────────────────────────────────────────

app.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;

  const viewTab = event.target.closest("[data-view]");
  if (viewTab) {
    state.activeView = viewTab.dataset.view;
    saveState();
    render();
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const action = actionButton.dataset.action;
    if (action === "regenerate") { regenerateWeek(); return; }
    if (action === "reset") {
      const ok = typeof window.confirm === "function"
        ? window.confirm("Reset the planner to defaults? This clears your saved goals and regenerated week.")
        : true;
      if (ok) resetPlanner();
      return;
    }
    if (action === "reset-my-planner") {
      const ok = typeof window.confirm === "function"
        ? window.confirm("Reset your weekly planner to the default template?")
        : true;
      if (ok) {
        window.localStorage.removeItem(MY_KEY);
        const fresh = defaultMyPlannerState();
        Object.assign(myPlanner, fresh);
        render();
      }
      return;
    }
  }

  // Collapsible panels
  const panelToggle = event.target.closest("[data-panel-toggle]");
  if (panelToggle) {
    const id = panelToggle.dataset.panelToggle;
    collapsedPanels.has(id) ? collapsedPanels.delete(id) : collapsedPanels.add(id);
    render();
    return;
  }

  // Mediterranean: day selection
  const dayButton = event.target.closest("[data-day]");
  if (dayButton) {
    state.selectedDayId = dayButton.dataset.day;
    saveState();
    render();
    return;
  }

  // My Planner: badge toggle (must come before day tab check to intercept)
  const toggleBadge = event.target.closest("[data-my-toggle-type]");
  if (toggleBadge) {
    const dayId = toggleBadge.dataset.myToggleType;
    myPlanner.dayTypes[dayId] = myPlanner.dayTypes[dayId] === "home" ? "work" : "home";
    saveMyPlannerState();
    render();
    return;
  }

  // My Planner: day tab
  const myDayTab = event.target.closest("[data-my-day]");
  if (myDayTab) {
    myPlanner.selectedDayId = myDayTab.dataset.myDay;
    myPlanner.pickerSlot = null;
    render();
    return;
  }

  // My Planner: day type toggle
  const dayTypeBtn = event.target.closest("[data-my-day-type]");
  if (dayTypeBtn) {
    const [dayId, type] = dayTypeBtn.dataset.myDayType.split(":");
    myPlanner.dayTypes[dayId] = type;
    saveMyPlannerState();
    render();
    return;
  }

  // My Planner: open/close meal picker
  const replaceBtn = event.target.closest("[data-my-replace]");
  if (replaceBtn) {
    const slotKey = replaceBtn.dataset.myReplace;
    myPlanner.pickerSlot = myPlanner.pickerSlot === slotKey ? null : slotKey;
    render();
    return;
  }

  // My Planner: close picker
  if (event.target.closest("[data-my-picker-close]")) {
    myPlanner.pickerSlot = null;
    render();
    return;
  }

  // My Planner: pick a meal
  const pickBtn = event.target.closest("[data-my-pick]");
  if (pickBtn) {
    const [dayId, slotKey, mealId] = pickBtn.dataset.myPick.split(":");
    if (!myPlanner.plan[dayId]) myPlanner.plan[dayId] = {};
    myPlanner.plan[dayId][slotKey] = mealId;
    myPlanner.pickerSlot = null;
    saveMyPlannerState();
    render();
    return;
  }

  // My Planner: reset single slot
  const resetSlotBtn = event.target.closest("[data-my-reset]");
  if (resetSlotBtn) {
    const [dayId, slotKey] = resetSlotBtn.dataset.myReset.split(":");
    const defaultDay = myWeekTemplate.find((d) => d.id === dayId);
    if (defaultDay) {
      if (!myPlanner.plan[dayId]) myPlanner.plan[dayId] = {};
      myPlanner.plan[dayId][slotKey] = defaultDay.meals[slotKey];
    }
    saveMyPlannerState();
    render();
    return;
  }
});

app.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const toggleBadge = event.target.closest("[data-my-toggle-type]");
  if (toggleBadge) {
    event.preventDefault();
    const dayId = toggleBadge.dataset.myToggleType;
    myPlanner.dayTypes[dayId] = myPlanner.dayTypes[dayId] === "home" ? "work" : "home";
    saveMyPlannerState();
    render();
  }
});

app.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

  if (target.name === "presetId") {
    if (target.value === "custom") { state.presetId = "custom"; saveState(); render(); return; }
    const preset = goalPresets.find((p) => p.id === target.value);
    if (!preset) return;
    state.presetId = preset.id;
    state.goals = { potassium: preset.potassium, magnesium: preset.magnesium };
    saveState(); render(); return;
  }

  if (target.name === "potassium" || target.name === "magnesium") {
    state.presetId = "custom";
    state.goals[target.name] = clampGoal(target.value, state.goals[target.name]);
    saveState(); render();
  }
});

render();
