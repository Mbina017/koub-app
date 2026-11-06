// KOUB loyalty cards at the till (API 1.11). These mirror the store's rules in koub-site loyalty.php and app-pos.php,
// so the total the till shows is the total the store charges.
import type { Lang, LoyaltyCard } from './types';

const CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;

// A scanned QR ("KOUBK7Q49XM2") or a typed code ("k7q4-9xm2"): the 8-character code, or '' if it is not one.
export function cleanCode(raw: string): string {
  let c = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.startsWith('KOUB') && c.length === 12) c = c.slice(4);
  return CODE.test(c) ? c : '';
}

export type TillLine = { price: number; qty: number; group?: 'drinks' | 'products' };

// With a free drink, the dearest drink in the sale is free and earns no stamp.
export function freeDrink(lines: TillLine[], redeem: boolean): number {
  if (!redeem) return 0;
  const drinks = lines.filter((l) => l.group === 'drinks' && l.qty > 0);
  return drinks.length ? Math.round(Math.max(...drinks.map((l) => l.price)) * 1000) / 1000 : 0;
}

// Stamps this sale adds: paid drinks, at most `cap` a sale.
export function stampsFor(lines: TillLine[], free: number, cap: number): number {
  const drinks = lines.reduce((n, l) => n + (l.group === 'drinks' ? l.qty : 0), 0);
  return Math.max(0, Math.min(cap, drinks - (free > 0 ? 1 : 0)));
}

// What the card looks like after this sale, before it is saved: for the till's preview.
export function after(card: { stamps: number; rewards: number; of: number }, add: number, redeemed: boolean) {
  let stamps = card.stamps + add, rewards = card.rewards - (redeemed ? 1 : 0), earned = 0;
  while (stamps >= card.of) { stamps -= card.of; rewards++; earned++; }
  return { stamps, rewards, earned };
}

// The message staff send from their own WhatsApp to a regular who stopped coming, in the card's language.
export function awayMessage(card: Pick<LoyaltyCard, 'name' | 'need' | 'rewards' | 'lang'>): string {
  const en = card.lang === 'en';
  if (card.rewards > 0) return en
    ? `Hi ${card.name}, we miss you at KOUB ☕ Your free drink is waiting on your card.`
    : `هلا ${card.name}، اشتقنا لك في KOUB ☕ مشروبك المجاني ينتظرك في بطاقتك.`;
  return en
    ? `Hi ${card.name}, we miss you at KOUB ☕ ${card.need} more ${card.need === 1 ? 'drink' : 'drinks'} and the next one is on us.`
    : `هلا ${card.name}، اشتقنا لك في KOUB ☕ باقي لك ${card.need} ${card.need === 1 ? 'مشروب' : 'مشروبات'} والمشروب اللي بعدها علينا.`;
}

// Resending the card to a customer who lost the link.
export function cardLinkMessage(card: Pick<LoyaltyCard, 'name' | 'card_url' | 'lang'>): string {
  return card.lang === 'en'
    ? `Hi ${card.name}, here is your KOUB card ☕ ${card.card_url}`
    : `هلا ${card.name}، هذي بطاقة KOUB حقتك ☕ ${card.card_url}`;
}

export function waLink(digits: string, text: string): string {
  return 'https://wa.me/' + digits.replace(/\D/g, '') + '?text=' + encodeURIComponent(text);
}

export const cardLang = (l: string | undefined): Lang => (l === 'en' ? 'en' : 'ar');
