import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderProgress } from './progress.ts';

test('order progress', () => {
  assert.deepEqual(orderProgress({ status: 'pending', fulfilment: null }), { done: 0, current: 1 });
  assert.deepEqual(orderProgress({ status: 'processing', fulfilment: null }), { done: 1, current: 2 });
  assert.deepEqual(orderProgress({ status: 'on-hold', fulfilment: null }), { done: 1, current: 2 });
  assert.deepEqual(orderProgress({ status: 'completed', fulfilment: 'out_delivery' }), { done: 3, current: 0 });
  assert.deepEqual(orderProgress({ status: 'completed', fulfilment: 'ready_pickup' }), { done: 3, current: 0 });
  // Completed without a KOUB fulfilment record must not look like it is still being prepared.
  assert.deepEqual(orderProgress({ status: 'completed', fulfilment: null }), { done: 3, current: 0 });
  assert.deepEqual(orderProgress({ status: 'processing', fulfilment: 'delivered' }), { done: 3, current: 0 });
});
