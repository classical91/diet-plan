import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { summarizeDay } from '../meal-day.js';

const source = readFileSync(new URL('../work-meals-app.js', import.meta.url), 'utf8');
const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const afternoons = ['Chicken sandwich', 'Quesadillas', 'Eggs', 'Pasta', 'Veggie stir fry', 'Veggie shake'];
const legacyAfternoons = ['Greek yogurt + nuts + fruit', 'Cottage cheese + fruit', 'Chicken or tofu grain bowl', 'Tuna or salmon wrap', 'Chickpea or lentil salad', 'Hummus + veg sticks + crackers', 'Mixed nuts + a piece of fruit', 'Leftover stir-fry + brown rice'];
const key = 'work-meals:v3';

// Exercise the actual button handlers and persisted plan without a network or AI call.
function planner(saved, answer = true) {
  const storage = new Map(saved ? [[key, JSON.stringify(saved)]] : []);
  const nodes = new Map();
  const document = { querySelector(selector) {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', textContent: '', innerHTML: '', hidden: false });
    return nodes.get(selector);
  } };
  const context = vm.createContext({
    document, location: { search: '' }, URLSearchParams, confirm: () => answer,
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    fetch: async () => ({ json: async () => ({ configured: false }) })
  });
  vm.runInContext(source, context);
  return {
    plan: () => JSON.parse(storage.get(key)),
    click: selector => document.querySelector(selector).onclick(),
    message: () => document.querySelector('#planWeekMsg').textContent
  };
}

function savedPlan() {
  const plan = planner().plan();
  plan.foodLists = { morning: ['My breakfast', 'Other breakfast'], afternoon: ['My sandwich', 'My stir fry'], night: [] };
  plan.dinners = [{ id: 'my-curry', name: 'My curry', sides: ['rice', 'veggies'], on: ['rice'] }, { id: 'my-pasta', name: 'My pasta' }];
  return plan;
}

function texts(plan, slot) {
  return days.map(id => summarizeDay(plan, id).slots.find(s => s.id === slot)?.text);
}

test('Plan my week fills all three slots using only saved lists, and persists them for the calendar', () => {
  const app = planner(savedPlan());
  app.click('#planWeek');
  const plan = app.plan();
  for (const id of days) {
    const meals = summarizeDay(plan, id).slots;
    assert.equal(meals.length, 3);
    for (const slot of ['morning', 'afternoon']) {
      assert.ok(plan.foodLists[slot].includes(meals.find(s => s.id === slot).text));
    }
    assert.ok(plan.dinners.some(d => d.id === plan.days[id].dinner.pick));
  }
  for (const slot of ['morning', 'afternoon', 'night']) {
    const meals = texts(plan, slot);
    assert.ok(meals.every((name, i) => !i || name !== meals[i - 1]));
  }
  assert.match(app.message(), /Filled 21 meals/);
  app.click('#planWeek');
  assert.deepEqual(app.plan(), plan, 'another click must not replace anything already planned');
  assert.equal(app.message(), 'No empty meals to fill.');
  assert.deepEqual(planner(plan).plan(), plan);
});

test('manual picks, AI picks, leftover lunches and hidden slots survive planning', () => {
  const saved = savedPlan();
  saved.days.mon.checked = { 'morning|my-breakfast': true, 'morning|other-breakfast': true };
  saved.days.mon.ai = { afternoon: ['My AI lunch'] };
  saved.days.mon.checked['afternoon|my-ai-lunch'] = true;
  saved.days.mon.dinner.type = 'out';
  saved.days.tue.leftovers.afternoon = 'Saved leftovers';
  saved.days.wed.states = { morning: 'skip', afternoon: 'skip', night: 'skip' };
  const app = planner(saved);
  app.click('#planWeek');
  const plan = app.plan();
  for (const id of ['mon', 'wed']) assert.deepEqual(plan.days[id], saved.days[id]);
  assert.equal(plan.days.tue.leftovers.afternoon, 'Saved leftovers');
  assert.equal(Object.keys(plan.days.tue.checked).length, 1);
  assert.ok(Object.keys(plan.days.tue.checked)[0].startsWith('morning|'));
});

test('bulk cooking fills dinners first and uses leftovers only for blank visible lunches', () => {
  const saved = savedPlan();
  saved.gen = { batch: '2', lunch: true };
  saved.days.wed.checked['afternoon|my-sandwich'] = true;
  saved.days.thu.leftovers.afternoon = 'Already packed';
  saved.days.fri.states.afternoon = 'skip';
  const app = planner(saved);
  app.click('#planWeek');
  const plan = app.plan();
  assert.equal(plan.days.tue.dinner.from, 'mon');
  assert.equal(plan.days.tue.dinner.pick, plan.days.mon.dinner.pick);
  assert.deepEqual(plan.days.tue.dinner.sides, plan.days.mon.dinner.sides);
  assert.equal(plan.days.tue.leftovers.afternoon, plan.days.mon.dinner.name);
  assert.equal(plan.days.wed.leftovers.afternoon, '');
  assert.equal(plan.days.thu.leftovers.afternoon, 'Already packed');
  assert.equal(plan.days.fri.leftovers.afternoon, '');
  assert.match(app.message(), /Filled 18 meals/);
});

test('empty saved lists remain empty across reload and explain why meals were left blank', () => {
  const saved = savedPlan();
  saved.foodLists.morning = [];
  saved.foodLists.afternoon = [];
  saved.dinners = [];
  const app = planner(saved);
  app.click('#planWeek');
  assert.match(app.message(), /Edit list in Morning and Afternoon and Night/);
  assert.deepEqual(app.plan().dinners, []);
  assert.deepEqual(app.plan().days, saved.days);
  assert.deepEqual(planner(app.plan()).plan().dinners, []);
  app.click('#fill'); // Dinner-only actions must also tolerate an empty list.
  app.click('#replace');
  assert.deepEqual(app.plan().days, saved.days);
});

test('dinner-only fill does not add breakfasts or random afternoon foods', () => {
  const app = planner(savedPlan());
  app.click('#fill');
  const plan = app.plan();
  for (const id of days) {
    assert.deepEqual(plan.days[id].checked, {});
    assert.ok(plan.days[id].dinner.pick);
  }
});

test('one-item lists repeat safely without invented meals', () => {
  const saved = savedPlan();
  saved.foodLists.morning = ['Eggs'];
  saved.foodLists.afternoon = ['Veggie shake'];
  saved.dinners = [saved.dinners[0]];
  const app = planner(saved);
  app.click('#planWeek');
  assert.ok(texts(app.plan(), 'morning').every(text => text === 'Eggs'));
  assert.ok(texts(app.plan(), 'afternoon').every(text => text === 'Veggie shake'));
});

test('hidden nights break a cooking batch and do not produce a lunch', () => {
  const saved = savedPlan();
  saved.gen = { batch: '3', lunch: true };
  saved.days.tue.states.night = 'skip';
  const app = planner(saved);
  app.click('#planWeek');
  const plan = app.plan();
  assert.equal(plan.days.tue.dinner.pick, null);
  assert.equal(plan.days.wed.dinner.from, null);
  assert.equal(plan.days.wed.leftovers.afternoon, '');
  assert.equal(plan.days.thu.dinner.from, 'wed');
});

test('new afternoon defaults match the supplied meals and upgrade only unused starter lists', () => {
  assert.deepEqual(planner().plan().foodLists.afternoon, afternoons);
  const saved = savedPlan();
  saved.v = 5;
  saved.foodLists.afternoon = legacyAfternoons;
  assert.deepEqual(planner(saved).plan().foodLists.afternoon, afternoons);
  saved.days.mon.checked['afternoon|greek-yogurt-nuts-fruit'] = true;
  assert.deepEqual(planner(saved).plan().foodLists.afternoon, legacyAfternoons, 'picked starter foods must remain readable');
  saved.foodLists.afternoon = ['My custom sandwich'];
  assert.deepEqual(planner(saved).plan().foodLists.afternoon, ['My custom sandwich']);
});

test('upgrading a v5 plan never restores removed dinners', () => {
  const saved = savedPlan();
  saved.v = 5;
  assert.deepEqual(planner(saved).plan().dinners.map(d => d.id), ['my-curry', 'my-pasta']);
});

test('a saved dinner title without a list id is already a planned dinner', () => {
  const saved = savedPlan();
  saved.days.mon.dinner.name = 'My handwritten dinner';
  const app = planner(saved);
  app.click('#planWeek');
  assert.deepEqual(app.plan().days.mon.dinner, saved.days.mon.dinner);
});

test('Reset week clears every day but keeps saved lists, and does nothing if cancelled', () => {
  const kept = planner(savedPlan(), false);
  kept.click('#planWeek');
  const before = kept.plan();
  kept.click('#resetWeek');
  assert.deepEqual(kept.plan().days, before.days);

  const app = planner(savedPlan());
  app.click('#planWeek');
  app.click('#resetWeek');
  const plan = app.plan();
  for (const id of days) assert.ok(summarizeDay(plan, id).slots.every(s => !s.planned));
  assert.deepEqual(plan.foodLists, savedPlan().foodLists);
  assert.equal(app.message(), 'Week reset.');
});
