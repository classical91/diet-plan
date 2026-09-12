// The answer behind GET /api/daily-meal-plan: one day of the stored week.
//
// Kept apart from server.js and expressed as plain values in and out — a
// method, a date, a sync code, and a way to read the plan — so the rules about
// what each kind of bad request gets back can be tested without a socket or a
// database.
import { dayIdFromDate, dayIdFromDateKey, summarizeDay } from "./meal-day.js";

/**
 * @param {object} query
 * @param {string} query.method       HTTP method of the request.
 * @param {string|null} query.dateKey The calendar day being asked about, `YYYY-MM-DD`.
 *   The caller sends the day it means, because the day a reader is having is
 *   not necessarily this container's: it runs on UTC. Without one, the day here.
 * @param {unknown} query.syncCode    The `x-sync-code` header, unvalidated.
 * @param {(code: unknown) => Promise<object|null>} query.readPlan
 * @returns {Promise<{status: number, payload: object}>}
 */
export async function dailyMealPlan({ method, dateKey, syncCode, readPlan, now = new Date() }) {
  if (method !== "GET") return { status: 405, payload: { error: "Use GET." } };

  const dayId = dateKey ? dayIdFromDateKey(dateKey) : dayIdFromDate(now);
  if (!dayId) return { status: 400, payload: { error: "date must be YYYY-MM-DD." } };

  let stored;
  try {
    stored = await readPlan(syncCode);
  } catch (error) {
    // A refused sync code is a 401 the reader can act on — it names the wrong
    // credential rather than looking like an outage.
    return { status: error.status || 500, payload: { error: error.message || "Could not read the plan." } };
  }
  if (!stored) return { status: 404, payload: { error: "No synced plan yet." } };

  // The whole plan stays on this side. What leaves is one day of it, already
  // written out as the lines the calendar shows — not the week, not the food
  // lists, and not the dinner list behind them.
  return {
    status: 200,
    payload: {
      date: dateKey || null,
      today: summarizeDay(stored.plan, dayId),
      updatedAt: stored.updatedAt,
      revision: stored.revision
    }
  };
}
