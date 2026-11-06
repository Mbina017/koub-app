// Card payments that did not finish: send the customer their own payment link from your WhatsApp, or mark it handled.
import { FlatList, Linking, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, radius, space } from '../lib/theme';
import { money } from '../lib/format';
import type { UnpaidRow } from '../lib/types';
import { confirmStep, showMessage } from '../lib/confirm';
import { Button, Empty, ErrorState, Muted, Row, Skeleton, TagChip, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

export default function Unpaid() {
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['unpaid'], queryFn: () => api.unpaid(session) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['unpaid'] }); qc.invalidateQueries({ queryKey: ['home'] }); };
  const fail = (e: Error) => showMessage(t('notUpdated'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e.message);
  // The store returns the link and a ready message; WhatsApp opens on this phone and the staff member presses send.
  const link = useMutation({
    mutationFn: (r: UnpaidRow) => api.paymentLink(session, r.id),
    onSuccess: async (p) => { refresh(); if (p.whatsapp) await Linking.openURL('https://wa.me/' + p.whatsapp + '?text=' + encodeURIComponent(p.text)); },
    onError: fail,
  });
  const dismiss = useMutation({ mutationFn: (r: UnpaidRow) => api.unpaidDismiss(session, r.id), onSuccess: refresh, onError: fail });
  const d = q.data;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={st.iconBtn} accessibilityLabel="back">
          <Icon name="back" size={24} rtl={lang === 'ar'} />
        </Touch>
        <View style={{ flex: 1 }}>
          <Txt size={19} weight="bold">{t('unpaidTitle')}</Txt>
          {d && d.count > 0 && <Muted size={12}>{t('unpaidSummary', { n: d.count, x: money(d.value, lang) })}</Muted>}
        </View>
      </Row>
      {q.isError && !d ? <ErrorState onRetry={() => { q.refetch(); }} /> : !d ? (
        <View style={{ padding: space.lg, gap: space.md }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={140} r={radius.lg} />)}</View>
      ) : (
        <FlatList
          data={d.rows}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl }}
          ListHeaderComponent={d.rows.length ? <Muted size={12}>{t('unpaidNote')}</Muted> : undefined}
          ListEmptyComponent={<Empty title={t('unpaidEmpty')} body={t('unpaidEmptyHint')} icon="check" />}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={color.ink} />}
          renderItem={({ item: r }) => (
            <View style={st.card}>
              <Touch onPress={() => router.push({ pathname: '/order/[id]', params: { id: String(r.id) } })} haptic={false}>
                <Row style={{ justifyContent: 'space-between' }} align="flex-start">
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt size={15} weight="semibold">{'#' + r.number + ' · ' + (r.name || '—')}</Txt>
                    <Muted size={13} lines={1}>{r.items}</Muted>
                    <Muted size={12}>{[r.ago, r.method, r.status_label].filter(Boolean).join(' · ')}</Muted>
                  </View>
                  <Txt size={16} weight="bold">{money(r.total, lang)}</Txt>
                </Row>
              </Touch>
              <View style={st.tags}>
                {!!r.reminder && <TagChip label={r.reminder} tone="neutral" small />}
                {r.opened && <TagChip label={t('linkOpened')} tone="blue" small />}
                {r.shared && <TagChip label={t('linkShared')} tone="green" small />}
                {!r.payable && <TagChip label={t('notPayable')} tone="amber" small />}
              </View>
              <Row gap={8}>
                {r.payable ? (
                  <Button label={t('sendPayLink')} icon="whatsapp" disabled={!r.whatsapp || link.isPending} loading={link.isPending && link.variables?.id === r.id} onPress={() => link.mutate(r)} style={{ flex: 2 }} />
                ) : (
                  <Button label={t('whatsapp')} icon="whatsapp" kind="light" disabled={!r.whatsapp} onPress={() => Linking.openURL('https://wa.me/' + r.whatsapp)} style={{ flex: 2 }} />
                )}
                <Button label={t('handled')} kind="light" disabled={dismiss.isPending} onPress={() => confirmStep({ label: t('handled'), confirm: t('handledConfirm', { n: r.number }), tone: 'primary' }, t('notNow'), () => dismiss.mutate(r))} style={{ flex: 1 }} />
              </Row>
            </View>
          )}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: space.sm },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.md, gap: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
