import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';
import { api, dashboardOrderUrl } from '../../lib/api';
import { useApiSession, useSession } from '../../lib/session';
import { color, radius, space, tone } from '../../lib/theme';
import { money, num } from '../../lib/format';
import type { CostKey, Order } from '../../lib/types';
import { orderProgress } from '../../lib/progress';
import { Button, Card, ErrorState, FadeIn, Muted, Row, Skeleton, TagChip, Touch, Txt, tap } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const q = useQuery({ queryKey: ['order', id], queryFn: () => api.order(session, Number(id)) });
  const o = q.data;
  const dash = dashboardOrderUrl(session, Number(id));

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/orders'))} style={st.iconBtn} accessibilityLabel="back">
          <Icon name="back" size={24} rtl={lang === 'ar'} />
        </Touch>
        <View style={{ flex: 1 }}>
          <Txt size={19} weight="bold">{t('order', { n: o?.number ?? id })}</Txt>
          {o && <Muted size={12}>{o.ago}</Muted>}
        </View>
      </Row>
      {q.isError && !o ? <ErrorState onRetry={q.refetch} /> : !o ? (
        <View style={{ padding: space.lg, gap: space.md }}>{[70, 180, 160, 140].map((h, i) => <Skeleton key={i} h={h} r={radius.lg} />)}</View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + 120, gap: space.md }}>
            <FadeIn>
              <View style={{ gap: space.md }}>
                {o.test && <Banner tint="red" text={t('testOrder')} />}
                <View style={st.tags}>{o.tags.map((tg, i) => <TagChip key={i} label={tg.label} tone={tg.tone} />)}</View>
                <Progress o={o} />
                <Customer o={o} />
                <Items o={o} />
                {o.profit && <Profit o={o} />}
                <Messages o={o} />
              </View>
            </FadeIn>
          </ScrollView>
          {/* Sticky next step. Phase 1 is read-only: actions stay in the dashboard for now. */}
          <View style={[st.bar, { paddingBottom: insets.bottom + 10 }]}>
            <Muted size={12} style={{ marginBottom: 8 }}>{o.no_action ?? t('actionsSoon')}</Muted>
            {dash && <Button label={t('openInDashboard')} icon="external" kind="primary" onPress={() => WebBrowser.openBrowserAsync(dash)} />}
          </View>
        </>
      )}
    </View>
  );
}

function Banner({ text, tint }: { text: string; tint: 'red' | 'amber' }) {
  return <View style={[st.banner, { backgroundColor: tone[tint].bg }]}><Icon name="warn" size={18} tint={tone[tint].fg} /><Txt size={14} weight="medium" tint={tone[tint].fg} style={{ flex: 1 }}>{text}</Txt></View>;
}

function Progress({ o }: { o: Order }) {
  const { t } = useSession();
  if (['cancelled', 'refunded', 'failed'].includes(o.status)) return <Banner tint="red" text={o.status_label} />;
  const pending = o.status === 'pending';
  const { done, current } = orderProgress(o);
  const steps = [pending ? t('awaitingPayment') : o.cod ? t('orderedCash') : t('orderedPaid'), o.preorder ? t('viewPreorder') : t('preparing'), o.pickup ? t('readyPickup') : t('outForDelivery')];
  return (
    <Card>
      <Row align="flex-start" gap={0}>
        {steps.map((label, i) => {
          const n = i + 1, isDone = n <= done, isNow = n === current;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Row gap={0} style={{ width: '100%' }}>
                <View style={[st.line, { opacity: i === 0 ? 0 : 1, backgroundColor: n - 1 <= done ? color.ink : color.line }]} />
                <View style={[st.step, isDone && { backgroundColor: color.ink, borderColor: color.ink }, isNow && { borderColor: color.ink, borderWidth: 2 }]}>
                  {isDone ? <Icon name="check" size={14} stroke={2.6} tint={color.bg} /> : <Txt size={12} weight="semibold" tint={isNow ? color.ink : color.faint} center>{String(n)}</Txt>}
                </View>
                <View style={[st.line, { opacity: i === steps.length - 1 ? 0 : 1, backgroundColor: n <= done ? color.ink : color.line }]} />
              </Row>
              <Txt size={12} weight={isNow ? 'semibold' : 'regular'} tint={isDone || isNow ? color.ink : color.muted} center style={{ marginTop: 6 }}>{label}</Txt>
              {isNow && <Muted size={11} center>{t('now')}</Muted>}
            </View>
          );
        })}
      </Row>
    </Card>
  );
}

function Customer({ o }: { o: Order }) {
  const { t, lang } = useSession();
  const [copied, setCopied] = useState(false);
  const c = o.customer;
  const address = o.pickup ? t('pickupFromKoub') : o.gift?.waiting_address ? t('waitingRecipient') : o.address.text || t('noAddress');
  const copyAll = async () => {
    await Clipboard.setStringAsync([o.gift ? o.gift.name : c.name, o.pickup ? '' : o.address.text].filter(Boolean).join('\n'));
    tap('select');
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt size={16} weight="semibold">{o.gift ? t('buyer') : t('customer')}</Txt>
        {c.orders !== null && <Muted size={12}>{(c.orders > 1 ? t('nthOrder', { n: c.position ?? 1 }) : t('firstOrder')) + ' · ' + t('spentSoFar', { x: money(c.spent ?? 0, lang) })}</Muted>}
      </Row>
      <Row gap={12} style={{ marginTop: space.md }}>
        <View style={st.avatar}><Txt size={17} weight="semibold" center>{c.initial}</Txt></View>
        <View style={{ flex: 1 }}>
          <Txt size={16} weight="semibold">{c.name}</Txt>
          {c.phone && <Muted ltr style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}>{c.phone}</Muted>}
        </View>
      </Row>
      <Row gap={8} style={{ marginTop: space.md }}>
        <Action icon="whatsapp" label={t('whatsapp')} disabled={!c.whatsapp} onPress={() => Linking.openURL('https://wa.me/' + c.whatsapp)} />
        <Action icon="phone" label={t('call')} disabled={!c.call} onPress={() => Linking.openURL('tel:+' + c.call)} />
        <Action icon={copied ? 'check' : 'copy'} label={copied ? t('copied') : t('copy')} onPress={copyAll} />
      </Row>
      <View style={st.divider} />
      <Row gap={10} align="flex-start">
        <Icon name="pin" size={20} tint={color.muted} />
        <View style={{ flex: 1 }}>
          <Txt size={15} weight="medium">{address}</Txt>
          {!o.pickup && !o.gift?.waiting_address && <Muted size={12}>{o.address.country}</Muted>}
        </View>
      </Row>
      {o.gift && (
        <View style={[st.inset, { backgroundColor: color.blueBg }]}>
          <Row gap={8}><Icon name="gift" size={18} tint={color.blue} /><Txt size={14} weight="semibold" tint={color.blue}>{t('giftFor', { n: o.gift.name || '…' })}</Txt></Row>
          {o.gift.phone && <Muted size={12} ltr style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}>{o.gift.phone}</Muted>}
          <Muted size={12}>{o.gift.anonymous ? t('senderHidden') : t('senderShown')}</Muted>
          {!!o.gift.message && <Txt size={14} style={{ marginTop: 6, fontStyle: 'italic' }}>{'“' + o.gift.message + '”'}</Txt>}
        </View>
      )}
      {!!o.note && (
        <View style={[st.inset, { backgroundColor: color.sunken }]}>
          <Muted size={12}>{t('customerNote')}</Muted>
          <Txt size={14}>{o.note}</Txt>
        </View>
      )}
    </Card>
  );
}

function Action({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Touch onPress={onPress} disabled={disabled} style={st.action}>
      <Icon name={icon} size={19} />
      <Txt size={13} weight="medium" center>{label}</Txt>
    </Touch>
  );
}

function Items({ o }: { o: Order }) {
  const { t, lang } = useSession();
  const tot = o.totals;
  return (
    <Card>
      <Txt size={16} weight="semibold" style={{ marginBottom: space.sm }}>{t('items')}</Txt>
      {o.items.map((it, i) => (
        <View key={i} style={{ paddingVertical: space.sm }}>
          <Row gap={12}>
            <View style={st.thumb}>{it.image ? <Image source={it.image} style={{ width: 48, height: 48 }} contentFit="cover" transition={150} /> : <Icon name="products" size={24} tint={color.faint} />}</View>
            <View style={{ flex: 1 }}>
              <Txt size={15} weight="medium" lines={2}>{it.name}</Txt>
              <Muted size={12}>{t('qty', { n: it.qty })}</Muted>
            </View>
            <Txt size={15} weight="semibold" ltr>{num(it.total)}</Txt>
          </Row>
          {it.parts.map((p, k) => <Muted key={k} size={12} style={{ marginStart: 60 }}>{'· ' + p.name + ' × ' + p.qty}</Muted>)}
        </View>
      ))}
      <View style={st.divider} />
      {tot.discount > 0 && <Line label={t('discount')} value={'−' + num(tot.discount)} />}
      {tot.fees.map((f, i) => <Line key={i} label={f.name} value={num(f.total)} />)}
      <Line label={o.pickup ? t('pickup') : t('delivery')} value={num(tot.shipping)} />
      {tot.refunded > 0 && <Line label={t('refunded')} value={'−' + num(tot.refunded)} />}
      <Line label={t('total')} value={money(tot.total, lang)} strong />
      <View style={[st.pay, { backgroundColor: tone[o.payment.tone].bg }]}>
        <Icon name={o.payment.tone === 'green' ? 'check' : o.payment.tone === 'amber' ? 'cash' : 'warn'} size={18} stroke={2} tint={tone[o.payment.tone].fg} />
        <Txt size={14} weight="medium" tint={tone[o.payment.tone].fg} style={{ flex: 1 }}>{o.payment.label}</Txt>
      </View>
    </Card>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 3 }}>
      <Txt size={strong ? 16 : 14} weight={strong ? 'bold' : 'regular'} tint={strong ? color.ink : color.inkSoft}>{label}</Txt>
      <Txt size={strong ? 16 : 14} weight={strong ? 'bold' : 'medium'} ltr>{value}</Txt>
    </Row>
  );
}

function Profit({ o }: { o: Order }) {
  const { t, lang } = useSession();
  const p = o.profit!;
  const rows: [CostKey, string][] = [['goods', t('productCost')], ['packaging', t('bag')], ['gateway', t('paymentFee')], ['courier', t('actualDelivery')]];
  const base = Math.max(p.revenue, 0.001);
  const share = (v: number) => Math.max(0, Math.min(100, (100 * v) / base));
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt size={16} weight="semibold">{t('yourProfit')}</Txt>
        <Txt size={18} weight="bold" tint={color.green}>{(p.at_most ? t('atMost') : '') + money(p.profit, lang)}</Txt>
      </Row>
      <View style={st.stack}>
        <View style={{ width: `${share(p.profit)}%`, backgroundColor: color.green }} />
        {rows.map(([k], i) => p.costs[k].value ? <View key={k} style={{ width: `${share(p.costs[k].value!)}%`, backgroundColor: [color.inkSoft, color.muted, color.faint, color.bar][i] }} /> : null)}
      </View>
      {rows.map(([k, label]) => (
        <Row key={k} style={{ justifyContent: 'space-between', paddingVertical: 3 }}>
          <Row gap={6}><Txt size={14} tint={color.inkSoft}>{label}</Txt>{p.costs[k].estimate && <Muted size={11}>{t('estShort')}</Muted>}</Row>
          {p.costs[k].value === null ? <TagChip label={t('missing')} tone="amber" small /> : <Txt size={14} weight="medium" ltr>{'−' + num(p.costs[k].value!)}</Txt>}
        </Row>
      ))}
      {p.missing_products.length > 0 && <Muted size={12} style={{ marginTop: 6 }}>{p.missing_products.join(lang === 'ar' ? '، ' : ', ')}</Muted>}
      <Muted size={12} style={{ marginTop: 6 }}>{t('beforeAds')}</Muted>
    </Card>
  );
}

function Messages({ o }: { o: Order }) {
  const { t } = useSession();
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Txt size={16} weight="semibold" style={{ marginBottom: space.sm }}>{t('messagesLog')}</Txt>
      {o.messages.length === 0 && <Muted>{t('noMessages')}</Muted>}
      {o.messages.map((m, i) => (
        <Row key={i} gap={10} align="flex-start" style={{ paddingVertical: 6 }}>
          <View style={[st.dot, { backgroundColor: tone[m.tone].fg }]} />
          <View style={{ flex: 1 }}>
            <Txt size={14} weight="medium">{t('whatsapp') + ' ' + m.label}</Txt>
            <Muted size={12} tint={tone[m.tone].fg}>{m.status}</Muted>
          </View>
        </Row>
      ))}
      {o.log.length > 0 && (
        <>
          <Touch onPress={() => setOpen(!open)} style={{ paddingTop: space.sm }} haptic={false}>
            <Row style={{ justifyContent: 'space-between' }}><Txt size={14} weight="medium" tint={color.muted}>{t('fullLog') + ' (' + o.log.length + ')'}</Txt><View style={{ transform: [{ rotate: open ? '90deg' : '-90deg' }] }}><Icon name="chevron" size={16} tint={color.muted} /></View></Row>
          </Touch>
          {open && o.log.map((l, i) => (
            <View key={i} style={{ paddingVertical: 6, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderColor: color.line }}>
              {l.to_customer && <Muted size={11}>{t('sentToCustomer')}</Muted>}
              <Txt size={13} tint={color.inkSoft}>{l.text}</Txt>
            </View>
          ))}
        </>
      )}
    </Card>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: 4, backgroundColor: color.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md, padding: space.md },
  step: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: color.line, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, height: 2 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: color.sunken, alignItems: 'center', justifyContent: 'center' },
  action: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.bg },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: color.line, marginVertical: space.md },
  inset: { borderRadius: radius.md, padding: space.md, marginTop: space.md, gap: 2 },
  thumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: color.sunken, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pay: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md, padding: space.md, marginTop: space.md },
  stack: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: color.sunken, marginVertical: space.md },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: color.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
});
