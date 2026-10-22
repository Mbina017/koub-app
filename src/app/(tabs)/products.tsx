import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { api } from '../../lib/api';
import { useApiSession, useSession } from '../../lib/session';
import { color, font, radius, space } from '../../lib/theme';
import { money, num } from '../../lib/format';
import type { Product, ProductFilter } from '../../lib/types';
import { Chips, Empty, ErrorState, Muted, Row, Screen, Skeleton, TagChip, Txt } from '../../components/ui';
import { Icon } from '../../components/Icon';

const FILTERS: ProductFilter[] = ['all', 'low', 'out', 'preorder', 'draft'];

export default function Products() {
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<ProductFilter>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => { if (params.filter && FILTERS.includes(params.filter as ProductFilter)) setFilter(params.filter as ProductFilter); }, [params.filter]);
  useEffect(() => { const id = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(id); }, [search]);

  const q = useInfiniteQuery({
    queryKey: ['products', filter, query],
    queryFn: ({ pageParam }) => api.products(session, { filter, s: query, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
  });
  const first = q.data?.pages[0];
  const rows = q.data?.pages.flatMap((p) => p.products) ?? [];
  const label: Record<ProductFilter, string> = { all: t('f_all'), low: t('f_low'), out: t('f_out'), preorder: t('f_preorder'), draft: t('f_draft') };

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.md }}>
      <View style={[st.search, { marginHorizontal: space.lg }]}>
        <Icon name="search" size={19} tint={color.muted} />
        <TextInput value={search} onChangeText={setSearch} placeholder={t('searchProducts')} placeholderTextColor={color.faint} style={[st.searchInput, { textAlign: lang === 'ar' ? 'right' : 'left' }]} returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing" />
      </View>
      <Chips items={FILTERS.filter((f) => f === 'all' || f === filter || (first?.counts[f] ?? 0) > 0).map((f) => ({ key: f, label: label[f], count: first?.counts[f] }))} value={filter} onChange={setFilter} />
    </View>
  );

  return (
    <Screen title={t('products')} header={header} scroll={false}>
      {q.isError && !first ? <ErrorState onRetry={() => { q.refetch(); }} /> : !first ? (
        <View style={{ padding: space.lg, gap: space.md }}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={76} r={radius.lg} />)}</View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => <ProductRow p={item} />}
          ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + 110 }}
          ListEmptyComponent={<Empty title={t('noProducts')} icon="products" />}
          ListFooterComponent={rows.length ? <Muted size={12} center style={{ marginTop: space.lg }}>{t('profitNote')}</Muted> : undefined}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => { q.refetch(); }} tintColor={color.ink} />}
          keyboardDismissMode="on-drag"
        />
      )}
    </Screen>
  );
}

function ProductRow({ p }: { p: Product }) {
  const { t, lang } = useSession();
  const pill = p.preorder ? { label: t('f_preorder'), tone: 'blue' as const }
    : p.state === 'out' ? { label: t('soldOut') + (p.waiting_alerts ? ' · ' + t('wantAlert', { n: p.waiting_alerts }) : ''), tone: 'red' as const }
    : p.state === 'low' ? { label: t('low') + (p.waiting_alerts ? ' · ' + t('wantAlert', { n: p.waiting_alerts }) : ''), tone: 'amber' as const }
    : p.state === 'draft' ? { label: t('draft'), tone: 'muted' as const } : null;
  return (
    <Row gap={12} style={st.row}>
      <View style={st.thumb}>{p.image ? <Image source={p.image} style={{ width: 56, height: 56 }} contentFit="cover" transition={150} /> : <Icon name="products" size={26} tint={color.faint} />}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt size={15} weight="semibold" lines={1}>{p.name}</Txt>
        <Muted size={13}>{money(p.price, lang) + ' · ' + (p.profit !== null ? t('profitShort', { x: num(p.profit) }) : t('costMissing'))}</Muted>
        {pill && <View style={{ marginTop: 4 }}><TagChip label={pill.label} tone={pill.tone} small /></View>}
      </View>
      {p.stock !== null && (
        <View style={[st.stock, p.stock <= 0 && { backgroundColor: color.redBg }, p.stock > 0 && p.state === 'low' && { backgroundColor: color.amberBg }]}>
          <Txt size={18} weight="bold" center tint={p.stock <= 0 ? color.red : p.state === 'low' ? color.amber : color.ink} ltr>{String(p.stock)}</Txt>
        </View>
      )}
    </Row>
  );
}

const st = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: radius.md, backgroundColor: color.sunken, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 15, color: color.ink, height: 44 },
  row: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  thumb: { width: 56, height: 56, borderRadius: 14, backgroundColor: color.sunken, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stock: { minWidth: 48, height: 48, borderRadius: 24, paddingHorizontal: 8, backgroundColor: color.sunken, alignItems: 'center', justifyContent: 'center' },
});
