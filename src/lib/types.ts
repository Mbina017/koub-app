// Shapes returned by koub/v1/app (see koub-site docs/app/api.md). Amounts are BHD numbers.
import type { Tone } from './theme';

export type Lang = 'ar' | 'en';
export type Tag = { label: string; tone: Tone };
export type Point = { x: string; y: number; orders?: number };
export type NextState = 'out_delivery' | 'ready_pickup';
// Order screen actions (API 1.1). Labels and confirmation text come from the dashboard.
export type ActionKey = NextState | 'release_preorder' | 'cod_collected' | 'cancel' | 'undo_fulfilment' | 'undo_cod';
// tone undo (API 1.2): a step pressed by mistake, shown quietly under the main steps.
export type OrderAction = { key: ActionKey; label: string; confirm: string; tone: 'primary' | 'danger' | 'undo' };
// Bulk choices for a list; {n} in confirm is the number of selected orders.
export type BulkKey = Exclude<ActionKey, 'undo_fulfilment' | 'undo_cod'>;
export type BulkAction = { key: BulkKey; label: string; confirm: string; tone: 'primary' | 'danger' };
export type BulkResult = { action: BulkKey; updated: number; skipped: { id: number; number: string; reason: string }[] };

export type Me = {
  api: string;
  name: string;
  initial: string;
  lang: Lang;
  dir: 'rtl' | 'ltr';
  currency: 'BHD';
  site: string;
  whatsapp_automation: boolean;
};

export type OrderSummary = {
  id: number;
  number: string;
  created: string | null;
  ago: string;
  name: string;
  items: string;
  total: number;
  due: number;
  tags: Tag[];
  next: NextState | null;
  test: boolean;
};

export type HomePeriod = 'today' | '7days' | 'month';
export type Home = {
  period: { preset: HomePeriod; start: string; end: string };
  profit: { value: number; exact: boolean; change_pct: number | null };
  sales: number;
  orders: number;
  spark: Point[];
  goal: {
    month: string;
    goal: number | null;
    revenue: number;
    pct: number | null;
    days_left: number;
    need_per_day: number | null;
  };
  needs: {
    prepare: { count: number; by: Record<'bahrain' | 'international' | 'pickup' | 'unknown', number> };
    cod: { amount: number; count: number };
    gifts: { count: number; oldest: string | null };
    whatsapp: { count: number; order_id: number | null };
    preorder: number;
  };
  stock: { low: number; out: number };
  visitors: { visitors: number; pageviews: number; orders: number } | null;
  latest: OrderSummary[];
};

export type OrderView = 'active' | 'preorder' | 'cod' | 'gifts' | 'all';
export type PrepareView = 'all' | 'bahrain' | 'international' | 'pickup' | 'unknown';
export type OrderList = {
  view: OrderView;
  prepare: PrepareView;
  total: number;
  page: number;
  pages: number;
  counts: Record<string, number>;
  orders: OrderSummary[];
  // Missing before API 1.2: no select mode then.
  bulk?: BulkAction[];
  // The dashboard bar offers slips for this list.
  print?: boolean;
};

export type CostKey = 'goods' | 'packaging' | 'gateway' | 'courier';
export type Order = {
  id: number;
  number: string;
  status: string;
  status_label: string;
  created: string | null;
  ago: string;
  via_staff: boolean;
  test: boolean;
  pickup: boolean;
  cod: boolean;
  preorder: boolean;
  fulfilment: string | null;
  fulfilment_at: string | null;
  tags: Tag[];
  customer: {
    name: string;
    initial: string;
    phone: string | null;
    whatsapp: string | null;
    call: string | null;
    orders: number | null;
    position: number | null;
    spent: number | null;
  };
  address: { text: string; country: string };
  gift: { name: string; phone: string | null; anonymous: boolean; message: string; waiting_address: boolean } | null;
  note: string;
  items: { name: string; qty: number; total: number; image: string | null; product_id: number; parts: { name: string; qty: number }[] }[];
  totals: { discount: number; fees: { name: string; total: number }[]; shipping: number; refunded: number; total: number };
  payment: { label: string; tone: Tone; method: string };
  profit: {
    revenue: number;
    profit: number;
    at_most: boolean;
    costs: Record<CostKey, { value: number | null; estimate: boolean }>;
    missing_products: string[];
  } | null;
  messages: { event: string; label: string; status: string; tone: Tone; at: string | null }[];
  log: { at: string | null; to_customer: boolean; text: string }[];
  next: NextState[];
  cod_due: boolean;
  no_action: string | null;
  // Missing on a store that still runs API 1.0.
  actions?: OrderAction[];
};

export type NumbersPeriod = 'today' | 'yesterday' | '7days' | 'month' | 'custom';
export type SpendKey = 'ads' | 'goods' | 'courier' | 'gateway' | 'packaging' | 'other';
export type Numbers = {
  period: { preset: NumbersPeriod; start: string; end: string; label: string; days: number };
  profit: { value: number; exact: boolean; change_pct: number | null };
  sales: number;
  orders: number;
  average: number;
  chart: { by: 'hour' | 'day'; points: Point[] };
  spend: { key: SpendKey; value: number; at_least: boolean }[];
  ads: { spent: number; roas: number | null; per_order: number | null };
  cash: { card_after_fees: number; cod_to_collect: number };
  best_sellers: { name: string; qty: number }[];
  countries: { code: string; name: string; orders: number }[];
  foreign_orders: number;
  missing: string[];
  mix: { card: number; cod: number; delivery: number; pickup: number; items: number; bundles: number; refunded: number; shipping_paid: number };
  carts: { reminded: number; delivered: number; recovered: number; sales: number } | null;
};

export type ProductFilter = 'all' | 'low' | 'out' | 'preorder' | 'draft';
export type Product = {
  id: number;
  name: string;
  sku: string;
  price: number;
  cost: number | null;
  profit: number | null;
  state: 'ok' | 'low' | 'out' | 'draft';
  preorder: boolean;
  stock: number | null;
  waiting_alerts: number;
  image: string | null;
};
export type ProductList = {
  filter: ProductFilter;
  total: number;
  page: number;
  pages: number;
  counts: Record<ProductFilter, number>;
  products: Product[];
};
