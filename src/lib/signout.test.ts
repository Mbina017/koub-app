import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Exercise the actual native session and push modules with only device/network boundaries mocked.
function evaluate(path: string, modules: Record<string, unknown>) {
  const output = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: Record<string, any> = {};
  runInNewContext(output, { exports, require: (id: string) => {
    assert.ok(id in modules, 'Unexpected dependency: ' + id);
    return modules[id];
  } });
  return exports;
}

test('offline logout retains credentials and push preferences until deregistration succeeds', async () => {
  const removed: string[] = [];
  let result = 'error';
  let stateIndex = 0;
  const credentials = { site: 'https://example.test', user: 'synthetic', password: 'synthetic' };
  const values = [true, credentials, null, false, 'auto', { on: true, quiet: true }];
  const session = evaluate('./session.tsx', {
    react: { createContext: () => ({ Provider: 'Provider' }), useCallback: (f: unknown) => f,
      useContext: () => null, useEffect: () => {}, useMemo: (f: () => unknown) => f(),
      useState: () => [values[stateIndex++], () => {}] },
    'react/jsx-runtime': { jsx: (_: unknown, props: unknown) => ({ props }) },
    'react-native': { Platform: { OS: 'ios' } },
    'expo-secure-store': { deleteItemAsync: async (key: string) => { removed.push(key); } },
    './api': {}, './push': { setPush: async () => result },
    './i18n': { translator: () => (key: string) => key },
  });
  const ctx = session.SessionProvider({ children: null }).props.value;
  await assert.rejects(ctx.signOut(), /signOutPushFailed/);
  assert.deepEqual(removed, []);
  result = 'off';
  await ctx.signOut();
  assert.deepEqual(removed, ['koub.session.v1', 'koub.push.v1']);
});

test('disable uses the saved token after OS notification permission is revoked; failures remain retryable', async () => {
  const saved = new Map([['koub.push-token.v1', 'ExponentPushToken[synthetic]']]);
  let fail = true;
  let calls = 0;
  const push = evaluate('./push.ts', {
    'react-native': { Platform: { OS: 'ios' } },
    'expo-constants': { default: {} }, 'expo-device': { isDevice: true },
    'expo-notifications': { setNotificationHandler: () => {}, getPermissionsAsync: () => { throw new Error('Must not request permission to disable'); } },
    'expo-secure-store': { getItemAsync: async (key: string) => saved.get(key) ?? null,
      setItemAsync: async (key: string, value: string) => { saved.set(key, value); },
      deleteItemAsync: async (key: string) => { saved.delete(key); } },
    './api': { api: { push: async (_: unknown, body: { token: string; enabled: boolean }) => {
      calls++; assert.equal(body.token, 'ExponentPushToken[synthetic]'); assert.equal(body.enabled, false);
      if (fail) throw new Error('offline');
      return { enabled: false };
    } } },
  });
  const credentials = { site: 'https://example.test', user: 'synthetic', password: 'synthetic' };
  assert.equal(await push.setPush(credentials, false, true, 'ar'), 'error');
  assert.equal(saved.size, 1);
  fail = false;
  assert.equal(await push.setPush(credentials, false, true, 'ar'), 'off');
  assert.equal(saved.size, 0);
  assert.equal(calls, 2);
});
