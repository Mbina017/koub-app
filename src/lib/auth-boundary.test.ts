import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkedStoredSession, keyForBoundary, PRODUCTION_ORIGIN, readBoundary } from './auth-boundary.ts';
import { detachAccountQueryClient, newAccountQueryClient } from './scoped-queries.ts';

const fixture = 'https://koub-owner-qa-fixture.test';
const prod = readBoundary({ variant: 'production', origin: PRODUCTION_ORIGIN });
const stage = readBoundary({ variant: 'owner-qa', origin: fixture, offlineFixture: true });
const snapshot = (site: string) => JSON.stringify({ session: { site, user: 'fixture-user', password: 'synthetic-credential' }, me: { role: 'owner' } });

test('restoration never forwards an old host record and never trusts the saved role', () => {
  assert.deepEqual(checkedStoredSession(snapshot(PRODUCTION_ORIGIN), prod),
    { site: PRODUCTION_ORIGIN, user: 'fixture-user', password: 'synthetic-credential' });
  assert.equal(checkedStoredSession(snapshot(PRODUCTION_ORIGIN), stage), null);
  assert.equal(checkedStoredSession(snapshot(fixture), prod), null);
  for (const old of ['https://old-fixture.test', 'http://koubbh.com', 'https://koubbh.com:443', 'https://koubbh.com/wp', 'https://koubbh.com/']) {
    assert.equal(checkedStoredSession(snapshot(old), prod), null);
  }
  assert.equal(checkedStoredSession(JSON.stringify({ session: { demo: true } }), stage), null);
  assert.equal(keyForBoundary('koub.session.v1', prod), 'koub.session.v1');
  assert.notEqual(keyForBoundary('koub.session.v1', stage), keyForBoundary('koub.session.v1', prod));
});


test('a late owner query and callback cannot populate the cashier QueryClient', async () => {
  const a = newAccountQueryClient();
  let finish!: (value: string) => void;
  const ownerDeferred = new Promise<string>((resolve) => { finish = resolve; });
  const old = a.fetchQuery({ queryKey: ['shared'], queryFn: () => ownerDeferred }).catch(() => null);
  const b = newAccountQueryClient();
  detachAccountQueryClient(a);
  await b.fetchQuery({ queryKey: ['shared'], queryFn: async () => 'cashier-only' });
  finish('owner-only');
  await old;
  a.setQueryData(['shared'], 'old-owner callback');
  assert.equal(b.getQueryData(['shared']), 'cashier-only');
  detachAccountQueryClient(b);
});
