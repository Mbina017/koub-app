import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';
import { api, ApiError, dashboardOrderUrl } from '../../lib/api';
import { useApiSession, useSession } from '../../lib/session';
import { color, font, radius, space, tone } from '../../lib/theme';
import { money, num } from '../../lib/format';
import type { ContactEdit, ContactInput, CostKey, Order, OrderAction } from '../../lib/types';
import { orderProgress } from '../../lib/progress';
import { confirmStep, showMessage } from '../../lib/confirm';
import { shareSlips } from '../../lib/print';
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
  // The sticky bar grows with the number of actions; the page scrolls past whatever height it has.
  const [barH, setBarH] = useState(120);
  const [printing, setPrinting] = useState(false);
  const print = async () => {
    setPrinting(true);
    try { await shareSlips(session, [Number(id)], 'KOUB-' + (o?.number ?? id)); }
    catch (e) { showMessage(t('notPrinted'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : (e as Error).message); }
    finally { setPrinting(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/orders'))} style={st.iconBtn} accessibilityLabel="back">
          <Icon name="back" size={24} rtl={lang === 'ar'} />
        </Touch>
        <View style={{ flex: 1 }}>
          <Txt size={19} weight="bold">{t('order', { n: o?.number ?? id })}</Txt>
          {o && <Muted size={12}>{o.ago}</Muted>}
        </View>
        {o?.actions && (
          <Touch onPress={print} disabled={printing} style={st.iconBtn} accessibilityLabel={t('printSlip')}>
            <Icon name="print" size={22} tint={printing ? color.faint : color.ink} />
          </Touch>
        )}
      </Row>
      {q.isError && !o ? <ErrorState onRetry={q.refetch} /> : !o ? (
        <View style={{ padding: space.lg, gap: space.md }}>{[70, 180, 160, 140].map((h, i) => <Skeleton key={i} h={h} r={radius.lg} />)}</View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: barH + space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
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
          <View style={[st.bar, { paddingBottom: insets.bottom + 10 }]} onLayout={(e) => setBarH(e.nativeEvent.layout.height)}>
            {o.actions ? <Actions o={o} /> : (
              // A store still on API 1.0 has no actions: send the step to the dashboard.
              <>
                <Muted size={12} style={{ marginBottom: 8 }}>{o.no_action ?? t('actionsOnDashboard')}</Muted>
                {dash && <Button label={t('openInDashboard')} icon="external" kind="primary" onPress={() => WebBrowser.openBrowserAsync(dash)} />}
              </>
            )}
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}


// After a change, the order screen, the lists and Home all show the new state.
function useOrderUpdate(id: number) {
  const qc = useQueryClient();
  return (data: Order) => {
    qc.setQueryData(['order', String(id)], data);
    qc.invalidateQueries({ queryKey: ['orders'] });
    qc.invalidateQueries({ queryKey: ['home'] });
  };
}

function Actions({ o }: { o: Order }) {
  const session = useApiSession();
  const { t } = useSession();
  const qc = useQueryClient();
  const update = useOrderUpdate(o.id);
  const run = useMutation({
    mutationFn: (a: OrderAction) => api.orderAction(session, o.id, a.key),
    onSuccess: (data) => { update(data); if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
    onError: (e) => {
      // Refused means the order moved on (another phone, or the dashboard): show why and load its current state.
      showMessage(t('notUpdated'), e instanceof ApiError && (e.kind === 'refused' || e.kind === 'server') ? e.message : e instanceof ApiError && e.kind === 'network' ? t('errNetwork') : e.message);
      qc.invalidateQueries({ queryKey: ['order', String(o.id)] });
    },
  });
  const actions = o.actions ?? [];
  if (!actions.length) return <Muted size={13} center>{o.no_action ?? t('nothingToDo')}</Muted>;
  const main = actions.filter((a) => a.tone === 'primary');
  const cancel = actions.find((a) => a.tone === 'danger');
  const undo = actions.filter((a) => a.tone === 'undo');
  const busy = run.isPending ? run.variables?.key : undefined;
  return (
    <View style={{ gap: 8 }}>
      {main.length === 0 && !!o.no_action && <Muted size={13} center>{o.no_action}</Muted>}
      {main.map((a, i) => (
        <Button key={a.key} label={a.label} kind={i === 0 ? 'primary' : 'light'} icon={a.key === 'out_delivery' ? 'truck' : a.key === 'cod_collected' ? 'cash' : 'check'}
          loading={busy === a.key} disabled={run.isPending} onPress={() => confirmStep(a, t('notNow'), () => run.mutate(a))} />
      ))}
      {cancel && (
        <Touch onPress={() => confirmStep(cancel, t('notNow'), () => run.mutate(cancel))} disabled={run.isPending} style={{ alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12 }}>
          <Txt size={14} weight="medium" tint={color.red} center>{busy === 'cancel' ? '…' : cancel.label}</Txt>
        </Touch>
      )}
      {undo.length > 0 && (
        <Row gap={4} style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          {undo.map((a) => (
            <Touch key={a.key} onPress={() => confirmStep(a, t('notNow'), () => run.mutate(a))} disabled={run.isPending} style={{ paddingVertical: 6, paddingHorizontal: 10 }}>
              <Row gap={6}><Icon name="back" size={15} tint={color.muted} /><Txt size={13} weight="medium" tint={color.muted}>{busy === a.key ? '…' : a.label}</Txt></Row>
            </Touch>
          ))}
        </Row>
      )}
    </View>
  );
}

// A private staff note in the order log; the customer never sees it.
function NoteBox({ o }: { o: Order }) {
  const session = useApiSession();
  const { t, lang } = useSession();
  const [text, setText] = useState('');
  const update = useOrderUpdate(o.id);
  const save = useMutation({
    mutationFn: () => api.orderNote(session, o.id, text.trim()),
    onSuccess: (data) => { update(data); setText(''); tap('select'); },
    onError: (e) => showMessage(t('notSaved'), e.message),
  });
  return (
    <Row gap={8} style={{ marginTop: space.md }}>
      <TextInput value={text} onChangeText={setText} placeholder={t('addNote')} placeholderTextColor={color.faint} maxLength={500} multiline
        style={[st.note, { textAlign: lang === 'ar' ? 'right' : 'left', fontFamily: font.regular }]} />
      <Button label={t('save')} kind="light" loading={save.isPending} disabled={!text.trim()} onPress={() => save.mutate()} style={{ paddingHorizontal: 16 }} />
    </Row>
  );
}

// Delivery details from the phone (API 1.3): the order screen's own fields and checks; the store logs the change.
function ContactEditor({ o, edit }: { o: Order; edit: ContactEdit }) {
  const session = useApiSession();
  const { t, lang } = useSession();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<ContactInput>(edit.values);
  const update = useOrderUpdate(o.id);
  const save = useMutation({
    mutationFn: () => {
      const input: ContactInput = { whatsapp: v.whatsapp ?? '' };
      if (edit.fields.includes('call')) input.call = v.call ?? '';
      if (edit.fields.includes('recipient')) input.recipient = v.recipient ?? '';
      if (edit.fields.includes('address')) { input.address = v.address ?? ''; input.city = v.city ?? ''; }
      return api.orderContact(session, o.id, input);
    },
    onSuccess: (data) => { update(data); setOpen(false); tap('select'); showMessage(t('save'), t('contactSaved')); },
    onError: (e) => showMessage(t('notSaved'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e.message),
  });
  const field = (k: keyof ContactInput, label: string, opts: { phone?: boolean; hint?: string; multiline?: boolean } = {}) => (
    <View style={{ gap: 4 }}>
      <Txt size={13} weight="medium" tint={color.muted}>{label}</Txt>
      <TextInput value={v[k] ?? ''} onChangeText={(x) => setV({ ...v, [k]: x })} keyboardType={opts.phone ? 'phone-pad' : 'default'} multiline={opts.multiline} maxLength={opts.phone ? 25 : k === 'city' ? 80 : 250}
        placeholder={opts.hint} placeholderTextColor={color.faint} style={[st.note, { flex: 0, textAlign: opts.phone ? 'left' : lang === 'ar' ? 'right' : 'left', fontFamily: font.regular }, opts.phone && { writingDirection: 'ltr' }]} />
    </View>
  );
  if (!open) return (
    <Touch onPress={() => { setV(edit.values); setOpen(true); }} style={[st.action, { flex: 0, flexDirection: 'row', justifyContent: 'center', marginTop: space.md }]}>
      <Icon name="edit" size={18} /><Txt size={14} weight="medium">{edit.fields.includes('address') ? t('editContact') : t('editNumbers')}</Txt>
    </Touch>
  );
  return (
    <View style={{ gap: space.md, marginTop: space.md }}>
      {edit.out_for_delivery && <Banner tint="amber" text={t('outWarn')} />}
      {field('whatsapp', o.gift ? t('senderWhatsapp') : t('whatsappNumber'), { phone: true })}
      {edit.fields.includes('call') && field('call', t('callNumber'), { phone: true, hint: t('callHint') })}
      {edit.fields.includes('recipient') && field('recipient', t('recipientWa'), { phone: true })}
      {edit.fields.includes('address') && field('address', t('addressLabel'), { multiline: true })}
      {edit.fields.includes('address') && field('city', t('areaLabel'))}
      {edit.fields.includes('address') && <Muted size={12}>{t('countryFixed')}</Muted>}
      <Row gap={8}>
        <Button label={t('save')} icon="check" loading={save.isPending} disabled={!(v.whatsapp ?? '').trim()} onPress={() => save.mutate()} style={{ flex: 2 }} />
        <Button label={t('notNow')} kind="light" onPress={() => setOpen(false)} style={{ flex: 1 }} />
      </Row>
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
  const address = o.pickup ? t('pickupFromKoub') : o.gift?.waiting_address ? t('waitingRecipient') : o.address_link ? t('waitingCustomerAddress') : o.address.text || t('noAddress');
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
      {o.address_link && <AddressLink o={o} />}
      {o.contact_edit && <ContactEditor o={o} edit={o.contact_edit} />}
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

// A staff order waiting for the customer's address: send the link again from the staff phone, or have the store
// send a fresh one (the old link stops working).
function AddressLink({ o }: { o: Order }) {
  const session = useApiSession();
  const { t } = useSession();
  const qc = useQueryClient();
  const l = o.address_link!;
  const first = o.customer.name.split(' ')[0];
  const text = l.lang === 'en'
    ? 'Hi ' + first + ', this is KOUB. Your order #' + o.number + ' is confirmed and paid. Please add your delivery address here:\n' + l.link
    : 'هلا ' + first + '، معك KOUB. طلبك رقم #' + o.number + ' تأكد وانحسب مدفوع. أضف عنوان التوصيل من هالرابط:\n' + l.link;
  const resend = useMutation({
    mutationFn: () => api.staffResendLink(session, o.id),
    onSuccess: (r) => { tap(); showMessage(t('newOrder'), r.message_state === 'sent' ? t('linkSent') : t('linkNotSent')); qc.invalidateQueries({ queryKey: ['order', String(o.id)] }); },
    onError: (e) => showMessage(t('orderNotSaved'), e.message),
  });
  return (
    <View style={[st.inset, { backgroundColor: color.amberBg, gap: 8 }]}>
      <Txt size={13} weight="semibold" tint={color.amber}>{l.message === 'sent' ? t('linkSent') : t('linkNotSent')}</Txt>
      <Row gap={8}>
        <Action icon="whatsapp" label={t('sendLinkWa')} disabled={!o.customer.whatsapp || !l.link} onPress={() => Linking.openURL('https://wa.me/' + o.customer.whatsapp + '?text=' + encodeURIComponent(text)).catch(() => {})} />
        <Action icon="bell" label={resend.isPending ? '…' : t('resendLink')} disabled={resend.isPending} onPress={() => resend.mutate()} />
      </Row>
    </View>
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
      {o.actions && <NoteBox o={o} />}
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
  note: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.surface, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: color.ink },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: color.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
});
