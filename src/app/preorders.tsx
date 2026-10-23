// Pre-orders by item: what each waiting order needs, and one tap to move an item's orders to To prepare when its stock arrives.
import { FlatList, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, radius, space } from '../lib/theme';
import type { PreorderGroup } from '../lib/types';
import { confirmStep, showMessage } from '../lib/confirm';
import { Button, Empty, ErrorState, Muted, Row, Skeleton, TagChip, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

export default function Preorders() {
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['preorders'], queryFn: () => api.preorders(session) });
  const release = useMutation({
    mutationFn: (g: PreorderGroup) => api.preordersRelease(session, g.key, g.ready_ids),
    onSuccess: (r) => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(r.skipped.length ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success).catch(() => {});
      showMessage(t('releasedN', { n: r.updated }), r.skipped.map((x) => '#' + x.number + ': ' + x.reason).join('\n'));
      for (const k of ['preorders', 'orders', 'home', 'order']) qc.invalidateQueries({ queryKey: [k] });
    },
    onError: (e) => showMessage(t('notUpdated'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e.message),
  });
  const groups = q.data?.groups ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/orders'))} style={st.iconBtn} accessibilityLabel="back">
          <Icon name="back" size={24} rtl={lang === 'ar'} />
        </Touch>
        <Txt size={19} weight="bold" style={{ flex: 1 }}>{t('preorderBoard')}</Txt>
      </Row>
      {q.isError && !q.data ? (
        <ErrorState onRetry={() => { q.refetch(); }} />
      ) : !q.data ? (
        <View style={{ padding: space.lg, gap: space.md }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={150} r={radius.lg} />)}</View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.key}
          contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl }}
          ListEmptyComponent={<Empty title={t('noPreorders')} icon="check" />}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={color.ink} />}
          renderItem={({ item: g }) => (
            <View style={st.card}>
              <Row gap={12}>
                <View style={st.thumb}>{g.image ? <Image source={g.image} style={{ width: 56, height: 56 }} contentFit="cover" transition={150} /> : <Icon name="products" size={26} tint={color.faint} />}</View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt size={16} weight="semibold" lines={2}>{g.name}</Txt>
                  <Muted size={13}>{t('waitingOrders', { n: g.orders }) + ' · ' + t('neededQty', { n: g.qty }) + (g.ago ? ' · ' + t('oldestSince', { x: g.ago }) : '')}</Muted>
                </View>
                {g.stock !== null && <TagChip label={t('stockN', { n: g.stock })} tone={g.stock >= g.qty ? 'green' : g.stock > 0 ? 'amber' : 'red'} small />}
              </Row>
              {g.mixed > 0 && <Muted size={12}>{t('mixedNote', { n: g.mixed })}</Muted>}
              <Row gap={8}>
                {g.ready > 0 && (
                  <Button
                    label={t('arrivedPrepare', { n: g.ready })}
                    icon="check"
                    loading={release.isPending && release.variables?.key === g.key}
                    disabled={release.isPending}
                    onPress={() => confirmStep({ label: t('arrived'), confirm: g.confirm, tone: 'primary' }, t('notNow'), () => release.mutate(g))}
                    style={{ flex: 2 }}
                  />
                )}
                <Button label={t('viewOrders')} kind="light" onPress={() => router.navigate({ pathname: '/orders', params: { view: 'preorder' } })} style={{ flex: 1 }} />
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
  thumb: { width: 56, height: 56, borderRadius: 14, backgroundColor: color.sunken, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
