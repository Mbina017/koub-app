// Shop insights (API 1.28), owner only: sales by hour and weekday, waiting times (median and the slowest 10%),
// best sellers by cups and by money with what each earns, payment mix, cancellations and waste.
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, radius, space } from '../lib/theme';
import { money } from '../lib/format';
import type { InsightItem, InsightsPeriod } from '../lib/types';
import { ErrorState, Muted, Row, Segmented, Skeleton, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

const mins = (s: number | null) => (s === null ? '—' : s < 60 ? s + 's' : Math.round(s / 6) / 10 + 'm');

export default function PosInsights() {
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<InsightsPeriod>('7days');
  const q = useQuery({ queryKey: ['pos-insights', period], queryFn: () => api.posInsights(session, period) });
  const d = q.data;
  const [by, setBy] = useState<'qty' | 'money'>('qty');
  // Shop hours only: from the first to the last hour that had a sale.
  const hrs = d ? d.hours.map((h, i) => ({ ...h, i })).filter((h, _, a) => { const used = a.filter((x) => x.count); return used.length ? h.i >= used[0].i && h.i <= used[used.length - 1].i : false; }) : [];
  const maxH = Math.max(1, ...hrs.map((h) => h.count));
  const days = [t('wd0'), t('wd1'), t('wd2'), t('wd3'), t('wd4'), t('wd5'), t('wd6')];
  const maxW = d ? Math.max(1, ...d.week.map((w) => w.count)) : 1;
  const list: InsightItem[] = d ? (by === 'qty' ? d.top : d.top_money) : [];
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/more' as never))} style={st.iconBtn} accessibilityLabel="back"><Icon name="back" size={24} rtl={lang === 'ar'} /></Touch>
        <Txt size={19} weight="bold" style={{ flex: 1 }}>{t('insightsTitle')}</Txt>
      </Row>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl, maxWidth: 760, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={color.ink} />}>
        <Segmented<InsightsPeriod> items={[['today', t('today')], ['7days', t('ins7')], ['30days', t('ins30')]]} value={period} onChange={setPeriod} />
        {q.isError && !d ? <ErrorState onRetry={() => { q.refetch(); }} /> : !d ? [0, 1, 2].map((i) => <Skeleton key={i} h={120} r={radius.lg} />) : (
          <>
            <View style={st.kpis}>
              {[[t('insTotal'), money(d.total, lang)], [t('insCount'), String(d.count)], [t('insAvg'), money(d.avg, lang)], [t('insCups'), String(d.cups)], ...(d.days > 1 ? [[t('insPerDay'), money(d.per_day, lang)]] : [])].map(([k, v]) => (
                <View key={k} style={st.kpi}><Muted size={12}>{k}</Muted><Txt size={20} weight="bold">{v}</Txt></View>
              ))}
            </View>

            <View style={[st.card, { gap: 10 }]}>
              <Txt size={15} weight="semibold">{t('insWait')}</Txt>
              {(['ready', 'handed'] as const).map((k) => (
                <Row key={k} style={{ justifyContent: 'space-between' }}>
                  <Muted style={{ flex: 1 }}>{t(('insWait_' + k) as never)}</Muted>
                  <Txt size={15} weight="semibold">{mins(d.wait[k].median)}</Txt>
                  <Txt size={13} tint={color.amber} style={{ width: 92, textAlign: 'right' }}>{'P90 ' + mins(d.wait[k].p90)}</Txt>
                </Row>
              ))}
              <Muted size={12}>{t('insWaitHint', { n: d.wait.handed.n })}</Muted>
            </View>

            <View style={[st.card, { gap: 8 }]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt size={15} weight="semibold">{t('insHours')}</Txt>
                {d.busiest_hour !== null && <Muted size={12}>{t('insBusiest', { h: d.busiest_hour + ':00' })}</Muted>}
              </Row>
              {hrs.length === 0 ? <Muted>{t('insNone')}</Muted> : (
                <View style={st.chart}>
                  {hrs.map((h) => (
                    <View key={h.i} style={st.col}>
                      <Txt size={10} tint={color.muted}>{h.count || ''}</Txt>
                      <View style={[st.barV, { height: Math.max(2, (h.count / maxH) * 110), backgroundColor: h.i === d.busiest_hour ? color.ink : color.inkSoft }]} />
                      <Txt size={10} tint={color.muted}>{String(h.i)}</Txt>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {d.days > 1 && (
              <View style={[st.card, { gap: 6 }]}>
                <Txt size={15} weight="semibold">{t('insWeek')}</Txt>
                {d.week.map((w, i) => (
                  <Row key={i} gap={8}>
                    <Txt size={13} style={{ width: 56 }}>{days[i]}</Txt>
                    <View style={[st.barH, { flex: 1 }]}><View style={[st.fill, { width: `${(w.count / maxW) * 100}%` }]} /></View>
                    <Muted size={12} style={{ width: 70, textAlign: 'right' }}>{money(w.total, lang)}</Muted>
                  </Row>
                ))}
              </View>
            )}

            <View style={[st.card, { gap: 8 }]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt size={15} weight="semibold">{t('insTop')}</Txt>
                <Segmented<'qty' | 'money'> items={[['qty', t('insByCups')], ['money', t('insByMoney')]]} value={by} onChange={setBy} style={{ width: 170 }} />
              </Row>
              {list.length === 0 ? <Muted>{t('insNone')}</Muted> : list.map((x, i) => (
                <Row key={x.id + '-' + i} gap={8}>
                  <Txt size={13} weight="bold" style={{ width: 20 }}>{String(i + 1)}</Txt>
                  <View style={{ flex: 1 }}>
                    <Txt size={14} weight="semibold" lines={1}>{x.name}</Txt>
                    {x.profit !== null && <Muted size={11}>{t('insProfit', { p: money(x.profit, lang) })}</Muted>}
                  </View>
                  <Txt size={13} weight="semibold">{by === 'qty' ? '× ' + x.qty : money(x.total, lang)}</Txt>
                </Row>
              ))}
            </View>

            <View style={[st.card, { gap: 6 }]}>
              <Txt size={15} weight="semibold">{t('insPay')}</Txt>
              {Object.entries(d.methods).map(([m, v]) => (
                <Row key={m} style={{ justifyContent: 'space-between' }}><Muted>{m === 'benefit' ? t('posBenefit') : m === 'card' ? t('posCard') : t('posCash')}</Muted><Txt size={14} weight="semibold">{money(v ?? 0, lang)}</Txt></Row>
              ))}
              {Object.keys(d.cancels).length > 0 && (
                <Muted size={12}>{t('insCancels') + ': ' + Object.entries(d.cancels).map(([r, n]) => t(('why_' + r) as never) + ' ' + n).join(' · ')}</Muted>
              )}
              {d.waste.length > 0 && <Muted size={12}>{t('closeWaste', { x: d.waste.map((w) => w.qty + '× ' + w.name).join('، ') })}</Muted>}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: 4, backgroundColor: color.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  kpi: { flexGrow: 1, minWidth: 140, padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface, gap: 2 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 150, direction: 'ltr' },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  barV: { width: '80%', borderRadius: 4 },
  barH: { height: 10, borderRadius: 5, backgroundColor: color.sunken, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: color.ink },
});
