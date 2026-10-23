// Client for koub/v1/app. Signs in with a WordPress Application Password (HTTP Basic over HTTPS).
import type { ActionKey, BulkKey, BulkResult, Home, HomePeriod, Lang, Me, Numbers, NumbersPeriod, Order, OrderList, OrderView, PrepareView, ProductFilter, ProductList, PreorderList, ReleaseResult, StockResult, Run, ContactInput, UnpaidList, PaymentLink } from './types';
import { demo, demoPost } from './demo';

export type Credentials = { site: string; user: string; password: string };
export type Session = Credentials | { demo: true };

export class ApiError extends Error {
  constructor(public kind: 'auth' | 'forbidden' | 'not_found' | 'network' | 'server' | 'refused', message: string = kind, public status = 0) {
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

async function post<T>(session: Session, path: string, body: Record<string, unknown>): Promise<T> {
  if ('demo' in session) return demoPost<T>(path, { ...body, lang: appLang });
  let res: Response;
  try {
    res = await fetch(session.site + '/wp-json/koub/v1/app' + path, {
      method: 'POST',
      headers: { Authorization: basic(session.user, session.password), Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('network');
  }
  if (res.status === 401) throw new ApiError('auth', 'auth', 401);
  if (res.status === 403) throw new ApiError('forbidden', 'forbidden', 403);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    // 409: the store refused this step (already done, wrong step, someone else is updating); its message says why.
    if (res.status === 409) throw new ApiError('refused', err?.message ?? 'HTTP 409', 409);
    throw new ApiError(res.status === 404 ? 'not_found' : 'server', err?.message ?? 'HTTP ' + res.status, res.status);
  }
  return res.json() as Promise<T>;
}

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
  push: (s: Credentials, p: { token: string; platform: 'ios' | 'android'; enabled: boolean; quiet: boolean; lang: Lang; kinds: ('new_order' | 'unpaid' | 'stock')[] }) =>
    post<{ enabled: boolean; quiet: boolean | null; kinds?: ('new_order' | 'unpaid' | 'stock')[] | null; devices: number }>(s, '/push', p),
  // Each returns the updated order.
  orderAction: (s: Session, id: number, action: ActionKey) => post<Order>(s, '/orders/' + id + '/action', { action, lang: appLang }),
  // The dashboard's shipping slips as one HTML document (API 1.2), to print from the phone.
  slips: (s: Session, ids: number[]) => get<{ count: number; html: string }>(s, '/orders/slips', { ids: ids.join(',') }),
  ordersBulk: (s: Session, ids: number[], action: BulkKey) => post<BulkResult>(s, '/orders/bulk', { ids, action, lang: appLang }),
  orderNote: (s: Session, id: number, note: string) => post<Order>(s, '/orders/' + id + '/note', { note, lang: appLang }),
  // API 1.3: pre-orders by item, and stock from the phone.
  preorders: (s: Session) => get<PreorderList>(s, '/preorders'),
  preordersRelease: (s: Session, key: string, ids: number[]) => post<ReleaseResult>(s, '/preorders/release', { key, ids, lang: appLang }),
  productStock: (s: Session, id: number, delta: number, revision: string) => post<StockResult>(s, '/products/' + id + '/stock', { delta, revision, lang: appLang }),
  // API 1.3: the delivery run and delivery details.
  run: (s: Session) => get<Run>(s, '/run'),
  orderContact: (s: Session, id: number, input: ContactInput) => post<Order>(s, '/orders/' + id + '/contact', { ...input, lang: appLang }),
  // API 1.3: unfinished payments. Nothing is sent by the store; the app opens WhatsApp with the link filled in.
  unpaid: (s: Session) => get<UnpaidList>(s, '/unpaid'),
  paymentLink: (s: Session, id: number) => post<PaymentLink>(s, '/orders/' + id + '/payment-link', { lang: appLang }),
  unpaidDismiss: (s: Session, id: number) => post<{ ok: boolean }>(s, '/orders/' + id + '/unpaid-dismiss', { lang: appLang }),
};

// The dashboard order screen, for stores without the order actions API and for refunds.
export function dashboardOrderUrl(session: Session, id: number): string | null {
  return 'demo' in session ? null : session.site + '/wp-admin/admin.php?page=koub-order&order_id=' + id;
}
