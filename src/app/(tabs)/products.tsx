import { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { api, ApiError } from '../../lib/api';
import { confirmStep, showMessage } from '../../lib/confirm';
import { useApiSession, useSession } from '../../lib/session';
import { color, font, radius, space } from '../../lib/theme';
import { money, num } from '../../lib/format';
import type { Product, ProductFilter, ProductList } from '../../lib/types';
import { Button, Chips, Empty, ErrorState, Muted, Row, Screen, Skeleton, TagChip, Touch, Txt } from '../../components/ui';
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
  // Stock from the phone (API 1.3): the store's own change, lock and revision check; the row updates in place.
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Product | null>(null);
  const stock = useMutation({
    mutationFn: ({ p, delta }: { p: Product; delta: number }) => api.productStock(session, p.id, delta, p.revision ?? ''),
    onSuccess: (r, { p }) => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.setQueriesData<InfiniteData<ProductList>>({ queryKey: ['products'] }, (d) => d && { ...d, pages: d.pages.map((pg) => ({ ...pg, products: pg.products.map((x) => (x.id === p.id ? { ...x, stock: r.qty, revision: r.revision, state: r.state } : x)) })) });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['preorders'] });
      setEditing(null);
    },
    onError: (e) => { showMessage(t('stockNotSaved'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e.message); qc.invalidateQueries({ queryKey: ['products'] }); },
  });
  // Adding to an out-of-stock product sends a back-in-stock WhatsApp to the customers waiting, so ask first.
  const change = (p: Product, delta: number) => {
    if (delta > 0 && (p.stock ?? 0) <= 0 && p.waiting_alerts > 0) confirmStep({ label: t('addStock'), confirm: t('stockAlertConfirm', { n: p.waiting_alerts }), tone: 'primary' }, t('notNow'), () => stock.mutate({ p, delta }));
    else stock.mutate({ p, delta });
  };

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
          renderItem={({ item }) => <ProductRow p={item} busy={stock.isPending && stock.variables?.p.id === item.id} onStep={(d) => change(item, d)} onEdit={() => setEditing(item)} />}
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
      <StockSheet p={editing} busy={stock.isPending} onClose={() => setEditing(null)} onSave={(delta) => editing && change(editing, delta)} />
    </Screen>
  );
}

// A delivery or a count correction in one go: how many, then add or remove.
function StockSheet({ p, busy, onClose, onSave }: { p: Product | null; busy: boolean; onClose: () => void; onSave: (delta: number) => void }) {
  const { t } = useSession();
  const [n, setN] = useState('');
  useEffect(() => { setN(''); }, [p?.id]);
  const qty = Math.min(200, Math.max(0, parseInt(n.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))), 10) || 0));
  const have = p?.stock ?? 0;
  return (
    <Modal visible={!!p} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={st.sheet}>
          <Txt size={17} weight="bold" lines={2}>{p?.name ?? ''}</Txt>
          <Muted size={13}>{t('stockN', { n: have })}</Muted>
          <TextInput value={n} onChangeText={setN} placeholder={t('stockAmount')} placeholderTextColor={color.faint} keyboardType="number-pad" autoFocus maxLength={3} style={[st.amount, { textAlign: 'center' }]} />
          <Row gap={8}>
            <Button label={t('addN') + (qty ? ' ' + qty : '')} icon="check" disabled={!qty || busy} loading={busy} onPress={() => onSave(qty)} style={{ flex: 1 }} />
            <Button label={t('removeN') + (qty ? ' ' + qty : '')} kind="light" disabled={!qty || qty > Math.min(50, have) || busy} onPress={() => onSave(-qty)} style={{ flex: 1 }} />
          </Row>
          {qty > have && have >= 0 && qty <= 50 && <Muted size={12} center>{t('moreThanStock', { n: have })}</Muted>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ProductRow({ p, busy, onStep, onEdit }: { p: Product; busy: boolean; onStep: (delta: number) => void; onEdit: () => void }) {
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
      {p.stock !== null && p.quick && p.revision ? (
        <Row gap={4} style={{ opacity: busy ? 0.5 : 1 }}>
          <Touch onPress={() => onStep(-1)} disabled={busy || p.stock <= 0} style={st.step} accessibilityLabel={t('removeN')}><Txt size={20} weight="bold" tint={p.stock <= 0 ? color.faint : color.ink}>−</Txt></Touch>
          <Touch onPress={onEdit} disabled={busy} style={[st.stock, p.stock <= 0 && { backgroundColor: color.redBg }, p.stock > 0 && p.state === 'low' && { backgroundColor: color.amberBg }]} accessibilityLabel={t('addStock')}>
            <Txt size={18} weight="bold" center tint={p.stock <= 0 ? color.red : p.state === 'low' ? color.amber : color.ink} ltr>{String(p.stock)}</Txt>
          </Touch>
          <Touch onPress={() => onStep(1)} disabled={busy} style={st.step} accessibilityLabel={t('addN')}><Txt size={20} weight="bold">+</Txt></Touch>
        </Row>
      ) : p.stock !== null && (
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
  step: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: color.bg, padding: space.lg, paddingBottom: space.xl * 1.5, gap: space.md, borderTopLeftRadius: radius.lg * 1.5, borderTopRightRadius: radius.lg * 1.5 },
  amount: { height: 56, borderRadius: radius.md, backgroundColor: color.sunken, fontFamily: font.bold, fontSize: 24, color: color.ink },
  stock: { minWidth: 48, height: 48, borderRadius: 24, paddingHorizontal: 8, backgroundColor: color.sunken, alignItems: 'center', justifyContent: 'center' },
});
