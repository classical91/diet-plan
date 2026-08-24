import { createHash } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const MAX_BODY = 256 * 1024;
const CODE_RE = /^[A-Za-z0-9_-]{20,128}$/;
const DAY_IDS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function normalizePlan(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const days = {};
  for (const id of DAY_IDS) {
    const day = input.days?.[id];
    if (day && typeof day === "object" && !Array.isArray(day)) days[id] = day;
  }
  const foodLists = {};
  for (const slot of ["morning", "afternoon", "night"]) {
    foodLists[slot] = Array.isArray(input.foodLists?.[slot])
      ? [...new Set(input.foodLists[slot].map(String).map((v) => v.trim()).filter(Boolean))].slice(0, 200)
      : [];
  }
  return { selectedDay: DAY_IDS.includes(input.selectedDay) ? input.selectedDay : "mon", days, foodLists };
}

export function hashSyncCode(code) {
  return createHash("sha256").update(code).digest("hex");
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error("Request body too large"), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("Invalid JSON"), { status: 400 }); }
}

export function createDinnerSync({ databaseUrl = process.env.DATABASE_URL, pool: suppliedPool } = {}) {
  if (!databaseUrl && !suppliedPool) return { configured: false };
  const pool = suppliedPool || new Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false } });
  let ready;
  const ensure = () => ready ||= pool.query(`CREATE TABLE IF NOT EXISTS dinner_plans (
    identity_hash TEXT PRIMARY KEY, plan JSONB NOT NULL, revision BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  return {
    configured: true,
    async close() { if (!suppliedPool) await pool.end(); },
    async handle(request, response, sendJson) {
      const code = request.headers["x-sync-code"];
      if (typeof code !== "string" || !CODE_RE.test(code)) return sendJson(response, 401, { error: "A valid sync code is required." });
      await ensure();
      const identity = hashSyncCode(code);
      if (request.method === "GET") {
        const result = await pool.query("SELECT plan, revision, updated_at FROM dinner_plans WHERE identity_hash = $1", [identity]);
        if (!result.rowCount) return sendJson(response, 404, { error: "No synced plan yet." });
        const row = result.rows[0];
        return sendJson(response, 200, { plan: row.plan, revision: Number(row.revision), updatedAt: row.updated_at });
      }
      if (request.method !== "PUT") return sendJson(response, 405, { error: "Use GET or PUT." });
      let body;
      try { body = await readJson(request); }
      catch (error) { return sendJson(response, error.status || 400, { error: error.message }); }
      const plan = normalizePlan(body.plan);
      const revision = Number(body.revision);
      if (!plan || !Number.isSafeInteger(revision) || revision < 0) return sendJson(response, 400, { error: "Invalid plan or revision." });
      const result = await pool.query(`INSERT INTO dinner_plans (identity_hash, plan, revision) VALUES ($1, $2::jsonb, 1)
        ON CONFLICT (identity_hash) DO UPDATE SET plan = EXCLUDED.plan, revision = dinner_plans.revision + 1, updated_at = NOW()
        WHERE dinner_plans.revision = $3 RETURNING revision, updated_at`, [identity, JSON.stringify(plan), revision]);
      if (!result.rowCount) return sendJson(response, 409, { error: "The plan changed on another device. Refresh before saving." });
      return sendJson(response, 200, { revision: Number(result.rows[0].revision), updatedAt: result.rows[0].updated_at });
    }
  };
}
