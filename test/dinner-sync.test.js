import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createDinnerSync, hashSyncCode, normalizePlan } from "../dinner-sync.js";

const code = "desktop-mobile-private-code-123";
const plan = { selectedDay: "tue", days: { tue: { dinner: { name: "Salmon rice" } } }, foodLists: { night: ["Salmon rice", "Salmon rice", "  "] } };

function request(method, body, syncCode = code) {
  const stream = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  stream.method = method;
  stream.headers = { "x-sync-code": syncCode };
  return stream;
}

function capture() {
  const output = {};
  return { output, sendJson(_response, status, payload) { output.status = status; output.payload = payload; } };
}

test("normalizes planner data without duplicating food-list entries", () => {
  const value = normalizePlan(plan);
  assert.equal(value.selectedDay, "tue");
  assert.equal(value.days.tue.dinner.name, "Salmon rice");
  assert.deepEqual(value.foodLists.night, ["Salmon rice"]);
  assert.deepEqual(value.foodLists.morning, []);
});

test("carries the week-fill settings across devices", () => {
  const gen = { batch: "2", lunch: true };
  assert.deepEqual(normalizePlan({ ...plan, gen }).gen, gen);
  assert.equal(normalizePlan({ ...plan, gen: "simple" }).gen, undefined);
});

test("hashes private sync codes before database lookup", () => {
  assert.equal(hashSyncCode(code).length, 64);
  assert.equal(hashSyncCode(code), hashSyncCode(code));
  assert.notEqual(hashSyncCode(code), code);
});

test("reports sync as unconfigured without DATABASE_URL", () => {
  assert.equal(createDinnerSync({ databaseUrl: "" }).configured, false);
});

test("first-device import inserts revision one", async () => {
  const calls = [];
  const pool = { async query(sql, values) { calls.push({ sql, values }); return calls.length === 1 ? { rowCount: 0 } : { rowCount: 1, rows: [{ revision: "1", updated_at: new Date() }] }; } };
  const sync = createDinnerSync({ pool });
  const result = capture();
  await sync.handle(request("PUT", { plan, revision: 0 }), {}, result.sendJson);
  assert.equal(result.output.status, 200);
  assert.equal(result.output.payload.revision, 1);
  assert.equal(calls[1].values[0], hashSyncCode(code));
  assert.equal(calls[1].values[2], 0);
});

test("second device receives the existing remote plan", async () => {
  const pool = { async query(sql) { return sql.startsWith("CREATE") ? {} : { rowCount: 1, rows: [{ plan, revision: "4", updated_at: new Date() }] }; } };
  const sync = createDinnerSync({ pool });
  const result = capture();
  await sync.handle(request("GET"), {}, result.sendJson);
  assert.equal(result.output.status, 200);
  assert.equal(result.output.payload.revision, 4);
  assert.equal(result.output.payload.plan.days.tue.dinner.name, "Salmon rice");
});

test("stale optimistic revision returns conflict instead of overwriting", async () => {
  let calls = 0;
  const pool = { async query() { calls += 1; return calls === 1 ? {} : { rowCount: 0, rows: [] }; } };
  const sync = createDinnerSync({ pool });
  const result = capture();
  await sync.handle(request("PUT", { plan, revision: 2 }), {}, result.sendJson);
  assert.equal(result.output.status, 409);
});

test("rejects missing identity and malformed JSON", async () => {
  const pool = { async query() { return {}; } };
  const sync = createDinnerSync({ pool });
  let result = capture();
  await sync.handle(request("GET", undefined, "short"), {}, result.sendJson);
  assert.equal(result.output.status, 401);

  const bad = Readable.from([Buffer.from("{")]);
  bad.method = "PUT";
  bad.headers = { "x-sync-code": code };
  result = capture();
  await sync.handle(bad, {}, result.sendJson);
  assert.equal(result.output.status, 400);
});
