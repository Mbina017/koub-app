// The work screen (API 1.17): what needs doing now, one big button per card.
// - To hand over: every paid till sale, oldest first, with how long each waited. One tap "Handed over" (or a swipe)
//   clears it; "Ready" is optional, to tell the customer. Recently handed-over ones fold away at the bottom (undo).
// - To prepare: online and staff orders waiting for their next step, done from the card.
// Refreshes on its own, so it can stay open on the counter.
import { useEffect, useState } from 'react';
import { Linking, Modal, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SwipeCard } from '../../components/SwipeCard';
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
  // A tablet (or a wide window) shows both lanes side by side.
  const wide = useWindowDimensions().width >= 768;

  const barLane = old ? <View style={st.card}><Muted>{t('needsUpdate')}</Muted></View>
    : !bar.data ? [0, 1].map((i) => <Skeleton key={i} h={130} r={radius.lg} style={{ marginBottom: space.md }} />)
    : <HandOver tickets={bar.data.tickets} />;
  const prepLane = !prep.data ? [0, 1].map((i) => <Skeleton key={i} h={130} r={radius.lg} style={{ marginBottom: space.md }} />)
    : prep.data.orders.length === 0 ? <Empty title={t('allClear')} icon="check" />
    : prep.data.orders.map((o) => <OrderCard key={o.id} o={o} label={prep.data!.bulk?.find((b) => b.key === o.next)?.label} />);

  return (
    <Screen title={t('work')} refreshing={bar.isRefetching || prep.isRefetching} onRefresh={() => { bar.refetch(); prep.refetch(); }}>
      {wide ? (
        <Row align="flex-start" gap={space.lg}>
          <View style={{ flex: 1 }}><Txt size={17} weight="bold" style={{ marginBottom: space.sm }}>{t('workBar') + (waiting ? ' · ' + waiting : '')}</Txt>{barLane}</View>
          <View style={{ flex: 1 }}><Txt size={17} weight="bold" style={{ marginBottom: space.sm }}>{t('workPrepare') + (toPrep ? ' · ' + toPrep : '')}</Txt>{prepLane}</View>
        </Row>
      ) : (
        <>
          <Segmented<'bar' | 'prepare'> items={[['bar', t('workBar') + (waiting ? ' · ' + waiting : '')], ['prepare', t('workPrepare') + (toPrep ? ' · ' + toPrep : '')]]} value={lane} onChange={setLane} style={{ marginBottom: space.md }} />
          {lane === 'bar' ? barLane : prepLane}
        </>
      )}
      <Tips />
    </Screen>
  );
}

// First visit on this phone: three short tips, then never again.
const TIPS = 'koub.tips.work.v1';
function Tips() {
  const { t } = useSession();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  useEffect(() => {
    (async () => {
      try { const seen = Platform.OS === 'web' ? globalThis.localStorage?.getItem(TIPS) : await SecureStore.getItemAsync(TIPS); if (!seen) setOpen(true); } catch { /* skip */ }
    })();
  }, []);
  const close = () => {
    setOpen(false);
    try { if (Platform.OS === 'web') globalThis.localStorage?.setItem(TIPS, '1'); else SecureStore.setItemAsync(TIPS, '1').catch(() => {}); } catch { /* skip */ }
  };
  const tips: [string, string][] = [[t('tip1Title'), t('tip1Body')], [t('tip2Title'), t('tip2Body')], [t('tip3Title'), t('tip3Body')]];
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <View style={st.shade}>
        <View style={[st.card, { gap: space.md, padding: space.lg, maxWidth: 440, width: '100%', alignSelf: 'center' }]}>
          <Muted size={12}>{(page + 1) + ' / ' + tips.length}</Muted>
          <Txt size={20} weight="bold">{tips[page][0]}</Txt>
          <Txt size={15}>{tips[page][1]}</Txt>
          <Row gap={8}>
            <Button label={page < tips.length - 1 ? t('nextStep') : t('done')} onPress={() => (page < tips.length - 1 ? setPage(page + 1) : close())} style={{ flex: 1 }} />
            {page < tips.length - 1 && <Button label={t('skip')} kind="ghost" onPress={close} />}
          </Row>
        </View>
      </View>
    </Modal>
  );
}

function HandOver({ tickets }: { tickets: BarTicket[] }) {
  const { t } = useSession();
  const [showDone, setShowDone] = useState(false);
  // Customers waiting in the car outside come first (API 1.31); otherwise oldest first, as the store sends them.
  const open = tickets.filter((x) => x.state !== 'done').sort((a, b) => Number(!!b.arrived) - Number(!!a.arrived));
  const done = tickets.filter((x) => x.state === 'done');
  return (
    <>
      {open.length === 0 ? <Empty title={t('workBarEmpty')} icon="check" /> : open.map((x) => <Ticket key={x.id} x={x} />)}
      {done.length > 0 && (
        <Touch onPress={() => setShowDone(!showDone)} style={{ alignSelf: 'center', paddingVertical: space.sm }}>
          <Muted>{t('workRecent', { n: done.length }) + (showDone ? '  ▴' : '  ▾')}</Muted>
        </Touch>
      )}
      {showDone && done.map((x) => <Ticket key={x.id} x={x} />)}
    </>
  );
}

function Ticket({ x }: { x: BarTicket }) {
  const session = useApiSession();
  const { t, lang } = useSession();
  const qc = useQueryClient();
  const move = useMutation({
    mutationFn: (state: BarTicket['state']) => api.barSet(session, x.id, state),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bar'] }),
    onError: (e) => showMessage(t('notUpdated'), e.message),
  });
  // API 1.27: Start (who is making it) and one item ready; the store moves the ticket to ready when all are.
  const start = useMutation({
    mutationFn: (take: boolean) => api.barStart(session, x.id, take),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bar'] }),
    onError: (e) => showMessage(t('notUpdated'), e.message),
  });
  const item = useMutation({
    mutationFn: (v: { i: number; ready: boolean }) => api.barItem(session, x.id, v.i, v.ready),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bar'] }),
    onError: (e) => showMessage(t('notUpdated'), e.message),
  });
  const perItem = x.lines.some((l) => l.i !== undefined);
  const readyN = x.lines.filter((l) => l.ready).length;
  const waited = minutes(x.since);
  const late = x.state === 'waiting' && waited >= 10 ? color.red : x.state === 'waiting' && waited >= 5 ? color.amber : color.muted;
  const done = x.state === 'done';
  return (
    <SwipeCard label={done ? undefined : t('workHanded')} onSwipe={done ? undefined : () => move.mutate('done')} disabled={move.isPending} style={{ marginBottom: space.md }}>
    <View style={[st.card, { gap: 10 }, x.state === 'ready' && st.ready, done && { opacity: 0.5 }]}>
      <Row style={{ justifyContent: 'space-between' }}>
        {x.no ? <View style={st.no}><Txt size={20} weight="bold" tint={color.bg} center>{String(x.no)}</Txt></View> : null}
        <Txt size={20} weight="bold" style={{ flex: 1 }} lines={1}>{x.name || '#' + x.number}</Txt>
        <Txt size={14} weight="semibold" tint={late}>{t('workMin', { n: waited })}</Txt>
      </Row>
      {x.started && !done && (
        <Row gap={6}><View style={[st.dotSm, { backgroundColor: x.started.mine ? color.green : color.amber }]} /><Muted size={13}>{t('workStartedBy', { n: x.started.mine ? t('you') : x.started.by })}</Muted>
          {!x.started.mine && <Touch onPress={() => start.mutate(true)} disabled={start.isPending}><Txt size={13} weight="semibold" tint={color.ink}>{' · ' + t('workTake')}</Txt></Touch>}</Row>
      )}
      {x.lines.map((l, i) => {
        const line = (<><View style={[st.qty, l.ready && { backgroundColor: color.green }]}>{l.ready ? <Icon name="check" size={18} tint={color.bg} /> : <Txt size={16} weight="bold" center>{l.qty}</Txt>}</View><View style={{ flex: 1 }}><Txt size={17} weight="medium" style={l.ready ? { textDecorationLine: 'line-through', color: color.muted } : undefined}>{(l.ready ? l.qty + '× ' : '') + l.name}</Txt>{l.options ? <Txt size={14} weight="semibold" tint={color.amber}>{l.options}</Txt> : null}</View>{l.drink === false && <Icon name="products" size={16} tint={color.faint} />}</>);
        // Tap an item when it is made (API 1.27); older stores have no item index, so the line stays plain.
        return perItem && !done
          ? <Touch key={i} onPress={() => item.mutate({ i: l.i!, ready: !l.ready })} style={st.lineRow} accessibilityState={{ checked: !!l.ready }}>{line}</Touch>
          : <Row key={i} gap={10}>{line}</Row>;
      })}
      {perItem && !done && x.lines.length > 1 && <Muted size={12}>{t('workItemsReady', { r: readyN, n: x.lines.length })}</Muted>}
      {x.arrived && !done ? (
        <View style={st.arrived}><Txt size={16} weight="bold" tint={color.bg}>{t('workArrived', { n: minutes(x.arrived.at) })}</Txt>{x.arrived.spot ? <Txt size={15} weight="semibold" tint={color.bg}>{'📍 ' + x.arrived.spot}</Txt> : null}</View>
      ) : null}
      {x.pickup ? <View style={[st.where, { backgroundColor: color.blueBg }]}><Txt size={15} weight="semibold">{t('workPickup', { t: new Date(x.pickup).toLocaleTimeString(lang === 'ar' ? 'ar-BH' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bahrain' }) })}</Txt></View> : null}
      {x.where ? <View style={st.where}><Txt size={15} weight="semibold">{x.where}</Txt></View> : null}
      {x.note ? <Muted>{x.note}</Muted> : null}
      <Muted size={12}>{'#' + x.number}</Muted>
      {!done && (
        <Row gap={8}>
          {x.state === 'waiting' && perItem && !x.started && <Button label={t('workStart')} kind="light" disabled={start.isPending} onPress={() => start.mutate(false)} />}
          {x.state === 'waiting' && <Button label={t('workReady')} kind="ghost" disabled={move.isPending} onPress={() => move.mutate('ready')} />}
          {x.state === 'ready' && x.whatsapp && (
            <Touch onPress={() => Linking.openURL('https://wa.me/' + x.whatsapp + '?text=' + encodeURIComponent(t('workReadyMsg', { n: x.name || '' }))).catch(() => {})} style={st.side}>
              <Icon name="whatsapp" size={20} />
            </Touch>
          )}
          <Button label={t('workHanded')} icon="check" loading={move.isPending} onPress={() => move.mutate('done')} style={{ flex: 1 }} />
        </Row>
      )}
      {done && <Touch onPress={() => move.mutate('waiting')} style={{ alignSelf: 'flex-start' }}><Muted>{t('workUndo')}</Muted></Touch>}
    </View>
    </SwipeCard>
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
    <SwipeCard label={o.next ? label : undefined} onSwipe={o.next && label ? () => step.mutate() : undefined} disabled={step.isPending} style={{ marginBottom: space.md }}>
    <View style={[st.card, { gap: 8 }]}>
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
    </SwipeCard>
  );
}

const st = StyleSheet.create({
  card: { padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
  ready: { borderWidth: 2, borderColor: color.green },
  arrived: { borderRadius: radius.md, backgroundColor: color.green, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  where: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: color.amberBg },
  no: { minWidth: 40, height: 40, borderRadius: 12, paddingHorizontal: 8, backgroundColor: color.ink, justifyContent: 'center', marginEnd: 10 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  dotSm: { width: 8, height: 8, borderRadius: 4 },
  qty: { minWidth: 34, height: 34, borderRadius: 10, backgroundColor: color.sunken, justifyContent: 'center', paddingHorizontal: 6 },
  shade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: space.lg },
  side: { width: 52, borderRadius: radius.md, backgroundColor: color.greenBg, alignItems: 'center', justifyContent: 'center' },
});
