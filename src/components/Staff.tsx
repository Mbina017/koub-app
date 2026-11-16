// Staff screens (API 1.40). A staff member picks where they work on this device:
// - In the kiosk: the orders to make (who took each, what is in it) with one button, "Ready", which tells the person
//   who took it; and the store's pickup orders (number, items, paid or pay on pickup) with "Handed over".
// - Outside: "New order" (the till) and "My orders": the orders they took, being made or ready, and "Handed over".
// Staff see nothing else: no store orders, customers, amounts of the day or day close.
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession, type StaffRole } from '../lib/session';
import { color, radius, space } from '../lib/theme';
import { money } from '../lib/format';
import { confirmStep, showMessage } from '../lib/confirm';
import type { BarTicket, PickupOrder } from '../lib/types';
import { Logo } from './Logo';
import { Button, Empty, Muted, Row, Screen, Segmented, Skeleton, TagChip, Touch, Txt } from './ui';
import { Icon } from './Icon';

const minutes = (iso: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)) : 0);
const later = (x: BarTicket) => x.state === 'waiting' && !!x.fire_at && new Date(x.fire_at).getTime() > Date.now();
const fail = (t: (k: never) => string) => (e: Error) => showMessage(t('notUpdated' as never), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate' as never) : e.message);

// ---- First thing after sign-in: where do you work today?
export function RolePicker() {
  const { t, setStaffRole, me } = useSession();
  const pick = (r: StaffRole) => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); setStaffRole(r); };
  return (
    <Screen>
      <View style={{ paddingTop: space.xl, gap: space.lg, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
        <Logo width={170} center />
        <View style={{ gap: 4 }}>
          <Txt size={26} weight="bold" center>{t('roleTitle')}</Txt>
          <Muted center>{me?.name ? me.name + ' · ' : ''}{t('roleHint')}</Muted>
        </View>
        {(['inside', 'outside'] as StaffRole[]).map((r) => (
          <Touch key={r} onPress={() => pick(r)} style={st.role} accessibilityRole="button">
            <Txt size={22} weight="bold">{t(r === 'inside' ? 'roleInside' : 'roleOutside')}</Txt>
            <Muted>{t(r === 'inside' ? 'roleInsideHint' : 'roleOutsideHint')}</Muted>
          </Touch>
        ))}
      </View>
    </Screen>
  );
}

// ---- The small menu staff have instead of "More": change place, language, sign out.
export function StaffMenu() {
  const { t, staffRole, setStaffRole, langPref, setLangPref, signOut, me } = useSession();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  return (
    <>
      <Touch onPress={() => setOpen(true)} style={st.menuBtn} accessibilityLabel={t('staffMenu')}><Icon name="more" size={22} /></Touch>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Touch onPress={() => setOpen(false)} style={st.shade} accessibilityLabel="close">
          <View style={[st.card, { gap: space.md, padding: space.lg, maxWidth: 420, width: '100%', alignSelf: 'center' }]} onStartShouldSetResponder={() => true}>
            {me?.name ? <Txt size={17} weight="bold">{me.name}</Txt> : null}
            <Muted>{t('roleNow', { r: t(staffRole === 'inside' ? 'roleInside' : 'roleOutside') })}</Muted>
            <Button label={t('roleSwitch')} icon="users" kind="light" onPress={() => { setOpen(false); setStaffRole(null); }} />
            <Segmented<'ar' | 'en'> items={[['ar', 'العربية'], ['en', 'English']]} value={langPref === 'en' ? 'en' : 'ar'} onChange={(v) => { setLangPref(v).then(() => qc.invalidateQueries()); }} />
            <Button label={t('signOut')} icon="logout" kind="ghost" onPress={() => { setOpen(false); signOut(); }} />
          </View>
        </Touch>
      </Modal>
    </>
  );
}

// ---- In the kiosk: orders to make, and store pickups.
export function Kiosk() {
  const session = useApiSession();
  const { t } = useSession();
  const bar = useQuery({ queryKey: ['bar'], queryFn: () => api.bar(session), refetchInterval: 8_000 });
  const pick = useQuery({ queryKey: ['bar-pickup'], queryFn: () => api.barPickup(session), refetchInterval: 30_000, retry: false });
  const tickets = (bar.data?.tickets ?? []).filter((x) => x.state !== 'done' && !later(x))
    // Waiting first (oldest first, as the store sends them), then the ready ones still to be taken out.
    .sort((a, b) => Number(a.state === 'ready') - Number(b.state === 'ready'));
  const waiting = tickets.filter((x) => x.state === 'waiting').length;
  const pickups = pick.data?.orders ?? [];
  const [lane, setLane] = useState<'orders' | 'pickup'>('orders');
  return (
    <Screen title={t('kioskTitle')} right={<StaffMenu />} refreshing={bar.isRefetching} onRefresh={() => { bar.refetch(); pick.refetch(); }}>
      <Segmented<'orders' | 'pickup'> items={[['orders', t('kioskOrders') + (waiting ? ' · ' + waiting : '')], ['pickup', t('kioskPickups') + (pickups.length ? ' · ' + pickups.length : '')]]} value={lane} onChange={setLane} style={{ marginBottom: space.md }} />
      {lane === 'orders' ? (
        !bar.data ? [0, 1].map((i) => <Skeleton key={i} h={140} r={radius.lg} style={{ marginBottom: space.md }} />)
          : tickets.length === 0 ? <Empty title={t('kioskEmpty')} icon="check" />
          : tickets.map((x) => <KioskTicket key={x.id} x={x} />)
      ) : (
        pick.error instanceof ApiError && pick.error.message === 'no_route' ? <View style={st.card}><Muted>{t('needsUpdate')}</Muted></View>
          : !pick.data ? [0].map((i) => <Skeleton key={i} h={120} r={radius.lg} />)
          : pickups.length === 0 ? <Empty title={t('allClear')} icon="check" />
          : <>{pickups.map((o) => <PickupCard key={o.id} o={o} />)}<Muted size={12} center>{t('pickupHint')}</Muted></>
      )}
    </Screen>
  );
}

function Lines({ x }: { x: BarTicket }) {
  return (
    <View style={{ gap: 6 }}>
      {x.lines.map((l, i) => (
        <Row key={i} gap={10}>
          <View style={st.qty}><Txt size={16} weight="bold" center>{l.qty}</Txt></View>
          <View style={{ flex: 1 }}>
            <Txt size={17} weight="medium">{l.name}</Txt>
            {l.options ? <Txt size={14} weight="semibold" tint={color.amber}>{l.options}</Txt> : null}
          </View>
        </Row>
      ))}
    </View>
  );
}

function Head({ x }: { x: BarTicket }) {
  const { t } = useSession();
  const waited = minutes(x.since);
  const late = x.state === 'waiting' && waited >= 10 ? color.red : x.state === 'waiting' && waited >= 5 ? color.amber : color.muted;
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      {x.no ? <View style={st.no}><Txt size={22} weight="bold" tint={color.bg} center>{String(x.no)}</Txt></View> : null}
      <Txt size={17} weight="bold" style={{ flex: 1 }}>{'#' + x.number}</Txt>
      <Txt size={14} weight="semibold" tint={late}>{t('workMin', { n: waited })}</Txt>
    </Row>
  );
}

function KioskTicket({ x }: { x: BarTicket }) {
  const session = useApiSession();
  const { t } = useSession();
  const qc = useQueryClient();
  const move = useMutation({
    mutationFn: (state: BarTicket['state']) => api.barSet(session, x.id, state),
    onSuccess: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); qc.invalidateQueries({ queryKey: ['bar'] }); },
    onError: fail(t as never),
  });
  const ready = x.state === 'ready';
  return (
    <View style={[st.card, { gap: 10, marginBottom: space.md }, ready && { opacity: 0.6 }]}>
      <Head x={x} />
      <Row gap={6}><Icon name="users" size={16} tint={color.muted} /><Txt size={15} weight="semibold" tint={color.inkSoft}>{x.by ? t('kioskBy', { n: x.by }) : t('kioskOnline')}</Txt></Row>
      <Lines x={x} />
      {x.where ? <View style={st.where}><Txt size={15} weight="semibold">{x.where}</Txt></View> : null}
      {x.arrived ? <View style={st.arrived}><Txt size={15} weight="bold" tint={color.bg}>{t('workArrived', { n: minutes(x.arrived.at) })}{x.arrived.spot ? ' · 📍 ' + x.arrived.spot : ''}</Txt></View> : null}
      {x.note ? <Muted>{x.note}</Muted> : null}
      {ready ? (
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt size={15} weight="semibold" tint={color.green}>{t('kioskReadyWait')}</Txt>
          <Touch onPress={() => move.mutate('waiting')} disabled={move.isPending}><Muted>{t('workUndo')}</Muted></Touch>
        </Row>
      ) : (
        <Button label={t('kioskReady')} icon="check" loading={move.isPending} onPress={() => move.mutate('ready')} />
      )}
    </View>
  );
}

function PickupCard({ o }: { o: PickupOrder }) {
  const session = useApiSession();
  const { t, lang } = useSession();
  const qc = useQueryClient();
  const done = useMutation({
    mutationFn: () => api.barPickupDone(session, o.id),
    onSuccess: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); qc.invalidateQueries({ queryKey: ['bar-pickup'] }); },
    onError: (e: Error) => { qc.invalidateQueries({ queryKey: ['bar-pickup'] }); fail(t as never)(e); },
  });
  return (
    <View style={[st.card, { gap: 10, marginBottom: space.md }]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt size={24} weight="bold" ltr>{'#' + o.number}</Txt>
        <TagChip label={o.cod ? t('pickupCod', { x: money(o.collect ?? 0, lang) }) : t('pickupPaid')} tone={o.cod ? 'amber' : 'green'} />
      </Row>
      {o.lines.map((l, i) => (
        <Row key={i} gap={10}>
          <View style={st.qty}><Txt size={16} weight="bold" center>{l.qty}</Txt></View>
          <Txt size={17} weight="medium" style={{ flex: 1 }}>{l.name}</Txt>
        </Row>
      ))}
      <Button label={t('pickupDone')} icon="check" loading={done.isPending}
        onPress={() => confirmStep({ label: t('pickupDone'), confirm: t('pickupDoneQ', { n: o.number }), tone: 'primary' }, t('notNow'), () => done.mutate())} />
    </View>
  );
}

// ---- Outside: the orders I took. Ready ones glow, and the phone buzzes when one turns ready.
export function MyOrders() {
  const session = useApiSession();
  const { t } = useSession();
  const bar = useQuery({ queryKey: ['bar'], queryFn: () => api.bar(session), refetchInterval: 8_000 });
  // Mine, plus orders customers placed themselves on the online menu (nobody took them), so someone outside brings
  // them out; they show "Online order" on the card.
  const mine = (bar.data?.tickets ?? []).filter((x) => x.mine || (x.online && !x.by));
  const open = mine.filter((x) => x.state !== 'done').sort((a, b) => Number(b.state === 'ready') - Number(a.state === 'ready'));
  const done = mine.filter((x) => x.state === 'done');
  const [showDone, setShowDone] = useState(false);
  // The "ready" alert and the red count live in the tab bar (ReadyWatch), so they show on every screen.
  return (
    <Screen title={t('myTitle')} right={<StaffMenu />} refreshing={bar.isRefetching} onRefresh={() => { bar.refetch(); }}>
      {!bar.data ? [0, 1].map((i) => <Skeleton key={i} h={130} r={radius.lg} style={{ marginBottom: space.md }} />)
        : open.length === 0 ? <Empty title={t('myEmpty')} icon="cash" />
        : open.map((x) => <MyTicket key={x.id} x={x} />)}
      {done.length > 0 && (
        <Touch onPress={() => setShowDone(!showDone)} style={{ alignSelf: 'center', paddingVertical: space.sm }}>
          <Muted>{t('myRecent', { n: done.length }) + (showDone ? '  ▴' : '  ▾')}</Muted>
        </Touch>
      )}
      {showDone && done.map((x) => <MyTicket key={x.id} x={x} />)}
    </Screen>
  );
}

function MyTicket({ x }: { x: BarTicket }) {
  const session = useApiSession();
  const { t } = useSession();
  const qc = useQueryClient();
  const move = useMutation({
    mutationFn: (state: BarTicket['state']) => api.barSet(session, x.id, state),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bar'] }),
    onError: fail(t as never),
  });
  const ready = x.state === 'ready';
  const done = x.state === 'done';
  return (
    <View style={[st.card, { gap: 10, marginBottom: space.md }, ready && st.ready, done && { opacity: 0.5 }]}>
      <Head x={x} />
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        <TagChip label={done ? t('myHanded') : ready ? t('myReady') : t('myMaking')} tone={done ? 'muted' : ready ? 'green' : 'amber'} />
        {x.online && !x.by ? <TagChip label={t('kioskOnline')} tone="blue" /> : null}
      </Row>
      <Lines x={x} />
      {x.where ? <View style={st.where}><Txt size={15} weight="semibold">{x.where}</Txt></View> : null}
      {done ? <Touch onPress={() => move.mutate('ready')} style={{ alignSelf: 'flex-start' }} disabled={move.isPending}><Muted>{t('workUndo')}</Muted></Touch>
        : <Button label={t('myHanded')} icon="check" kind={ready ? 'primary' : 'light'} loading={move.isPending} onPress={() => move.mutate('done')} />}
    </View>
  );
}

// ---- Outside staff, on every screen (API 1.40): the orders they take out (theirs and online-menu ones) are checked
// every few seconds. The "My orders" tab shows a red count of the ready ones, and when one turns ready the phone
// buzzes (app) or chimes (browser) and a green banner says which order and where. No refresh needed.
const mineOrOnline = (x: BarTicket) => !!x.mine || (!!x.online && !x.by);
let audio: AudioContext | null = null;
// Browsers only play sound after a tap: the first tap anywhere unlocks it for the chime.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const unlock = () => {
    try { const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }); audio = audio ?? new (AC.AudioContext ?? AC.webkitAudioContext!)(); audio.resume().catch(() => {}); } catch { /* no sound */ }
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
}
function chime() {
  if (Platform.OS !== 'web') { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); return; }
  try {
    if (!audio) return;
    const t0 = audio.currentTime;
    [[880, 0], [1175, 0.18], [1568, 0.36]].forEach(([f, o]) => {
      const osc = audio!.createOscillator(); const g = audio!.createGain();
      osc.frequency.value = f; osc.connect(g); g.connect(audio!.destination);
      g.gain.setValueAtTime(0.0001, t0 + o); g.gain.exponentialRampToValueAtTime(0.35, t0 + o + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + o + 0.35);
      osc.start(t0 + o); osc.stop(t0 + o + 0.4);
    });
    (navigator as Navigator & { vibrate?: (p: number[]) => boolean }).vibrate?.([200, 100, 200]);
  } catch { /* no sound */ }
}
export function useReadyWatch(on: boolean) {
  const session = useApiSession();
  const { t } = useSession();
  const bar = useQuery({ queryKey: ['bar'], queryFn: () => api.bar(session), refetchInterval: 6_000, enabled: on, refetchIntervalInBackground: true });
  const mine = (bar.data?.tickets ?? []).filter(mineOrOnline);
  const ready = mine.filter((x) => x.state === 'ready').length;
  const seen = useRef<Map<number, BarTicket['state']> | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  useEffect(() => {
    if (!on || !bar.data) return;
    const prev = seen.current;
    if (prev) {
      const fresh = mine.filter((x) => x.state === 'ready' && prev.get(x.id) !== 'ready' && prev.get(x.id) !== 'done');
      if (fresh.length) {
        chime();
        const x = fresh[0];
        const where = x.where ? ' · ' + x.where : '';
        setAlert(t('myReadyAlert', { n: x.no ? String(x.no) : '#' + x.number }) + where + (fresh.length > 1 ? ' (+' + (fresh.length - 1) + ')' : ''));
      }
    }
    seen.current = new Map(mine.map((x) => [x.id, x.state] as const));
  }, [bar.data, on]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!alert) return; const h = setTimeout(() => setAlert(null), 9000); return () => clearTimeout(h); }, [alert]);
  return { ready, alert, clear: () => setAlert(null) };
}

const st = StyleSheet.create({
  card: { padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
  role: { padding: space.lg, borderRadius: radius.lg, backgroundColor: color.surface, gap: 6, borderWidth: 1.5, borderColor: color.line },
  ready: { borderWidth: 2, borderColor: color.green },
  where: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: color.amberBg },
  arrived: { borderRadius: radius.md, backgroundColor: color.green, paddingHorizontal: 12, paddingVertical: 10 },
  no: { minWidth: 44, height: 44, borderRadius: 12, paddingHorizontal: 8, backgroundColor: color.ink, justifyContent: 'center', marginEnd: 10 },
  qty: { minWidth: 34, height: 34, borderRadius: 10, backgroundColor: color.sunken, justifyContent: 'center', paddingHorizontal: 6 },
  menuBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  shade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: space.lg },
  alert: { marginHorizontal: space.lg, marginBottom: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: color.green },
});
