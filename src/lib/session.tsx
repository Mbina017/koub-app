// Signed-in store, language and the optional Face ID lock.
// The application password lives only in the device keychain (expo-secure-store), never in plain storage.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api, setApiLang, type Credentials, type Session } from './api';
import { setPush, type PushResult } from './push';
import { translator, type T } from './i18n';
import type { Lang, Me } from './types';

const KEY = 'koub.session.v1';
const LOCK = 'koub.lock.v1';
const LANG = 'koub.lang.v1';
const PUSH = 'koub.push.v1';
export type PushPrefs = { on: boolean; quiet: boolean };
export type LangPref = 'auto' | Lang;

// Web is only used for previews and has no secure storage, so a real sign-in there lives in memory
// and is gone on reload. Only non-secret values (language, lock switch, the demo session) use sessionStorage.
const memory = new Map<string, string>();
const webSecret = (k: string, v: string) => k === KEY && !('demo' in (JSON.parse(v) as { session: Session }).session);
const store = {
  get: async (k: string) => (Platform.OS !== 'web' ? SecureStore.getItemAsync(k) : memory.get(k) ?? globalThis.sessionStorage?.getItem(k) ?? null),
  set: async (k: string, v: string) => {
    if (Platform.OS !== 'web') return SecureStore.setItemAsync(k, v);
    if (webSecret(k, v)) { memory.set(k, v); globalThis.sessionStorage?.removeItem(k); } else globalThis.sessionStorage?.setItem(k, v);
  },
  del: async (k: string) => { if (Platform.OS !== 'web') return SecureStore.deleteItemAsync(k); memory.delete(k); globalThis.sessionStorage?.removeItem(k); },
};

type Ctx = {
  ready: boolean;
  session: Session | null;
  me: Me | null;
  lang: Lang;
  t: T;
  lock: boolean;
  langPref: LangPref;
  push: PushPrefs;
  savePush: (p: PushPrefs) => Promise<PushResult>;
  setLangPref: (p: LangPref) => Promise<void>;
  signIn: (c: Credentials) => Promise<void>;
  signInDemo: () => Promise<void>;
  signOut: () => Promise<void>;
  setLock: (on: boolean) => Promise<void>;
};
const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [lock, setLockState] = useState(false);
  const [langPref, setPref] = useState<LangPref>('auto');
  const [push, setPushState] = useState<PushPrefs>({ on: false, quiet: true });

  useEffect(() => {
    (async () => {
      try {
        const raw = await store.get(KEY);
        setLockState((await store.get(LOCK)) === '1');
        const pref = await store.get(LANG);
        if (pref === 'ar' || pref === 'en') { setPref(pref); setApiLang(pref); }
        const savedPush = await store.get(PUSH);
        if (savedPush) setPushState(JSON.parse(savedPush) as PushPrefs);
        if (raw) {
          const saved = JSON.parse(raw) as { session: Session; me: Me };
          setSession(saved.session);
          setMe(saved.me);
          // Refresh name and language in the background; a failure keeps the saved copy.
          api.me(saved.session).then(setMe).catch(() => {});
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const begin = useCallback(async (s: Session) => {
    const who = await api.me(s); // throws ApiError on a wrong password, missing API or no access
    await store.set(KEY, JSON.stringify({ session: s, me: who }));
    setSession(s);
    setMe(who);
  }, []);

  const value = useMemo<Ctx>(() => {
    const lang: Lang = langPref === 'auto' ? me?.lang ?? 'ar' : langPref;
    // Alerts on this phone; the store is told so it sends (or stops sending) new-order alerts here.
    const savePush = async (p: PushPrefs): Promise<PushResult> => {
      if (!session) return 'error';
      const r = await setPush(session, p.on, p.quiet, lang);
      const next = { on: r === 'on', quiet: p.quiet };
      if (r === 'on' || r === 'off') { await store.set(PUSH, JSON.stringify(next)); setPushState(next); }
      return r;
    };
    return {
      push, savePush,
      ready, session, me, lang, t: translator(lang), lock, langPref,
      // The caller refetches its data so labels from the store switch too.
      setLangPref: async (p) => {
        await store.set(LANG, p); setApiLang(p === 'auto' ? undefined : p); setPref(p);
        // Alerts follow the app language too.
        if (session && push.on) setPush(session, true, push.quiet, p === 'auto' ? me?.lang ?? 'ar' : p).catch(() => {});
      },
      signIn: (c) => begin(c),
      signInDemo: () => begin({ demo: true }),
      signOut: async () => {
        // Stop alerts to this phone before forgetting the store.
        if (session && push.on) {
          const result = await setPush(session, false, push.quiet, lang);
          if (result !== 'off') throw new Error(translator(lang)('signOutPushFailed'));
        }
        await store.del(KEY); await store.del(PUSH); setPushState({ on: false, quiet: true }); setSession(null); setMe(null);
      },
      setLock: async (on) => { await store.set(LOCK, on ? '1' : '0'); setLockState(on); },
    };
  }, [ready, session, me, lock, langPref, push, begin]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Ctx {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}

// For screens behind sign-in: the session is guaranteed there.
export function useApiSession(): Session {
  const { session } = useSession();
  if (!session) throw new Error('Signed-out screen asked for the API');
  return session;
}

