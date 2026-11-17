// An order staff place for a customer who finds the website hard (API 1.8), in three short steps:
// 1. the customer (type the number: a returning customer's name fills in), 2. the items, 3. delivery and payment.
// A returning customer's last address can be reused (API 1.18): the order is ready to prepare at once. Otherwise the
// customer gets one WhatsApp message with a private link to add only the address. Prices and the delivery fee come from
// the store. Each order carries its own reference, so pressing again after a network drop never makes two.
// The last payment method and message language are remembered on this phone.
// API 1.42: custom amounts (any amount with a short description, not a store product; up to 5), and "the customer
// pays by link": the order waits for the customer, and the owner sends the payment link from their own WhatsApp.
// An order of custom amounts only has nothing to deliver or pick up.
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import { Image } from 'expo-image';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, font, radius, space } from '../lib/theme';
import { money } from '../lib/format';
import { showMessage } from '../lib/confirm';
import type { Lang, PosProduct, StaffCustom, StaffMethod, StaffOrder } from '../lib/types';
import { Button, ErrorState, Muted, Row, Segmented, Skeleton, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

const r3 = (n: number) => Math.round(Number((n * 1000).toPrecision(15))) / 1000;
const newRef = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
const COUNTRIES: [string, string, string][] = [['BH', 'البحرين', 'Bahrain'], ['SA', 'السعودية', 'Saudi'], ['KW', 'الكويت', 'Kuwait'], ['QA', 'قطر', 'Qatar'], ['AE', 'الإمارات', 'UAE'], ['OM', 'عُمان', 'Oman']];
const PREFS = 'koub.neworder.v1';
type PayMode = 'link' | 'paid';
const loadPrefs = async (): Promise<{ method?: StaffMethod; msgLang?: Lang; pay?: PayMode }> => {
  try { const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(PREFS) : await SecureStore.getItemAsync(PREFS); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
};
const savePrefs = (v: { method: StaffMethod; msgLang: Lang; pay: PayMode }) => {
  const raw = JSON.stringify(v);
  try { if (Platform.OS === 'web') globalThis.localStorage?.setItem(PREFS, raw); else SecureStore.setItemAsync(PREFS, raw).catch(() => {}); } catch { /* not kept */ }
};
// The texts staff send from their own WhatsApp, in the customer's language (not the app's).
const linkText = (lang: string, name: string, number: string, url: string) => lang === 'en'
  ? 'Hi ' + name + ', this is KOUB. Your order #' + number + ' is confirmed and paid. Please add your delivery address here:\n' + url
  : 'هلا ' + name + '، معك KOUB. طلبك رقم #' + number + ' تأكد وانحسب مدفوع. أضف عنوان التوصيل من هالرابط:\n' + url;
const confirmText = (lang: string, name: string, number: string, address: string) => lang === 'en'
  ? 'Hi ' + name + ', this is KOUB. Your order #' + number + ' is confirmed and paid. We will deliver it to:\n' + address
  : 'هلا ' + name + '، معك KOUB. طلبك رقم #' + number + ' تأكد وانحسب مدفوع، وبنوصله على:\n' + address;
// Pay by link: the payment link, and the address link too when the customer still has to add it.
const payText = (lang: string, name: string, number: string, amount: string, pay: string, address: string | null) => lang === 'en'
  ? 'Hi ' + name + ', this is KOUB. Your order #' + number + ' comes to ' + amount + '. You can pay here:\n' + pay + (address ? '\n\nThen add your delivery address here:\n' + address : '')
  : 'هلا ' + name + '، معك KOUB. طلبك رقم #' + number + ' بمبلغ ' + amount + '. تقدر تدفع من هالرابط:\n' + pay + (address ? '\n\nوبعدها أضف عنوان التوصيل من هني:\n' + address : '');
const amountOf = (v: string) => { const n = Number(v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,٫]/g, '.').trim()); return Number.isFinite(n) ? r3(n) : NaN; };

type Step = 1 | 2 | 3;

export default function NewOrder() {
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const catalog = useQuery({ queryKey: ['pos-catalog'], queryFn: () => api.posCatalog(session) });
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [phone, setPhone] = useState('');
  const [cart, setCart] = useState<Record<number, number>>({});
  const [search, setSearch] = useState('');
  const [fulfilment, setFulfilment] = useState<'delivery' | 'pickup'>('delivery');
  const [country, setCountry] = useState('BH');
  const [method, setMethod] = useState<StaffMethod>('benefit');
  const [pay, setPay] = useState<PayMode>('paid');
  const [custom, setCustom] = useState<StaffCustom[]>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [cLabel, setCLabel] = useState('');
  const [cAmount, setCAmount] = useState('');
  const [msgLang, setMsgLang] = useState<Lang>('ar');
  const [useSaved, setUseSaved] = useState(true);
  const [ref, setRef] = useState(newRef);
  const [done, setDone] = useState<StaffOrder | null>(null);
  useEffect(() => { loadPrefs().then((p) => { if (p.method) setMethod(p.method); if (p.msgLang) setMsgLang(p.msgLang); if (p.pay) setPay(p.pay); }); }, []);

  const hasProducts = Object.values(cart).some((q) => q > 0);
  // Returning customer: looked up once the number is long enough, for the delivery country.
  const digits = phone.replace(/\D/g, '');
  const [lookFor, setLookFor] = useState('');
  useEffect(() => { const id = setTimeout(() => setLookFor(digits.length >= 8 ? digits : ''), 400); return () => clearTimeout(id); }, [digits]);
  const who = useQuery({ queryKey: ['customer', lookFor, country], queryFn: () => api.customer(session, lookFor, country), enabled: lookFor.length >= 8, retry: false });
  const known = who.data?.found ? who.data : null;
  useEffect(() => { if (known?.name && !nameTouched) setName(known.name); }, [known?.name, nameTouched]);
  const saved = known?.address && known.address.country === country && fulfilment === 'delivery' && hasProducts ? known.address : null;

  // Products only: the kiosk drinks menu is sold at the till, not delivered.
  const products = (catalog.data?.products ?? []).filter((p) => p.group !== 'drinks');
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId.get(Number(id)), qty })).filter((l): l is { p: PosProduct; qty: number } => !!l.p && l.qty > 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const basket = lines.map((l) => l.p.id + 'x' + l.qty).join(',') + '|' + custom.map((c) => c.amount + ':' + c.label).join(',');
  const customSum = r3(custom.reduce((a, c) => a + c.amount, 0));
  // Custom amounts only: nothing to deliver or pick up.
  const ship: 'delivery' | 'pickup' | 'none' = lines.length ? fulfilment : 'none';
  const shown = products.filter((p) => !search.trim() || (p.name + ' ' + p.sku).toLowerCase().includes(search.trim().toLowerCase()));
  // A different basket is a different order: the reference only survives retries of the same one.
  useEffect(() => { if (!done) setRef(newRef()); }, [basket, done]);

  const quoteInput = { lines: lines.map((l) => ({ id: l.p.id, qty: l.qty })), fulfilment: ship, country, ...(custom.length ? { custom } : {}) };
  const quote = useQuery({ queryKey: ['staff-quote', basket, ship, country], queryFn: () => api.staffQuote(session, quoteInput), enabled: ship === 'delivery' });
  const subtotal = r3(lines.reduce((s, l) => s + l.p.price * l.qty, 0) + customSum);
  const delivery = ship !== 'delivery' ? 0 : quote.data?.delivery;
  const total = delivery === null || delivery === undefined ? null : r3(subtotal + delivery);

  const stepOk = { 1: name.trim().length > 0 && digits.length >= 8, 2: lines.length > 0 || custom.length > 0, 3: total !== null } as const;
  const reuse = !!saved && useSaved;
  const create = useMutation({
    mutationFn: () => api.staffOrder(session, { ref, lines: quoteInput.lines, ...(custom.length ? { custom } : {}), name: name.trim(), phone: digits, fulfilment: ship, country, method: pay === 'link' ? 'link' : method, message_lang: msgLang, expected_total: total, note: '', ...(reuse ? { address_from: saved!.from } : {}) }),
    onSuccess: (o) => { setDone(o); savePrefs({ method, msgLang, pay }); for (const k of ['orders', 'home', 'products', 'numbers', 'pos-catalog']) qc.invalidateQueries({ queryKey: [k] }); },
    onError: (e) => showMessage(t('orderNotSaved'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e instanceof ApiError && e.kind === 'network' ? t('orderNetwork') : e.message),
  });

  const setQty = (p: PosProduct, qty: number) => {
    const max = p.stock === null ? 99 : Math.min(99, p.stock);
    if (qty > max) { showMessage(p.name, t('posNoMore', { n: Math.max(0, p.stock ?? 0) })); return; }
    setCart((c) => { const n = { ...c }; if (qty <= 0) delete n[p.id]; else n[p.id] = qty; return n; });
  };
  const addCustom = () => {
    const amount = amountOf(cAmount);
    if (!(amount > 0 && amount <= 1000)) { showMessage(t('customAmount'), t('customBad')); return; }
    if (custom.length >= 5) { showMessage(t('customAmount'), t('customMax')); return; }
    setCustom((c) => [...c, { label: cLabel.trim().slice(0, 60), amount }]); setCLabel(''); setCAmount(''); setCustomOpen(false);
  };
  const reset = () => { setStep(1); setName(''); setNameTouched(false); setPhone(''); setCart({}); setCustom([]); setCustomOpen(false); setCLabel(''); setCAmount(''); setSearch(''); setFulfilment('delivery'); setCountry('BH'); setUseSaved(true); setDone(null); setRef(newRef()); create.reset(); };
  const input = [st.input, { textAlign: (lang === 'ar' ? 'right' : 'left') as 'right' | 'left', fontFamily: font.regular }];
  const close = () => (step > 1 && !done ? setStep((step - 1) as Step) : router.canGoBack() ? router.back() : router.replace('/orders'));

  const header = (
    <View style={[st.top, { paddingTop: insets.top + 6 }]}>
      <Row gap={4}>
        <Touch onPress={close} style={st.iconBtn} accessibilityLabel="back">
          <Icon name={step > 1 && !done ? 'back' : 'close'} size={22} rtl={lang === 'ar'} />
        </Touch>
        <Txt size={19} weight="bold" style={{ flex: 1 }}>{done ? t('orderCreated', { n: done.number }) : t('newOrder')}</Txt>
      </Row>
      {!done && (
        <Row gap={6} style={{ paddingHorizontal: space.sm, marginTop: 4 }}>
          {([1, 2, 3] as Step[]).map((n) => (
            <Touch key={n} onPress={() => (n < step || (n === 2 && stepOk[1]) || (n === 3 && stepOk[1] && stepOk[2])) && setStep(n)} style={{ flex: 1, gap: 4 }}>
              <View style={[st.bar1, n <= step && { backgroundColor: color.ink }]} />
              <Txt size={12} weight={n === step ? 'semibold' : 'regular'} tint={n === step ? color.ink : color.muted}>{[t('stepCustomer'), t('stepItems'), t('stepDelivery')][n - 1]}</Txt>
            </Touch>
          ))}
        </Row>
      )}
    </View>
  );

  if (done) {
    const sent = done.message_state === 'sent';
    const reused = !done.pickup && done.address_state === 'received';
    const waiting = !!done.pay;
    const nothingToShip = !done.pickup && done.address_state === '';
    const first = done.name.split(' ')[0];
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        {header}
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl }}>
          <View style={[st.card, { alignItems: 'center', gap: 6, paddingVertical: space.xl }]}>
            <View style={st.okDot}><Icon name="check" size={30} tint={color.bg} /></View>
            <Txt size={28} weight="bold">{money(done.total, lang)}</Txt>
            <Muted>{done.name + ' · ' + (waiting ? t('payByLink') : done.method_label)}</Muted>
          </View>
          {waiting ? (
            <View style={[st.card, { backgroundColor: color.amberBg }]}>
              <Txt size={14} weight="semibold" tint={color.amber}>{t('payLinkReady')}</Txt>
            </View>
          ) : !nothingToShip && (
            <View style={[st.card, { backgroundColor: done.pickup || sent || reused ? color.greenBg : color.amberBg }]}>
              <Txt size={14} weight="semibold" tint={done.pickup || sent || reused ? color.green : color.amber}>
                {done.pickup ? t('pickupNoLink') : reused ? t('savedAddressUsed') : sent ? t('linkSent') : t('linkNotSent')}
              </Txt>
            </View>
          )}
          {waiting && (
            <>
              <Button label={t('sendPayWa')} icon="whatsapp"
                onPress={() => Linking.openURL('https://wa.me/' + done.whatsapp + '?text=' + encodeURIComponent(payText(msgLang, first, done.number, money(done.total, msgLang), done.pay!, done.link))).catch(() => {})} />
              <Button label={t('copyPayLink')} icon="copy" kind="light" onPress={() => { Clipboard.setStringAsync(done.pay!).catch(() => {}); }} />
            </>
          )}
          {!waiting && reused && saved && (
            <Button label={t('sendConfirmWa')} icon="whatsapp"
              onPress={() => Linking.openURL('https://wa.me/' + done.whatsapp + '?text=' + encodeURIComponent(confirmText(msgLang, done.name.split(' ')[0], done.number, saved.text))).catch(() => {})} />
          )}
          {!waiting && done.link && (
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
        {step === 1 && (
          <>
            <Muted size={13}>{t('newOrderHint')}</Muted>
            <Txt size={14} weight="semibold">{t('customerWa')}</Txt>
            <TextInput value={phone} onChangeText={setPhone} placeholder="3300 1122" placeholderTextColor={color.faint} keyboardType="phone-pad" maxLength={20} autoFocus
              style={[input, st.big, { textAlign: 'left', writingDirection: 'ltr' }]} />
            <Muted size={12}>{t('waHint')}</Muted>
            {known ? (
              <View style={[st.card, { backgroundColor: color.greenBg, gap: 4 }]}>
                <Txt size={14} weight="semibold" tint={color.green}>{t('returningCustomer', { n: known.orders ?? 0 })}</Txt>
                {known.address ? <Muted size={12}>{known.address.text}</Muted> : null}
              </View>
            ) : who.isFetching ? <Muted size={12}>…</Muted> : null}
            <Txt size={14} weight="semibold">{t('customerName')}</Txt>
            <TextInput value={name} onChangeText={(v) => { setName(v); setNameTouched(true); }} placeholder={t('customerName')} placeholderTextColor={color.faint} maxLength={80} style={input} />
          </>
        )}

        {step === 2 && (
          <>
            {(lines.length > 0 || custom.length > 0) && (
              <View style={st.card}>
                {custom.map((c, i) => (
                  <Row key={'c' + i} gap={10} style={[{ paddingVertical: 8 }, i > 0 && st.sep]}>
                    <View style={{ flex: 1 }}>
                      <Txt size={15} weight="semibold" lines={2}>{c.label || t('customAmount')}</Txt>
                      <Muted size={12}>{t('customAmount')}</Muted>
                    </View>
                    <Txt size={15} weight="bold">{money(c.amount, lang)}</Txt>
                    <Touch onPress={() => setCustom((x) => x.filter((_, j) => j !== i))} style={st.step} accessibilityLabel="remove"><Icon name="close" size={16} /></Touch>
                  </Row>
                ))}
                {lines.map((l, i) => (
                  <Row key={l.p.id} gap={10} style={[{ paddingVertical: 8 }, (i > 0 || custom.length > 0) && st.sep]}>
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
              </View>
            )}
            {customOpen ? (
              <View style={[st.card, { gap: 8 }]}>
                <Txt size={15} weight="semibold">{t('customAmount')}</Txt>
                <TextInput value={cAmount} onChangeText={setCAmount} placeholder={t('customAmountPh') + ' (BHD)'} placeholderTextColor={color.faint} keyboardType="decimal-pad" autoFocus maxLength={9}
                  style={[input, st.big, { textAlign: 'left', writingDirection: 'ltr' }]} />
                <TextInput value={cLabel} onChangeText={setCLabel} placeholder={t('customLabel') + ' · ' + t('customLabelPh')} placeholderTextColor={color.faint} maxLength={60} style={input} />
                <Row gap={8}>
                  <View style={{ flex: 1 }}><Button label={t('customOk')} icon="plus" onPress={addCustom} disabled={!cAmount.trim()} /></View>
                  <View style={{ flex: 1 }}><Button label={t('customCancel')} kind="light" onPress={() => { setCustomOpen(false); setCLabel(''); setCAmount(''); }} /></View>
                </Row>
              </View>
            ) : custom.length < 5 && (
              <Touch onPress={() => setCustomOpen(true)} style={[st.pick, { borderStyle: 'dashed', borderColor: color.line }]} accessibilityLabel={t('customAdd')}>
                <View style={st.thumb}><Icon name="cash" size={20} tint={color.ink} /></View>
                <Txt size={14} weight="semibold" style={{ flex: 1 }}>{t('customAdd')}</Txt>
                <Icon name="plus" size={18} tint={color.muted} />
              </Touch>
            )}
            {catalog.isError && !catalog.data ? <ErrorState onRetry={() => { catalog.refetch(); }} /> : !catalog.data ? <Skeleton h={160} r={radius.lg} /> : (
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
            )}
          </>
        )}

        {step === 3 && (
          <>
            {ship === 'none' ? <Muted size={13}>{t('customOnly')}</Muted> : <Segmented<'delivery' | 'pickup'> items={[['delivery', t('delivery')], ['pickup', t('pickup')]]} value={fulfilment} onChange={setFulfilment} />}
            {ship === 'delivery' && (
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {COUNTRIES.map(([code, a, e]) => (
                  <Touch key={code} onPress={() => setCountry(code)} style={[st.chip, country === code && st.chipOn]}>
                    <Txt size={13} weight="semibold" tint={country === code ? color.bg : color.ink}>{lang === 'ar' ? a : e}</Txt>
                  </Touch>
                ))}
              </Row>
            )}
            {saved && (
              <Touch onPress={() => setUseSaved(!useSaved)} style={[st.card, { gap: 4, borderWidth: 1.5, borderColor: useSaved ? color.ink : 'transparent' }]}>
                <Row gap={8}>
                  <View style={[st.tick, useSaved && { backgroundColor: color.ink, borderColor: color.ink }]}>{useSaved && <Icon name="check" size={14} tint={color.bg} />}</View>
                  <Txt size={15} weight="semibold" style={{ flex: 1 }}>{t('useSavedAddress')}</Txt>
                </Row>
                <Muted size={13}>{saved.text}</Muted>
              </Touch>
            )}
            <Txt size={14} weight="semibold">{t('payHow')}</Txt>
            <Segmented<PayMode> items={[['link', t('payByLink')], ['paid', t('payRecorded')]]} value={pay} onChange={setPay} />
            {pay === 'link' ? <Muted size={12}>{t('payLinkHint')}</Muted> : (
              <>
                <Txt size={14} weight="semibold">{t('paidBy')}</Txt>
                <Segmented<StaffMethod> items={[['benefit', t('posBenefit')], ['cash', t('posCash')], ['card', t('posCard')], ['transfer', t('transfer')]]} value={method} onChange={setMethod} />
              </>
            )}
            {((ship === 'delivery' && !reuse) || pay === 'link') && (
              <>
                <Txt size={14} weight="semibold">{t('msgLang')}</Txt>
                <Segmented<Lang> items={[['ar', 'العربي'], ['en', 'English']]} value={msgLang} onChange={setMsgLang} />
              </>
            )}
          </>
        )}
      </ScrollView>
      <View style={[st.bar, { paddingBottom: insets.bottom + space.md, gap: 6 }]}>
        {step === 3 && (lines.length > 0 || custom.length > 0) && (
          <>
            <Row style={{ justifyContent: 'space-between' }}><Muted>{t(custom.length ? 'amountsLabel' : 'subtotal')}</Muted><Muted>{money(subtotal, lang)}</Muted></Row>
            {ship !== 'none' && <Row style={{ justifyContent: 'space-between' }}>
              <Muted>{t('delivery')}</Muted>
              <Muted>{delivery === undefined ? '…' : delivery === null ? t('noRate') : delivery === 0 ? t('deliveryFree') : money(delivery, lang)}</Muted>
            </Row>}
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt size={16} weight="semibold">{t('posTotal')}</Txt>
              <Txt size={22} weight="bold">{total === null ? '—' : money(total, lang)}</Txt>
            </Row>
          </>
        )}
        {step === 1 && <Button label={t('nextStep')} onPress={() => setStep(2)} disabled={!stepOk[1]} />}
        {step === 2 && <Button label={count + custom.length ? t('nextItems', { n: count + custom.length, x: money(subtotal, lang) }) : t('nextStep')} onPress={() => setStep(3)} disabled={!stepOk[2]} />}
        {step === 3 && <Button label={t('createOrder')} icon="check" loading={create.isPending} disabled={!stepOk[1] || !stepOk[2] || !stepOk[3] || create.isPending} onPress={() => create.mutate()} />}
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, backgroundColor: color.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bar1: { height: 4, borderRadius: 2, backgroundColor: color.line },
  card: { padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  step: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.sunken, justifyContent: 'center' },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.surface, paddingHorizontal: 12, fontSize: 16, color: color.ink },
  big: { minHeight: 56, fontSize: 22, letterSpacing: 1 },
  search: { gap: 8, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1.5, borderColor: 'transparent' },
  pickOn: { borderColor: color.ink },
  thumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: color.sunken, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  badge: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 6, backgroundColor: color.ink, justifyContent: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: color.sunken },
  chipOn: { backgroundColor: color.ink },
  tick: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: color.line, alignItems: 'center', justifyContent: 'center' },
  bar: { paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: color.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  okDot: { width: 56, height: 56, borderRadius: 28, backgroundColor: color.green, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
});
