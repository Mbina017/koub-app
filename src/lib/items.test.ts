import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemsTotal } from './items.ts';

test('swap for a cheaper item: the customer is owed the difference, delivery kept', () => {
  assert.deepEqual(itemsTotal(10.5, [{ unit: 8.5, qty: 1 }], [{ unit: 7, qty: 1 }]), { total: 9, diff: -1.5 });
});
test('add an item: the customer pays more', () => {
  assert.deepEqual(itemsTotal(14.5, [{ unit: 14.5, qty: 1 }, { unit: 0, qty: 1 }], [{ unit: 14.5, qty: 1 }, { unit: 0, qty: 1 }, { unit: 7, qty: 1 }]), { total: 21.5, diff: 7 });
});
test('fils stay exact', () => {
  assert.deepEqual(itemsTotal(6.3, [{ unit: 2.1, qty: 3 }], [{ unit: 2.1, qty: 2 }]), { total: 4.2, diff: -2.1 });
});
