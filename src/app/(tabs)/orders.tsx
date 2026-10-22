import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api } from '../../lib/api';
import { useApiSession, useSession } from '../../lib/session';
import { color, font, radius, space } from '../../lib/theme';
import type { BulkAction, OrderView, PrepareView } from '../../lib/types';
import { confirmStep, showMessage } from '../../lib/confirm';
import { Button, Chips, Empty, ErrorState, Muted, Row, Screen, Segmented, Skeleton, Touch, Txt, tap } from '../../components/ui';
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
  // Select mode: tick orders, then one step for all of them (the dashboard's bulk bar, up to 20).
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const qc = useQueryClient();

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
  const bulk = first?.bulk ?? [];
  // A different list means a different selection.
  useEffect(() => { setPicked([]); }, [view, prepare, query]);
  useEffect(() => { if (!bulk.length) setSelecting(false); }, [bulk.length]);
  const toggle = (id: number) => { tap('select'); setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 20 ? p : [...p, id])); };
  const all = rows.filter((o) => !o.test).slice(0, 20).map((o) => o.id);
  const allPicked = all.length > 0 && all.every((id) => picked.includes(id));
  const run = useMutation({
    mutationFn: (a: BulkAction) => api.ordersBulk(session, picked, a.key),
    onSuccess: (r) => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(r.skipped.length ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Every order that did not change is listed with the store's reason.
      if (r.skipped.length) showMessage(t('updatedN', { n: r.updated }) + ' · ' + t('notUpdatedN', { n: r.skipped.length }), r.skipped.map((x) => '#' + x.number + ': ' + x.reason).join('\n'));
      setPicked([]);
      setSelecting(false);
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['home'] });
      qc.invalidateQueries({ queryKey: ['order'] });
    },
    onError: (e) => showMessage(t('notUpdated'), e.message),
  });
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
      {selecting && (
        <Row style={{ justifyContent: 'space-between', marginHorizontal: space.lg }}>
          <Touch onPress={() => { tap('select'); setPicked(allPicked ? [] : all); }} haptic={false} style={st.selAll}>
            <Row gap={8}>
              <View style={[st.tick, allPicked && st.ticked]}>{allPicked && <Icon name="check" size={13} stroke={2.6} tint={color.bg} />}</View>
              <Txt size={14} weight="medium">{allPicked ? t('clearAll') : t('selectAll')}</Txt>
            </Row>
          </Touch>
          <Muted size={12}>{picked.length ? t('nSelected', { n: picked.length }) : t('bulkMax')}</Muted>
        </Row>
      )}
    </View>
  );
  const right = bulk.length > 0 && rows.length > 0 ? (
    <Touch onPress={() => { setSelecting(!selecting); setPicked([]); }} style={st.selBtn}>
      <Txt size={15} weight="semibold" tint={color.ink}>{selecting ? t('done') : t('select')}</Txt>
    </Touch>
  ) : undefined;
  const main = bulk.filter((a) => a.tone === 'primary');
  const cancel = bulk.find((a) => a.tone === 'danger');
  const ask = (a: BulkAction) => confirmStep({ ...a, confirm: a.confirm.split('{n}').join(String(picked.length)) }, t('notNow'), () => run.mutate(a));

  return (
    <Screen title={t('orders')} header={header} right={right} scroll={false}>
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
              <OrderRow o={item} last={index === rows.length - 1} {...(selecting && !item.test ? { selected: picked.includes(item.id), onSelect: () => toggle(item.id) } : {})} />
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + (selecting ? 220 : 110) }}
          ListEmptyComponent={<Empty title={t('allClear')} body={query ? t('noMatch') : t('emptyList')} />}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={color.ink} style={{ margin: space.lg }} /> : undefined}
          refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => { q.refetch(); }} tintColor={color.ink} />}
          keyboardDismissMode="on-drag"
        />
      )}
      {selecting && (
        <View style={[st.bar, { paddingBottom: insets.bottom + 86 }]}>
          {main.map((a, i) => (
            <Button key={a.key} label={picked.length ? a.label + ' · ' + picked.length : t('pickOrders')} kind={i === 0 ? 'primary' : 'light'}
              loading={run.isPending && run.variables?.key === a.key} disabled={!picked.length || run.isPending} onPress={() => ask(a)} />
          ))}
          {cancel && picked.length > 0 && (
            <Touch onPress={() => ask(cancel)} disabled={run.isPending} style={{ alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 12 }}>
              <Txt size={14} weight="medium" tint={color.red} center>{cancel.label + ' · ' + picked.length}</Txt>
            </Touch>
          )}
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: radius.md, backgroundColor: color.sunken, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 15, color: color.ink, height: 44 },
  selBtn: { paddingHorizontal: 4, paddingVertical: 8 },
  selAll: { paddingVertical: 4 },
  tick: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: color.faint, alignItems: 'center', justifyContent: 'center' },
  ticked: { backgroundColor: color.ink, borderColor: color.ink },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 8, paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: color.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  cardRow: { backgroundColor: color.surface, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  top: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  bottom: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
});
