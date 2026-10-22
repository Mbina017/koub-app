// Same cases as koub-site scripts/dashboard-phase1.test.php, so the app formats like the dashboard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { num, money, pct, dayMonth, shortDay, hourLabel } from './format.ts';

test('numbers match koub_ui_num', () => {
  assert.equal(num(15), '15.0');
  assert.equal(num(8.5), '8.5');
  assert.equal(num(9.275), '9.275');
  assert.equal(num(1240, 0), '1,240');
  assert.equal(num(-0.323), '⁦−0.323⁩');
  assert.equal(num(-0.0001), '0.0');
  assert.equal(num(-0.4, 0), '0');
  assert.equal(num(-0.04, 1), '0.0');
  assert.equal(num(-1.6, 0), '⁦−2⁩');
  assert.equal(num(12345.5), '12,345.5');
});

test('money and change', () => {
  assert.equal(money(15, 'ar'), '15.0 د.ب');
  assert.equal(money(15, 'en'), 'BHD 15.0');
  assert.deepEqual(pct(12), { text: '↑ 12%', up: true });
  assert.deepEqual(pct(-5), { text: '↓ 5%', up: false });
  assert.equal(pct(null), null);
});

test('dates', () => {
  assert.equal(dayMonth('2026-10-04', 'ar'), '4 أكتوبر');
  assert.equal(dayMonth('2026-10-04', 'en'), '4 Oct');
  assert.equal(shortDay('2026-10-04', 'ar'), 'الأحد');
  assert.equal(hourLabel('13:00', 'ar'), '1م');
  assert.equal(hourLabel('00:00', 'en'), '12a');
});
