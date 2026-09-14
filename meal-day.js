// One day of the week's meal plan, read the way the Weekly Meal Calendar reads it.
//
// The plan itself is written by the Daily Meal Planner (/work-meals) and stored
// under a sync code; this file only turns a stored plan into the three lines a
// day is — Morning, Afternoon, Night — so that the calendar page and
// /api/daily-meal-plan can never disagree about what today's meals are.
//
// It is deliberately dependency-free and valid in both a browser and node: the
// calendar imports it as a module, the server imports it to answer the hub.

export const SLOTS = [
  { id: "morning", icon: "🌅", label: "Morning" },
  { id: "afternoon", icon: "☀️", label: "Afternoon" },
  { id: "night", icon: "🌙", label: "Night" },
];

export const DAYS = [
  { id: "mon", label: "Monday" }, { id: "tue", label: "Tuesday" }, { id: "wed", label: "Wednesday" },
  { id: "thu", label: "Thursday" }, { id: "fri", label: "Friday" }, { id: "sat", label: "Saturday" },
  { id: "sun", label: "Sunday" },
];

const WEEKDAY_IDS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function dayLabel(id) {
  const day = DAYS.find(d => d.id === id);
  return day ? day.label : "";
}

/** The day id for a `Date`, in whatever timezone that date is already in. */
export function dayIdFromDate(date = new Date()) {
  return WEEKDAY_IDS[date.getDay()];
}

/**
 * The day id for a plain `YYYY-MM-DD`.
 *
 * Built through `Date.UTC` rather than `new Date(key)` so the weekday is the
 * one that calendar day actually has. The caller's date is already the day it
 * means — the hub sends Vancouver's — and re-reading it in this container's
 * timezone would turn it into a different weekday for half of every day.
 */
export function dayIdFromDateKey(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || "").trim());
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return WEEKDAY_IDS[date.getUTCDay()];
}

function slugify(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function cap(value) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : value; }

/** A planned dinner as a heading and the line under it, or null for an empty night. */
export function describeDinner(dinner) {
  const d = dinner;
  if (!d) return null;
  if (d.type === "out") return { main: "🍽️ Ordering out", sub: "" };
  if (d.type === "full") return { main: "✅ Already full", sub: "Ate enough earlier — skipping dinner." };
  if (d.name || d.protein || d.carb || (d.veg && d.veg.length)) {
    // A dinner picked from the dinner list lists only what was added to it; the heading is the
    // dinner itself, so an older dinner's protein only follows when it adds something.
    const sameName = d.name && d.protein && d.name.toLowerCase() === d.protein.toLowerCase();
    const parts = d.pick
      ? [d.meat, ...(d.sides || [])].filter(Boolean).join(" · ")
      : [d.name && !sameName ? cap(d.protein) : null, d.carb, (d.veg || []).join(" + "), d.sauce].filter(Boolean).join(" · ");
    // A leftover serving keeps the meal's own name and says which day's cook it came from.
    const from = d.from ? "♻️ Leftovers from " + dayLabel(d.from) + (parts ? " · " : "") : "";
    return { main: d.name || cap(d.protein) || "Dinner planned", sub: from + parts };
  }
  return null;
}

function dayOf(plan, dayId) {
  const day = (plan && plan.days && plan.days[dayId]) || {};
  return {
    states: day.states || {},
    checked: day.checked || {},
    ai: day.ai || {},
    dinner: day.dinner || null,
    leftovers: day.leftovers || {},
  };
}

function checkedFoodsFor(plan, day, slotId) {
  const own = (plan && plan.foodLists && plan.foodLists[slotId]) || [];
  const generated = day.ai[slotId] || [];
  return [...own, ...generated].filter(name => day.checked[slotId + "|" + slugify(name)]);
}

/**
 * One slot of one day: the same sentence the calendar prints in that cell.
 *
 * `planned` is what separates "nothing chosen yet" from a real answer, so a
 * reader of this — a card on another app, say — can tell an empty day from a
 * planned one without matching on the wording.
 */
export function slotEntry(plan, dayId, slot) {
  const day = dayOf(plan, dayId);
  // A meal is either happening or hidden; older plans also wrote "work" or "home" here.
  const hidden = day.states[slot.id] === "skip";
  const base = { id: slot.id, icon: slot.icon, label: slot.label };

  if (hidden) return { ...base, text: "Hidden", hidden: true, planned: false };

  const leftover = day.leftovers[slot.id];
  if (leftover && slot.id !== "night") {
    return { ...base, text: "♻️ Leftovers — " + leftover, hidden: false, planned: true };
  }

  if (slot.id === "night") {
    const summary = describeDinner(day.dinner);
    if (summary) {
      return { ...base, text: summary.main + (summary.sub ? " — " + summary.sub : ""), hidden: false, planned: true };
    }
    return { ...base, text: "Nothing planned yet", hidden: false, planned: false };
  }

  const picked = checkedFoodsFor(plan, day, slot.id);
  return picked.length
    ? { ...base, text: picked.join(", "), hidden: false, planned: true }
    : { ...base, text: "Not chosen yet", hidden: false, planned: false };
}

/**
 * A whole day, as three slots.
 *
 * Slots set to Hide are left out unless asked for: the calendar draws every
 * row of its grid, but anything reading a day for a summary should be told
 * about the meals that are happening and not about the ones deliberately
 * turned off.
 */
export function summarizeDay(plan, dayId, { includeHidden = false } = {}) {
  const slots = SLOTS.map(slot => slotEntry(plan, dayId, slot))
    .filter(entry => includeHidden || !entry.hidden);

  return {
    day: dayId,
    label: dayLabel(dayId),
    slots,
    planned: slots.some(entry => entry.planned),
  };
}
