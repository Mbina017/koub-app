// The parking sign (API 1.31): an A4 page with the order-from-your-car QR, printed or saved as a PDF from the app.
import qrcode from 'qrcode-generator';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function carSignHtml(url: string, title: string, body: string, rtl: boolean) {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
  return `<!doctype html><html dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:-apple-system,"Segoe UI",Tahoma,sans-serif;color:#2B241D;background:#F5F0E8}
.p{width:210mm;height:297mm;padding:22mm 18mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center}
h1{font-family:Georgia,serif;letter-spacing:14px;font-size:54px;margin:0;font-weight:600}h2{font-size:46px;margin:8mm 0 0}p{font-size:24px;line-height:1.5;margin:4mm 0 0;color:#5C5248}
.q{background:#fff;border-radius:10mm;padding:8mm;width:130mm;height:130mm}.q svg{width:100%;height:100%}.u{font-size:16px;color:#8A7F73;direction:ltr}
</style></head><body><div class="p"><div><h1>KOUB</h1><h2>🚗 ${esc(title)}</h2><p>${esc(body)}</p></div><div class="q">${svg}</div><div class="u">${esc(url.replace(/^https?:\/\//, ''))}</div></div></body></html>`;
}
