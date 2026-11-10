// The shop receipt: a till-roll page (80 mm wide) built on the phone from the sale the store returned,
// shared as a PDF (print, WhatsApp, Files), plus a short text for a WhatsApp receipt from the staff phone.
import type { Lang, PosReceipt } from './types';
import { money } from './format';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
export const RECEIPT_SIZE = { width: 227, height: 600 };

function when(iso: string | null, lang: Lang) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString(lang === 'ar' ? 'ar-BH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bahrain' });
}

export function receiptHtml(r: PosReceipt, lang: Lang) {
  const ar = lang === 'ar';
  const L = (en: string, a: string) => (ar ? a : en);
  const row = (a: string, b: string, strong = false) => `<tr${strong ? ' class="b"' : ''}><td>${a}</td><td class="n">${b}</td></tr>`;
  const lines = r.lines.map((l) => row(esc(l.name) + ` <span class="q">× ${l.qty}</span>`, money(l.total, lang))).join('');
  return `<!doctype html><html dir="${ar ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
  @page{size:80mm auto;margin:4mm}body{font-family:-apple-system,"Segoe UI",Tahoma,sans-serif;color:#2B241D;font-size:11px;margin:0}
  h1{font-family:Georgia,serif;letter-spacing:4px;font-weight:600;font-size:22px;text-align:center;margin:4px 0 0}
  .tag{text-align:center;font-size:8px;letter-spacing:3px;color:#6B6157;margin-bottom:8px}
  .meta{text-align:center;color:#6B6157;margin-bottom:8px}table{width:100%;border-collapse:collapse}td{padding:3px 0;vertical-align:top}
  .n{text-align:${ar ? 'left' : 'right'};white-space:nowrap;direction:ltr}.q{color:#6B6157}.b td{font-weight:700;font-size:13px;border-top:1px dashed #9A8F83;padding-top:6px}
  .sep{border-top:1px dashed #9A8F83;margin:6px 0}.thanks{text-align:center;margin-top:10px;color:#6B6157}
  </style></head><body>
  <h1>KOUB</h1><div class="tag">CARRY YOUR STORY</div>
  <div class="meta">${L('Receipt', 'إيصال')} #${esc(r.number)}<br>${esc(when(r.date, lang))}</div>
  <table>${lines}
  ${r.discount > 0 ? row(L('Discount', 'خصم'), '−' + money(r.discount, lang)) : ''}
  ${row(L('Total', 'المجموع'), money(r.total, lang), true)}
  ${row(esc(r.method_label), money(r.cash_given ?? r.total, lang))}
  ${r.change !== null && r.change > 0 ? row(L('Change', 'الباقي'), money(r.change, lang)) : ''}
  </table>
  ${r.status === 'cancelled' ? `<div class="sep"></div><div class="thanks"><b>${L('CANCELLED', 'ملغي')}</b></div>` : ''}
  <div class="thanks">${L('Thank you for shopping at KOUB', 'شكراً لتسوقك من KOUB')}<br>koubbh.com</div>
  </body></html>`;
}

export function receiptText(r: PosReceipt, lang: Lang) {
  const ar = lang === 'ar';
  const items = r.lines.map((l) => `${l.name} × ${l.qty} — ${money(l.total, lang)}`).join('\n');
  return [
    ar ? `شكراً لتسوقك من KOUB 🤍\nإيصال #${r.number}` : `Thank you for shopping at KOUB 🤍\nReceipt #${r.number}`,
    items,
    r.discount > 0 ? (ar ? 'خصم: ' : 'Discount: ') + money(r.discount, lang) : '',
    (ar ? 'المجموع: ' : 'Total: ') + money(r.total, lang) + ' · ' + r.method_label,
  ].filter(Boolean).join('\n');
}
