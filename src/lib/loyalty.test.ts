import { test } from 'node:test';
import assert from 'node:assert/strict';
import { after, awayMessage, cleanCode, freeDrink, stampsFor } from './loyalty.ts';

const latte = { price: 2.2, qty: 1, group: 'drinks' as const };
const karak = { price: 0.8, qty: 2, group: 'drinks' as const };
const mug = { price: 8.5, qty: 1, group: 'products' as const };

test('codes: scanned QR, typed with a dash, look-alikes refused', () => {
  assert.equal(cleanCode('KOUBK7Q49XM2'), 'K7Q49XM2');
  assert.equal(cleanCode(' k7q4-9xm2 '), 'K7Q49XM2');
  assert.equal(cleanCode('K7Q49XM0'), '');
  assert.equal(cleanCode('https://example.com'), '');
});
test('free drink: the dearest drink, never a mug, nothing without a drink', () => {
  assert.equal(freeDrink([karak, latte, mug], true), 2.2);
  assert.equal(freeDrink([mug], true), 0);
  assert.equal(freeDrink([latte], false), 0);
});
test('stamps: paid drinks only, the free one excluded, capped per sale', () => {
  assert.equal(stampsFor([latte, karak, mug], 0, 4), 3);
  assert.equal(stampsFor([latte, karak], 2.2, 4), 2);
  assert.equal(stampsFor([{ ...karak, qty: 9 }], 0, 4), 4);
});
test('after the sale: 4 stamps roll into a free drink', () => {
  assert.deepEqual(after({ stamps: 3, rewards: 0, of: 4 }, 2, false), { stamps: 1, rewards: 1, earned: 1 });
  assert.deepEqual(after({ stamps: 1, rewards: 1, of: 4 }, 1, true), { stamps: 2, rewards: 0, earned: 0 });
});
test('away message in the card language', () => {
  assert.match(awayMessage({ name: 'Reem', need: 1, rewards: 0, lang: 'en' }), /1 more drink and/);
  assert.match(awayMessage({ name: 'ريم', need: 2, rewards: 1, lang: 'ar' }), /مشروبك المجاني/);
});
