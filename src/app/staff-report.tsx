// Sales by staff (API 1.15), owner only: what each person sold in the period, how they were paid, and every
// discount and cancellation with who did it and how it was approved. A cashier with no sales still shows.
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, radius, space } from '../lib/theme';
import { money } from '../lib/format';
import type { PosMethod, PosStaffEvent, PosStaffRow, ShopPeriod } from '../lib/types';
import { ErrorState, Muted, Row, Segmented, Skeleton, TagChip, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

const when = (iso: string | null, lang: string) =>
  iso ? new Date(iso).toLocaleString(lang === 'ar' ? 'ar-BH' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bahrain' }) : '';

export default function StaffReport() {
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<ShopPeriod>('today');
  const q = useQuery({ queryKey: ['staff-report', period], queryFn: () => api.posStaffReport(session, period), placeholderData: (prev) => prev });
  const d = q.data;
  const old = q.error instanceof ApiError && q.error.message === 'no_route';

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/more' as never))} style={st.iconBtn} accessibilityLabel="back">
          <Icon name="back" size={24} rtl={lang === 'ar'} />
        </Touch>
        <Txt size={19} weight="bold" style={{ flex: 1 }}>{t('staffReport')}</Txt>
      </Row>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={color.ink} />}>
        <Segmented items={[['today', t('today')], ['yesterday', t('yesterday')], ['7days', t('days7')], ['month', t('month')]]} value={period} onChange={setPeriod} />
        {old ? (
          <View style={st.card}><Muted>{t('needsUpdate')}</Muted></View>
        ) : q.isError && !d ? (
          <ErrorState onRetry={() => { q.refetch(); }} />
        ) : !d ? (
          [0, 1].map((i) => <Skeleton key={i} h={130} r={radius.lg} />)
        ) : (
          <>
            <Muted>{d.period.label}</Muted>
            {d.staff.length === 0 ? <View style={st.card}><Muted>{t('rpNobody')}</Muted></View> : d.staff.map((p) => <Person key={p.id} p={p} />)}
            <Txt size={16} weight="semibold" style={{ marginTop: space.sm }}>{t('rpEvents')}</Txt>
            {d.events.length === 0 ? <View style={st.card}><Muted>{t('rpNoEvents')}</Muted></View> : (
              <View style={st.card}>{d.events.map((e, i) => <Event key={e.kind + e.id} e={e} first={i === 0} when={when(e.date, lang)} />)}</View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Person({ p }: { p: PosStaffRow }) {
  const { t, lang } = useSession();
  const label: Record<PosMethod, string> = { cash: t('posCash'), card: t('posCard'), benefit: t('posBenefit') };
  return (
    <View style={[st.card, { gap: 8 }]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Txt size={16} weight="semibold">{p.name}</Txt>
          <Muted size={12}>{t('rpSales', { n: p.count })}</Muted>
        </View>
        <Txt size={20} weight="bold">{money(p.total, lang)}</Txt>
      </Row>
      {(['cash', 'card', 'benefit'] as PosMethod[]).map((m) => (
        <Row key={m} style={{ justifyContent: 'space-between' }}><Muted>{label[m]}</Muted><Txt size={14}>{money(p.by_method[m] ?? 0, lang)}</Txt></Row>
      ))}
      {(p.discount_count > 0 || p.voids > 0 || p.refunds > 0) && (
        <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 2 }}>
          {p.discount_count > 0 && <TagChip label={t('rpDiscounts') + ' ' + p.discount_count + ' · ' + money(p.discounts, lang)} tone="amber" small />}
          {p.voids > 0 && <TagChip label={t('rpVoids') + ' ' + p.voids + ' · ' + money(p.void_total, lang)} tone="red" small />}
          {p.refunds > 0 && <TagChip label={t('rpRefunds') + ' ' + money(p.refunds, lang)} tone="muted" small />}
        </Row>
      )}
    </View>
  );
}

function Event({ e, first, when }: { e: PosStaffEvent; first: boolean; when: string }) {
  const { t, lang } = useSession();
  const how = e.approved === 'owner' ? t('rpByOwner') : e.approved === 'pin' ? t('rpByPin') : '';
  return (
    <Row gap={10} style={[{ paddingVertical: 10 }, !first && st.sep]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt size={14} weight="semibold">{'#' + e.number + ' · ' + e.staff}</Txt>
        <Muted size={12}>{[when, how].filter(Boolean).join(' · ')}</Muted>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <TagChip label={e.kind === 'void' ? t('rpVoid') : t('rpDiscount')} tone={e.kind === 'void' ? 'red' : 'amber'} small />
        <Txt size={13} weight="semibold">{money(e.kind === 'void' ? e.total : e.amount ?? 0, lang)}</Txt>
      </View>
    </Row>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: 4, backgroundColor: color.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
});
