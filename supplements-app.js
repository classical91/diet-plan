import {
  MODES,
  dateKey,
  addDays,
  mondayOf,
  starterPlan,
  blankSupplement,
  normalizeSupplementPlan,
  scheduleError,
  scheduleSummary,
  endDate,
  plannedStatus,
  cellStatus,
  toggleLog,
} from "./supplement-plan.js";
const KEY = "nutrimind:supplements:v1",
  SYNC_KEY = "work-meals:sync-code",
  DIRTY = KEY + ":dirty";
const $ = (selector) => document.querySelector(selector),
  esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const today = () => dateKey();
let plan = starterPlan(),
  dirty = false,
  loadFailed = false,
  rangeStart = mondayOf(today()),
  span = 14;
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const parsed = normalizeSupplementPlan(JSON.parse(raw));
    if (!parsed) throw Error("Invalid saved calendar");
    plan = parsed;
  }
  dirty = localStorage.getItem(DIRTY) === "1";
} catch {
  loadFailed = true;
  $("#saveStatus").textContent =
    "Saved calendar could not be read. Download the saved data before making changes.";
}
let syncCode = "",
  revision = 0,
  syncTimer = null,
  syncBusy = false,
  connecting = false,
  pendingRemote = null;
const labels = {
  planned: "Planned",
  taken: "Taken",
  skipped: "Skipped",
  break: "Cycle break",
  unset: "Not scheduled",
  paused: "Paused",
  before: "Before start",
  ended: "Course ended",
  off: "Off day",
  asneeded: "As needed",
};
const symbols = {
  planned: "○",
  taken: "✓",
  skipped: "×",
  break: "Ⅱ",
  unset: "—",
  paused: "Ⅱ",
  before: "—",
  ended: "—",
  off: "—",
  asneeded: "·",
};
function formatDate(key, options) {
  return new Date(key + "T12:00:00").toLocaleDateString(undefined, options);
}
function render() {
  const active = plan.supplements.filter((s) => !s.archived),
    now = today();
  const planned = active.filter(
      (s) => plannedStatus(s, now) === "planned",
    ).length,
    taken = active.filter((s) => plan.logs[s.id]?.[now] === "taken").length,
    breaks = active.filter((s) => plannedStatus(s, now) === "break").length,
    reviews = active.filter((s) => s.review && s.review <= now).length;
  $("#summary").innerHTML = [
    [planned, "Planned today"],
    [taken, "Recorded taken today"],
    [breaks, "On a cycle break"],
    [reviews, "Reviews due"],
  ]
    .map(
      ([n, label]) =>
        `<div class="summary-card"><strong>${n}</strong><span>${label}</span></div>`,
    )
    .join("");
  $("#calendarTitle").textContent =
    span === 7
      ? "Your week"
      : span === 14
        ? "Your two weeks"
        : "Your four weeks";
  $("#rangeLabel").textContent =
    formatDate(rangeStart, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) +
    " – " +
    formatDate(addDays(rangeStart, span - 1), {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const dates = Array.from({ length: span }, (_, i) => addDays(rangeStart, i));
  const shown = plan.supplements.filter(
    (s) => !s.archived || $("#showArchived").checked,
  );
  $("#matrix").innerHTML =
    '<caption class="sr-only">Supplement schedule and daily records</caption><thead><tr><th scope="col">Supplement / schedule</th>' +
    dates
      .map(
        (date) =>
          `<th scope="col" class="${date === now ? "today" : ""}" ${date === now ? 'aria-current="date"' : ""}>${esc(formatDate(date, { weekday: "short" }))}<strong>${esc(formatDate(date, { day: "numeric" }))}</strong>${esc(formatDate(date, { month: "short" }))}</th>`,
      )
      .join("") +
    "</tr></thead><tbody>" +
    shown
      .map(
        (s) =>
          `<tr><th scope="row"><button type="button" data-edit="${esc(s.id)}">${esc(s.name)}${s.archived ? " (archived)" : ""}</button><small>${esc(scheduleSummary(s))}</small>${s.dose || s.timing ? `<small>${esc([s.dose, s.timing].filter(Boolean).join(" · "))}</small>` : ""}${s.review ? `<small class="${s.review <= now ? "review" : ""}">${s.review <= now ? "Review due" : "Review"} · ${esc(s.review)}</small>` : ""}</th>` +
          dates
            .map((date) => {
              const status = cellStatus(plan, s, date),
                label = `${s.name}, ${date}: ${labels[status]}`;
              return `<td class="${date === now ? "today" : ""}"><button class="cell ${status}" type="button" data-log="${esc(s.id)}" data-date="${date}" aria-label="${esc(label)}" title="${esc(label + (date > now ? " · Future date" : s.archived ? " · Archived" : " · Click to change record"))}" ${date > now || s.archived || loadFailed ? "disabled" : ""}>${symbols[status]}</button></td>`;
            })
            .join("") +
          "</tr>",
      )
      .join("") +
    (shown.length
      ? ""
      : `<tr><td colspan="${span + 1}" class="empty-row">No supplements here. Add one or show archived supplements.</td></tr>`) +
    "</tbody>";
  $("#addSupplement").disabled = loadFailed;
}
function scrollToToday() {
  requestAnimationFrame(() => {
    const cell = $("#matrix thead .today"),
      scroller = $(".matrix-scroll");
    if (!cell) return;
    const fixedWidth = $("#matrix thead th:first-child").getBoundingClientRect()
      .width;
    const left =
      cell.getBoundingClientRect().left -
      scroller.getBoundingClientRect().left +
      scroller.scrollLeft -
      fixedWidth;
    scroller.scrollLeft = Math.max(0, left);
  });
}
function save() {
  if (loadFailed) return false;
  dirty = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(plan));
    localStorage.setItem(DIRTY, "1");
    $("#saveStatus").textContent = "Saved on this device";
  } catch {
    $("#saveStatus").textContent =
      "Device storage is unavailable. Download a backup to keep these changes.";
  }
  render();
  queueSync();
  return true;
}
$("#matrix").onclick = (event) => {
  const b = event.target.closest("button");
  if (!b) return;
  if (b.dataset.edit) openEditor(b.dataset.edit);
  if (
    b.dataset.log &&
    toggleLog(plan, b.dataset.log, b.dataset.date, today())
  ) {
    save();
    $("#announcement").textContent = `${
      labels[
        cellStatus(
          plan,
          plan.supplements.find((s) => s.id === b.dataset.log),
          b.dataset.date,
        )
      ]
    } on ${b.dataset.date}`;
    const replacement = $(
      `[data-log="${b.dataset.log}"][data-date="${b.dataset.date}"]`,
    );
    replacement?.focus();
  }
};
$("#previous").onclick = () => {
  rangeStart = addDays(rangeStart, -span);
  render();
};
$("#next").onclick = () => {
  rangeStart = addDays(rangeStart, span);
  render();
};
$("#today").onclick = () => {
  rangeStart = mondayOf(today());
  render();
  scrollToToday();
};
$("#range").onchange = () => {
  span = Number($("#range").value);
  render();
};
$("#showArchived").onchange = render;
function scheduleFields() {
  const mode = $("#mode").value;
  $("#scheduleFields").hidden = ["unset", "paused"].includes(mode);
  $("#weekdayFields").hidden = mode !== "weekdays";
  $("#courseFields").hidden = mode !== "course";
  $("#cycleFields").hidden = mode !== "cycle";
  if (!["unset", "paused"].includes(mode) && !$("#start").value)
    $("#start").value = today();
}
$("#mode").onchange = scheduleFields;
function openEditor(id) {
  const s =
    plan.supplements.find((s) => s.id === id) ||
    blankSupplement(crypto.randomUUID());
  $("#supplementId").value = s.id;
  for (const field of [
    "name",
    "dose",
    "timing",
    "mode",
    "start",
    "end",
    "review",
    "notes",
    "duration",
    "onDays",
    "offDays",
  ])
    $("#" + field).value = s[field] ?? "";
  document
    .querySelectorAll('[name="weekday"]')
    .forEach((el) => (el.checked = s.weekdays.includes(Number(el.value))));
  $("#editorTitle").textContent = id ? "Edit supplement" : "Add supplement";
  $("#archive").hidden = !id;
  $("#archive").textContent = s.archived ? "Restore supplement" : "Archive";
  $("#formError").textContent = "";
  scheduleFields();
  $("#supplementForm")
    .querySelectorAll('input,select,textarea,button[type="submit"],#archive')
    .forEach((el) => (el.disabled = loadFailed));
  $("#editor").showModal();
}
$("#addSupplement").onclick = () => openEditor();
for (const id of ["closeEditor", "cancelEditor"])
  $("#" + id).onclick = () => $("#editor").close();
$("#supplementForm").onsubmit = (event) => {
  event.preventDefault();
  if (loadFailed) return;
  const id = $("#supplementId").value,
    existing = plan.supplements.find((s) => s.id === id),
    s = blankSupplement(id);
  s.archived = existing?.archived || false;
  for (const field of [
    "name",
    "dose",
    "timing",
    "mode",
    "start",
    "end",
    "review",
    "notes",
  ])
    s[field] = $("#" + field).value.trim();
  for (const field of ["duration", "onDays", "offDays"])
    s[field] = $("#" + field).value ? Number($("#" + field).value) : null;
  s.weekdays = [...document.querySelectorAll('[name="weekday"]:checked')].map(
    (el) => Number(el.value),
  );
  const error = scheduleError(s);
  if (error) {
    $("#formError").textContent = error;
    return;
  }
  if (!existing && plan.supplements.length >= 100) {
    $("#formError").textContent = "You can keep up to 100 supplements.";
    return;
  }
  if (existing) plan.supplements[plan.supplements.indexOf(existing)] = s;
  else plan.supplements.push(s);
  save();
  $("#editor").close();
};
$("#archive").onclick = () => {
  const s = plan.supplements.find((s) => s.id === $("#supplementId").value);
  if (s && !loadFailed) {
    s.archived = !s.archived;
    save();
    $("#editor").close();
  }
};
$("#downloadBackup").onclick = () => {
  const data = loadFailed
      ? localStorage.getItem(KEY)
      : JSON.stringify(plan, null, 2),
    url = URL.createObjectURL(
      new Blob([data || ""], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = `supplement-calendar-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
// Separate, revision-checked store: supplement saves never write a meal plan.
const syncStatus = (message) => {
  $("#syncStatus").textContent = message;
  $("#syncForget").hidden = !syncCode;
};
const request = (method, body) =>
  fetch("/api/supplement-plan", {
    method,
    headers: { "content-type": "application/json", "x-sync-code": syncCode },
    body: body ? JSON.stringify(body) : undefined,
  });
function markClean(snapshot) {
  if (JSON.stringify(plan) !== snapshot) return;
  dirty = false;
  try {
    localStorage.removeItem(DIRTY);
  } catch {}
}
function showConflict(data) {
  pendingRemote = data;
  syncStatus(
    "This device and the synced calendar differ. Choose which copy to keep. Local changes are preserved until you choose.",
  );
  $("#syncChoices").hidden = false;
}
function useRemote(data) {
  const remote = normalizeSupplementPlan(data.plan);
  if (!remote)
    throw Error("The synced calendar could not be read. Local data was kept.");
  // Save successfully before replacing the in-memory calendar.
  localStorage.setItem(KEY, JSON.stringify(remote));
  plan = remote;
  revision = data.revision;
  dirty = false;
  localStorage.removeItem(DIRTY);
  render();
  syncStatus("Synced across devices.");
}
async function connect(code) {
  if (syncBusy || connecting) return;
  if (loadFailed) {
    syncStatus("Download the saved data before connecting a new calendar.");
    return;
  }
  code = String(code).trim();
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(code)) {
    syncStatus("Use a private code of 20–128 letters, numbers, _ or -.");
    return;
  }
  clearTimeout(syncTimer);
  syncCode = code;
  connecting = true;
  $("#syncCode").value = code;
  pendingRemote = null;
  $("#syncChoices").hidden = true;
  try {
    localStorage.setItem(SYNC_KEY, code);
  } catch {}
  syncStatus("Checking your synced calendar…");
  try {
    const response = await request("GET");
    if (response.status === 404) {
      revision = 0;
      connecting = false;
      await push();
      return;
    }
    if (!response.ok)
      throw Error((await response.json()).error || "Could not connect.");
    const data = await response.json(),
      remote = normalizeSupplementPlan(data.plan);
    if (!remote) throw Error("The synced calendar could not be read.");
    const identical = JSON.stringify(remote) === JSON.stringify(plan);
    revision = data.revision;
    if (
      !identical &&
      (dirty || JSON.stringify(plan) !== JSON.stringify(starterPlan()))
    )
      showConflict(data);
    else if (identical) {
      markClean(JSON.stringify(plan));
      syncStatus("Synced across devices.");
    } else useRemote(data);
  } catch (error) {
    syncStatus(error.message + " Changes stay on this device.");
  } finally {
    connecting = false;
  }
}
function queueSync() {
  if (!syncCode || pendingRemote || loadFailed || connecting) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(push, 700);
}
async function push() {
  if (!syncCode || pendingRemote || loadFailed || connecting || syncBusy)
    return;
  syncBusy = true;
  const snapshot = JSON.stringify(plan);
  syncStatus("Syncing…");
  let succeeded = false;
  try {
    const response = await request("PUT", {
      plan: JSON.parse(snapshot),
      revision,
    });
    if (response.status === 409) {
      const latest = await request("GET");
      if (!latest.ok) throw Error("Could not load the newer calendar.");
      showConflict(await latest.json());
      return;
    }
    if (!response.ok)
      throw Error((await response.json()).error || "Sync failed.");
    revision = (await response.json()).revision;
    markClean(snapshot);
    succeeded = true;
    syncStatus("Synced across devices.");
  } catch (error) {
    syncStatus(
      error.message + " Changes are saved here. Use Connect to retry.",
    );
  } finally {
    syncBusy = false;
    if (succeeded && JSON.stringify(plan) !== snapshot) queueSync();
  }
}
$("#syncForm").onsubmit = (event) => {
  event.preventDefault();
  connect($("#syncCode").value);
};
$("#useRemote").onclick = () => {
  if (!pendingRemote) return;
  try {
    useRemote(pendingRemote);
    pendingRemote = null;
    $("#syncChoices").hidden = true;
  } catch (error) {
    syncStatus(error.message);
  }
};
$("#keepLocal").onclick = () => {
  if (!pendingRemote) return;
  revision = pendingRemote.revision;
  pendingRemote = null;
  $("#syncChoices").hidden = true;
  push();
};
$("#syncForget").onclick = () => {
  if (syncBusy || connecting) {
    syncStatus("Wait for the current sync to finish before disconnecting.");
    return;
  }
  clearTimeout(syncTimer);
  syncCode = "";
  revision = 0;
  pendingRemote = null;
  $("#syncCode").value = "";
  $("#syncChoices").hidden = true;
  try {
    localStorage.removeItem(SYNC_KEY);
  } catch {}
  syncStatus("Disconnected. Your calendar is kept on this device.");
};
render();
scrollToToday();
try {
  const code = localStorage.getItem(SYNC_KEY);
  if (code && !loadFailed) connect(code);
} catch {}
