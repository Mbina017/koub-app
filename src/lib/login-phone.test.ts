import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bahrainLoginPhone, canRestoreKoubSession } from './login-phone.ts';

test('canonical Bahrain phone supports Arabic, Persian and ASCII input', () => {
  for (const phone of ['30000000', '+973 3000 0000', '00973-3000-0000', '٩٧٣ ٣٠٠٠٠٠٠٠', '۳۰۰۰۰۰۰۰']) {
    assert.equal(bahrainLoginPhone(phone), '97330000000');
  }
  for (const phone of ['', '+97430000000', '3a0000000', '3000000', '+30000000', '++97330000000']) {
    assert.equal(bahrainLoginPhone(phone), null);
  }
});
test('only explicit server roles unlock KOUB; unknown role never defaults to owner', () => {
  assert.equal(canRestoreKoubSession('owner'), true);
  assert.equal(canRestoreKoubSession('cashier'), true);
  for (const role of [undefined, null, 'admin', 'customer', true]) assert.equal(canRestoreKoubSession(role), false);
});
