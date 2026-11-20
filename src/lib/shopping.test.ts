import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shoppingList } from './shopping.ts';

const ing = (o: Partial<Parameters<typeof shoppingList>[0][number]>) => ({ id: 'x', name: 'X', unit: 'g' as const, stock: 0, low: 0, cost: 0, per_day: 0, days_left: null, is_low: false, ...o });

test('shopping list', () => {
  const list = shoppingList([
    ing({ id: 'beans', name: 'Beans', stock: 500, low: 300, cost: 0.012, per_day: 200 }), // 200*7 + 300 - 500 = 1200 g
    ing({ id: 'cups', name: 'Cups', unit: 'pc', stock: 40, low: 50, per_day: 30.4 }), // 212.8 + 50 - 40 = 222.8 -> 223
    ing({ id: 'milk', name: 'Milk', unit: 'ml', stock: 20000, low: 2000, per_day: 1000 }), // enough for a week
    ing({ id: 'syrup', name: 'Syrup', unit: 'ml', stock: 50, low: 100, is_low: true }), // not used, but low: 100 - 50 = 50
    ing({ id: 'lids', name: 'Lids', unit: 'pc', stock: 0 }), // never used, not low: left out
  ], 7);
  assert.deepEqual(list, [
    { id: 'beans', name: 'Beans', unit: 'g', buy: 1200, cost: 14.4 },
    { id: 'cups', name: 'Cups', unit: 'pc', buy: 223, cost: null },
    { id: 'syrup', name: 'Syrup', unit: 'ml', buy: 50, cost: null },
  ]);
  // Fewer days, less to buy; grams rounded up to the next 10.
  assert.deepEqual(shoppingList([ing({ stock: 0, per_day: 33 })], 3), [{ id: 'x', name: 'X', unit: 'g', buy: 100, cost: null }]);
  // Negative stock (sold before a delivery was entered) counts as none.
  assert.equal(shoppingList([ing({ unit: 'pc', stock: -5, per_day: 1 })], 7)[0].buy, 7);
});
