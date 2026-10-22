// Client for koub/v1/app. Signs in with a WordPress Application Password (HTTP Basic over HTTPS).
import type { Home, HomePeriod, Lang, Me, Numbers, NumbersPeriod, Order, OrderList, OrderView, PrepareView, ProductFilter, ProductList } from './types';
import { demo } from './demo';

export type Credentials = { site: string; user: string; password: string };
export type Session = Credentials | { demo: true };

export class ApiError extends Error {
  constructor(public kind: 'auth' | 'forbidden' | 'not_found' | 'network' | 'server', message = kind, public status = 0) {
    super(message);
  }
}

// "koubbh.com", "https://koubbh.com/" and "http://…" all become "https://koubbh.com".
export function normalizeSite(input: string): string {
  let s = input.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  return s.replace(/^http:\/\//i, 'https://');
}

function basic(user: string, password: string): string {
  // UTF-8 safe base64, so Arabic usernames work. Application Passwords may contain spaces; WordPress ignores them.
  const bytes = new TextEncoder().encode(user + ':' + password);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return 'Basic ' + btoa(bin);
}

function query(params: Record<string, string | number | undefined>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
  return q.length ? '?' + q.join('&') : '';
}

// The app's own language choice; unset means the dashboard setting. /me always reports the dashboard setting.
let appLang: Lang | undefined;
export function setApiLang(lang: Lang | undefined) { appLang = lang; }

async function get<T>(session: Session, path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  if (path !== '/me') params = { ...params, lang: appLang };
  if ('demo' in session) return demo<T>(path, params);
  let res: Response;
  try {
    res = await fetch(session.site + '/wp-json/koub/v1/app' + path + query(params), {
      headers: { Authorization: basic(session.user, session.password), Accept: 'application/json' },
    });
  } catch {
    throw new ApiError('network');
  }
  if (res.status === 401) throw new ApiError('auth', 'auth', 401);
  if (res.status === 403) throw new ApiError('forbidden', 'forbidden', 403);
  if (res.status === 404) {
    const body = await res.json().catch(() => null);
    // rest_no_route means the koub-tap update is missing; any other 404 is a real "not found" from the API.
    throw new ApiError('not_found', body?.code === 'rest_no_route' ? 'no_route' : body?.message ?? 'not_found', 404);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError('server', body?.message ?? 'HTTP ' + res.status, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  me: (s: Session) => get<Me>(s, '/me'),
  home: (s: Session, period: HomePeriod) => get<Home>(s, '/home', { period }),
  orders: (s: Session, p: { view: OrderView; prepare?: PrepareView; s?: string; page?: number }) =>
    get<OrderList>(s, '/orders', { view: p.view, prepare: p.view === 'active' ? p.prepare : undefined, s: p.s, page: p.page }),
  order: (s: Session, id: number) => get<Order>(s, '/orders/' + id),
  numbers: (s: Session, p: { period: NumbersPeriod; from?: string; to?: string }) => get<Numbers>(s, '/numbers', p),
  products: (s: Session, p: { filter: ProductFilter; s?: string; page?: number }) => get<ProductList>(s, '/products', p),
};

// The dashboard order screen, for actions the app does not have yet.
export function dashboardOrderUrl(session: Session, id: number): string | null {
  return 'demo' in session ? null : session.site + '/wp-admin/admin.php?page=koub-order&order_id=' + id;
}
