// An order staff place for a customer who finds the website hard (API 1.8): name, WhatsApp and items, already paid.
// For delivery the customer gets one WhatsApp message with a private link where they add only the address; the
// order waits in "To prepare" until then. Prices and the delivery fee come from the store. Each order carries its own
// reference, so pressing again after a network drop never makes two.
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, font, radius, space } from '../lib/theme';
import { money } from '../lib/format';
import { showMessage } from '../lib/confirm';
import type { Lang, PosProduct, StaffMethod, StaffOrder } from '../lib/types';
import { Button, ErrorState, Muted, Row, Segmented, Skeleton, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const newRef = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
const COUNTRIES: [string, string, string][] = [['BH', 'البحرين', 'Bahrain'], ['SA', 'السعودية', 'Saudi'], ['KW', 'الكويت', 'Kuwait'], ['QA', 'قطر', 'Qatar'], ['AE', 'الإمارات', 'UAE'], ['OM', 'عُمان', 'Oman']];
// The text staff send from their own WhatsApp, in the customer's language (not the app's).
const linkText = (lang: string, name: string, number: string, url: string) => lang === 'en'
  ? 'Hi ' + name + ', this is KOUB. Your order #' + number + ' is confirmed and paid. Please add your delivery address here:\n' + url
  : 'هلا ' + name + '، معك KOUB. طلبك رقم #' + number + ' تأكد وانحسب مدفوع. أضف عنوان التوصيل من هالرابط:\n' + url;

export default function NewOrder() {
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const catalog = useQuery({ queryKey: ['pos-catalog'], queryFn: () => api.posCatalog(session) });
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cart, setCart] = useState<Record<number, number>>({});
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');
  const [fulfilment, setFulfilment] = useState<'delivery' | 'pickup'>('delivery');
  const [country, setCountry] = useState('BH');
  const [method, setMethod] = useState<StaffMethod>('benefit');
  const [msgLang, setMsgLang] = useState<Lang>('ar');
  const [ref, setRef] = useState(newRef);
  const [done, setDone] = useState<StaffOrder | null>(null);

  // Products only: the kiosk drinks menu is sold at the till, not delivered.
  const products = (catalog.data?.products ?? []).filter((p) => p.group !== 'drinks');
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId.get(Number(id)), qty })).filter((l): l is { p: PosProduct; qty: number } => !!l.p && l.qty > 0);
  const basket = lines.map((l) => l.p.id + 'x' + l.qty).join(',');
  const shown = products.filter((p) => !search.trim() || (p.name + ' ' + p.sku).toLowerCase().includes(search.trim().toLowerCase()));
  // A different basket is a different order: the reference only survives retries of the same one.
  useEffect(() => { if (!done) setRef(newRef()); }, [basket, done]);

  const quoteInput = { lines: lines.map((l) => ({ id: l.p.id, qty: l.qty })), fulfilment, country };
  const quote = useQuery({ queryKey: ['staff-quote', basket, fulfilment, country], queryFn: () => api.staffQuote(session, quoteInput), enabled: lines.length > 0 });
  const subtotal = r3(lines.reduce((s, l) => s + l.p.price * l.qty, 0));
  const delivery = fulfilment === 'pickup' ? 0 : quote.data?.delivery;
  const total = delivery === null || delivery === undefined ? null : r3(subtotal + delivery);

  const digits = phone.replace(/\D/g, '');
  const ready = name.trim().length > 0 && digits.length >= 8 && lines.length > 0 && total !== null;
  const create = useMutation({
    mutationFn: () => api.staffOrder(session, { ref, lines: quoteInput.lines, name: name.trim(), phone: digits, fulfilment, country, method, message_lang: msgLang, expected_total: total, note: '' }),
    onSuccess: (o) => { setDone(o); for (const k of ['orders', 'home', 'products', 'numbers', 'pos-catalog']) qc.invalidateQueries({ queryKey: [k] }); },
    onError: (e) => showMessage(t('orderNotSaved'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e instanceof ApiError && e.kind === 'network' ? t('orderNetwork') : e.message),
  });

  const setQty = (p: PosProduct, qty: number) => {
    const max = p.stock === null ? 99 : Math.min(99, p.stock);
    if (qty > max) { showMessage(p.name, t('posNoMore', { n: Math.max(0, p.stock ?? 0) })); return; }
    setCart((c) => { const n = { ...c }; if (qty <= 0) delete n[p.id]; else n[p.id] = qty; return n; });
  };
  const reset = () => { setName(''); setPhone(''); setCart({}); setFulfilment('delivery'); setCountry('BH'); setMethod('benefit'); setMsgLang('ar'); setDone(null); setRef(newRef()); create.reset(); };
  const input = [st.input, { textAlign: (lang === 'ar' ? 'right' : 'left') as 'right' | 'left', fontFamily: font.regular }];
  const close = () => (router.canGoBack() ? router.back() : router.replace('/orders'));

  const header = (
    <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
      <Touch onPress={close} style={st.iconBtn} accessibilityLabel="close"><Icon name="close" size={22} /></Touch>
      <Txt size={19} weight="bold" style={{ flex: 1 }}>{done ? t('orderCreated', { n: done.number }) : t('newOrder')}</Txt>
    </Row>
  );

  if (done) {
    const sent = done.message_state === 'sent';
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        {header}
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl }}>
          <View style={[st.card, { alignItems: 'center', gap: 6, paddingVertical: space.xl }]}>
            <View style={st.okDot}><Icon name="check" size={30} tint={color.bg} /></View>
            <Txt size={28} weight="bold">{money(done.total, lang)}</Txt>
            <Muted>{done.name + ' · ' + done.method_label}</Muted>
          </View>
          <View style={[st.card, { backgroundColor: done.pickup || sent ? color.greenBg : color.amberBg }]}>
            <Txt size={14} weight="semibold" tint={done.pickup || sent ? color.green : color.amber}>
              {done.pickup ? t('pickupNoLink') : sent ? t('linkSent') : t('linkNotSent')}
            </Txt>
          </View>
          {done.link && (
            <>
              <Button label={t('sendLinkWa')} icon="whatsapp" kind={sent ? 'light' : 'primary'}
                onPress={() => Linking.openURL('https://wa.me/' + done.whatsapp + '?text=' + encodeURIComponent(linkText(done.lang, done.name.split(' ')[0], done.number, done.link!))).catch(() => {})} />
              <Button label={t('copyLink')} icon="copy" kind="light" onPress={() => { Clipboard.setStringAsync(done.link!).catch(() => {}); }} />
            </>
          )}
          <Button label={t('openOrder')} icon="orders" kind="light" onPress={() => router.replace('/order/' + done.id)} />
          <Button label={t('anotherOrder')} icon="plus" kind="ghost" onPress={reset} />
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: color.bg }}>
      {header}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xl }}>
        <Muted size={13}>{t('newOrderHint')}</Muted>

        <Txt size={14} weight="semibold">{t('customer')}</Txt>
        <TextInput value={name} onChangeText={setName} placeholder={t('customerName')} placeholderTextColor={color.faint} maxLength={80} style={input} />
        <TextInput value={phone} onChangeText={setPhone} placeholder={t('customerWa')} placeholderTextColor={color.faint} keyboardType="phone-pad" maxLength={20} style={[input, { textAlign: 'left', writingDirection: 'ltr' }]} />
        <Muted size={12}>{t('waHint')}</Muted>

        <Txt size={14} weight="semibold">{t('items')}</Txt>
        <View style={st.card}>
          {lines.map((l, i) => (
            <Row key={l.p.id} gap={10} style={[{ paddingVertical: 8 }, i > 0 && st.sep]}>
              <View style={{ flex: 1 }}>
                <Txt size={15} weight="semibold" lines={2}>{l.p.name}</Txt>
                <Muted size={12}>{money(l.p.price, lang)}</Muted>
              </View>
              <Row gap={6}>
                <Touch onPress={() => setQty(l.p, l.qty - 1)} style={st.step} accessibilityLabel="-"><Txt size={18} weight="bold" center>−</Txt></Touch>
                <Txt size={16} weight="bold" style={{ minWidth: 24 }} center>{l.qty}</Txt>
                <Touch onPress={() => setQty(l.p, l.qty + 1)} style={st.step} accessibilityLabel="+"><Txt size={18} weight="bold" center>+</Txt></Touch>
              </Row>
            </Row>
          ))}
          <Touch onPress={() => setPicking(!picking)} style={[{ paddingVertical: 10 }, lines.length > 0 && st.sep]}>
            <Row gap={8}><Icon name={picking ? 'check' : 'plus'} size={18} /><Txt size={15} weight="semibold">{picking ? t('doneAdding') : t('addItems')}</Txt></Row>
          </Touch>
        </View>

        {picking && (
          catalog.isError && !catalog.data ? <ErrorState onRetry={() => { catalog.refetch(); }} /> :
          !catalog.data ? <Skeleton h={160} r={radius.lg} /> : (
            <View style={{ gap: space.sm }}>
              <Row style={st.search}>
                <Icon name="search" size={18} tint={color.faint} />
                <TextInput value={search} onChangeText={setSearch} placeholder={t('posSearch')} placeholderTextColor={color.faint}
                  style={{ flex: 1, fontSize: 15, color: color.ink, fontFamily: font.regular, textAlign: lang === 'ar' ? 'right' : 'left', paddingVertical: 10 }} />
              </Row>
              {shown.map((p) => {
                const out = p.stock !== null && p.stock <= 0;
                const n = cart[p.id] ?? 0;
                return (
                  <Touch key={p.id} onPress={() => setQty(p, n + 1)} disabled={out} style={[st.pick, n > 0 && st.pickOn, out && { opacity: 0.45 }]} accessibilityLabel={p.name}>
                    <View style={st.thumb}>{p.image ? <Image source={p.image} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Icon name="products" size={20} tint={color.faint} />}</View>
                    <View style={{ flex: 1 }}>
                      <Txt size={14} weight="semibold" lines={1}>{p.name}</Txt>
                      <Muted size={12}>{money(p.price, lang) + (out ? ' · ' + t('posOut') : p.stock === null ? '' : ' · ' + t('stockN', { n: p.stock }))}</Muted>
                    </View>
                    {n > 0 ? <View style={st.badge}><Txt size={13} weight="bold" tint={color.bg} center>{n}</Txt></View> : <Icon name="plus" size={18} tint={color.muted} />}
                  </Touch>
                );
              })}
            </View>
          )
        )}

        <Txt size={14} weight="semibold">{t('delivery')}</Txt>
        <Segmented<'delivery' | 'pickup'> items={[['delivery', t('delivery')], ['pickup', t('pickup')]]} value={fulfilment} onChange={setFulfilment} />
        {fulfilment === 'delivery' && (
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {COUNTRIES.map(([code, a, e]) => (
              <Touch key={code} onPress={() => setCountry(code)} style={[st.chip, country === code && st.chipOn]}>
                <Txt size={13} weight="semibold" tint={country === code ? color.bg : color.ink}>{lang === 'ar' ? a : e}</Txt>
              </Touch>
            ))}
          </Row>
        )}

        <Txt size={14} weight="semibold">{t('paidBy')}</Txt>
        <Segmented<StaffMethod> items={[['benefit', t('posBenefit')], ['cash', t('posCash')], ['card', t('posCard')], ['transfer', t('transfer')]]} value={method} onChange={setMethod} />

        {fulfilment === 'delivery' && (
          <>
            <Txt size={14} weight="semibold">{t('msgLang')}</Txt>
            <Segmented<Lang> items={[['ar', 'العربي'], ['en', 'English']]} value={msgLang} onChange={setMsgLang} />
          </>
        )}
      </ScrollView>
      <View style={[st.bar, { paddingBottom: insets.bottom + space.md, gap: 6 }]}>
        {lines.length > 0 && (
          <>
            <Row style={{ justifyContent: 'space-between' }}><Muted>{t('subtotal')}</Muted><Muted>{money(subtotal, lang)}</Muted></Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <Muted>{t('delivery')}</Muted>
              <Muted>{delivery === undefined ? '…' : delivery === null ? t('noRate') : delivery === 0 ? t('deliveryFree') : money(delivery, lang)}</Muted>
            </Row>
          </>
        )}
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt size={16} weight="semibold">{t('posTotal')}</Txt>
          <Txt size={22} weight="bold">{total === null ? '—' : money(total, lang)}</Txt>
        </Row>
        <Button label={t('createOrder')} icon="check" loading={create.isPending} disabled={!ready || create.isPending} onPress={() => create.mutate()} />
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: 4, backgroundColor: color.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  step: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.sunken, justifyContent: 'center' },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.surface, paddingHorizontal: 12, fontSize: 16, color: color.ink },
  search: { gap: 8, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1.5, borderColor: 'transparent' },
  pickOn: { borderColor: color.ink },
  thumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: color.sunken, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  badge: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 6, backgroundColor: color.ink, justifyContent: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: color.sunken },
  chipOn: { backgroundColor: color.ink },
  bar: { paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: color.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  okDot: { width: 56, height: 56, borderRadius: 28, backgroundColor: color.green, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
});
