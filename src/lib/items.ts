// The money rule for changing an order's items (API 1.9), the same as the store's koub_items_money:
// lines already in the order count at their exact total (scaled when the quantity changes), new ones at the store price.
// Less to pay first takes back any difference given free before, then the rest is owed back to the customer.
// More to pay first uses up anything owed back, then the rest is paid (by a method staff choose) or given free.
// Cash on delivery not collected yet: the courier just collects the new total.
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export type MoneyLine = { qty: number; total?: number; was?: number; unit: number };
// A line's value now: its own total if it was in the order, scaled to the fil like the store, else unit × qty.
export const lineValue = (l: MoneyLine) => l.total === undefined || l.was === undefined ? r3(l.unit * l.qty) : l.qty === l.was ? r3(l.total) : r3((l.total * l.qty) / Math.max(1, l.was));

export function itemsMoney(o: { total: number; owed: number; free: number; cod: boolean }, before: { total: number }[], now: MoneyLine[], free: boolean) {
  const goods = r3(now.reduce((s, l) => s + lineValue(l), 0) - before.reduce((s, l) => s + l.total, 0));
  const r = { goods, total: r3(o.total + goods), freeBack: 0, owedAdd: 0, owedUsed: 0, pay: 0, freeAdd: 0, needsMethod: false };
  if (o.cod || !goods) return r;
  if (goods < 0) { r.freeBack = r3(Math.min(o.free, -goods)); r.owedAdd = r3(-goods - r.freeBack); r.total = r3(o.total + goods + r.freeBack); return r; }
  r.owedUsed = r3(Math.min(o.owed, goods));
  const rest = r3(goods - r.owedUsed);
  if (rest > 0) { r.needsMethod = true; if (free) { r.freeAdd = rest; r.total = r3(o.total + goods - rest); } else r.pay = rest; }
  return r;
}
