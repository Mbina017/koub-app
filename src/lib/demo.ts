// Synthetic demo store: invented names and numbers only, so the app can be tried without signing in.
import type { ActionKey, BulkAction, BulkKey, BulkResult, Home, Me, Numbers, Order, OrderAction, OrderList, OrderSummary, PreorderGroup, Product, ProductList, ReleaseResult, Run, StockResult, Tag, UnpaidList, UnpaidRow, PosCatalog, PosMethod, PosReceipt, PosToday } from './types';

const people = ['سارة م.', 'خالد ع.', 'نورة ي.', 'أحمد س.', 'ريم ح.', 'يوسف ب.', 'دانة ف.', 'عبدالله ر.', 'مريم ك.', 'حمد ج.', 'فاطمة ن.', 'علي ط.'];
const catalog: [string, number, number | null, number | null][] = [
  // name, price, unit cost, stock (null = not tracked)
  ['كوب المنامة', 8.5, 2.047, 14],
  ['كوب المحرق', 8.5, 2.047, 2],
  ['كوب زجاج شفاف', 6.0, 1.4, 0],
  ['كوب الرفاع', 8.5, 2.047, 22],
  ['طقم كوبين · هدية', 15.5, 4.2, 6],
  ['كوب السيف', 9.0, null, 9],
  ['كوب عراد', 8.5, 2.047, 1],
  ['كوب جدحفص', 8.5, 2.047, 0],
];
type Kind = 'prepare_bh' | 'prepare_gcc' | 'pickup' | 'gift' | 'cod' | 'preorder' | 'done';
const plan: [Kind, number][] = [
  ['prepare_bh', 0.2], ['prepare_bh', 0.9], ['pickup', 1.6], ['prepare_gcc', 2.4], ['gift', 3.1], ['cod', 4.0],
  ['preorder', 5.5], ['done', 7], ['done', 9], ['cod', 26], ['done', 30], ['done', 49], ['done', 53], ['done', 75],
  ['preorder', 11], ['preorder', 20], ['preorder', 34], ['preorder', 52],
];
// Pre-orders wait for كوب السيف (5) or كوب جدحفص (7); one waits for both.
const preorderLines: [number, number][][] = [[[5, 1]], [[5, 2]], [[5, 1], [7, 1]], [[7, 1]], [[5, 1]]];
let preorderSeen = 0;

const now = Date.now();
const H = 3600 * 1000;
function ago(hours: number): string {
  if (hours < 1) return 'قبل ' + Math.max(1, Math.round(hours * 60)) + ' د';
  if (hours < 24) { const h = Math.floor(hours); return h === 1 ? 'قبل ساعة' : h === 2 ? 'قبل ساعتين' : 'قبل ' + h + ' ساعات'; }
  if (hours < 48) return 'أمس';
  return 'قبل ' + Math.floor(hours / 24) + ' أيام';
}

// Steps taken in demo mode change the invented orders for this session only.
type DemoOrder = OrderSummary & { kind: Kind; lines: [number, number][]; fulfilled?: boolean; collected?: boolean; cancelled?: boolean; released?: boolean; notes?: string[]; contact?: { whatsapp: string; call: string; address: string; city: string } };
const orders: DemoOrder[] = plan.map(([kind, hours], k) => {
  const lines: [number, number][] = kind === 'preorder' ? preorderLines[preorderSeen++ % preorderLines.length] : k % 3 === 0 ? [[0, 1], [3, 1]] : k % 4 === 1 ? [[4, 1]] : [[k % catalog.length, 1 + (k % 2)]];
  const total = Math.round((lines.reduce((s, [p, q]) => s + catalog[p][1] * q, 0) + (kind === 'pickup' ? 0 : kind === 'prepare_gcc' ? 4 : 1.5)) * 1000) / 1000;
  const tags: Tag[] = [];
  if (kind === 'gift') tags.push({ label: 'هدية · تنتظر العنوان', tone: 'blue' });
  else if (kind === 'pickup') tags.push({ label: 'استلام', tone: 'neutral' });
  else if (kind === 'prepare_gcc') tags.push({ label: 'السعودية · شحن', tone: 'neutral' });
  else tags.push({ label: 'توصيل · ' + ['المنامة', 'المحرق', 'الرفاع', 'عيسى'][k % 4], tone: 'neutral' });
  if (kind === 'cod') tags.push({ label: 'كاش عند التوصيل', tone: 'amber' });
  else tags.push({ label: 'مدفوع', tone: 'green' });
  if (kind === 'preorder') tags.push({ label: 'طلب مسبق', tone: 'amber' });
  if (kind === 'done') tags.push({ label: k % 2 ? 'طلع للتوصيل' : 'جاهز للاستلام', tone: 'green' });
  const items = lines.map(([p, q]) => q + '× ' + catalog[p][0]).join('، ');
  const next = kind === 'prepare_bh' || kind === 'prepare_gcc' || (kind === 'cod' && hours < 10) ? 'out_delivery' : kind === 'pickup' ? 'ready_pickup' : null;
  return { id: 1040 - k, number: String(1040 - k), created: new Date(now - hours * H).toISOString(), ago: ago(hours), name: people[k % people.length], items, total, due: total, tags, next, test: false, kind, lines };
});

const inView = (o: DemoOrder, view: string, prepare: string) => {
  if (view === 'all') return true;
  if (o.cancelled) return false;
  const active = o.next !== null;
  if (view === 'active') return active && (prepare === 'all' || (prepare === 'bahrain' && (o.kind === 'prepare_bh' || o.kind === 'cod' || o.kind === 'preorder')) || (prepare === 'international' && o.kind === 'prepare_gcc') || (prepare === 'pickup' && o.kind === 'pickup'));
  if (view === 'preorder') return o.kind === 'preorder' && !o.released;
  if (view === 'cod') return o.kind === 'cod' && !o.collected;
  if (view === 'gifts') return o.kind === 'gift';
  return false;
};
const strip = (d: DemoOrder): OrderSummary => { const { kind, lines, fulfilled, collected, cancelled, released, notes, contact, ...o } = d; return { ...o, can: actions(d).map((a) => a.key).filter((k) => !k.startsWith('undo_')) }; };

function counts(): Record<string, number> {
  const c: Record<string, number> = {};
  for (const v of ['active', 'preorder', 'cod', 'gifts', 'all']) c[v] = orders.filter((o) => inView(o, v, 'all')).length;
  for (const p of ['bahrain', 'international', 'pickup', 'unknown']) c['prepare_' + p] = orders.filter((o) => inView(o, 'active', p)).length;
  return c;
}

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function series(days: number) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 24 * H);
    const wave = 0.55 + 0.45 * Math.sin((d.getDate() * 1.7) % 6.28);
    const y = Math.round((38 + wave * 70 + (d.getDay() === 4 || d.getDay() === 5 ? 35 : 0)) * 1000) / 1000;
    out.push({ x: ymd(d), y, orders: Math.max(1, Math.round(y / 13)) });
  }
  return out;
}
function hours() {
  // The demo day is always well under way, so the numbers look like a real afternoon.
  const h = Math.max(new Date().getHours(), 17);
  return Array.from({ length: 24 }, (_, i) => ({ x: String(i).padStart(2, '0') + ':00', y: i > h || i < 9 ? 0 : [0, 8.5, 0, 17, 25.5, 0, 9, 15.5, 8.5, 0, 17, 8.5, 26, 9, 0][i - 9] ?? 8.5 }));
}

function numbers(period: string): Numbers {
  const days = period === 'month' ? new Date().getDate() : period === '7days' ? 7 : 1;
  const chart = days === 1 ? hours() : series(days);
  const sales = Math.round(chart.reduce((s, p) => s + p.y, 0) * 1000) / 1000;
  const n = Math.max(1, days === 1 ? 7 : Math.round(sales / 13.4));
  const goods = sales * 0.24, ads = days * 3.1, courier = n * 0.9, gateway = sales * 0.021, packaging = n * 0.22, other = days * 0.32;
  const profit = sales - goods - ads - courier - gateway - packaging - other;
  const r = (x: number) => Math.round(x * 1000) / 1000;
  const spend = ([['goods', goods], ['ads', ads], ['courier', courier], ['gateway', gateway], ['packaging', packaging], ['other', other]] as const)
    .map(([key, value]) => ({ key, value: r(value), at_least: key === 'goods' }))
    .sort((a, b) => b.value - a.value);
  const end = ymd(new Date());
  return {
    period: { preset: period as Numbers['period']['preset'], start: days === 1 ? end : ymd(new Date(now - (days - 1) * 24 * H)), end, label: '', days },
    profit: { value: r(profit), exact: false, change_pct: days === 1 ? 14 : 9 },
    sales, orders: n, average: r(sales / n),
    chart: { by: days === 1 ? 'hour' : 'day', points: chart },
    spend,
    ads: { spent: r(ads), roas: Math.round((sales / ads) * 10) / 10, per_order: r(ads / n) },
    cash: { card_after_fees: r(sales * 0.82 - gateway), cod_to_collect: r(sales * 0.18) },
    best_sellers: [['كوب المنامة', 9], ['طقم كوبين · هدية', 6], ['كوب المحرق', 5], ['كوب الرفاع', 4], ['كوب عراد', 2]].map(([name, qty]) => ({ name: name as string, qty: Math.max(1, Math.round((qty as number) * Math.max(1, days / 3))) })),
    countries: [{ code: 'BH', name: 'البحرين', orders: Math.ceil(n * 0.8) }, { code: 'SA', name: 'السعودية', orders: Math.ceil(n * 0.15) }, { code: 'KW', name: 'الكويت', orders: 1 }],
    foreign_orders: 0,
    missing: ['#1035 · تكلفة المنتج · كوب السيف'],
    mix: { card: Math.ceil(n * 0.8), cod: Math.floor(n * 0.2), delivery: Math.ceil(n * 0.85), pickup: Math.floor(n * 0.15), items: Math.round(n * 1.6), bundles: Math.round(n * 0.3), refunded: 0, shipping_paid: r(n * 1.3) },
    carts: { reminded: 3 * days, delivered: 3 * days - 1, recovered: Math.ceil(days / 2), sales: r(17 * Math.ceil(days / 2)) },
  };
}

function home(period: string): Home {
  const nb = numbers(period);
  let sum = 0;
  const spark = nb.chart.points.filter((p) => nb.chart.by === 'day' || parseInt(p.x, 10) >= 9).filter((p) => nb.chart.by === 'day' || parseInt(p.x, 10) <= Math.max(new Date().getHours(), 17)).map((p) => ({ x: p.x, y: (sum += p.y) }));
  const c = counts();
  const month = numbers('month');
  return {
    period: { preset: period as Home['period']['preset'], start: nb.period.start, end: nb.period.end },
    profit: nb.profit, sales: nb.sales, orders: nb.orders, spark,
    goal: { month: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'][new Date().getMonth()], goal: 3000, revenue: month.sales, pct: Math.min(100, Math.floor((100 * month.sales) / 3000)), days_left: 10, need_per_day: Math.round(Math.max(0, 3000 - month.sales) / 10) },
    needs: {
      prepare: { count: c.active, by: { bahrain: c.prepare_bahrain, international: c.prepare_international, pickup: c.prepare_pickup, unknown: 0 } },
      cod: { amount: orders.filter((o) => o.kind === 'cod').reduce((s, o) => s + o.due, 0), count: c.cod },
      gifts: { count: c.gifts, oldest: orders.find((o) => o.kind === 'gift')!.created },
      whatsapp: { count: 1, order_id: 1036 },
      preorder: c.preorder,
    },
    work: (() => { const r = run(); return { run: { count: r.rows.filter((x) => x.today).length, total: r.count, cod: r.cod_total }, preorder_ready: preorderGroups().filter((g) => g.stock !== null && g.stock >= g.qty).reduce((sum, g) => sum + g.ready, 0), unpaid: { count: unpaidList().count, value: unpaidList().value } }; })(),
    stock: { low: 2, out: 2 },
    visitors: { visitors: period === 'today' ? 184 : period === '7days' ? 1420 : 4310, pageviews: period === 'today' ? 512 : period === '7days' ? 4033 : 12870, orders: nb.orders },
    latest: orders.slice(0, 5).map(strip),
  };
}

// Delivery details as the store keeps them; edits in demo mode last for the session.
const areaOf = (o: DemoOrder) => o.tags.find((x) => x.label.startsWith('توصيل · '))?.label.slice(8) ?? 'المنامة';
function contactOf(o: DemoOrder) {
  return (o.contact ??= { whatsapp: '+9733' + String(3000000 + o.id * 7919).slice(0, 7), call: '', address: 'بيت ' + (o.id % 40) + ' · طريق ' + (3400 + (o.id % 9)) + ' · مجمع ' + (330 + (o.id % 7)), city: areaOf(o) });
}
function editContact(o: DemoOrder, p: Record<string, unknown>, en: boolean) {
  const digits = String(p.whatsapp ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '');
  if (digits.length < 8) throw new Error(en ? 'Enter a valid WhatsApp number with its country code, e.g. +973 3XXX XXXX.' : 'اكتب رقم واتساب صحيح مع رمز الدولة، مثل ‎+973 3XXX XXXX‎.');
  if (p.address !== undefined && !String(p.address).trim()) throw new Error(en ? 'Enter the street address.' : 'اكتب العنوان.');
  const c = contactOf(o);
  Object.assign(c, { whatsapp: '+' + (digits.length === 8 ? '973' + digits : digits), call: String(p.call ?? c.call), address: String(p.address ?? c.address).trim(), city: String(p.city ?? c.city).trim() });
  (o.notes ??= []).push('انعدّلت بيانات التوصيل من التطبيق (تجربة)');
}
// The day's delivery run, the store's rules: out for delivery today, plus cash still out.
function run(): Run {
  const rows = orders.filter((o) => !o.cancelled && o.kind !== 'pickup' && o.kind !== 'prepare_gcc' && (o.fulfilled || (o.kind === 'done' && o.tags.some((x) => x.label === 'طلع للتوصيل')) || (o.kind === 'cod' && !o.collected && !o.next)))
    .map((o) => {
      const c = contactOf(o);
      const cod = o.kind === 'cod' && !o.collected;
      const today = o.fulfilled || now - Date.parse(o.created ?? '') < 24 * H;
      return { id: o.id, number: o.number, name: o.name, area: c.city || 'المنامة', address: c.address, items: o.items, call: c.whatsapp.replace('+', ''), whatsapp: c.whatsapp.replace('+', ''), cod_due: cod ? o.due : null, gift: o.kind === 'gift', today: !!today, map: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.address + ', ' + c.city + ', البحرين') };
    })
    .filter((r) => r.today || r.cod_due !== null)
    .sort((a, b) => a.area.localeCompare(b.area) || Number(a.number) - Number(b.number));
  const cod = rows.filter((r) => r.cod_due !== null);
  return { date: new Date().toISOString().slice(0, 10), count: rows.length, cod_total: cod.reduce((sum, r) => sum + (r.cod_due ?? 0), 0), cod_count: cod.length, rows };
}

// Card payments that did not finish (invented); payment links and "handled" last for the session.
const unpaidRows: UnpaidRow[] = [
  { id: 1052, number: '1052', name: 'هيا م.', total: 17.0, items: '2× كوب المنامة', created: new Date(now - 3 * H).toISOString(), ago: 'قبل 3 ساعات', status: 'failed', status_label: 'فشل الدفع', payable: true, method: 'EazyPay card', reminder: 'انرسل تذكير تلقائي', opened: false, shared: null, whatsapp: '97333000052' },
  { id: 1051, number: '1051', name: 'بدر ع.', total: 15.5, items: '1× طقم كوبين · هدية', created: new Date(now - 20 * H).toISOString(), ago: 'قبل 20 ساعة', status: 'failed', status_label: 'فشل الدفع', payable: true, method: 'Benefit', reminder: 'ما انرسل تذكير تلقائي (واحد لكل عميل كل ٤٨ ساعة)', opened: true, shared: null, whatsapp: '97333000051' },
  { id: 1050, number: '1050', name: 'شوق ح.', total: 9.0, items: '1× كوب السيف', created: new Date(now - 50 * H).toISOString(), ago: 'قبل 2 أيام', status: 'cancelled', status_label: 'ملغي', payable: false, method: 'EazyPay card', reminder: '', opened: false, shared: null, whatsapp: '97333000050' },
];
const unpaidList = (): UnpaidList => ({ count: unpaidRows.length, value: unpaidRows.reduce((sum, r) => sum + r.total, 0), rows: unpaidRows });

function order(id: number): Order {
  const o = orders.find((x) => x.id === id) ?? orders[0];
  const items = o.lines.map(([p, q]) => ({ name: catalog[p][0], qty: q, total: catalog[p][1] * q, image: null, product_id: 100 + p, parts: p === 4 ? [{ name: 'كوب المنامة', qty: q }, { name: 'كوب المحرق', qty: q }] : [] }));
  const goods = o.lines.reduce((s, [p, q]) => s + (catalog[p][2] ?? 0) * q, 0);
  const missingGoods = o.lines.some(([p]) => catalog[p][2] === null);
  const shipping = o.kind === 'pickup' ? 0 : o.kind === 'prepare_gcc' ? 4 : 1.5;
  const gateway = o.kind === 'cod' ? 0 : Math.round(o.total * 0.0223 * 1000) / 1000;
  const courier = o.kind === 'pickup' ? 0 : 0.9;
  const known = (missingGoods ? 0 : goods) + 0.22 + gateway + courier;
  const done = o.kind === 'done' || !!o.fulfilled;
  const status = o.cancelled ? 'cancelled' : done ? 'completed' : 'processing';
  return {
    id: o.id, number: o.number, status, status_label: o.cancelled ? 'ملغي' : done ? 'Completed' : 'Processing', created: o.created, ago: o.ago, via_staff: false, test: false,
    pickup: o.kind === 'pickup', cod: o.kind === 'cod', preorder: o.kind === 'preorder' && !o.released, fulfilment: done ? 'out_delivery' : null, fulfilment_at: done ? o.created : null, tags: o.tags,
    customer: { name: o.name, initial: o.name.slice(0, 1), phone: '+973 3••• ••' + String(10 + (o.id % 89)), whatsapp: null, call: null, orders: (o.id % 3) + 1, position: (o.id % 3) + 1, spent: Math.round(o.total * ((o.id % 3) + 1) * 1000) / 1000 },
    address: { text: o.kind === 'pickup' ? '' : o.kind === 'prepare_gcc' ? 'حي النرجس · الرياض' : [contactOf(o).address, contactOf(o).city].filter(Boolean).join(' · '), country: o.kind === 'prepare_gcc' ? 'السعودية' : 'البحرين' },
    contact_edit: o.cancelled ? null : { fields: o.kind === 'gift' ? ['whatsapp', 'recipient'] : o.kind === 'pickup' ? ['whatsapp', 'call'] : ['whatsapp', 'call', 'address'], values: { ...contactOf(o), recipient: o.kind === 'gift' ? '+97336000047' : '' }, out_for_delivery: done && o.kind !== 'pickup' },
    gift: o.kind === 'gift' ? { name: 'لولوة', phone: '+973 3••• ••47', anonymous: false, message: 'كل عام وأنتِ بخير 🤍', waiting_address: true } : null,
    note: o.id % 5 === 0 ? 'لو سمحت التوصيل بعد الساعة 6' : '',
    items,
    totals: { discount: 0, fees: [], shipping, refunded: 0, total: o.total },
    payment: o.cancelled ? { label: 'ملغي', tone: 'red', method: '' } : o.kind === 'cod' && o.collected ? { label: 'الكاش انحصل', tone: 'green', method: 'الدفع عند الاستلام' } : o.kind === 'cod' ? { label: 'كاش عند التوصيل · ما انحصل للحين', tone: 'amber', method: 'الدفع عند الاستلام' } : { label: 'مدفوع · بطاقة', tone: 'green', method: 'بطاقة' },
    profit: { revenue: o.total, profit: Math.round((o.total - known) * 1000) / 1000, at_most: missingGoods, costs: { goods: { value: missingGoods ? null : goods, estimate: false }, packaging: { value: 0.22, estimate: false }, gateway: { value: gateway, estimate: o.kind !== 'cod' }, courier: { value: courier, estimate: o.kind !== 'pickup' } }, missing_products: missingGoods ? ['كوب السيف'] : [] },
    messages: [
      { event: 'confirmed', label: '«تم تأكيد طلبك»', status: 'وصلت وانقرت', tone: 'green', at: o.created },
      ...(done ? [{ event: 'out_delivery', label: '«طلبك بالطريق»', status: 'وصلت', tone: 'green' as const, at: o.created }] : []),
      ...(o.id === 1036 ? [{ event: 'gift', label: 'دعوة المستلم يضيف عنوانه', status: 'ما وصلت', tone: 'red' as const, at: o.created }] : []),
    ],
    log: [...(o.notes ?? []).map((text) => ({ at: null, to_customer: false, text })).reverse(), { at: o.created, to_customer: false, text: 'Payment verified with Tap. Order moved to processing.' }],
    next: o.next ? [o.next] : [],
    cod_due: o.kind === 'cod' && !o.collected && !o.cancelled,
    no_action: o.next ? null : o.cancelled ? 'ما في خطوات ثانية لهالطلب.' : done ? 'خلص. طلع للتوصيل.' : o.kind === 'gift' ? 'ينتظر عنوان مستلم الهدية.' : o.kind === 'preorder' ? 'ينتظر منتج الطلب المسبق.' : null,
    actions: actions(o),
  };
}

// The same choices the store offers (see koub_app_order_actions), with its Arabic wording.
const labels: Record<ActionKey, string> = { out_delivery: 'طلع للتوصيل', ready_pickup: 'جاهز للاستلام', release_preorder: 'المنتج وصل · حوّله للتحضير', cod_collected: 'تم تحصيل المبلغ', cancel: 'إلغاء الطلب', undo_fulfilment: 'تراجع عن «طلع للتوصيل»', undo_cod: 'تراجع عن «تم تحصيل المبلغ»' };
const handedOver = (o: DemoOrder) => o.kind === 'done' || !!o.fulfilled;
function actions(o: DemoOrder): OrderAction[] {
  if (o.cancelled) return [];
  const out: OrderAction[] = [];
  if (o.next) out.push({ key: o.next, label: labels[o.next], confirm: 'تحدّث طلب #' + o.number + ' إلى «' + labels[o.next] + '»؟ العملاء المؤهلين يوصلهم واتساب.', tone: 'primary' });
  if (o.kind === 'preorder' && !o.released) out.push({ key: 'release_preorder', label: labels.release_preorder, confirm: 'كل المنتجات موجودة للتحضير؟ ما بينرسل للعميل رسالة.', tone: 'primary' });
  if (o.kind === 'cod' && !o.collected) out.push({ key: 'cod_collected', label: labels.cod_collected, confirm: 'تأكد إن KOUB استلم كامل مبلغ الكاش من طلب #' + o.number + '؟', tone: 'primary' });
  const paid = o.kind === 'cod' ? !!o.collected : true;
  // Open orders, and cash orders already handed over but not yet paid (as the dashboard's order card).
  const open = o.kind !== 'done' && !o.fulfilled;
  if (handedOver(o)) out.push({ key: 'undo_fulfilment', label: o.kind === 'pickup' ? 'تراجع عن «جاهز للاستلام»' : labels.undo_fulfilment, confirm: 'ترجّع طلب #' + o.number + ' للتحضير؟ لو انرسل واتساب للعميل، ما ينسحب.', tone: 'undo' });
  if (o.kind === 'cod' && o.collected) out.push({ key: 'undo_cod', label: labels.undo_cod, confirm: 'تسجّل إن كاش طلب #' + o.number + ' ما انحصل للحين؟', tone: 'undo' });
  if (open || (o.kind === 'cod' && !o.collected)) out.push({ key: 'cancel', label: labels.cancel, confirm: paid ? 'تلغي طلب #' + o.number + ' بدون ما ترجع المبلغ؟ الاسترجاع يكون من صفحة الطلب.' : 'تلغي طلب #' + o.number + '؟ ما في مبلغ مدفوع.', tone: 'danger' });
  return out;
}

// ---- Shop till: sells the demo catalog (simple items with stock), keeps today's sales in memory.
const posSales: PosReceipt[] = [];
const methodLabel = (m: PosMethod, en: boolean) => ({ cash: en ? 'Cash' : 'كاش', card: en ? 'Card machine' : 'مكينة البطاقة', benefit: en ? 'BenefitPay' : 'بنفت باي' })[m];
function posCatalog(en: boolean): PosCatalog {
  return {
    products: catalog.map(([name, price, , stock], i) => ({ id: 100 + i, name, sku: 'KB-' + (100 + i), price, stock, image: null })).filter((p, i) => i !== 4),
    methods: (['cash', 'card', 'benefit'] as PosMethod[]).map((key) => ({ key, label: methodLabel(key, en) })),
  };
}
function posSale(p: Record<string, unknown>, en: boolean): PosReceipt {
  const ref = String(p.ref);
  const done = posSales.find((s) => (s as PosReceipt & { ref?: string }).ref === ref);
  if (done) return { ...done, repeat: true };
  const lines = ((p.lines as { id: number; qty: number }[]) ?? []).map((l) => ({ row: catalog[l.id - 100], ...l }));
  if (!lines.length) throw new Error(en ? 'The sale is empty.' : 'البيع فاضي.');
  for (const l of lines) if (l.row && l.row[3] !== null && l.row[3] < l.qty) throw new Error(en ? l.row[0] + ': the store shows ' + l.row[3] + ' in stock. Fix the stock count first.' : l.row[0] + ': المخزون في النظام ' + l.row[3] + '. عدّل المخزون أول.');
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  const sub = r3(lines.reduce((s, l) => s + l.row[1] * l.qty, 0));
  const value = Number(p.discount) || 0;
  const discount = r3(Math.min(sub, p.discount_type === 'percent' ? (sub * Math.min(100, value)) / 100 : value));
  const total = r3(sub - discount);
  const method = p.method as PosMethod;
  const given = method === 'cash' && p.cash_given != null ? Number(p.cash_given) : null;
  if (given !== null && given < total) throw new Error(en ? 'The cash given is less than the total.' : 'الكاش المستلم أقل من المجموع.');
  for (const l of lines) if (l.row[3] !== null) l.row[3] -= l.qty;
  const phone = String(p.phone ?? '').replace(/\D+/g, '');
  const sale: PosReceipt & { ref: string } = {
    ref, id: 900 + posSales.length, number: String(2400 + posSales.length), status: 'completed', date: new Date().toISOString(),
    lines: lines.map((l) => ({ name: l.row[0], qty: l.qty, total: r3(l.row[1] * l.qty) })), discount, total, method, method_label: methodLabel(method, en),
    cash_given: given, change: given === null ? null : r3(given - total), name: String(p.name ?? ''), whatsapp: phone ? (phone.length === 8 ? '973' + phone : phone) : null, voidable: true,
  };
  posSales.unshift(sale);
  return sale;
}
function posToday(): PosToday {
  const by = { cash: 0, card: 0, benefit: 0 } as Record<PosMethod, number>;
  const live = posSales.filter((s) => s.status === 'completed');
  live.forEach((s) => (by[s.method] = Math.round((by[s.method] + s.total) * 1000) / 1000));
  return { count: live.length, total: Math.round(live.reduce((a, s) => a + s.total, 0) * 1000) / 1000, by_method: by,
    sales: posSales.map((s) => ({ id: s.id, number: s.number, total: s.total, method: s.method, method_label: s.method_label, date: s.date, void: s.status === 'cancelled', items: s.lines.reduce((a, l) => a + l.qty, 0) })) };
}
function posVoid(id: number, en: boolean): PosReceipt {
  const s = posSales.find((x) => x.id === id);
  if (!s || s.status !== 'completed') throw new Error(en ? 'Only a shop sale from today can be cancelled here.' : 'بس بيع المحل من اليوم ينلغى من هني.');
  s.status = 'cancelled'; s.voidable = false;
  for (const l of s.lines) { const row = catalog.find((c) => c[0] === l.name); if (row && row[3] !== null) row[3] += l.qty; }
  return s;
}

export async function demoPost<T>(path: string, p: Record<string, unknown>): Promise<T> {
  await new Promise((r) => setTimeout(r, 500));
  if (path === '/pos/sale') return posSale(p, p.lang === 'en') as T;
  if (/^\/pos\/sale\/\d+\/void$/.test(path)) return posVoid(Number(path.split('/')[3]), p.lang === 'en') as T;
  if (path === '/orders/bulk') { const r = bulk((p.ids as number[]) ?? [], p.action as BulkKey); return (p.lang === 'en' ? english(r) : r) as T; }
  if (path === '/preorders/release') { const r = releasePreorders(String(p.key), (p.ids as number[]) ?? []); return (p.lang === 'en' ? english(r) : r) as T; }
  if (/^\/products\/\d+\/stock$/.test(path)) return stockChange(Number(path.split('/')[2]), Number(p.delta), p.lang === 'en') as T;
  if (/^\/orders\/\d+\/(payment-link|unpaid-dismiss)$/.test(path)) {
    const [, , id, what] = path.split('/');
    const i = unpaidRows.findIndex((r) => r.id === Number(id));
    if (i < 0) throw new Error(p.lang === 'en' ? 'Order not found' : 'الطلب مو موجود');
    if (what === 'unpaid-dismiss') { unpaidRows.splice(i, 1); return { ok: true } as T; }
    const r = unpaidRows[i];
    if (!r.payable) throw new Error(p.lang === 'en' ? 'This order can no longer be paid from a link.' : 'هالطلب ما عاد ينفع يندفع من رابط.');
    r.shared = new Date().toISOString();
    const url = 'https://koubbh.com/continue/demo' + r.id + '/';
    return { url, text: 'هلا ' + r.name.split(' ')[0] + '، معك KOUB. دفع طلبك #' + r.number + ' ما اكتمل. تقدر تكمل الدفع من هالرابط:\n' + url, whatsapp: r.whatsapp } as T;
  }
  if (/^\/orders\/\d+\/contact$/.test(path)) {
    const o = orders.find((x) => x.id === Number(path.split('/')[2]));
    if (!o) throw new Error(p.lang === 'en' ? 'Order not found' : 'الطلب مو موجود');
    editContact(o, p, p.lang === 'en');
    return demo<T>('/orders/' + o.id, { lang: p.lang as string | undefined });
  }
  const [, , id, what] = path.split('/');
  const o = orders.find((x) => x.id === Number(id));
  if (!o || (what !== 'action' && what !== 'note')) throw new Error(p.lang === 'en' ? 'Not available in demo mode.' : 'مو متاح في وضع التجربة.');
  o.notes ??= [];
  if (what === 'note') o.notes.push(String(p.note ?? '').trim().slice(0, 500));
  else if (!apply(o, p.action as ActionKey)) throw new Error(p.lang === 'en' ? 'This step isn’t available for this order.' : 'هالخطوة مو متاحة لهالطلب.');
  return demo<T>('/orders/' + o.id, { lang: p.lang as string | undefined });
}

function apply(o: DemoOrder, key: ActionKey): boolean {
  if (!actions(o).some((a) => a.key === key)) return false;
  const done = ['طلع للتوصيل', 'جاهز للاستلام'];
  if (key === 'out_delivery' || key === 'ready_pickup') { o.fulfilled = true; o.next = null; o.tags = [...o.tags, { label: labels[key], tone: 'green' }]; }
  if (key === 'undo_fulfilment') { o.fulfilled = false; if (o.kind === 'done') o.kind = 'prepare_bh'; o.next = o.kind === 'pickup' ? 'ready_pickup' : 'out_delivery'; o.tags = o.tags.filter((t) => !done.includes(t.label)); }
  if (key === 'release_preorder') { o.released = true; o.next = 'out_delivery'; o.tags = o.tags.filter((t) => t.label !== 'طلب مسبق'); }
  if (key === 'cod_collected') o.collected = true;
  if (key === 'undo_cod') o.collected = false;
  if (key === 'cancel') { o.cancelled = true; o.next = null; }
  (o.notes ??= []).push('KOUB: ' + key + ' (demo)');
  return true;
}

// The same rules as the store's bulk bar: cash only for orders already handed over; every skip has a reason.
function bulk(ids: number[], key: BulkKey): BulkResult {
  const out: BulkResult = { action: key, updated: 0, skipped: [] };
  for (const id of [...new Set(ids)].slice(0, 20)) {
    const o = orders.find((x) => x.id === id);
    if (!o) continue;
    const ok = apply(o, key);
    if (ok) out.updated += 1;
    else out.skipped.push({ id, number: o.number, reason: key === 'cod_collected' && !o.collected && !handedOver(o) ? 'ما تسلّم للحين. أكد الكاش من صفحة الطلب.' : key === 'out_delivery' && o.kind === 'pickup' ? 'طلب استلام، اضغط «جاهز للاستلام».' : 'هالخطوة مو متاحة لهالطلب.' });
  }
  return out;
}
// A plain demo slip; the real one comes from the store's dashboard template.
function slipsHtml(ids: number[]): string {
  const sheets = ids.map((id) => orders.find((o) => o.id === id)).filter(Boolean).map((o) => '<section class="sheet"><h1>KOUB</h1><h2>#' + o!.number + '</h2><p>' + o!.name + '</p><p>' + o!.items + '</p><p><b>' + o!.total.toFixed(3) + ' BHD</b></p><p class="demo">بيانات تجريبية · Demo data</p></section>').join('');
  return '<!doctype html><html><head><meta charset="utf-8"><style>body{font:16px Arial,sans-serif}.sheet{padding:24px;border-bottom:1px dashed #999;break-after:page}.demo{color:#a60}</style></head><body>' + sheets + '</body></html>';
}
function bulkChoices(view: string, prepare: string): BulkAction[] {
  // Every step; the app shows the ones the ticked rows allow. Cancel only on All, like the dashboard.
  const keys: BulkKey[] = ['out_delivery', 'ready_pickup', 'release_preorder', 'cod_collected'];
  if (view === 'all') keys.push('cancel');
  return keys.map((k) => ({ key: k, label: k === 'cancel' ? 'إلغاء الطلبات' : labels[k], confirm: k === 'cancel' ? 'تلغي {n} طلبات محددة بدون ما ترجع المبلغ؟' : k === 'cod_collected' ? 'تأكد إن KOUB استلم كامل مبلغ الكاش من {n} طلبات محددة؟' : k === 'release_preorder' ? 'كل المنتجات موجودة للتحضير؟ ما بينرسل للعميل رسالة.' : 'تحدّث {n} طلبات محددة إلى «' + labels[k] + '»؟ العملاء المؤهلين يوصلهم واتساب.', tone: k === 'cancel' ? 'danger' : 'primary' }));
}

// Pre-orders by item, the store's rules: an order waiting for one item only can be released from that item.
const preKeys = (o: DemoOrder) => [...new Set(o.lines.filter(([i]) => i === 5 || i === 7).map(([i]) => 'p' + (100 + i)))];
function preorderGroups(): PreorderGroup[] {
  const open = orders.filter((o) => o.kind === 'preorder' && !o.released && !o.cancelled);
  const keys = [...new Set(open.flatMap(preKeys))];
  return keys.map((key) => {
    const i = Number(key.slice(1)) - 100;
    const mine = open.filter((o) => preKeys(o).includes(key));
    const ready = mine.filter((o) => preKeys(o).length === 1).map((o) => o.id);
    const qty = mine.reduce((sum, o) => sum + o.lines.filter(([x]) => x === i).reduce((a, [, q]) => a + q, 0), 0);
    const oldest = mine.reduce((a, o) => (o.created && (!a || o.created < a) ? o.created : a), null as string | null);
    return { key, name: catalog[i][0], orders: mine.length, qty, ready: ready.length, ready_ids: ready, mixed: mine.length - ready.length, oldest, ago: mine.find((o) => o.created === oldest)?.ago ?? '', stock: catalog[i][3], product_id: 100 + i, image: null, confirm: 'وصل مخزون ' + catalog[i][0] + '؟ ' + ready.length + ' طلب ينتقل للتحضير. ما ينرسل شي للعملاء.' };
  }).sort((a, b) => b.orders - a.orders);
}
function releasePreorders(key: string, ids: number[]): ReleaseResult {
  const ready = preorderGroups().find((g) => g.key === key)?.ready_ids ?? [];
  const out: ReleaseResult = { updated: 0, skipped: [] };
  for (const id of ids) {
    const o = orders.find((x) => x.id === id);
    if (o && ready.includes(id) && apply(o, 'release_preorder')) out.updated += 1;
    else out.skipped.push({ id, number: String(id), reason: o && !o.released ? 'ينتظر منتج ثاني كمان. جهّزه من صفحة الطلب.' : 'ما عاد ينتظر.' });
  }
  return out;
}
function stockChange(id: number, delta: number, en: boolean): StockResult {
  const row = catalog[id - 100];
  if (!row || row[3] === null) throw new Error(en ? 'Use the product screen for this product.' : 'عدّل هالمنتج من صفحته.');
  if (row[3] + delta < 0) throw new Error(en ? 'Only ' + row[3] + ' in stock.' : 'المخزون ' + row[3] + ' بس.');
  row[3] += delta;
  const stock = row[3];
  return { qty: stock, revision: 'demo-' + id + '-' + stock, state: stock === 0 ? 'out' : stock <= 2 ? 'low' : 'ok' };
}

function products(filter: string, s: string): ProductList {
  const all: Product[] = catalog.map(([name, price, cost, stock], i) => {
    const state = i === 5 ? 'ok' : stock === 0 ? 'out' : stock !== null && stock <= 2 ? 'low' : 'ok';
    return { id: 100 + i, name, sku: 'KB-' + (100 + i), price, cost, profit: cost === null ? null : Math.round((price - cost) * 1000) / 1000, state, preorder: i === 5, stock, waiting_alerts: state === 'out' ? 3 + i : 0, image: null, quick: stock !== null, revision: 'demo-' + (100 + i) + '-' + stock };
  });
  const keys = (p: Product) => ['all', p.state === 'draft' ? 'draft' : p.preorder ? 'preorder' : p.state === 'low' || p.state === 'out' ? p.state : ''];
  const c = { all: 0, low: 0, out: 0, preorder: 0, draft: 0 } as ProductList['counts'];
  all.forEach((p) => keys(p).forEach((k) => k && (c[k as keyof typeof c] += 1)));
  const rows = all.filter((p) => keys(p).includes(filter) && (!s || p.name.includes(s)));
  return { filter: filter as ProductList['filter'], total: rows.length, page: 1, pages: 1, counts: c, products: rows };
}

// English demo: the same invented store, translated phrase by phrase (longest first).
const EN: [string | RegExp, string][] = [
  // Whole confirmation sentences first; the order labels inside them are translated by the entries below.
  [/^تحدّث طلب #(\d+) إلى «(.+)»؟ العملاء المؤهلين يوصلهم واتساب\.$/, 'Update order #$1 to “$2”? Eligible customers get a WhatsApp update.'],
  [/^تأكد إن KOUB استلم كامل مبلغ الكاش من طلب #(\d+)؟$/, 'Confirm KOUB received the full cash amount for order #$1?'],
  [/^تلغي طلب #(\d+) بدون ما ترجع المبلغ؟ الاسترجاع يكون من صفحة الطلب\.$/, 'Cancel order #$1 WITHOUT refunding the payment? Refunds are done from the order screen.'],
  [/^تلغي طلب #(\d+)؟ ما في مبلغ مدفوع\.$/, 'Cancel order #$1? No payment was taken.'],
  [/^ترجّع طلب #(\d+) للتحضير؟ لو انرسل واتساب للعميل، ما ينسحب\.$/, 'Move order #$1 back to To prepare? A WhatsApp update already sent to the customer is not recalled.'],
  [/^تسجّل إن كاش طلب #(\d+) ما انحصل للحين؟$/, 'Mark the cash for order #$1 as not received yet?'],
  [/^تحدّث \{n\} طلبات محددة إلى «(.+)»؟ العملاء المؤهلين يوصلهم واتساب\.$/, 'Update {n} selected orders to “$1”? Eligible customers get a WhatsApp update.'],
  ['تأكد إن KOUB استلم كامل مبلغ الكاش من {n} طلبات محددة؟', 'Confirm KOUB received the full cash amount for {n} selected orders?'], ['تلغي {n} طلبات محددة بدون ما ترجع المبلغ؟', 'Cancel {n} selected orders WITHOUT refunding the payment?'],
  ['ما تسلّم للحين. أكد الكاش من صفحة الطلب.', 'not handed over yet. Confirm its cash from the order screen.'], ['هالخطوة مو متاحة لهالطلب.', 'this step isn’t available for this order.'],
  ['طلب استلام، اضغط «جاهز للاستلام».', 'pickup order. Use “Ready for pickup”.'], ['تراجع عن «', 'Undo “'], ['إلغاء الطلبات', 'Cancel orders'],
  ['كاش عند التوصيل · ما انحصل للحين', 'Cash on delivery · not collected yet'], ['هدية · تنتظر العنوان', 'Gift · address needed'], ['السعودية · شحن', 'Saudi Arabia · Shipping'],
  ['دعوة المستلم يضيف عنوانه', 'Gift address invitation'], ['ينتظر عنوان مستلم الهدية.', 'Waiting for the gift recipient’s address.'], ['ينتظر منتج الطلب المسبق.', 'Waiting for the pre-order product.'],
  ['خلص. طلع للتوصيل.', 'Done. Out for delivery.'], ['لو سمحت التوصيل بعد الساعة 6', 'Please deliver after 6'], ['كل عام وأنتِ بخير', 'Happy birthday'],
  ['بيت 12 · طريق 3401 · مجمع 334 · المنامة', 'House 12 · Road 3401 · Block 334 · Manama'], ['حي النرجس · الرياض', 'Al Narjis · Riyadh'],
  ['«تم تأكيد طلبك»', '“Order confirmed”'], ['«طلبك بالطريق»', '“Out for delivery”'], ['وصلت وانقرت', 'delivered and read'], ['ما وصلت', 'not delivered'],
  ['تكلفة المنتج', 'product cost'], ['الدفع عند الاستلام', 'Cash on delivery'], ['كاش عند التوصيل', 'Cash on delivery'], ['مدفوع · بطاقة', 'Paid · Card'],
  ['طقم كوبين · هدية', 'Two-mug gift set'], ['كوب زجاج شفاف', 'Clear glass mug'], ['كوب المنامة', 'Manama mug'], ['كوب المحرق', 'Muharraq mug'], ['كوب الرفاع', 'Riffa mug'],
  ['كوب السيف', 'Seef mug'], ['كوب عراد', 'Arad mug'], ['كوب جدحفص', 'Jidhafs mug'], ['طلع للتوصيل', 'Out for delivery'], ['جاهز للاستلام', 'Ready for pickup'],
  ['المنتج وصل · حوّله للتحضير', 'Stock arrived · move to prepare'], ['تم تحصيل المبلغ', 'Cash collected'], ['إلغاء الطلب', 'Cancel order'], ['الكاش انحصل', 'Cash collected'],
  ['ما في خطوات ثانية لهالطلب.', 'No further steps for this order.'], ['كل المنتجات موجودة للتحضير؟ ما بينرسل للعميل رسالة.', 'Are all items available to prepare? No customer message is sent.'], ['ملغي', 'Cancelled'],
  ['طلب مسبق', 'Pre-order'], ['توصيل', 'Delivery'], ['استلام', 'Pickup'], ['مدفوع', 'Paid'], ['بطاقة', 'Card'], ['وصلت', 'delivered'],
  ['المنامة', 'Manama'], ['المحرق', 'Muharraq'], ['الرفاع', 'Riffa'], ['عيسى', 'Isa Town'], ['البحرين', 'Bahrain'], ['السعودية', 'Saudi Arabia'], ['الكويت', 'Kuwait'],
  ['سارة م.', 'Sara M.'], ['خالد ع.', 'Khalid A.'], ['نورة ي.', 'Noora Y.'], ['أحمد س.', 'Ahmed S.'], ['ريم ح.', 'Reem H.'], ['يوسف ب.', 'Yusuf B.'], ['دانة ف.', 'Dana F.'],
  ['عبدالله ر.', 'Abdulla R.'], ['مريم ك.', 'Maryam K.'], ['حمد ج.', 'Hamad J.'], ['فاطمة ن.', 'Fatima N.'], ['علي ط.', 'Ali T.'], ['لولوة', 'Lulwa'], ['مساحة KOUB', 'KOUB workspace'],
  ['يناير', 'January'], ['فبراير', 'February'], ['مارس', 'March'], ['أبريل', 'April'], ['مايو', 'May'], ['يونيو', 'June'], ['يوليو', 'July'], ['أغسطس', 'August'], ['سبتمبر', 'September'], ['أكتوبر', 'October'], ['نوفمبر', 'November'], ['ديسمبر', 'December'],
  [/^قبل (\d+) د$/, '$1 min ago'], [/^قبل ساعة$/, '1h ago'], [/^قبل ساعتين$/, '2h ago'], [/^قبل (\d+) ساعات$/, '$1h ago'], [/^قبل (\d+) أيام$/, '$1 days ago'], [/^أمس$/, 'Yesterday'], ['، ', ', '], ['»', '”'], ['«', '“'],
];
function english<T>(v: T): T {
  if (typeof v === 'string') {
    let s: string = v;
    for (const [from, to] of EN) s = typeof from === 'string' ? s.split(from).join(to) : s.replace(from, to);
    return s as T;
  }
  if (Array.isArray(v)) return v.map(english) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'initial' ? x : english(x)])) as T;
  return v;
}

export async function demo<T>(path: string, p: Record<string, string | number | undefined>): Promise<T> {
  if (p.lang !== 'en') return demoAr<T>(path, p);
  // Search the English names, so an English query finds English rows.
  const q = String(p.s ?? '').toLowerCase();
  const en = english(await demoAr<Record<string, unknown>>(path, { ...p, s: undefined }));
  if (path === '/me') Object.assign(en, { lang: 'en', dir: 'ltr' });
  if (path.startsWith('/orders/')) { const c = en.customer as { name: string; initial: string }; c.initial = c.name.slice(0, 1); }
  for (const key of ['orders', 'products'] as const) {
    if (q && Array.isArray(en[key])) {
      const rows = (en[key] as { name: string; number?: string }[]).filter((r) => r.name.toLowerCase().includes(q) || r.number?.includes(q));
      Object.assign(en, { [key]: rows, total: rows.length });
    }
  }
  return en as T;
}

async function demoAr<T>(path: string, p: Record<string, string | number | undefined>): Promise<T> {
  await new Promise((r) => setTimeout(r, 350));
  const me: Me = { api: 'demo', name: 'KOUB', initial: 'K', lang: 'ar', dir: 'rtl', currency: 'BHD', site: 'KOUB', whatsapp_automation: true };
  if (path === '/me') return me as T;
  if (path === '/home') return home(String(p.period ?? 'today')) as T;
  if (path === '/numbers') return numbers(String(p.period ?? 'today')) as T;
  if (path === '/products') return products(String(p.filter ?? 'all'), String(p.s ?? '')) as T;
  if (path === '/preorders') return { groups: preorderGroups() } as T;
  if (path === '/run') return run() as T;
  if (path === '/unpaid') return unpaidList() as T;
  if (path === '/pos/catalog') return posCatalog(false) as T;
  if (path === '/pos/today') return posToday() as T;
  if (path === '/orders/slips') return { count: 1, html: slipsHtml(String(p.ids ?? '').split(',').map(Number)) } as T;
  if (path.startsWith('/orders/')) return order(Number(path.split('/')[2])) as T;
  if (path === '/orders') {
    const view = String(p.view ?? 'active'), prepare = String(p.prepare ?? 'all'), q = String(p.s ?? '');
    const rows = orders.filter((o) => inView(o, view, prepare) && (!q || o.number.includes(q) || o.name.includes(q)));
    return { view, prepare, total: rows.length, page: 1, pages: 1, counts: counts(), orders: rows.map(strip), bulk: bulkChoices(view, prepare), print: view === 'all' || (view === 'active' && prepare !== 'pickup') } as T;
  }
  throw new Error('Unknown demo route ' + path);
}
