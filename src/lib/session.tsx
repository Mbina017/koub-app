// Signed-in store, language and the optional Face ID lock.
// The application password lives only in the device keychain (expo-secure-store), never in plain storage.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api, type Credentials, type Session } from './api';
import { translator, type T } from './i18n';
import type { Lang, Me } from './types';

const KEY = 'koub.session.v1';
const LOCK = 'koub.lock.v1';

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

  useEffect(() => {
    (async () => {
      try {
        const raw = await store.get(KEY);
        setLockState((await store.get(LOCK)) === '1');
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
    const lang: Lang = me?.lang ?? 'ar';
    return {
      ready, session, me, lang, t: translator(lang), lock,
      signIn: (c) => begin(c),
      signInDemo: () => begin({ demo: true }),
      signOut: async () => { await store.del(KEY); setSession(null); setMe(null); },
      setLock: async (on) => { await store.set(LOCK, on ? '1' : '0'); setLockState(on); },
    };
  }, [ready, session, me, lock, begin]);

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
