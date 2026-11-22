// Signed-in store, language and the optional Face ID lock.
// The application password lives only in the device keychain (expo-secure-store), never in plain storage.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { QueryClientProvider } from '@tanstack/react-query';
import { detachAccountQueryClient, newAccountQueryClient } from './scoped-queries';
import { canRestoreKoubSession } from './login-phone';
import { APP_BOUNDARY } from './app-environment';
import { checkedStoredSession, keyForBoundary } from './auth-boundary';
import { api, ApiError, setApiLang, staffSignIn, type Credentials, type Session } from './api';
import { PUSH_DEFAULT, setPush, type PushPrefs, type PushResult } from './push';
import { translator, type T } from './i18n';
import type { Lang, Me } from './types';

const KEY = keyForBoundary('koub.session.v1', APP_BOUNDARY);
const LOCK = keyForBoundary('koub.lock.v1', APP_BOUNDARY);
const LANG = keyForBoundary('koub.lang.v1', APP_BOUNDARY);
const PUSH = keyForBoundary('koub.push.v1', APP_BOUNDARY);
// API 1.40: on this device, is the staff member in the kiosk (making orders) or outside (taking them)?
const ROLE = keyForBoundary('koub.staffrole.v1', APP_BOUNDARY);
export type StaffRole = 'inside' | 'outside';
export type { PushPrefs };
export type LangPref = 'auto' | Lang;

// Native device credentials live in the Keychain/Keystore. Web credentials are memory-only;
// the browser may still keep noncredential display preferences for this tab.
const store = {
  get: async (k: string) => (Platform.OS !== 'web' ? SecureStore.getItemAsync(k) : k === KEY ? null : globalThis.sessionStorage?.getItem(k) ?? null),
  set: async (k: string, v: string) => {
    if (Platform.OS !== 'web') return SecureStore.setItemAsync(k, v, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    if (k !== KEY) globalThis.sessionStorage?.setItem(k, v);
  },
  del: async (k: string) => { if (Platform.OS !== 'web') return SecureStore.deleteItemAsync(k); globalThis.sessionStorage?.removeItem(k); },
};

// Serialize writes to the same secure slot. A logout ordered after an in-flight save wins.
let credentialWrites: Promise<void> = Promise.resolve();
function orderedCredentialWrite(write: () => Promise<void>) {
  const pending = credentialWrites.then(write);
  credentialWrites = pending.catch(() => {});
  return pending;
}

function ScopedQueries({ children }: { children: ReactNode }) {
  const [client] = useState(newAccountQueryClient);
  useEffect(() => () => detachAccountQueryClient(client), [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function verifiedMe(s: Session) {
  const who = await api.me(s);
  if (!canRestoreKoubSession(who?.role)) throw new ApiError('forbidden', 'role_not_verified', 403);
  return who;
}

type Ctx = {
  ready: boolean;
  session: Session | null;
  me: Me | null;
  // A cashier account (API 1.15): the till only.
  cashier: boolean;
  // Staff only: chosen on first sign-in, changeable from the staff menu. null until chosen.
  staffRole: StaffRole | null;
  setStaffRole: (r: StaffRole | null) => Promise<void>;
  lang: Lang;
  t: T;
  lock: boolean;
  langPref: LangPref;
  push: PushPrefs;
  savePush: (p: PushPrefs) => Promise<PushResult>;
  setLangPref: (p: LangPref) => Promise<void>;
  signIn: (c: Credentials) => Promise<void>;
  restoreFailed: boolean;
  retryRestore: () => void;
  signInDemo: () => Promise<void>;
  signOut: () => Promise<void>;
  setLock: (on: boolean) => Promise<void>;
};
const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const generation = useRef(0);
  const [scope, setScope] = useState(0);
  const invalidate = useCallback(() => {
    ++generation.current;
    setSession(null); setMe(null); setRole(null); setPushState(PUSH_DEFAULT);
    setScope((x) => x + 1);
  }, []);
  const [ready, setReady] = useState(false);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [lock, setLockState] = useState(false);
  const [langPref, setPref] = useState<LangPref>('auto');
  const [push, setPushState] = useState<PushPrefs>(PUSH_DEFAULT);
  const [staffRole, setRole] = useState<StaffRole | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ticket = generation.current;
    const current = () => !cancelled && generation.current === ticket;
    (async () => {
      try {
        setRestoreFailed(false);
        if (Platform.OS === 'web') await store.del(KEY); // remove legacy browser-stored credentials
        const raw = await store.get(KEY);
        if (!current()) return;
        setLockState((await store.get(LOCK)) === '1');
        const role = await store.get(ROLE);
        if (role === 'inside' || role === 'outside') setRole(role);
        const pref = await store.get(LANG);
        if (pref === 'ar' || pref === 'en') { setPref(pref); setApiLang(pref); }
        const savedPush = await store.get(PUSH);
        if (savedPush) setPushState({ ...PUSH_DEFAULT, ...(JSON.parse(savedPush) as Partial<PushPrefs>) });
        if (!raw) return;
        // Older versions stored a display-role snapshot. Do not render it until the server confirms the session.
        const saved = checkedStoredSession(raw, APP_BOUNDARY);
        if (!current()) return;
        if (!saved) { await orderedCredentialWrite(() => current() ? store.del(KEY) : Promise.resolve()); return; }
        const who = await verifiedMe(saved);
        if (current()) { setMe(who); setSession(saved); setScope((x) => x + 1); }
      } catch (e) {
        if (!current()) return;
        if ((e instanceof ApiError && (e.kind === 'auth' || e.kind === 'forbidden')) || e instanceof SyntaxError) {
          await orderedCredentialWrite(() => current() ? store.del(KEY) : Promise.resolve()).catch(() => {});
          if (current()) { setMe(null); setSession(null); setScope((x) => x + 1); }
        } else {
          setRestoreFailed(true); // keep the native key to retry after a temporary connection failure
        }
      } finally {
        if (current()) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [restoreAttempt]);

  // Never let late verification of the previous session restore its privileges.
  useEffect(() => {
    if (!session || 'demo' in session || Platform.OS === 'web') return;
    let cancelled = false;
    let foreground = 0;
    const ticket = generation.current;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const check = ++foreground;
      const current = () => !cancelled && ticket === generation.current && check === foreground;
      verifiedMe(session).then((who) => {
        if (!current()) return;
        if (who.role !== me?.role) { ++generation.current; setScope((x) => x + 1); }
        setMe(who);
      }).catch((e) => {
        if (!current() || !(e instanceof ApiError) || (e.kind !== 'auth' && e.kind !== 'forbidden')) return;
        invalidate();
        void orderedCredentialWrite(() => store.del(KEY)).catch(() => {});
      });
    });
    return () => { cancelled = true; sub.remove(); };
  }, [session, me?.role, invalidate]);

  const begin = useCallback(async (s: Session, ticket: number) => {
    if (ticket !== generation.current) return;
    const who = await verifiedMe(s);
    if (ticket !== generation.current) return;
    await orderedCredentialWrite(() => ticket === generation.current ? store.set(KEY, JSON.stringify({ session: s })) : Promise.resolve());
    if (ticket !== generation.current) return;
    setScope((x) => x + 1); setRestoreFailed(false); setReady(true); setMe(who); setSession(s);
  }, []);

  const value = useMemo<Ctx>(() => {
    const lang: Lang = langPref === 'auto' ? me?.lang ?? 'ar' : langPref;
    // Alerts on this phone; the store is told so it sends (or stops sending) alerts here.
    const savePush = async (p: PushPrefs): Promise<PushResult> => {
      if (!session) return 'error';
      const ticket = generation.current;
      const r = await setPush(session, p, lang);
      if (ticket !== generation.current) return 'error';
      const next = { ...p, on: r === 'on' };
      if (r === 'on' || r === 'off') { await store.set(PUSH, JSON.stringify(next)); setPushState(next); }
      return r;
    };
    return {
      push, savePush,
      ready, session, me, restoreFailed,
      retryRestore: () => { setReady(false); setRestoreAttempt((n) => n + 1); },
      cashier: me?.role === 'cashier', lang, staffRole,
      setStaffRole: async (r) => { if (r) await store.set(ROLE, r); else await store.del(ROLE); setRole(r); }, t: translator(lang), lock, langPref,
      // The caller refetches its data so labels from the store switch too.
      setLangPref: async (p) => {
        await store.set(LANG, p); setApiLang(p === 'auto' ? undefined : p); setPref(p);
        // Alerts follow the app language too.
        if (session && push.on) setPush(session, push, p === 'auto' ? me?.lang ?? 'ar' : p).catch(() => {});
      },
      // An application password signs in as it is. Anything else may be a staff member's own password (API 1.16):
      // the store swaps it for an application password for this phone. A store without that keeps the first error.
      signIn: async (c) => {
        const ticket = ++generation.current;
        try { await begin(c, ticket); } catch (e) {
          if (ticket !== generation.current) return;
          if (!(e instanceof ApiError) || e.kind !== 'auth') throw e;
          let swapped: { user: string; password: string };
          try { swapped = await staffSignIn(c.site, c.user, c.password); } catch (e2) {
            if (e2 instanceof ApiError && (e2.kind === 'refused' || e2.kind === 'network')) throw e2;
            throw e;
          }
          await begin({ site: c.site, user: swapped.user, password: swapped.password }, ticket);
        }
      },
      signInDemo: () => begin({ demo: true }, ++generation.current),
      signOut: async () => {
        // Local credentials and UI are invalid immediately, even if device notification deregistration hangs.
        invalidate();
        const removed = orderedCredentialWrite(() => store.del(KEY));
        const prefs = Promise.allSettled([store.del(PUSH), store.del(ROLE)]);
        if (session && push.on) void setPush(session, push, lang, false).catch(() => {});
        await Promise.all([removed, prefs]);
      },
      setLock: async (on) => { await store.set(LOCK, on ? '1' : '0'); setLockState(on); },
    };
  }, [ready, session, me, lock, langPref, push, begin, staffRole, invalidate, restoreFailed]);

  return <SessionContext.Provider value={value}><ScopedQueries key={scope}>{children}</ScopedQueries></SessionContext.Provider>;
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
