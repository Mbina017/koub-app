export const PRODUCTION_ORIGIN = 'https://koubbh.com';
export type AppBoundary = { variant: 'production' | 'owner-qa'; origin: string; offlineFixture?: true };

export function readBoundary(value: unknown): AppBoundary {
  if (!value || typeof value !== 'object' || !('variant' in value) || !('origin' in value)) throw new Error('KOUB build configuration missing');
  const { variant, origin } = value;
  if (variant === 'production' && origin === PRODUCTION_ORIGIN) return { variant, origin };
  if (variant !== 'owner-qa' || typeof origin !== 'string') throw new Error('KOUB build configuration invalid');
  const url = new URL(origin);
  const fixture = 'offlineFixture' in value && value.offlineFixture === true;
  if (url.protocol !== 'https:' || url.origin !== origin || url.port || url.hostname === 'koubbh.com' || url.hostname.endsWith('.koubbh.com')
      || ['koub.mystagingwebsite.com', 'koub-wa-qa.mystagingwebsite.com'].includes(url.hostname)
      || url.hostname.endsWith('.test') !== fixture) throw new Error('KOUB owner QA requires isolated staging');
  return { variant, origin, ...(fixture ? { offlineFixture: true as const } : {}) };
}

type StoredCredentials = { site: string; user: string; password: string };
export type StoredSession = StoredCredentials | { demo: true };

export function checkedStoredSession(raw: string, boundary: AppBoundary): StoredSession | null {
  const saved: unknown = JSON.parse(raw);
  if (!saved || typeof saved !== 'object' || !('session' in saved) || !saved.session || typeof saved.session !== 'object') return null;
  const s = saved.session;
  if ('demo' in s) return s.demo === true && boundary.variant === 'production' ? { demo: true } : null;
  if (!('site' in s) || s.site !== boundary.origin || !('user' in s) || typeof s.user !== 'string' || !s.user.trim()
      || !('password' in s) || typeof s.password !== 'string' || !s.password) return null;
  return { site: s.site, user: s.user, password: s.password };
}

export function keyForBoundary(key: string, b: AppBoundary): string {
  // Stage bindings never read or delete the legacy production key. The staged host itself is not a secret.
  return b.variant === 'owner-qa' ? key + '.owner-qa.' + new URL(b.origin).hostname : key;
}
