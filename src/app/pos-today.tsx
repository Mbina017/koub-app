// Today's shop sales: the cash that should be in the drawer, card and BenefitPay totals, and every sale.
// A sale entered by mistake can be cancelled here the same day; the store puts its stock back.
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, radius, space } from '../lib/theme';
import { money } from '../lib/format';
import { confirmStep, showMessage } from '../lib/confirm';
import type { PosMethod } from '../lib/types';
import { Empty, ErrorState, Muted, Row, Skeleton, TagChip, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

const time = (iso: string | null, lang: string) => (iso ? new Date(iso).toLocaleTimeString(lang === 'ar' ? 'ar-BH' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bahrain' }) : '');

export default function PosToday() {
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['pos-today'], queryFn: () => api.posToday(session), refetchInterval: 60_000 });
  const cancel = useMutation({
    mutationFn: (id: number) => api.posVoid(session, id),
    onSuccess: () => { for (const k of ['pos-today', 'pos-catalog', 'home', 'products', 'numbers', 'orders']) qc.invalidateQueries({ queryKey: [k] }); },
    onError: (e) => showMessage(t('notUpdated'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e.message),
  });
  const d = q.data;
  const label: Record<PosMethod, string> = { cash: t('posCash'), card: t('posCard'), benefit: t('posBenefit') };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/pos'))} style={st.iconBtn} accessibilityLabel="back">
          <Icon name="back" size={24} rtl={lang === 'ar'} />
        </Touch>
        <Txt size={19} weight="bold" style={{ flex: 1 }}>{t('posToday')}</Txt>
      </Row>
      {q.isError && !d ? (
        <ErrorState onRetry={() => { q.refetch(); }} />
      ) : !d ? (
        <View style={{ padding: space.lg, gap: space.md }}>{[0, 1].map((i) => <Skeleton key={i} h={120} r={radius.lg} />)}</View>
      ) : (
        <FlatList
          data={d.sales}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: insets.bottom + space.xl }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={color.ink} />}
          ListHeaderComponent={
            <View style={[st.card, { gap: 10, marginBottom: space.md }]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Muted>{t('posSalesN', { n: d.count })}</Muted>
                <Txt size={24} weight="bold">{money(d.total, lang)}</Txt>
              </Row>
              {(['cash', 'card', 'benefit'] as PosMethod[]).map((m) => (
                <Row key={m} style={{ justifyContent: 'space-between' }}>
                  <Txt size={15}>{label[m]}</Txt>
                  <Txt size={15} weight="semibold">{money(d.by_method[m] ?? 0, lang)}</Txt>
                </Row>
              ))}
              <Muted size={12}>{t('posDrawerHint')}</Muted>
            </View>
          }
          ListEmptyComponent={<Empty title={t('posNoSales')} icon="cash" />}
          renderItem={({ item: s }) => (
            <Row gap={10} style={[st.card, s.void && { opacity: 0.55 }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt size={15} weight="semibold">{'#' + s.number + ' · ' + money(s.total, lang)}</Txt>
                <Muted size={12}>{[time(s.date, lang), s.method_label, t('posItemsN', { n: s.items })].filter(Boolean).join(' · ')}</Muted>
              </View>
              {s.void ? <TagChip label={t('posVoided')} tone="red" small /> : (
                <Touch
                  onPress={() => confirmStep({ label: t('posVoid'), confirm: t('posVoidConfirm', { n: s.number }), tone: 'danger' }, t('notNow'), () => cancel.mutate(s.id))}
                  disabled={cancel.isPending}
                  style={st.pill}
                >
                  <Txt size={13} weight="semibold" tint={color.red}>{t('posVoid')}</Txt>
                </Touch>
              )}
            </Row>
          )}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: 4, backgroundColor: color.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: color.redBg },
});
