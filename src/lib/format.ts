// Number formatting, ported from koub_ui_num() so the app reads exactly like the dashboard.
// Numbers stay Western. Money keeps up to 3 decimals (fils) and at least one.
import type { Lang } from './types';

const LRI = '⁦';
const PDI = '⁩';
const MINUS = '−';

function group(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function num(value: number, decimals?: number): string {
  let v = Math.round(Number(value) * 1000) / 1000;
  if (Math.abs(v) < 0.0005) v = 0;
  if (decimals !== undefined) {
    const f = 10 ** decimals;
    v = Math.round(v * f) / f;
    if (v === 0) v = 0;
    const [i, d] = Math.abs(v).toFixed(decimals).split('.');
    const s = group(i) + (d ? '.' + d : '');
    // Negative figures are isolated left-to-right so Arabic text never moves the minus sign.
    return v < 0 ? LRI + MINUS + s + PDI : s;
  }
  let s = Math.abs(v).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  if (!s.includes('.')) s += '.0';
  const [i, d] = s.split('.');
  s = group(i) + '.' + d;
  return v < 0 ? LRI + MINUS + s + PDI : s;
}

export const currency = (lang: Lang) => (lang === 'en' ? 'BHD' : 'د.ب');
export function money(value: number, lang: Lang): string {
  return lang === 'en' ? 'BHD ' + num(value) : num(value) + ' د.ب';
}

export function pct(change: number | null): { text: string; up: boolean } | null {
  if (change === null || change === undefined) return null;
  return { text: (change >= 0 ? '↑ ' : '↓ ') + Math.abs(change) + '%', up: change >= 0 };
}

const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const daysAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Y-m-d from the API, read as a calendar day (no time zone shift).
export function dayMonth(ymd: string, lang: Lang): string {
  const [, m, d] = ymd.split('-').map(Number);
  return d + ' ' + (lang === 'en' ? monthsEn : monthsAr)[m - 1];
}
export function shortDay(ymd: string, lang: Lang): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return (lang === 'en' ? daysEn : daysAr)[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}
export function today(date: Date, lang: Lang): string {
  return (lang === 'en' ? daysEn : daysAr)[date.getDay()] + ' ' + date.getDate() + ' ' + (lang === 'en' ? monthsEn : monthsAr)[date.getMonth()];
}
export function hourLabel(x: string, lang: Lang): string {
  const h = parseInt(x, 10);
  const h12 = h % 12 || 12;
  return lang === 'en' ? h12 + (h < 12 ? 'a' : 'p') : h12 + (h < 12 ? 'ص' : 'م');
}
