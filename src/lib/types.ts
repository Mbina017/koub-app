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
  // API 1.2: the steps this order allows now, for select mode.
  can?: ActionKey[];
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
  // API 1.3: today's work — the delivery run and pre-orders whose stock is in.
  work?: { run: { count: number; total: number; cod: number }; preorder_ready: number; unpaid?: { count: number; value: number } } | null;
  stock: { low: number; out: number };
  visitors: { visitors: number; pageviews: number; orders: number } | null;
  latest: OrderSummary[];
  // API 1.7: the shop till's own figures for the same period; the online figures above never include them.
  shop?: { sales: number; count: number; expenses: number; profit: number; exact: boolean } | null;
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
  // API 1.3: delivery details this order can change from the app, with their saved values; null when it is closed.
  contact_edit?: ContactEdit | null;
  // API 1.9: what the order holds while it can still be changed, and any amount owed back after a change.
  items_edit?: ItemsEdit | null;
  refund_owed?: number | null;
  gift: { name: string; phone: string | null; anonymous: boolean; message: string; waiting_address: boolean } | null;
  // API 1.8: an order staff placed for the customer, waiting for them to add the address from the link.
  address_link?: { message: string; lang: string } | null;
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
  // API 1.3: stock can change from the app (simple product with tracked stock), and the version it was read at.
  quick?: boolean;
  revision?: string;
};
export type StockResult = { qty: number; revision: string; state: Product['state'] };
// API 1.3: open pre-orders grouped by what they wait for.
export type PreorderGroup = {
  key: string;
  name: string;
  orders: number;
  qty: number;
  ready: number;
  ready_ids: number[];
  mixed: number;
  oldest: string | null;
  ago: string;
  stock: number | null;
  product_id: number | null;
  image: string | null;
  confirm: string;
};
export type PreorderList = { groups: PreorderGroup[] };
export type ReleaseResult = { updated: number; skipped: { id: number; number: string; reason: string }[] };
export type ProductList = {
  filter: ProductFilter;
  total: number;
  page: number;
  pages: number;
  counts: Record<ProductFilter, number>;
  products: Product[];
};

// API 1.3: delivery details from the app.
export type ContactField = 'whatsapp' | 'call' | 'recipient' | 'address';
export type ContactEdit = { fields: ContactField[]; values: { whatsapp: string; call: string; recipient: string; address: string; city: string }; out_for_delivery: boolean };
export type ContactInput = Partial<Record<'whatsapp' | 'call' | 'recipient' | 'address' | 'city', string>>;
// API 1.3: the day's delivery run, by area.
export type RunRow = { id: number; number: string; name: string; area: string; address: string; items: string; call: string | null; whatsapp: string | null; cod_due: number | null; gift: boolean; today: boolean; map: string | null };
export type Run = { date: string; count: number; cod_total: number; cod_count: number; rows: RunRow[] };
// API 1.3: card payments that did not finish, and the order's own payment link to send from staff WhatsApp.
export type UnpaidRow = { id: number; number: string; name: string; total: number; items: string; created: string | null; ago: string; status: string; status_label: string; payable: boolean; method: string; reminder: string; opened: boolean; shared: string | null; whatsapp: string | null };
export type UnpaidList = { count: number; value: number; rows: UnpaidRow[] };
export type PaymentLink = { url: string; text: string; whatsapp: string | null };

// Shop till (API 1.5).
export type PosMethod = 'cash' | 'card' | 'benefit';
// An order staff place for a customer (API 1.8): paid, and for delivery the customer adds the address from a WhatsApp link.
export type StaffMethod = 'cash' | 'card' | 'benefit' | 'transfer';
export type StaffOrderInput = {
  ref: string; lines: { id: number; qty: number }[]; name: string; phone: string;
  fulfilment: 'delivery' | 'pickup'; country: string; method: StaffMethod; message_lang: Lang; expected_total: number | null; note: string;
};
export type StaffOrder = {
  id: number; number: string; total: number; method_label: string; name: string; whatsapp: string; pickup: boolean;
  address_state: '' | 'awaiting_address' | 'received'; message_state: '' | 'sent' | 'waiting_for_template' | 'failed' | 'not_sent'; link: string | null; lang: string; repeat?: boolean;
};
export type StaffQuote = { subtotal: number; delivery: number | null; total: number | null };
// group: shop drinks from the menu (API 1.6) or store products; older stores send no group.
export type PosProduct = { id: number; name: string; group?: 'drinks' | 'products'; sku: string; price: number; stock: number | null; image: string | null };
export type PosCatalog = { products: PosProduct[]; methods: { key: PosMethod; label: string }[] };
export type PosSaleInput = {
  ref: string;
  lines: { id: number; qty: number }[];
  method: PosMethod;
  discount: number;
  discount_type: 'amount' | 'percent';
  cash_given: number | null;
  // The total the phone showed; the store refuses the sale if a price changed since.
  expected_total: number;
  name: string;
  phone: string;
};
export type PosReceipt = {
  id: number;
  number: string;
  status: string;
  date: string | null;
  lines: { name: string; qty: number; total: number }[];
  discount: number;
  total: number;
  method: PosMethod;
  method_label: string;
  cash_given: number | null;
  change: number | null;
  name: string;
  whatsapp: string | null;
  voidable: boolean;
  repeat?: boolean;
};
export type PosToday = {
  count: number;
  total: number;
  by_method: Record<PosMethod, number>;
  sales: { id: number; number: string; total: number; method: PosMethod; method_label: string; date: string | null; void: boolean; items: number; refunded?: number; voidable?: boolean }[];
};

// Shop books (API 1.7): the till's own sales, expenses and result, never mixed with the online store.
export type ShopExpenseCat = 'stock' | 'rent' | 'salary' | 'bills' | 'other';
export type ShopPeriod = 'today' | 'yesterday' | '7days' | 'month';
export type ShopExpense = { id: string; date: string; amount: number; cat: ShopExpenseCat; cat_label: string; label: string; by: string; at: string | null; removable: boolean };
export type ShopBooks = {
  period: { preset: ShopPeriod; start: string; end: string; label: string };
  sales: number;
  count: number;
  items: number;
  average: number;
  refunded: number;
  by_method: Record<PosMethod, number>;
  goods: number;
  fees: number;
  expenses: number;
  by_category: { key: ShopExpenseCat; label: string; value: number }[];
  // Not exact while a sold item has no cost: the result is then "at most" this amount.
  profit: number;
  exact: boolean;
  missing: string[];
  days: { date: string; sales: number; expenses: number }[];
  entries: ShopExpense[];
  categories: { key: ShopExpenseCat; label: string }[];
};
export type ShopExpenseInput = { ref: string; amount: number; cat: ShopExpenseCat; label: string; date: string };
// API 1.9: changing the items. Lines in the order keep the price paid (`unit`); a set lists its mugs per set.
export type ItemPart = { name: string; qty: number };
export type ItemsEditLine = { item_id: number; product_id: number; name: string; qty: number; unit: number; set_size: number; parts: ItemPart[] };
export type ItemsEdit = { lines: ItemsEditLine[]; mugs: string[]; sets: Record<string, number>; cod: boolean; total: number };
export type ItemsMethod = StaffMethod | 'free';
export type ItemsInput = { lines: { item_id?: number; id?: number; qty: number; parts?: ItemPart[] }[]; expected_total: number | null; method: ItemsMethod | '' };
