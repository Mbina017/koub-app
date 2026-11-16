// Monthly report (API 1.41), owner only: a calendar month at a glance, online store and shop together.
// Sales and net profit (online: Numbers; shop: the shop books, its expenses included), best sellers and customer
// ratings. "Share PDF" makes a one-page report with the logo. On the 1st the store alerts that last month's is ready.
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, radius, space } from '../lib/theme';
import { money, num } from '../lib/format';
import { sharePdf } from '../lib/print';
import { LOGO_DATA_URI } from '../lib/logoData';
import type { Lang } from '../lib/types';
import { Button, ErrorState, Muted, Row, Segmented, Skeleton, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
// This month runs to today; last month is the whole month.
function monthRange(which: 'this' | 'last', now = new Date()) {
  const first = new Date(now.getFullYear(), now.getMonth() - (which === 'last' ? 1 : 0), 1);
  const last = which === 'last' ? new Date(now.getFullYear(), now.getMonth(), 0) : now;
  return { from: ymd(first), to: ymd(last), first };
}
const monthName = (d: Date, lang: Lang) => d.toLocaleDateString(lang === 'ar' ? 'ar-BH' : 'en-GB', { month: 'long', year: 'numeric' });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export default function PosMonth() {
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  // From the 1st to the 5th, last month is what the owner wants first.
  const [which, setWhich] = useState<'this' | 'last'>(new Date().getDate() <= 5 ? 'last' : 'this');
  const r = monthRange(which);
  const online = useQuery({ queryKey: ['month', 'numbers', r.from, r.to], queryFn: () => api.numbers(session, { period: 'custom', from: r.from, to: r.to }) });
  const shop = useQuery({ queryKey: ['month', 'books', r.from, r.to], queryFn: () => api.posBooksRange(session, r.from, r.to) });
  const fb = useQuery({ queryKey: ['feedback'], queryFn: () => api.feedback(session), retry: false });
  const o = online.data;
  const b = shop.data;
  const rated = (fb.data?.items ?? []).filter((f) => f.at.slice(0, 10) >= r.from && f.at.slice(0, 10) <= r.to);
  const rating = rated.length ? Math.round((rated.reduce((a, f) => a + f.stars, 0) / rated.length) * 10) / 10 : null;
  const ready = !!o && !!b;
  const sales = ready ? o.sales + b.sales : 0;
  const net = ready ? o.profit.value + b.profit : 0;
  const exact = ready && o.profit.exact && b.exact;
  const title = monthName(r.first, lang);

  const pdf = () => {
    if (!o || !b) return;
    const ar = lang === 'ar';
    const row = (a: string, v: string, strong = false) => `<tr${strong ? ' class="b"' : ''}><td>${esc(a)}</td><td class="n">${esc(v)}</td></tr>`;
    const html = `<!doctype html><html dir="${ar ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
      @page{size:A4;margin:16mm}body{font-family:-apple-system,"Segoe UI",Tahoma,sans-serif;color:#2B241D;font-size:13px;margin:0}
      .logo{display:block;width:150px;margin:0 auto 6px}h1{text-align:center;font-size:20px;margin:6px 0 2px}.sub{text-align:center;color:#6B6157;margin-bottom:18px}
      .big{display:flex;gap:12px;margin-bottom:16px}.big div{flex:1;border:1px solid #E6DCCD;border-radius:12px;padding:12px;text-align:center}.big b{display:block;font-size:22px;margin-top:4px}
      h2{font-size:15px;margin:16px 0 6px}table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px solid #EFE6DA}
      .n{text-align:${ar ? 'left' : 'right'};direction:ltr;white-space:nowrap}.b td{font-weight:700}.note{color:#8A7F73;font-size:11px;margin-top:14px;text-align:center}
    </style></head><body>
      <img class="logo" src="${LOGO_DATA_URI}" alt="KOUB">
      <h1>${esc(t('mrPdfTitle', { m: title }))}</h1><div class="sub">${esc(r.from + ' – ' + r.to)}</div>
      <div class="big"><div>${esc(t('mrSales'))}<b>${esc(money(sales, lang))}</b></div><div>${esc(t('mrNet'))}<b>${esc(money(net, lang))}</b></div><div>${esc(t('mrRating'))}<b>${rating === null ? '—' : esc(num(rating, 1)) + ' ★'}</b></div></div>
      <h2>${esc(t('mrOnline'))}</h2><table>${row(t('mrSales'), money(o.sales, lang))}${row(t('mrOrders', { n: o.orders }), '')}${row(t('mrNet'), money(o.profit.value, lang), true)}</table>
      <h2>${esc(t('mrShop'))}</h2><table>${row(t('mrSales'), money(b.sales, lang))}${row(t('mrOrders', { n: b.count }), '')}${row(t('mrExpenses'), money(b.expenses, lang))}${row(t('mrNet'), money(b.profit, lang), true)}</table>
      ${o.best_sellers.length ? `<h2>${esc(t('mrTop'))}</h2><table>${o.best_sellers.slice(0, 8).map((x) => row(x.name, '× ' + x.qty)).join('')}</table>` : ''}
      ${rated.length ? `<h2>${esc(t('mrRating'))}</h2><table>${row(t('fbCount', { n: rated.length }), num(rating ?? 0, 1) + ' ★', true)}${rated.filter((f) => f.note).slice(0, 8).map((f) => row('★'.repeat(f.stars) + ' · ' + f.note, '')).join('')}</table>` : ''}
      ${exact ? '' : `<div class="note">${esc(t('mrAtMost'))}</div>`}
      <div class="note">koubbh.com</div>
    </body></html>`;
    sharePdf(html, 'KOUB-report-' + r.from.slice(0, 7)).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/more' as never))} style={st.iconBtn} accessibilityLabel="back"><Icon name="back" size={24} rtl={lang === 'ar'} /></Touch>
        <Txt size={19} weight="bold" style={{ flex: 1 }}>{t('mrTitle')}</Txt>
      </Row>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl, maxWidth: 640, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={online.isRefetching || shop.isRefetching} onRefresh={() => { online.refetch(); shop.refetch(); fb.refetch(); }} tintColor={color.ink} />}>
        <Segmented<'this' | 'last'> items={[['last', t('mrLast')], ['this', t('mrThis')]]} value={which} onChange={setWhich} />
        <Txt size={22} weight="bold" center>{title}</Txt>
        {(online.isError && !o) || (shop.isError && !b) ? <ErrorState onRetry={() => { online.refetch(); shop.refetch(); }} />
          : !ready ? [0, 1, 2].map((i) => <Skeleton key={i} h={110} r={radius.lg} />) : (
          <>
            <View style={[st.card, { gap: 4, alignItems: 'center' }]}>
              <Muted>{t('mrAll')}</Muted>
              <Txt size={30} weight="bold">{money(sales, lang)}</Txt>
              <Txt size={16} weight="semibold" tint={net >= 0 ? color.green : color.red}>{t('mrNet') + ' · ' + money(net, lang)}</Txt>
              {!exact && <Muted size={11}>{t('mrAtMost')}</Muted>}
            </View>
            <Row gap={10}>
              <Part title={t('mrOnline')} lines={[[t('mrSales'), money(o.sales, lang)], [t('mrOrders', { n: o.orders }), ''], [t('mrNet'), money(o.profit.value, lang)]]} />
              <Part title={t('mrShop')} lines={[[t('mrSales'), money(b.sales, lang)], [t('mrOrders', { n: b.count }), ''], [t('mrExpenses'), money(b.expenses, lang)], [t('mrNet'), money(b.profit, lang)]]} />
            </Row>
            {o.best_sellers.length > 0 && (
              <View style={[st.card, { gap: 6 }]}>
                <Txt size={15} weight="semibold">{t('mrTop')}</Txt>
                {o.best_sellers.slice(0, 5).map((x, i) => <Row key={i} style={{ justifyContent: 'space-between' }}><Txt size={14} style={{ flex: 1 }} lines={1}>{x.name}</Txt><Muted>{'× ' + x.qty}</Muted></Row>)}
              </View>
            )}
            <View style={[st.card, { gap: 4 }]}>
              <Txt size={15} weight="semibold">{t('mrRating')}</Txt>
              {rating === null ? <Muted>{t('mrNoRating')}</Muted> : <Txt size={20} weight="bold" ltr>{num(rating, 1)}<Txt size={16} tint={color.amber}> ★</Txt><Muted size={13}>{'  ' + t('fbCount', { n: rated.length })}</Muted></Txt>}
            </View>
            <Button label={t('mrShare')} icon="print" onPress={pdf} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Part({ title, lines }: { title: string; lines: [string, string][] }) {
  return (
    <View style={[st.card, { flex: 1, gap: 6 }]}>
      <Txt size={14} weight="semibold">{title}</Txt>
      {lines.map(([a, v], i) => <Row key={i} style={{ justifyContent: 'space-between' }}><Muted size={12}>{a}</Muted><Txt size={13} weight={i === lines.length - 1 ? 'bold' : 'medium'}>{v}</Txt></Row>)}
    </View>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: 4, backgroundColor: color.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
});
