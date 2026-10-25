// Date-only arithmetic keeps courses and breaks stable across time zones and DST.
const DAY_MS = 86400000;
export const MODES = {
  unset: "Not scheduled",
  daily: "Every day",
  weekdays: "Selected weekdays",
  course: "Fixed course",
  cycle: "On / off cycle",
  asneeded: "As needed",
  paused: "Paused",
};
export const STARTER_NAMES = [
  "Ashwagandha",
  "Vitamin D",
  "Zinc",
  "Melatonin",
  "Immune complex (Purana)",
  "Calcium + magnesium",
  "Biotin",
];
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function validDate(key) {
  return (
    typeof key === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(key) &&
    Number.isFinite(Date.parse(key)) &&
    new Date(key + "T00:00:00Z").toISOString().slice(0, 10) === key
  );
}
export function addDays(key, count) {
  return new Date(Date.parse(key + "T00:00:00Z") + count * DAY_MS)
    .toISOString()
    .slice(0, 10);
}
export function daysBetween(a, b) {
  return Math.round(
    (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY_MS,
  );
}
export function mondayOf(key) {
  return addDays(key, -(new Date(key + "T00:00:00Z").getUTCDay() + 6) % 7);
}
export function blankSupplement(id, name = "") {
  return {
    id,
    name,
    dose: "",
    timing: "",
    notes: "",
    review: "",
    archived: false,
    mode: "unset",
    start: "",
    end: "",
    weekdays: [],
    onDays: null,
    offDays: null,
    duration: null,
  };
}
export function starterPlan() {
  return {
    v: 1,
    supplements: STARTER_NAMES.map((name, i) =>
      blankSupplement("supp-" + (i + 1), name),
    ),
    logs: {},
  };
}
const text = (x, n) => (typeof x === "string" ? x.trim().slice(0, n) : "");
const integer = (x) => (Number.isInteger(x) && x > 0 && x <= 3650 ? x : null);
export function scheduleError(s) {
  if (!s.name.trim()) return "Enter a supplement name.";
  if (s.review && !validDate(s.review)) return "Choose a valid review date.";
  if (["unset", "paused"].includes(s.mode)) return "";
  if (!validDate(s.start)) return "Choose a start date.";
  if (s.end && (!validDate(s.end) || s.end < s.start))
    return "End date must be on or after the start date.";
  if (s.mode === "weekdays" && !s.weekdays.length)
    return "Choose at least one weekday.";
  if (s.mode === "course" && !integer(s.duration))
    return "Enter the number of days in this course (1–3650).";
  if (s.mode === "cycle" && (!integer(s.onDays) || !integer(s.offDays)))
    return "Enter both on-days and break-days (1–3650 each).";
  return "";
}
export function normalizeSupplementPlan(input) {
  if (
    !input ||
    typeof input !== "object" ||
    !Array.isArray(input.supplements) ||
    input.supplements.length > 100 ||
    !input.logs ||
    typeof input.logs !== "object" ||
    Array.isArray(input.logs)
  )
    return null;
  const supplements = [],
    ids = new Set();
  for (const raw of input.supplements) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const id = text(raw.id, 80);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) return null;
    ids.add(id);
    const item = {
      ...blankSupplement(id),
      name: text(raw.name, 80),
      dose: text(raw.dose, 160),
      timing: text(raw.timing, 120),
      notes: text(raw.notes, 1500),
      review: text(raw.review, 10),
      archived: !!raw.archived,
      mode: Object.hasOwn(MODES, raw.mode) ? raw.mode : "unset",
      start: text(raw.start, 10),
      end: text(raw.end, 10),
      weekdays: [
        ...new Set(
          (Array.isArray(raw.weekdays) ? raw.weekdays : []).filter(
            (n) => Number.isInteger(n) && n >= 0 && n <= 6,
          ),
        ),
      ],
      onDays: integer(raw.onDays),
      offDays: integer(raw.offDays),
      duration: integer(raw.duration),
    };
    if (scheduleError(item)) return null;
    supplements.push(item);
  }
  const logs = {};
  for (const item of supplements) {
    const entries = input.logs[item.id];
    if (!entries || typeof entries !== "object" || Array.isArray(entries))
      continue;
    const clean = Object.entries(entries).filter(
      ([date, status]) =>
        validDate(date) && ["taken", "skipped"].includes(status),
    );
    if (clean.length > 3660) return null;
    if (clean.length)
      Object.defineProperty(logs, item.id, {
        value: Object.fromEntries(clean),
        enumerable: true,
        writable: true,
        configurable: true,
      });
  }
  return { v: 1, supplements, logs };
}
export function endDate(s) {
  const courseEnd =
    s.mode === "course" && validDate(s.start) && integer(s.duration)
      ? addDays(s.start, s.duration - 1)
      : "";
  return courseEnd && s.end
    ? courseEnd < s.end
      ? courseEnd
      : s.end
    : courseEnd || s.end;
}
export function plannedStatus(s, date) {
  if (s.mode === "unset") return "unset";
  if (s.mode === "paused") return "paused";
  if (!validDate(date) || scheduleError(s)) return "unset";
  if (date < s.start) return "before";
  const end = endDate(s);
  if (end && date > end) return "ended";
  if (s.mode === "asneeded") return "asneeded";
  if (
    s.mode === "weekdays" &&
    !s.weekdays.includes(new Date(date + "T00:00:00Z").getUTCDay())
  )
    return "off";
  if (
    s.mode === "cycle" &&
    daysBetween(s.start, date) % (s.onDays + s.offDays) >= s.onDays
  )
    return "break";
  return "planned";
}
export function cellStatus(plan, s, date) {
  return plan.logs[s.id]?.[date] || plannedStatus(s, date);
}
export function toggleLog(plan, id, date, today = dateKey()) {
  if (
    !validDate(date) ||
    date > today ||
    !plan.supplements.some((s) => s.id === id && !s.archived)
  )
    return false;
  const logs = Object.hasOwn(plan.logs, id) ? plan.logs[id] : {};
  Object.defineProperty(plan.logs, id, {
    value: logs,
    enumerable: true,
    writable: true,
    configurable: true,
  });
  if (logs[date] === "skipped") delete logs[date];
  else logs[date] = logs[date] === "taken" ? "skipped" : "taken";
  return true;
}
export function scheduleSummary(s) {
  if (s.mode === "cycle")
    return `${s.onDays} days on · ${s.offDays} days break`;
  if (s.mode === "course")
    return `${s.duration}-day course · ends ${endDate(s)}`;
  if (s.mode === "weekdays")
    return s.weekdays
      .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
      .join(" · ");
  return MODES[s.mode] || MODES.unset;
}
