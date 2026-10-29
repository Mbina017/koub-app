// The new total of an order being changed (API 1.9), as the store works it out: the order's total without its items
// (delivery, fees), plus each line at its price (the price paid for lines already in the order, the store price for new ones).
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function itemsTotal(orderTotal: number, before: { unit: number; qty: number }[], now: { unit: number; qty: number }[]) {
  const base = r3(orderTotal - before.reduce((s, l) => s + l.unit * l.qty, 0));
  const total = r3(base + now.reduce((s, l) => s + l.unit * l.qty, 0));
  return { total, diff: r3(total - orderTotal) };
}
