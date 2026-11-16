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
  // API 1.15: a cashier sees the till only. Older stores send nothing: everyone is the owner there.
  role?: 'owner' | 'cashier';
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

export type HomePeriod = 'today' | 'yesterday' | 'month';
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
  // API 1.10: `instagram` when KOUB reaches the recipient on Instagram (staff send the address link by hand);
  // `buyer_sends` when the buyer sends the private link on themselves from their receipt page.
  gift: { name: string; phone: string | null; whatsapp?: string | null; call?: string | null; can_add_address?: boolean; need_phone?: boolean; country?: string; anonymous: boolean; message: string; waiting_address: boolean; instagram?: GiftInstagram | null; buyer_sends?: boolean } | null;
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
// 'credit' (API 1.34): KOUB credit on the scanned card.
export type PosMethod = 'cash' | 'card' | 'benefit' | 'credit';
// An order staff place for a customer (API 1.8): paid, and for delivery the customer adds the address from a WhatsApp link.
export type StaffMethod = 'cash' | 'card' | 'benefit' | 'transfer';
export type StaffOrderInput = {
  ref: string; lines: { id: number; qty: number }[]; name: string; phone: string;
  fulfilment: 'delivery' | 'pickup'; country: string; method: StaffMethod; message_lang: Lang; expected_total: number | null; note: string;
  // API 1.18: reuse this returning customer's last delivery address (an order id from the customer lookup).
  address_from?: number;
};
// A returning customer by number (API 1.18).
export type CustomerLookup = { found: boolean; phone?: string; name?: string; orders?: number; address?: { from: number; country: string; text: string } | null };
export type StaffOrder = {
  id: number; number: string; total: number; method_label: string; name: string; whatsapp: string; pickup: boolean;
  address_state: '' | 'awaiting_address' | 'received'; message_state: '' | 'sent' | 'waiting_for_template' | 'failed' | 'not_sent'; link: string | null; lang: string; repeat?: boolean;
};
export type StaffQuote = { subtotal: number; delivery: number | null; total: number | null };
// group: shop drinks from the menu (API 1.6) or store products; older stores send no group.
// stamp: a drink that earns a KOUB card stamp and can be the free drink (API 1.16; before that, every menu item).
export type PosShelf = 'coffee' | 'tea' | 'sweets' | 'goods';
// shelf / temp (API 1.19): where the till shows it (coffee hot / cold, tea, sweets, goods).
export type PosProduct = { id: number; name: string; group?: 'drinks' | 'products'; shelf?: PosShelf; temp?: 'hot' | 'cold' | null; stamp?: boolean; sku: string; price: number; stock: number | null; image: string | null;
  // API 1.22: an item that is several drinks (e.g. Flat white / Latte / Cappuccino): one is picked at the POS.
  choices?: PosChoice[];
  // API 1.23: sold out for today (marked from the POS).
  out_today?: boolean };
export type PosChoice = { key: string; label: string };
// loyalty: the KOUB card rules (API 1.11+), null when cards are off.
export type PosCatalog = { products: PosProduct[]; methods: { key: PosMethod; label: string }[]; loyalty?: { stamps: number; max_per_sale: number } | null;
  // Training mode (API 1.20): sales are practice only, nothing is real.
  training?: boolean;
  // BenefitPay (API 1.21): what the shop's QR encodes, shown on the till for the customer to scan.
  benefit_qr?: string | null;
  // API 1.23: the best sellers of the last 7 days (product ids), for a quick shelf.
  top?: number[];
  // API 1.25: whether a sale needs the payment number (EazyPay approval code / BenefitPay transaction number).
  pay_ref?: PayRefMode };
export type PayRefMode = 'required' | 'optional' | 'off';
// A barista ticket (API 1.17): the menu items of one till sale.
export type BarTicket = { id: number; number: string; state: 'waiting' | 'ready' | 'done'; at: string | null; since: string | null; name: string; whatsapp: string | null; note: string;
  // i / ready (API 1.27): the item's place on the sale, and whether it is ready.
  lines: { name: string; qty: number; drink?: boolean; options?: string; i?: number; ready?: boolean }[];
  // API 1.27: who is making it, and the customer's private page.
  started?: { by: string; mine: boolean; at: string | null } | null;
  track?: string | null;
  // API 1.29: ordered ahead online, the pickup time the customer chose.
  pickup?: string | null;
  // API 1.31: the customer pressed "I'm here" (or ordered from the parking QR): in the car outside, and where.
  arrived?: { at: string | null; spot: string } | null;
  // API 1.32: ordered ahead for later: not to be made before this time (so it is fresh at pickup).
  fire_at?: string | null;
  // Today's order number (API 1.22): staff call the customer by it.
  no?: number | null;
  // API 1.23: where to hand it over (in the shop, or the car).
  where?: string;
  // API 1.40: who took the order at the till ('' for an online order), whether it is mine, and from the online menu.
  by?: string; mine?: boolean; online?: boolean };
export type BarList = { tickets: BarTicket[]; waiting: number };
// API 1.40: store pickup orders for the kiosk: number, items, paid or cash on pickup (the amount only then).
export type PickupOrder = { id: number; number: string; lines: { name: string; qty: number }[]; cod: boolean; collect: number | null; at: string | null };
export type PickupList = { orders: PickupOrder[] };
// A KOUB loyalty card as the till sees it (scanned QR or typed code).
export type LoyaltyCard = { id: number; code: string; name: string; stamps: number; of: number; need: number; rewards: number; credit?: number | null };
export type ReceiptLoyalty = { credit?: number | null; code: string; name: string; added: number; redeemed: boolean; new_rewards: number; failed: boolean; reversed: boolean; stamps: number; of: number; need: number; rewards: number };
export type PosSaleInput = {
  ref: string;
  // choice / note (API 1.22): the drink picked for a combined item, and a short note for the barista.
  lines: { id: number; qty: number; choice?: string; note?: string }[];
  // API 1.23: where to hand it over: in the shop, or the car ("white Land Cruiser").
  where?: string;
  method: PosMethod;
  discount: number;
  discount_type: 'amount' | 'percent';
  cash_given: number | null;
  // The total the phone showed; the store refuses the sale if a price changed since.
  expected_total: number;
  name: string;
  phone: string;
  // A cashier's discount needs the owner PIN (API 1.15).
  owner_pin?: string;
  // The scanned KOUB card: paid drinks become stamps; redeem uses a free drink waiting on it.
  loyalty?: string;
  loyalty_redeem?: boolean;
  // API 1.25: the approval code on the EazyPay receipt, or the BenefitPay transaction number.
  pay_ref?: string;
};
export type PosReceipt = {
  loyalty?: ReceiptLoyalty | null;
  id: number;
  number: string;
  status: string;
  date: string | null;
  // options (API 1.22): the drink chosen and the note, e.g. "Latte · no sugar".
  lines: { name: string; qty: number; total: number; options?: string }[];
  // Today's order number (API 1.22).
  no?: number | null;
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
  pay_ref?: string | null;
  // API 1.26: a cancelled sale: what happened to the money.
  refund?: { state: RefundState; ref: string | null; amount: number } | null;
  // API 1.27: the customer's private order page (shown as a QR after the sale).
  track?: string | null;
};
export type RefundState = 'done' | 'owed' | 'none';
export type CancelReason = 'mistake' | 'changed' | 'unpaid' | 'other';
export type PosCancelInput = { owner_pin?: string; reason: CancelReason; reason_note?: string; refund: RefundState; refund_ref?: string; made?: boolean };
export type RefundOwed = { id: number; no: number | null; number: string; date: string | null; amount: number; method: PosMethod; pay_ref: string | null; name: string; whatsapp: string | null; training: boolean };
// Order ahead (API 1.29), owner only: koubbh.com/order.
// API 1.33: KOUB card offers (owner).
// API 1.34: KOUB credit (owner): switch, packs [pay, get], and what is on cards / sold this month.
export type CreditSettings = { on: boolean; packs: [number, number][]; outstanding: number; cards: number; month_paid: number; month_credit: number };
export type LoyaltyOffers = { birthday: boolean; comeback: boolean; birthdays: number; comeback_days: number };
export type AheadSettings = { on: boolean; from: string; to: string; cap: number; lead: number; slots: { t: number; label: string; free: number }[]; url: string };
// API 1.39: customer ratings after pickup (owner). Anonymous ones have no name or number.
export type FeedbackItem = { at: string; stars: number; note: string; anon: boolean; name: string; no: number | null };
export type FeedbackView = { review_url: string; count: number; avg: number | null; month: { count: number; avg: number | null }; items: FeedbackItem[] };
// Ingredient stock (API 1.28), owner only.
export type StockUnit = 'g' | 'ml' | 'pc';
export type Ingredient = { id: string; name: string; unit: StockUnit; stock: number; low: number; cost: number; per_day: number; days_left: number | null; is_low: boolean };
export type RecipeItem = { ing: string; qty: number };
export type StockProduct = { id: number; name: string; price: number; choices: PosChoice[]; recipe: Record<string, RecipeItem[]>; cost: number | null; margin: number | null };
export type StockView = { ingredients: Ingredient[]; products: StockProduct[]; log: { at: string | null; ing: string; d: number; why: string; order: number | null; note: string }[] };
// Shop insights (API 1.28), owner only.
export type InsightsPeriod = 'today' | '7days' | '30days';
export type InsightItem = { id: number; name: string; qty: number; total: number; cost: number | null; profit: number | null };
export type Insights = { period: InsightsPeriod; days: number; count: number; total: number; avg: number; cups: number; per_day: number;
  hours: { count: number; total: number }[]; busiest_hour: number | null; week: { count: number; total: number }[];
  wait: Record<'ready' | 'handed', { n: number; median: number | null; p90: number | null }>;
  top: InsightItem[]; top_money: InsightItem[]; methods: Partial<Record<PosMethod, number>>; cancels: Partial<Record<CancelReason, number>>; waste: { name: string; qty: number }[] };
// Go-live list (API 1.26), owner only.
export type GoliveCheck = { key: 'staff' | 'pin' | 'benefit_qr' | 'pay_ref' | 'stock' | 'practice_close' | 'refunds' | 'training'; ok: boolean | null; active?: number; pending?: number; mode?: string; managed?: number; zero?: number; closes?: number; owed?: number; on?: boolean; sales?: number };
export type PosGolive = { checks: GoliveCheck[]; training: boolean; deleted?: number };
// End-of-day close (API 1.25).
export type CloseMethod = 'card' | 'benefit';
export type PosCloseInput = { date?: string; counted: Record<CloseMethod, number>; counts?: Partial<Record<CloseMethod, number>>; note?: string };
export type PosCloseEntry = { at: string | null; by: string | null; counted: Record<CloseMethod, number>; counts: Partial<Record<CloseMethod, number | null>>; note: string;
  expected: Record<CloseMethod, { count: number; total: number }>; diff: Record<CloseMethod, number>; ok: boolean; training?: boolean };
export type PosCloseSale = { id: number; no: number | null; date: string | null; method: PosMethod; total: number; kept: number; pay_ref: string | null; dup_of: number | null; void: boolean; staff: string | null; refund?: { state: RefundState; ref: string | null } | null };
export type PosCloseReport = {
  date: string;
  expected: { by_method: Record<CloseMethod, { count: number; total: number; missing_ref: number }>; total: number; void: { count: number; total: number }; refunds: number; dup_refs: number; sales: PosCloseSale[]; training: boolean;
    // API 1.26: cancelled sales whose money the shop still held at the end of the day; money given back today for
    // earlier sales; drinks made and then cancelled.
    held?: number; refunded_earlier?: { id: number; no: number | null; method: PosMethod; amount: number; ref: string | null }[]; waste?: { name: string; qty: number; no: number | null }[] };
  closes: PosCloseEntry[];
  // The last close against the sales as they are now (a sale cancelled after the close shows here).
  diff_now: Record<CloseMethod, number> | null;
  days: { date: string; closed: boolean; ok: boolean | null; diff: number | null; attempts: number }[];
  refunds_owed?: RefundOwed[];
};
export type PosToday = {
  // null for a cashier (API 1.19): staff see their sales only to cancel one, never how much they sold.
  count: number | null;
  // null for a cashier (API 1.15): they see their own sales, never the shop's totals.
  total: number | null;
  by_method: Record<PosMethod, number> | null;
  own?: boolean;
  sales: { id: number; number: string; total: number | null; method: PosMethod; method_label: string; date: string | null; void: boolean; items: number; refunded?: number; voidable?: boolean; staff?: string | null }[];
};

// Till staff (API 1.15): cashier accounts the owner makes, and who sold what.
export type PosStaff = { id: number; name: string; login: string; active: boolean; last_sale: string | null; pending?: boolean; phone?: string };
export type PosStaffList = { pin_set: boolean; staff: PosStaff[] };
// Returned once when an account is made, switched on again or given a new password.
export type PosStaffSecret = { staff: PosStaff; login?: string; password?: string };
export type PosStaffRow = { id: number; name: string; login?: string; free?: number; free_count?: number; orders?: number; orders_total?: number; count: number; total: number; by_method: Record<PosMethod, number>; discounts: number; discount_count: number; voids: number; void_total: number; refunds: number };
export type PosStaffEvent = { id: number; number: string; date: string | null; staff: string; login?: string; total: number; kind: 'void' | 'discount' | 'free' | 'order'; method?: string; amount?: number; by?: string | null; approved: string };
export type PosStaffReport = { period: { preset: ShopPeriod; start: string; end: string; label: string }; staff: PosStaffRow[]; events: PosStaffEvent[] };

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
export type ItemsEditLine = { item_id: number; product_id: number; name: string; qty: number; total: number; unit: number; set_size: number; parts: ItemPart[] };
// `cod`: cash on delivery not collected yet. `owed`: owed back from earlier changes. `free`: differences given free so far.
export type ItemsEdit = { lines: ItemsEditLine[]; mugs: string[]; sets: Record<string, number>; backorders: number[]; cod: boolean; total: number; owed: number; free: number };
export type ItemsMethod = StaffMethod | 'free';
export type ItemsInput = { lines: { item_id?: number; id?: number; qty: number; parts?: ItemPart[] }[]; expected_total: number | null; method: ItemsMethod | '' };
// API 1.10: a gift recipient KOUB messages on Instagram. `waiting`: still needs the message (paid, no address yet).
export type GiftInstagram = { handle: string; url: string; sent: string | null; waiting: boolean };
export type GiftInstagramLink = { link: string; handle: string; name: string; sender: string; message: string };
