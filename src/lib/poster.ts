// The counter poster: a QR to koubbh.com/loyalty/ for customers to join, printed from the phone (A5-ish on A4).
import qrcode from 'qrcode-generator';
import type { Lang } from './types';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export function qrSvg(text: string): string {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
}

export function posterHtml(joinUrl: string, stamps: number, lang: Lang): string {
  const ar = lang === 'ar';
  const L = (en: string, a: string) => (ar ? a : en);
  return `<!doctype html><html dir="${ar ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
  @page{size:A4;margin:0}body{margin:0;font-family:-apple-system,"Segoe UI",Tahoma,sans-serif;color:#F7F3EC;background:#2B241D}
  .p{height:297mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 22mm;box-sizing:border-box}
  h1{font-family:Georgia,serif;letter-spacing:10px;font-weight:600;font-size:54px;margin:0}
  .tag{font-size:11px;letter-spacing:5px;color:#C9B9A3;margin:4px 0 26px}
  h2{font-size:34px;margin:0 0 10px}p{font-size:19px;color:#E7DFD3;margin:0 0 26px;line-height:1.5}
  .qr{background:#F7F3EC;border-radius:22px;padding:18px;width:96mm;height:96mm;box-sizing:border-box}.qr svg{width:100%;height:100%}
  .dots{margin:26px 0 8px;font-size:30px;letter-spacing:10px}.small{font-size:14px;color:#C9B9A3}
  </style></head><body><div class="p">
  <h1>KOUB</h1><div class="tag">CARRY YOUR STORY</div>
  <h2>${L('Your KOUB card', 'بطاقة KOUB حقتك')}</h2>
  <p>${esc(ar ? `اشترِ ${stamps} مشروبات، والمشروب اللي بعدها علينا ☕` : `Buy ${stamps} drinks, the next one is on us ☕`)}</p>
  <div class="qr">${qrSvg(joinUrl)}</div>
  <div class="dots">${'●'.repeat(stamps)}🎁</div>
  <div class="small">${L('Scan with your camera · No app to download', 'امسح بالكاميرا · بدون تنزيل أي تطبيق')}</div>
  </div></body></html>`;
}
