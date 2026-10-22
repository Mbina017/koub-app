import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useApiSession, useSession } from '../../lib/session';
import { color, font, radius, space } from '../../lib/theme';
import type { OrderView, PrepareView } from '../../lib/types';
import { Chips, Empty, ErrorState, Screen, Segmented, Skeleton } from '../../components/ui';
import { OrderRow } from '../../components/OrderRow';
import { Icon } from '../../components/Icon';

const VIEWS: OrderView[] = ['active', 'preorder', 'cod', 'gifts', 'all'];

export default function Orders() {
  const session = useApiSession();
  const { t } = useSession();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<OrderView>('active');
  const [prepare, setPrepare] = useState<PrepareView>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  // Home tiles open a specific list.
  useEffect(() => { if (params.view && VIEWS.includes(params.view as OrderView)) setView(params.view as OrderView); }, [params.view]);
  // Search after a short pause in typing, not on every key.
  useEffect(() => { const id = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(id); }, [search]);

  const q = useInfiniteQuery({
    queryKey: ['orders', view, prepare, query],
    queryFn: ({ pageParam }) => api.orders(session, { view, prepare, s: query, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
  });
  const first = q.data?.pages[0];
  const rows = q.data?.pages.flatMap((p) => p.orders) ?? [];
  const c = first?.counts ?? {};
  const label: Record<OrderView, string> = { active: t('viewActive'), preorder: t('viewPreorder'), cod: t('viewCod'), gifts: t('viewGifts'), all: t('viewAll') };

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.md }}>
      <View style={[st.search, { marginHorizontal: space.lg }]}>
        <Icon name="search" size={19} tint={color.muted} />
        <TextInput value={search} onChangeText={setSearch} placeholder={t('search')} placeholderTextColor={color.faint} style={st.searchInput} returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing" />
      </View>
      <Chips
        items={VIEWS.filter((v) => v === view || v === 'active' || v === 'all' || (c[v] ?? 0) > 0).map((v) => ({ key: v, label: label[v], count: v === 'all' ? undefined : c[v] }))}
        value={view}
        onChange={(v) => { setView(v); setPrepare('all'); }}
      />
      {view === 'active' && (
        <Segmented
          style={{ marginHorizontal: space.lg }}
          items={([['all', t('all')], ['bahrain', t('bahrain')], ['international', t('gcc')], ['pickup', t('pickup')]] as [PrepareView, string][]).map(([k, l]) => [k, k === 'all' ? l : `${l} ${c['prepare_' + k] ?? 0}`] as [PrepareView, string])}
          value={prepare}
          onChange={setPrepare}
        />
      )}
    </View>
  );

  return (
    <Screen title={t('orders')} header={header} scroll={false}>
      {q.isError && !first ? (
        <ErrorState onRetry={() => { q.refetch(); }} />
      ) : !first ? (
        <View style={{ padding: space.lg, gap: space.md }}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={92} r={radius.lg} />)}</View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(o) => String(o.id)}
          renderItem={({ item, index }) => (
            <View style={[st.cardRow, index === 0 && st.top, index === rows.length - 1 && st.bottom]}>
              <OrderRow o={item} last={index === rows.length - 1} />
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + 110 }}
          ListEmptyComponent={<Empty title={t('allClear')} body={query ? t('noMatch') : t('emptyList')} />}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={color.ink} style={{ margin: space.lg }} /> : undefined}
          refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => { q.refetch(); }} tintColor={color.ink} />}
          keyboardDismissMode="on-drag"
        />
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: radius.md, backgroundColor: color.sunken, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 15, color: color.ink, height: 44 },
  cardRow: { backgroundColor: color.surface, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  top: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  bottom: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
});
