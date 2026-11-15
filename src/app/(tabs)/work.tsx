// The work screen (API 1.17): what needs doing now, one big button per card.
// - Drinks: barista tickets from the till (waiting → ready → handed over), oldest first, with how long each waited.
// - To prepare: online and staff orders waiting for their next step, done from the card.
// Refreshes on its own, so it can stay open on the counter.
import { useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { useApiSession, useSession } from '../../lib/session';
import { color, radius, space } from '../../lib/theme';
import { money } from '../../lib/format';
import { confirmStep, showMessage } from '../../lib/confirm';
import type { BarTicket, OrderSummary } from '../../lib/types';
import { Button, Empty, Muted, Row, Screen, Segmented, Skeleton, TagChip, Touch, Txt } from '../../components/ui';
import { Icon } from '../../components/Icon';

const minutes = (iso: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)) : 0);

export default function Work() {
  const session = useApiSession();
  const { t } = useSession();
  const [lane, setLane] = useState<'bar' | 'prepare'>('bar');
  const bar = useQuery({ queryKey: ['bar'], queryFn: () => api.bar(session), refetchInterval: 10_000 });
  const prep = useQuery({ queryKey: ['orders', 'work'], queryFn: () => api.orders(session, { view: 'active', prepare: 'all' }), refetchInterval: 30_000 });
  const old = bar.error instanceof ApiError && bar.error.message === 'no_route';
  const waiting = bar.data?.tickets.filter((x) => x.state !== 'done').length ?? 0;
  const toPrep = prep.data?.orders.length ?? 0;

  return (
    <Screen title={t('work')} refreshing={bar.isRefetching || prep.isRefetching} onRefresh={() => { bar.refetch(); prep.refetch(); }}>
      <Segmented<'bar' | 'prepare'> items={[['bar', t('workBar') + (waiting ? ' · ' + waiting : '')], ['prepare', t('workPrepare') + (toPrep ? ' · ' + toPrep : '')]]} value={lane} onChange={setLane} style={{ marginBottom: space.md }} />
      {lane === 'bar' ? (
        old ? <View style={st.card}><Muted>{t('needsUpdate')}</Muted></View>
          : !bar.data ? [0, 1].map((i) => <Skeleton key={i} h={130} r={radius.lg} style={{ marginBottom: space.md }} />)
          : bar.data.tickets.length === 0 ? <Empty title={t('workBarEmpty')} icon="cash" />
          : bar.data.tickets.map((x) => <Ticket key={x.id} x={x} />)
      ) : !prep.data ? [0, 1].map((i) => <Skeleton key={i} h={130} r={radius.lg} style={{ marginBottom: space.md }} />)
        : prep.data.orders.length === 0 ? <Empty title={t('allClear')} icon="check" />
        : prep.data.orders.map((o) => <OrderCard key={o.id} o={o} label={prep.data!.bulk?.find((b) => b.key === o.next)?.label} />)}
    </Screen>
  );
}

function Ticket({ x }: { x: BarTicket }) {
  const session = useApiSession();
  const { t } = useSession();
  const qc = useQueryClient();
  const move = useMutation({
    mutationFn: (state: BarTicket['state']) => api.barSet(session, x.id, state),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bar'] }),
    onError: (e) => showMessage(t('notUpdated'), e.message),
  });
  const waited = minutes(x.since);
  const late = x.state === 'waiting' && waited >= 10 ? color.red : x.state === 'waiting' && waited >= 5 ? color.amber : color.muted;
  const done = x.state === 'done';
  return (
    <View style={[st.card, { gap: 10, marginBottom: space.md }, x.state === 'ready' && st.ready, done && { opacity: 0.5 }]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt size={20} weight="bold" style={{ flex: 1 }} lines={1}>{x.name || '#' + x.number}</Txt>
        <Txt size={14} weight="semibold" tint={late}>{t('workMin', { n: waited })}</Txt>
      </Row>
      {x.lines.map((l, i) => (
        <Row key={i} gap={10}><View style={st.qty}><Txt size={16} weight="bold" center>{l.qty}</Txt></View><Txt size={17} weight="medium" style={{ flex: 1 }}>{l.name}</Txt></Row>
      ))}
      {x.note ? <Muted>{x.note}</Muted> : null}
      <Muted size={12}>{'#' + x.number}</Muted>
      {x.state === 'waiting' && <Button label={t('workReady')} icon="check" loading={move.isPending} onPress={() => move.mutate('ready')} />}
      {x.state === 'ready' && (
        <Row gap={8}>
          {x.whatsapp && (
            <Touch onPress={() => Linking.openURL('https://wa.me/' + x.whatsapp + '?text=' + encodeURIComponent(t('workReadyMsg', { n: x.name || '' }))).catch(() => {})} style={st.side}>
              <Icon name="whatsapp" size={20} />
            </Touch>
          )}
          <Button label={t('workHanded')} icon="check" loading={move.isPending} onPress={() => move.mutate('done')} style={{ flex: 1 }} />
        </Row>
      )}
      {done && <Touch onPress={() => move.mutate('ready')} style={{ alignSelf: 'flex-start' }}><Muted>{t('workUndo')}</Muted></Touch>}
    </View>
  );
}

function OrderCard({ o, label }: { o: OrderSummary; label?: string }) {
  const session = useApiSession();
  const { t, lang } = useSession();
  const qc = useQueryClient();
  const step = useMutation({
    mutationFn: () => api.orderAction(session, o.id, o.next!),
    onSuccess: () => { for (const k of ['orders', 'run', 'home']) qc.invalidateQueries({ queryKey: [k] }); },
    onError: (e) => showMessage(t('notUpdated'), e.message),
  });
  return (
    <View style={[st.card, { gap: 8, marginBottom: space.md }]}>
      <Touch onPress={() => router.push({ pathname: '/order/[id]', params: { id: String(o.id) } })} style={{ gap: 6 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt size={17} weight="bold">{'#' + o.number + ' · ' + o.name}</Txt>
          <Txt size={15} weight="semibold">{money(o.total, lang)}</Txt>
        </Row>
        <Txt size={15}>{o.items}</Txt>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {o.tags.map((g, i) => <TagChip key={i} label={g.label} tone={g.tone} small />)}
          <Muted size={12}>{o.ago}</Muted>
        </Row>
      </Touch>
      {o.next && label ? (
        <Button label={label} icon="truck" loading={step.isPending}
          onPress={() => confirmStep({ label, confirm: t('workStepQ', { n: o.number, s: label }), tone: 'primary' }, t('notNow'), () => step.mutate())} />
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  card: { padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
  ready: { borderWidth: 2, borderColor: color.green },
  qty: { minWidth: 34, height: 34, borderRadius: 10, backgroundColor: color.sunken, justifyContent: 'center', paddingHorizontal: 6 },
  side: { width: 52, borderRadius: radius.md, backgroundColor: color.greenBg, alignItems: 'center', justifyContent: 'center' },
});
