// Order progress for the three-step strip: ordered → preparing → out for delivery / ready for pickup.
import type { Order } from './types';

const HANDED_OVER = ['out_delivery', 'ready_pickup', 'delivered', 'collected'];

// done = how many steps are complete (0–3); current = the step in progress (0 when none).
// A completed order is finished even without a KOUB fulfilment record (staff completed it in WooCommerce, or it was imported).
export function orderProgress(o: Pick<Order, 'status' | 'fulfilment'>): { done: number; current: number } {
  const finished = o.status === 'completed' || HANDED_OVER.includes(o.fulfilment ?? '');
  if (finished) return { done: 3, current: 0 };
  const done = o.status === 'pending' ? 0 : 1;
  return { done, current: done + 1 };
}
