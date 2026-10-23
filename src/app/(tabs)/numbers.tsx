import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useApiSession, useSession } from '../../lib/session';
import { color, radius, space } from '../../lib/theme';
import { currency, dayMonth, hourLabel, money, num, pct, shortDay } from '../../lib/format';
import type { Numbers as Data, NumbersPeriod } from '../../lib/types';
import { Card, ErrorState, FadeIn, Muted, Row, Screen, SectionTitle, Segmented, Skeleton, Touch, Txt } from '../../components/ui';
import { Bars, ShareBar } from '../../components/Charts';
import { Icon } from '../../components/Icon';

type Preset = Exclude<NumbersPeriod, 'custom'>;

export default function Numbers() {
  const session = useApiSession();
  const { t, me } = useSession();
  const [period, setPeriod] = useState<Preset>('today');
  // API 1.7 stores keep the shop till in its own books.
  const apart = !!me && me.api !== 'demo' ? Number(me.api.split('.')[0]) * 100 + Number(me.api.split('.')[1] ?? 0) >= 107 : true;
  const q = useQuery({ queryKey: ['numbers', period], queryFn: () => api.numbers(session, { period }) });
  return (
    <Screen title={t('numbers')} refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Segmented items={[['today', t('today')], ['yesterday', t('yesterday')], ['7days', t('days7')], ['month', t('month')]]} value={period} onChange={setPeriod} />
      {apart && <Muted size={12} style={{ marginTop: space.sm }}>{t('onlineOnly')}</Muted>}
      {q.isError && !q.data ? <ErrorState onRetry={q.refetch} /> : !q.data ? (
        <View style={{ gap: space.md, marginTop: space.xl }}>{[150, 200, 220, 120].map((h, i) => <Skeleton key={i} h={h} r={radius.lg} />)}</View>
      ) : <Body d={q.data} />}
    </Screen>
  );
}

function Body({ d }: { d: Data }) {
  const { t, lang } = useSession();
  const rtl = lang === 'ar';
  const change = pct(d.profit.change_pct);
  const spendLabel = { ads: t('sp_ads'), goods: t('sp_goods'), courier: t('sp_courier'), gateway: t('sp_gateway'), packaging: t('sp_packaging'), other: t('sp_other') };
  const topQty = Math.max(1, ...d.best_sellers.map((b) => b.qty));
  const [mixOpen, setMixOpen] = useState(false);
  return (
    <FadeIn>
      {/* Profit hero card, dark like a statement */}
      <View style={st.hero}>
        <Txt size={14} tint="rgba(247,243,236,0.72)">{t('netProfit') + (d.profit.exact ? '' : ' · ' + t('estimate'))}</Txt>
        <Row gap={8} align="flex-end">
          <Txt size={44} weight="bold" tint={color.bg} style={{ lineHeight: 52, letterSpacing: -1 }} ltr>{num(d.profit.value)}</Txt>
          <Txt size={16} tint="rgba(247,243,236,0.72)" style={{ marginBottom: 8 }}>{currency(lang)}</Txt>
        </Row>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <Txt size={13} tint="rgba(247,243,236,0.72)">{t('afterCosts')}</Txt>
          {change && <Txt size={13} weight="semibold" tint={change.up ? '#9FD9B8' : '#F2A9A3'}>{change.text + ' ' + t('vsPrev')}</Txt>}
        </Row>
        <View style={st.kpis}>
          <Kpi label={t('sales')} value={num(d.sales)} />
          <Kpi label={t('ordersCount')} value={String(d.orders)} />
          <Kpi label={t('average')} value={d.orders ? num(d.average) : '0.0'} />
        </View>
      </View>

      {d.foreign_orders > 0 && <Muted style={{ marginTop: space.sm }}>{t('foreignOrders', { n: d.foreign_orders })}</Muted>}

      <SectionTitle title={(d.chart.by === 'hour' ? t('salesByHour') : t('dailySales')) + ' (' + currency(lang) + ')'} />
      <Card>
        <Bars
          points={d.chart.by === 'hour' ? trimHours(d.chart.points) : d.chart.points}
          rtl={rtl}
          value={(v) => num(v, v >= 100 ? 0 : 1)}
          label={(p) => (d.chart.by === 'hour' ? hourLabel(p.x, lang) : d.chart.points.length <= 8 ? shortDay(p.x, lang) : String(parseInt(p.x.slice(8), 10)))}
        />
      </Card>

      <SectionTitle title={t('whereMoney')} />
      <Card>
        <Muted style={{ marginBottom: space.sm }}>{t('ofSales', { x: money(d.sales, lang) })}</Muted>
        {d.spend.map((x) => <ShareRow key={x.key} label={spendLabel[x.key]} note={x.at_least ? t('atLeast') : ''} value={x.value} base={d.sales} />)}
        <ShareRow label={t('netProfit')} note={d.profit.exact ? '' : t('estShort')} value={Math.max(0, d.profit.value)} base={d.sales} strong />
        {d.missing.length > 0 && (
          <View style={st.hint}>
            <Icon name="warn" size={16} tint={color.amber} />
            <View style={{ flex: 1 }}>
              <Txt size={13} weight="semibold" tint={color.amber}>{t('missingTitle') + ' · ' + d.missing.length}</Txt>
              {d.missing.slice(0, 4).map((m, i) => <Muted key={i} size={12}>{m}</Muted>)}
            </View>
          </View>
        )}
      </Card>

      <View style={st.tiles}>
        <Card style={{ flex: 1 }}>
          <Muted>{t('ads')}</Muted>
          <Txt size={22} weight="bold" style={{ marginTop: 2 }}>{d.ads.roas ? t('roas', { x: num(d.ads.roas, 1) }) : '—'}</Txt>
          <Muted size={12}>{d.ads.spent > 0 ? t('spent', { x: num(d.ads.spent), y: d.ads.per_order ? num(d.ads.per_order) : '—' }) : t('noAds')}</Muted>
        </Card>
        <Card style={{ flex: 1 }}>
          <Muted>{t('cardCash')}</Muted>
          <Txt size={22} weight="bold" style={{ marginTop: 2 }} ltr>{num(d.cash.card_after_fees + d.cash.cod_to_collect)}</Txt>
          <Muted size={12}>{t('cardAfterFees', { a: num(d.cash.card_after_fees), b: num(d.cash.cod_to_collect) })}</Muted>
        </Card>
      </View>

      <SectionTitle title={t('bestSellers')} />
      <Card>
        {d.best_sellers.length === 0 && <Muted>{t('noSales')}</Muted>}
        {d.best_sellers.map((b, i) => (
          <View key={i} style={{ paddingVertical: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={8} style={{ flex: 1 }}><Txt size={13} weight="semibold" tint={color.faint}>{String(i + 1)}</Txt><Txt size={14} weight="medium" lines={1} style={{ flex: 1 }}>{b.name}</Txt></Row>
              <Txt size={14} weight="semibold">{t('pieces', { n: b.qty })}</Txt>
            </Row>
            <View style={{ marginTop: 6 }}><ShareBar pct={(100 * b.qty) / topQty} /></View>
          </View>
        ))}
        {d.countries.length > 0 && (
          <View style={st.countries}>{d.countries.map((c) => <View key={c.code} style={st.country}><Txt size={13}>{c.name + ' '}<Txt size={13} weight="bold">{String(c.orders)}</Txt></Txt></View>)}</View>
        )}
      </Card>

      <Card style={{ marginTop: space.md }} padded={false}>
        <Touch onPress={() => setMixOpen(!mixOpen)} haptic={false} style={{ padding: space.lg }}>
          <Row style={{ justifyContent: 'space-between' }}><Txt size={16} weight="semibold">{t('orderMix')}</Txt><View style={{ transform: [{ rotate: mixOpen ? '90deg' : '-90deg' }] }}><Icon name="chevron" size={18} tint={color.muted} /></View></Row>
        </Touch>
        {mixOpen && (
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
            {([[t('card'), d.mix.card], [t('cod'), d.mix.cod], [t('delivery'), d.mix.delivery], [t('pickup'), d.mix.pickup], [t('itemsSold'), d.mix.items], [t('bundlesSold'), d.mix.bundles], [t('refunded'), money(d.mix.refunded, lang)], [t('shippingPaid'), money(d.mix.shipping_paid, lang)]] as [string, string | number][]).map(([l, v], i) => (
              <Row key={i} style={{ justifyContent: 'space-between', paddingVertical: 4 }}><Txt size={14} tint={color.inkSoft}>{l}</Txt><Txt size={14} weight="medium">{String(v)}</Txt></Row>
            ))}
          </View>
        )}
      </Card>

      {d.carts && (
        <>
          <SectionTitle title={t('carts')} />
          <Card>
            <Row>
              {([[t('reminded'), d.carts.reminded], [t('delivered'), d.carts.delivered], [t('recovered'), d.carts.recovered], [t('sales'), num(d.carts.sales)]] as [string, string | number][]).map(([l, v], i) => <Kpi key={i} label={l} value={String(v)} dark={false} />)}
            </Row>
          </Card>
        </>
      )}
      <Muted size={12} center style={{ marginTop: space.lg }}>{d.period.start === d.period.end ? dayMonth(d.period.start, lang) : dayMonth(d.period.start, lang) + ' – ' + dayMonth(d.period.end, lang)}</Muted>
    </FadeIn>
  );
}

// From the first sale (or 9am) to the latest hour with data, like the dashboard's hour chart.
function trimHours(points: Data['chart']['points']) {
  const firstSale = points.findIndex((p) => p.y > 0);
  let lastSale = points.length - 1;
  while (lastSale > 0 && points[lastSale].y === 0) lastSale--;
  const from = Math.min(firstSale === -1 ? 9 : firstSale, 9);
  const to = Math.max(lastSale, from + 1, Math.min(23, new Date().getHours()));
  return points.slice(from, to + 1);
}

function Kpi({ label, value, dark = true }: { label: string; value: string; dark?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <Txt size={12} tint={dark ? 'rgba(247,243,236,0.66)' : color.muted}>{label}</Txt>
      <Txt size={18} weight="bold" tint={dark ? color.bg : color.ink}>{value}</Txt>
    </View>
  );
}

function ShareRow({ label, note, value, base, strong }: { label: string; note: string; value: number; base: number; strong?: boolean }) {
  return (
    <View style={{ paddingVertical: 6 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={6}><Txt size={14} weight={strong ? 'semibold' : 'regular'}>{label}</Txt>{note ? <Muted size={11}>{note}</Muted> : null}</Row>
        <Txt size={14} weight="semibold" tint={strong ? color.green : color.ink} ltr>{num(value)}</Txt>
      </Row>
      <View style={{ marginTop: 6, flexDirection: 'row' }}><ShareBar pct={base > 0 ? (100 * value) / base : 0} strong={strong} /></View>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { backgroundColor: color.ink, borderRadius: radius.lg, padding: space.xl, marginTop: space.xl, gap: 2 },
  kpis: { flexDirection: 'row', marginTop: space.lg, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(247,243,236,0.2)' },
  tiles: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  hint: { flexDirection: 'row', gap: 8, backgroundColor: color.amberBg, borderRadius: radius.md, padding: space.md, marginTop: space.md },
  countries: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.md },
  country: { backgroundColor: color.sunken, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 },
});
