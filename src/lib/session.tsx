// Signed-in store, language and the optional Face ID lock.
// The application password lives only in the device keychain (expo-secure-store), never in plain storage.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api, setApiLang, type Credentials, type Session } from './api';
import { translator, type T } from './i18n';
import type { Lang, Me } from './types';

const KEY = 'koub.session.v1';
const LOCK = 'koub.lock.v1';
const LANG = 'koub.lang.v1';
export type LangPref = 'auto' | Lang;

// Web is only used for previews; it keeps nothing after the tab closes.
const store = {
  get: (k: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.sessionStorage?.getItem(k) ?? null) : SecureStore.getItemAsync(k)),
  set: (k: string, v: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.sessionStorage?.setItem(k, v)) : SecureStore.setItemAsync(k, v)),
  del: (k: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.sessionStorage?.removeItem(k)) : SecureStore.deleteItemAsync(k)),
};

type Ctx = {
  ready: boolean;
  session: Session | null;
  me: Me | null;
  lang: Lang;
  t: T;
  lock: boolean;
  langPref: LangPref;
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

  useEffect(() => {
    (async () => {
      try {
        const raw = await store.get(KEY);
        setLockState((await store.get(LOCK)) === '1');
        const pref = await store.get(LANG);
        if (pref === 'ar' || pref === 'en') { setPref(pref); setApiLang(pref); }
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
    return {
      ready, session, me, lang, t: translator(lang), lock, langPref,
      // The caller refetches its data so labels from the store switch too.
      setLangPref: async (p) => { await store.set(LANG, p); setApiLang(p === 'auto' ? undefined : p); setPref(p); },
      signIn: (c) => begin(c),
      signInDemo: () => begin({ demo: true }),
      signOut: async () => { await store.del(KEY); setSession(null); setMe(null); },
      setLock: async (on) => { await store.set(LOCK, on ? '1' : '0'); setLockState(on); },
    };
  }, [ready, session, me, lock, langPref, begin]);

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
