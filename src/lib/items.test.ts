import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemsMoney, lineValue } from './items.ts';

const o = (total: number, owed = 0, free = 0, cod = false) => ({ total, owed, free, cod });
test('swap for a cheaper item: owed back, delivery kept', () => {
  const r = itemsMoney(o(10.5), [{ total: 8.5 }], [{ qty: 1, unit: 7 }], false);
  assert.equal(r.total, 9); assert.equal(r.owedAdd, 1.5); assert.equal(r.needsMethod, false);
});
test('swapping back uses what is owed first: nothing to pay', () => {
  const r = itemsMoney(o(9, 1.5), [{ total: 7 }], [{ qty: 1, unit: 8.5 }], false);
  assert.equal(r.total, 10.5); assert.equal(r.owedUsed, 1.5); assert.equal(r.needsMethod, false);
});
test('add an item: pays more, or free keeps the total', () => {
  assert.equal(itemsMoney(o(10.5), [{ total: 8.5 }], [{ qty: 1, total: 8.5, was: 1, unit: 8.5 }, { qty: 1, unit: 7 }], false).pay, 7);
  assert.equal(itemsMoney(o(10.5), [{ total: 8.5 }], [{ qty: 1, total: 8.5, was: 1, unit: 8.5 }, { qty: 1, unit: 7 }], true).total, 10.5);
});
test('dropping a free item takes the discount back, owes nothing', () => {
  const r = itemsMoney(o(10.5, 0, 7), [{ total: 8.5 }, { total: 7 }], [{ qty: 1, total: 8.5, was: 1, unit: 8.5 }], false);
  assert.equal(r.total, 10.5); assert.equal(r.freeBack, 7); assert.equal(r.owedAdd, 0);
});
test('odd line totals stay exact, scaled to the fil like the store', () => {
  assert.equal(lineValue({ qty: 3, total: 10, was: 3, unit: 3.333 }), 10);
  const r = itemsMoney(o(12), [{ total: 10 }], [{ qty: 2, total: 10, was: 3, unit: 3.333 }], false);
  assert.equal(r.total, 8.667); assert.equal(r.owedAdd, 3.333);
});
test('cash on delivery: the courier collects the new total', () => {
  const r = itemsMoney(o(10.5, 0, 0, true), [{ total: 8.5 }], [{ qty: 1, total: 8.5, was: 1, unit: 8.5 }, { qty: 1, unit: 7 }], false);
  assert.equal(r.total, 17.5); assert.equal(r.needsMethod, false);
});
