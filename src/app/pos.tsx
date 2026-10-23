// Shop till: tap items to build a sale, take cash, card or BenefitPay, and hand over a receipt.
// Prices and stock come from the store; the sale is saved there as a completed order (API 1.5).
// Each checkout carries its own reference, so pressing again after a network drop never sells twice.
import { useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, font, radius, space } from '../lib/theme';
import { money } from '../lib/format';
import { sharePdf } from '../lib/print';
import { receiptHtml, receiptText, RECEIPT_SIZE } from '../lib/receipt';
import { showMessage } from '../lib/confirm';
import type { PosMethod, PosProduct, PosReceipt } from '../lib/types';
import { Button, Empty, ErrorState, Muted, Row, Segmented, Skeleton, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const newRef = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
const parse = (s: string) => { const n = Number(s.replace(',', '.').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : 0; };
const tick = (kind: 'light' | 'ok' | 'warn') => {
  if (Platform.OS === 'web') return;
  if (kind === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  else Haptics.notificationAsync(kind === 'ok' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
};

export default function Pos() {
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['pos-catalog'], queryFn: () => api.posCatalog(session) });
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<'all' | 'drinks' | 'products'>('all');
  const [cart, setCart] = useState<Record<number, number>>({});
  const [open, setOpen] = useState(false);

  const products = q.data?.products ?? [];
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const hasDrinks = products.some((p) => p.group === 'drinks');
  // The menu was emptied since: back to everything rather than an empty tab.
  useEffect(() => { if (!hasDrinks && group !== 'all') setGroup('all'); }, [hasDrinks, group]);
  const shown = products.filter((p) => (group === 'all' || p.group === group) && (!search.trim() || (p.name + ' ' + p.sku).toLowerCase().includes(search.trim().toLowerCase())));
  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId.get(Number(id)), qty })).filter((l): l is { p: PosProduct; qty: number } => !!l.p && l.qty > 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = r3(lines.reduce((s, l) => s + l.p.price * l.qty, 0));

  const setQty = (p: PosProduct, qty: number) => {
    const max = p.stock === null ? 99 : Math.min(99, p.stock);
    if (qty > max) { tick('warn'); showMessage(p.name, t('posNoMore', { n: Math.max(0, p.stock ?? 0) })); return; }
    tick('light');
    setCart((c) => { const n = { ...c }; if (qty <= 0) delete n[p.id]; else n[p.id] = qty; return n; });
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={st.iconBtn} accessibilityLabel={t('posExit')}>
          <Icon name="close" size={22} />
        </Touch>
        <Txt size={19} weight="bold" style={{ flex: 1 }}>{t('pos')}</Txt>
        <Touch onPress={() => router.push('/pos-today')} style={st.pill}>
          <Txt size={13} weight="semibold">{t('posToday')}</Txt>
        </Touch>
        <Touch onPress={() => router.push('/pos-books')} style={st.pill}>
          <Txt size={13} weight="semibold">{t('booksShort')}</Txt>
        </Touch>
      </Row>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
        <Row style={st.search}>
          <Icon name="search" size={18} tint={color.faint} />
          <TextInput value={search} onChangeText={setSearch} placeholder={t('posSearch')} placeholderTextColor={color.faint}
            style={{ flex: 1, fontSize: 15, color: color.ink, fontFamily: font.regular, textAlign: lang === 'ar' ? 'right' : 'left', paddingVertical: 10 }} />
        </Row>
        {hasDrinks && <Segmented<'all' | 'drinks' | 'products'> items={[['all', t('posAll')], ['drinks', t('posDrinks')], ['products', t('posGoods')]]} value={group} onChange={setGroup} style={{ marginTop: space.sm }} />}
      </View>
      {q.isError && !q.data ? (
        <ErrorState onRetry={() => { q.refetch(); }} />
      ) : !q.data ? (
        <View style={{ padding: space.lg, gap: space.md }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={120} r={radius.lg} />)}</View>
      ) : (
        <FlatList
          data={shown}
          numColumns={2}
          keyExtractor={(p) => String(p.id)}
          columnWrapperStyle={{ gap: space.md }}
          contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + (count ? 110 : space.xl) }}
          ListEmptyComponent={<Empty title={t('posNoProducts')} icon="products" />}
          onRefresh={() => { q.refetch(); }}
          refreshing={q.isRefetching}
          renderItem={({ item: p }) => {
            const inCart = cart[p.id] ?? 0;
            const out = p.stock !== null && p.stock <= 0;
            return (
              <Touch onPress={() => setQty(p, inCart + 1)} disabled={out} style={[st.tile, inCart > 0 && st.tileOn, out && { opacity: 0.45 }]} accessibilityLabel={p.name}>
                <View style={st.thumb}>{p.image ? <Image source={p.image} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} /> : <Icon name="products" size={28} tint={color.faint} />}</View>
                <Txt size={14} weight="semibold" lines={2}>{p.name}</Txt>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt size={14} weight="bold">{money(p.price, lang)}</Txt>
                  <Muted size={12}>{out ? t('posOut') : p.stock === null ? '' : t('stockN', { n: p.stock })}</Muted>
                </Row>
                {inCart > 0 && <View style={st.badge}><Txt size={13} weight="bold" tint={color.bg} center>{inCart}</Txt></View>}
              </Touch>
            );
          }}
        />
      )}
      {count > 0 && (
        <View style={[st.bar, { paddingBottom: insets.bottom + space.md }]}>
          <Button label={t('posPay', { n: count, x: money(subtotal, lang) })} icon="cash" onPress={() => setOpen(true)} />
        </View>
      )}
      <Checkout
        open={open}
        lines={lines}
        subtotal={subtotal}
        methods={q.data?.methods ?? []}
        setQty={setQty}
        onClose={() => setOpen(false)}
        onDone={() => {
          setCart({});
          for (const k of ['pos-catalog', 'pos-today', 'pos-books', 'home', 'products']) qc.invalidateQueries({ queryKey: [k] });
        }}
      />
    </View>
  );
}

function Checkout({ open, lines, subtotal, methods, setQty, onClose, onDone }: {
  open: boolean; lines: { p: PosProduct; qty: number }[]; subtotal: number; methods: { key: PosMethod; label: string }[];
  setQty: (p: PosProduct, qty: number) => void; onClose: () => void; onDone: () => void;
}) {
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const [ref, setRef] = useState(newRef);
  const [method, setMethod] = useState<PosMethod>('cash');
  const [discType, setDiscType] = useState<'amount' | 'percent'>('amount');
  const [disc, setDisc] = useState('');
  const [given, setGiven] = useState('');
  const [who, setWho] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [done, setDone] = useState<PosReceipt | null>(null);
  // A new basket is a new sale: the reference only survives retries of the same items.
  const basket = lines.map((l) => l.p.id + 'x' + l.qty).join(',');
  useEffect(() => { if (!done) setRef(newRef()); }, [basket]); // eslint-disable-line react-hooks/exhaustive-deps

  const dv = parse(disc);
  const discount = r3(Math.min(subtotal, discType === 'percent' ? (subtotal * Math.min(100, dv)) / 100 : dv));
  const total = r3(subtotal - discount);
  const cash = given.trim() ? parse(given) : null;
  const change = method === 'cash' && cash !== null ? r3(cash - total) : null;
  const short = change !== null && change < 0;

  const sale = useMutation({
    mutationFn: () => api.posSale(session, {
      ref, lines: lines.map((l) => ({ id: l.p.id, qty: l.qty })), method, discount: dv, discount_type: discType,
      cash_given: method === 'cash' ? cash : null, expected_total: total, name: name.trim(), phone: phone.trim(),
    }),
    onSuccess: (r) => { tick('ok'); setDone(r); onDone(); },
    onError: (e) => { tick('warn'); showMessage(t('posNotSaved'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e instanceof ApiError && e.kind === 'network' ? t('posNetwork') : e.message); },
  });

  const reset = () => {
    setRef(newRef()); setMethod('cash'); setDiscType('amount'); setDisc(''); setGiven(''); setWho(false); setName(''); setPhone(''); setDone(null); sale.reset();
  };
  const close = () => { if (sale.isPending) return; if (done) reset(); onClose(); };
  const quick = [total, Math.ceil(total), Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, Math.ceil(total / 20) * 20].filter((v, i, a) => v > 0 && a.indexOf(v) === i).slice(0, 4);
  const input = [st.input, { textAlign: (lang === 'ar' ? 'right' : 'left') as 'right' | 'left', fontFamily: font.regular }];

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: color.bg }}>
        <Row style={[st.top, { paddingTop: Platform.OS === 'ios' ? space.md : insets.top + 6 }]}>
          <Txt size={19} weight="bold" style={{ flex: 1, paddingHorizontal: space.sm }}>{done ? t('posSold', { n: done.number }) : t('posCheckout')}</Txt>
          <Touch onPress={close} style={st.iconBtn} accessibilityLabel={t('posExit')}><Icon name="close" size={22} /></Touch>
        </Row>
        {done ? (
          <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl }}>
            <View style={[st.card, { alignItems: 'center', gap: 6, paddingVertical: space.xl }]}>
              <View style={st.okDot}><Icon name="check" size={30} tint={color.bg} /></View>
              <Txt size={28} weight="bold">{money(done.total, lang)}</Txt>
              <Muted>{done.method_label}{done.repeat ? ' · ' + t('posAlreadySaved') : ''}</Muted>
              {done.change !== null && done.change > 0 && (
                <View style={st.change}><Txt size={15} weight="semibold" tint={color.green}>{t('posChange', { x: money(done.change, lang) })}</Txt></View>
              )}
            </View>
            <Button label={t('posShareReceipt')} icon="print" kind="light" onPress={() => sharePdf(receiptHtml(done, lang), 'KOUB-' + done.number, RECEIPT_SIZE).catch(() => {})} />
            {done.whatsapp && (
              <Button label={t('posWhatsappReceipt')} icon="whatsapp" kind="light"
                onPress={() => Linking.openURL('https://wa.me/' + done.whatsapp + '?text=' + encodeURIComponent(receiptText(done, lang))).catch(() => {})} />
            )}
            <Button label={t('posNewSale')} icon="cash" onPress={() => { reset(); onClose(); }} />
          </ScrollView>
        ) : (
          <>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xl }}>
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
                    <Txt size={14} weight="semibold" style={{ minWidth: 70, textAlign: lang === 'ar' ? 'left' : 'right' }}>{money(r3(l.p.price * l.qty), lang)}</Txt>
                  </Row>
                ))}
                {!lines.length && <Muted center style={{ paddingVertical: space.md }}>{t('posEmpty')}</Muted>}
              </View>

              <Txt size={14} weight="semibold">{t('posDiscount')}</Txt>
              <Row gap={8}>
                <TextInput value={disc} onChangeText={setDisc} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={color.faint} style={[input, { flex: 1, minWidth: 0 }]} />
                <Segmented<'amount' | 'percent'> items={[['amount', lang === 'ar' ? 'د.ب' : 'BHD'], ['percent', '%']]} value={discType} onChange={setDiscType} style={{ width: 140 }} />
              </Row>

              <Txt size={14} weight="semibold">{t('posMethod')}</Txt>
              <Segmented<PosMethod> items={(methods.length ? methods : [{ key: 'cash' as PosMethod, label: t('posCash') }]).map((m) => [m.key, m.label])} value={method} onChange={setMethod} />

              {method === 'cash' && (
                <>
                  <Txt size={14} weight="semibold">{t('posCashGiven')}</Txt>
                  <TextInput value={given} onChangeText={setGiven} keyboardType="decimal-pad" placeholder={t('posCashHint')} placeholderTextColor={color.faint} style={input} />
                  <Row gap={8} style={{ flexWrap: 'wrap' }}>
                    {quick.map((v) => (
                      <Touch key={v} onPress={() => setGiven(String(v))} style={st.pill}><Txt size={13} weight="semibold">{money(v, lang)}</Txt></Touch>
                    ))}
                  </Row>
                  {change !== null && (
                    <Txt size={15} weight="semibold" tint={short ? color.red : color.green}>{short ? t('posShort', { x: money(-change, lang) }) : t('posChange', { x: money(change, lang) })}</Txt>
                  )}
                </>
              )}

              {who ? (
                <View style={{ gap: 8 }}>
                  <Txt size={14} weight="semibold">{t('posCustomer')}</Txt>
                  <TextInput value={name} onChangeText={setName} placeholder={t('posCustomerName')} placeholderTextColor={color.faint} maxLength={80} style={input} />
                  <TextInput value={phone} onChangeText={setPhone} placeholder={t('posCustomerPhone')} placeholderTextColor={color.faint} keyboardType="phone-pad" maxLength={20} style={[input, { textAlign: 'left', writingDirection: 'ltr' }]} />
                </View>
              ) : (
                <Touch onPress={() => setWho(true)} style={{ paddingVertical: 6 }}><Muted>{'+ ' + t('posAddCustomer')}</Muted></Touch>
              )}
            </ScrollView>
            <View style={[st.bar, { position: 'relative', paddingBottom: insets.bottom + space.md, gap: 6 }]}>
              {discount > 0 && <Row style={{ justifyContent: 'space-between' }}><Muted>{t('posDiscount')}</Muted><Muted>{'−' + money(discount, lang)}</Muted></Row>}
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt size={16} weight="semibold">{t('posTotal')}</Txt>
                <Txt size={22} weight="bold">{money(total, lang)}</Txt>
              </Row>
              <Button label={t('posComplete')} icon="check" loading={sale.isPending} disabled={!lines.length || short || sale.isPending} onPress={() => sale.mutate()} />
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: 4, backgroundColor: color.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: color.sunken },
  search: { gap: 8, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  tile: { flex: 1, gap: 6, padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface, borderWidth: 1.5, borderColor: 'transparent' },
  tileOn: { borderColor: color.ink },
  thumb: { height: 96, borderRadius: radius.md, backgroundColor: color.sunken, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  badge: { position: 'absolute', top: 8, end: 8, minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 6, backgroundColor: color.ink, justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: color.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  card: { padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  step: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.sunken, justifyContent: 'center' },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.surface, paddingHorizontal: 12, fontSize: 16, color: color.ink },
  okDot: { width: 56, height: 56, borderRadius: 28, backgroundColor: color.green, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  change: { marginTop: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: color.greenBg },
});
