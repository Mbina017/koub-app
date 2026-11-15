// Shopping list (pos-stock.tsx): what to buy so each ingredient lasts the chosen number of days at last week's pace,
// and still sits above its low mark at the end. Only ingredients that were used last week or are already low.
import type { Ingredient } from './types';

export type ShoppingRow = { id: string; name: string; unit: Ingredient['unit']; buy: number; cost: number | null };

// Pieces are bought whole; grams and millilitres to the next 10.
const roundUp = (v: number, unit: Ingredient['unit']) => (unit === 'pc' ? Math.ceil(v - 1e-9) : Math.ceil(v / 10 - 1e-9) * 10);

export function shoppingList(ings: Ingredient[], days: number): ShoppingRow[] {
  const rows: ShoppingRow[] = [];
  for (const x of ings) {
    if (!(x.per_day > 0) && !x.is_low) continue;
    const need = x.per_day * days + Math.max(0, x.low) - Math.max(0, x.stock);
    if (need <= 0) continue;
    const buy = roundUp(need, x.unit);
    rows.push({ id: x.id, name: x.name, unit: x.unit, buy, cost: x.cost > 0 ? Math.round(buy * x.cost * 1000) / 1000 : null });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
