// KOUB POS: tap items to build an order (a combined item asks which drink; a long press adds a note), take card or
// BenefitPay (no cash since API 1.21), and hand over a receipt with today's order number (API 1.22).
// On an iPad the order stays open beside the products, like a counter POS.
// Prices and stock come from the store; the sale is saved there as a completed order (API 1.5).
// Each checkout carries its own reference, so pressing again after a network drop never sells twice.
import { useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, font, radius, space } from '../lib/theme';
import { money } from '../lib/format';
import { showMessage } from '../lib/confirm';
import type { LoyaltyCard, PosChoice, PayRefMode, PosMethod, PosProduct, PosReceipt, PosShelf } from '../lib/types';
import { PosOptions, type PosPick } from '../components/PosOptions';
import { LoyaltyScan } from '../components/LoyaltyScan';
import { QrCode } from '../components/QrCode';
import { Button, Empty, ErrorState, Muted, Row, Segmented, Skeleton, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';
import { StaffMenu } from '../components/Staff';

// Rounds like the store's PHP round(): 0.30749999… (float error for 0.3075) goes up, so totals always agree.
const r3 = (n: number) => Math.round(Number((n * 1000).toPrecision(15))) / 1000;
// One order line: a product, the drink picked (combined items) and a note; same three together add up.
type Line = { key: string; p: PosProduct; qty: number; choice: PosChoice | null; note: string };
type CartLine = { key: string; id: number; qty: number; choice: PosChoice | null; note: string };
const lineKey = (id: number, choice: PosChoice | null, note: string) => id + '|' + (choice?.key ?? '') + '|' + note;
const newRef = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
const parse = (s: string) => { const n = Number(s.replace(',', '.').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : 0; };
const tick = (kind: 'light' | 'ok' | 'warn') => {
  if (Platform.OS === 'web') return;
  if (kind === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  else Haptics.notificationAsync(kind === 'ok' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
};

// inTab (API 1.40): staff outside open the till as their "New order" tab, above the tab bar, with their menu.
export default function Pos({ inTab = false }: { inTab?: boolean } = {}) {
  const session = useApiSession();
  const { t, lang, cashier, me } = useSession();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['pos-catalog'], queryFn: () => api.posCatalog(session) });
  // What is still to be handed to customers (API 1.19: every sale), one tap away from the till.
  const bar = useQuery({ queryKey: ['bar'], queryFn: () => api.bar(session), refetchInterval: 15_000, retry: false });
  const toHand = cashier ? 0 : bar.data?.tickets.filter((x) => x.state !== 'done').length ?? 0;
  // Room for the tab bar under the pay button when the till is a tab.
  const tabPad = inTab ? 64 : 0;
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<'all' | 'drinks' | 'products'>('all');
  // '⭐ Top' (API 1.23): the best sellers of the week, first when the store sends them.
  const [shelf, setShelf] = useState<PosShelf | 'top'>('top');
  const [temp, setTemp] = useState<'hot' | 'cold'>('hot');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [optFor, setOptFor] = useState<PosProduct | null>(null);
  const [open, setOpen] = useState(false);
  // More tiles across on a tablet.
  const { width } = useWindowDimensions();
  // An iPad (or a wide window) keeps the order open beside the products.
  const wide = width >= 900;
  const cols = wide ? (width >= 1300 ? 4 : 3) : width >= 768 ? 4 : 2;

  const products = q.data?.products ?? [];
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const hasDrinks = products.some((p) => p.group === 'drinks');
  // The menu was emptied since: back to everything rather than an empty tab.
  useEffect(() => { if (!hasDrinks && group !== 'all') setGroup('all'); }, [hasDrinks, group]);
  // Shelves (API 1.19): coffee (hot / cold), tea, sweets, goods. Only the shelves that have something show.
  const top = (q.data?.top ?? []).map((id) => byId.get(id)).filter((p): p is PosProduct => !!p);
  const shelves = [...(top.length ? ['top' as const] : []), ...(['coffee', 'tea', 'sweets', 'goods'] as PosShelf[]).filter((k) => products.some((p) => p.shelf === k))];
  const useShelves = shelves.length > 1;
  const temps = (['hot', 'cold'] as const).filter((k) => products.some((p) => p.shelf === 'coffee' && p.temp === k));
  useEffect(() => { if (useShelves && !shelves.includes(shelf)) setShelf(shelves[0]); }, [useShelves, shelves, shelf]);
  useEffect(() => { if (temps.length && !temps.includes(temp)) setTemp(temps[0]); }, [temps, temp]);
  const query = search.trim().toLowerCase();
  // A search looks through everything.
  const shown = products.filter((p) => query ? (p.name + ' ' + p.sku).toLowerCase().includes(query)
    : useShelves ? p.shelf === shelf && (shelf !== 'coffee' || temps.length < 2 || p.temp === temp)
    : group === 'all' || p.group === group);
  const list = !query && useShelves && shelf === 'top' ? top : shown;
  const lines = cart.map((c) => ({ ...c, p: byId.get(c.id) })).filter((l): l is Line & CartLine => !!l.p && l.qty > 0) as Line[];
  const perProduct = (id: number) => cart.reduce((n, c) => n + (c.id === id ? c.qty : 0), 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = r3(lines.reduce((s, l) => s + l.p.price * l.qty, 0));

  // Stock is per product, whatever the drink picked or the note.
  const fits = (p: PosProduct, extra: number) => {
    const max = p.stock === null ? 99 : Math.min(99, p.stock);
    if (perProduct(p.id) + extra > max) { tick('warn'); showMessage(p.name, t('posNoMore', { n: Math.max(0, p.stock ?? 0) })); return false; }
    return true;
  };
  const add = (p: PosProduct, pick: PosPick) => {
    if (!fits(p, pick.qty)) return;
    tick('light');
    const key = lineKey(p.id, pick.choice, pick.note);
    setCart((c) => (c.some((x) => x.key === key) ? c.map((x) => (x.key === key ? { ...x, qty: Math.min(99, x.qty + pick.qty) } : x)) : [...c, { key, id: p.id, qty: pick.qty, choice: pick.choice, note: pick.note }]));
  };
  const setLineQty = (key: string, qty: number) => {
    const line = lines.find((l) => l.key === key);
    if (line && qty > line.qty && !fits(line.p, qty - line.qty)) return;
    tick('light');
    setCart((c) => (qty <= 0 ? c.filter((x) => x.key !== key) : c.map((x) => (x.key === key ? { ...x, qty } : x))));
  };
  // A combined item asks which drink; anything else goes straight in. A long press on a drink opens notes.
  // Sold out today opens the sheet (to put it back); a combined item asks which drink; anything else goes straight in.
  const press = (p: PosProduct) => (p.out_today || p.choices?.length ? setOptFor(p) : add(p, { choice: null, note: '', qty: 1 }));
  // − on a tile: one less of the product, from its latest line (a drink with choices may have several lines).
  const less = (p: PosProduct) => {
    const line = [...cart].reverse().find((c) => c.id === p.id && c.qty > 0);
    if (line) setLineQty(line.key, line.qty - 1);
  };
  // A long press opens the sheet: notes for a drink, and "sold out today" for anything.
  const hold = (p: PosProduct) => { tick('light'); setOptFor(p); };
  const outM = useMutation({
    mutationFn: (v: { p: PosProduct; out: boolean }) => api.posOut(session, v.p.id, v.out),
    onSuccess: (_r, v) => { tick('ok'); setOptFor(null); if (v.out) setCart((c) => c.filter((x) => x.id !== v.p.id)); qc.invalidateQueries({ queryKey: ['pos-catalog'] }); },
    onError: (e) => showMessage(t('notUpdated'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e.message),
  });

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        {inTab ? null : cashier ? (
          // Staff reach the full-screen till only by an old link: back to their tabs.
          <Touch onPress={() => router.replace('/' as never)} style={st.iconBtn} accessibilityLabel={t('posExit')}>
            <Icon name="close" size={22} />
          </Touch>
        ) : (
          <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={st.iconBtn} accessibilityLabel={t('posExit')}>
            <Icon name="close" size={22} />
          </Touch>
        )}
        <View style={{ flex: 1 }}>
          <Txt size={19} weight="bold">{inTab ? t('tabNewOrder') : t('pos')}</Txt>
          {cashier && me?.name ? <Muted size={12} lines={1}>{t('posSignedIn', { n: me.name })}</Muted> : null}
        </View>
        {toHand > 0 && (
          <Touch onPress={() => router.push('/work' as never)} style={[st.pill, { backgroundColor: color.ink }]}>
            <Txt size={13} weight="semibold" tint={color.bg}>{t('posHandover', { n: toHand })}</Txt>
          </Touch>
        )}
        {!cashier && (
          <Touch onPress={() => router.push('/pos-today' as never)} style={st.pill}>
            <Txt size={13} weight="semibold">{t('posToday')}</Txt>
          </Touch>
        )}
        {!cashier && (
          <Touch onPress={() => router.push('/pos-books' as never)} style={st.pill}>
            <Txt size={13} weight="semibold">{t('booksShort')}</Txt>
          </Touch>
        )}
        {cashier && <StaffMenu />}
      </Row>
      {q.data?.training ? (
        <Row gap={8} style={st.training}>
          <Icon name="warn" size={18} tint={color.bg} />
          <Txt size={13} weight="semibold" tint={color.bg} style={{ flex: 1 }}>{t('posTraining')}</Txt>
        </Row>
      ) : null}
      <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
      <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
        <Row style={st.search}>
          <Icon name="search" size={18} tint={color.faint} />
          <TextInput value={search} onChangeText={setSearch} placeholder={t('posSearch')} placeholderTextColor={color.faint}
            style={{ flex: 1, fontSize: 15, color: color.ink, fontFamily: font.regular, textAlign: lang === 'ar' ? 'right' : 'left', paddingVertical: 10 }} />
        </Row>
        {useShelves ? (
          <>
            <Segmented<PosShelf | 'top'> items={shelves.map((k) => [k, t(({ top: 'shTop', coffee: 'shCoffee', tea: 'shTea', sweets: 'shSweets', goods: 'posGoods' } as const)[k])] as [PosShelf | 'top', string])} value={shelf} onChange={setShelf} style={{ marginTop: space.sm }} />
            {shelf === 'coffee' && temps.length > 1 && !query && (
              <Segmented<'hot' | 'cold'> items={[['hot', '☕ ' + t('shHot')], ['cold', '🧊 ' + t('shCold')]]} value={temp} onChange={setTemp} style={{ marginTop: space.sm }} />
            )}
          </>
        ) : hasDrinks && <Segmented<'all' | 'drinks' | 'products'> items={[['all', t('posAll')], ['drinks', t('posDrinks')], ['products', t('posGoods')]]} value={group} onChange={setGroup} style={{ marginTop: space.sm }} />}
      </View>
      {q.isError && !q.data ? (
        <ErrorState onRetry={() => { q.refetch(); }} />
      ) : !q.data ? (
        <View style={{ padding: space.lg, gap: space.md }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={120} r={radius.lg} />)}</View>
      ) : (
        <FlatList
          data={list}
          key={'cols-' + cols}
          numColumns={cols}
          keyExtractor={(p) => String(p.id)}
          columnWrapperStyle={{ gap: space.md }}
          contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + tabPad + (count && !wide ? 110 : space.xl) }}
          ListFooterComponent={count === 0 ? <Muted center size={12} style={{ marginTop: space.sm }}>{t('posHoldHint')}</Muted> : undefined}
          ListEmptyComponent={<Empty title={t('posNoProducts')} icon="products" />}
          onRefresh={() => { q.refetch(); }}
          refreshing={q.isRefetching}
          renderItem={({ item: p }) => {
            const inCart = perProduct(p.id);
            const out = (p.stock !== null && p.stock <= 0) || !!p.out_today;
            return (
              <Touch onPress={() => press(p)} onLongPress={() => hold(p)} delayLongPress={350} disabled={out && !p.out_today} style={[st.tile, inCart > 0 && st.tileOn, out && { opacity: 0.45 }]} accessibilityLabel={p.name}>
                <View style={st.thumb}>{p.image ? <Image source={p.image} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} /> : <Icon name="products" size={28} tint={color.faint} />}</View>
                <Txt size={14} weight="semibold" lines={2}>{p.name}</Txt>
                {p.stock !== null && !out ? <Muted size={11}>{t('stockN', { n: p.stock })}</Muted> : null}
                <Row style={{ justifyContent: 'space-between', gap: 4 }}>
                  <Txt size={14} weight="bold" lines={1} style={{ flexShrink: 1 }}>{money(p.price, lang)}</Txt>
                  {!out ? (
                    // − / + right on the tile (owner's ask): change how many without opening the order.
                    <Row gap={2} style={{ flexShrink: 0 }}>
                      {inCart > 0 && <Touch onPress={() => less(p)} style={st.tileStep} accessibilityLabel={'− ' + p.name}><Txt size={18} weight="bold" center>−</Txt></Touch>}
                      {inCart > 0 && <Txt size={15} weight="bold" style={{ minWidth: 18 }} center>{inCart}</Txt>}
                      <Touch onPress={() => press(p)} style={[st.tileStep, inCart > 0 && { backgroundColor: color.ink }]} accessibilityLabel={'+ ' + p.name}><Txt size={18} weight="bold" tint={inCart > 0 ? color.bg : color.ink} center>+</Txt></Touch>
                    </Row>
                  ) : <Muted size={12}>{p.out_today ? t('soldOutToday') : t('posOut')}</Muted>}
                </Row>
              </Touch>
            );
          }}
        />
      )}
      </View>
      {wide && (
        // The open order, always in view on an iPad: lines with their options, quantities, total, pay.
        <View style={[st.panel, { paddingBottom: insets.bottom + tabPad + space.md }]}>
          <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
            <Txt size={18} weight="bold">{t('posOrder') + (count ? ' · ' + count : '')}</Txt>
            {count > 0 && <Touch onPress={() => { tick('light'); setCart([]); }} style={{ padding: 6 }}><Muted>{t('posClear')}</Muted></Touch>}
          </Row>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
            {count ? <OrderLines lines={lines} setLineQty={setLineQty} /> : <Empty title={t('posOrderEmpty')} icon="cash" />}
          </ScrollView>
          <Row style={{ justifyContent: 'space-between', paddingVertical: space.md }}>
            <Txt size={16} weight="semibold">{t('posTotal')}</Txt>
            <Txt size={24} weight="bold">{money(subtotal, lang)}</Txt>
          </Row>
          <Button label={t('posPay', { n: count, x: money(subtotal, lang) })} icon="cash" disabled={!count} onPress={() => setOpen(true)} />
        </View>
      )}
      </View>
      {count > 0 && !wide && (
        <View style={[st.bar, { paddingBottom: inTab ? tabPad + Math.max(insets.bottom, 10) : insets.bottom + space.md }]}>
          <Button label={t('posPay', { n: count, x: money(subtotal, lang) })} icon="cash" onPress={() => setOpen(true)} />
        </View>
      )}
      <PosOptions product={optFor} onClose={() => setOptFor(null)} onAdd={(p, pick) => { add(p, pick); setOptFor(null); }}
        onOut={(p, out) => outM.mutate({ p, out })} outBusy={outM.isPending} />
      <Checkout
        open={open}
        lines={lines}
        subtotal={subtotal}
        methods={q.data?.methods ?? []}
        benefitQr={q.data?.benefit_qr ?? null}
        payRefMode={q.data?.pay_ref ?? 'off'}
        loyaltyOn={!!q.data?.loyalty}
        setLineQty={setLineQty}
        onClose={() => setOpen(false)}
        onDone={() => {
          setCart([]);
          for (const k of ['pos-catalog', 'pos-today', 'pos-books', 'home', 'products', 'numbers', 'orders', 'bar']) qc.invalidateQueries({ queryKey: [k] });
        }}
      />
    </View>
  );
}

// The order's lines with what was picked and noted, each with − / + (used beside the products and at payment).
function OrderLines({ lines, setLineQty }: { lines: Line[]; setLineQty: (key: string, qty: number) => void }) {
  const { lang } = useSession();
  return (
    <View>
      {lines.map((l, i) => (
        <Row key={l.key} gap={10} style={[{ paddingVertical: 10 }, i > 0 && st.sep]}>
          <View style={{ flex: 1 }}>
            {/* A combined item reads as the drink picked ("Latte"), with the note under it. */}
            <Txt size={15} weight="semibold" lines={2}>{l.choice?.label ?? l.p.name}</Txt>
            {l.note ? <Txt size={13} weight="semibold" tint={color.amber} lines={2}>{l.note}</Txt> : null}
            <Muted size={12}>{money(l.p.price, lang)}</Muted>
          </View>
          <Row gap={6}>
            <Touch onPress={() => setLineQty(l.key, l.qty - 1)} style={st.step} accessibilityLabel="-"><Txt size={18} weight="bold" center>−</Txt></Touch>
            <Txt size={16} weight="bold" style={{ minWidth: 24 }} center>{l.qty}</Txt>
            <Touch onPress={() => setLineQty(l.key, l.qty + 1)} style={st.step} accessibilityLabel="+"><Txt size={18} weight="bold" center>+</Txt></Touch>
          </Row>
          <Txt size={14} weight="semibold" style={{ minWidth: 64, textAlign: lang === 'ar' ? 'left' : 'right' }}>{money(r3(l.p.price * l.qty), lang)}</Txt>
        </Row>
      ))}
    </View>
  );
}

function Checkout({ open, lines, subtotal, methods, benefitQr, payRefMode, loyaltyOn, setLineQty, onClose, onDone }: {
  open: boolean; lines: Line[]; subtotal: number; methods: { key: PosMethod; label: string }[]; benefitQr: string | null; payRefMode: PayRefMode; loyaltyOn: boolean;
  setLineQty: (key: string, qty: number) => void; onClose: () => void; onDone: () => void;
}) {
  const session = useApiSession();
  const { t, lang, cashier, me } = useSession();
  const insets = useSafeAreaInsets();
  const [ref, setRef] = useState(newRef);
  // The scanned KOUB card: every paid drink is a stamp; a free drink waiting can be used on this sale.
  const [card, setCard] = useState<{ card: LoyaltyCard; code: string } | null>(null);
  const [useFree, setUseFree] = useState(false);
  const [scan, setScan] = useState(false);
  // The store says which methods it takes (API 1.21: card machine and BenefitPay); the first is the default.
  const first = (methods[0]?.key ?? 'card') as PosMethod;
  const [method, setMethod] = useState<PosMethod>(first);
  // KOUB credit (API 1.34) is offered only once a card with credit switched on is scanned.
  const shown = methods.filter((m) => m.key !== 'credit' || (card && card.card.credit != null));
  useEffect(() => { if (shown.length && !shown.some((m) => m.key === method)) setMethod(first); }, [shown, method, first]);
  const [discType, setDiscType] = useState<'amount' | 'percent'>('amount');
  const [disc, setDisc] = useState('');
  // API 1.40: no payment number at all (the owner's call): the till never asks for it, and the store no longer needs it.
  void payRefMode;
  const [given, setGiven] = useState('');
  const [who, setWho] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  // API 1.41: no card to scan: the customer's number puts the stamps on their card (or a new one).
  const joining = loyaltyOn && !card && phone.trim() !== '';
  // A Bahrain number of 8 digits, or a full international one (10 to 15 digits), as the store accepts.
  const joinDigits = phone.replace(/\D/g, '').replace(/^0+/, '').length;
  const joinMissing = joining && joinDigits !== 8 && (joinDigits < 10 || joinDigits > 15);
  const [done, setDone] = useState<PosReceipt | null>(null);
  // Where to hand it over (API 1.23): in the shop, or the car: its plate and what it is (API 1.40), so whoever takes it
  // out finds it. Staff must say where; the owner may leave it.
  const [where, setWhere] = useState<'' | 'shop' | 'car'>('');
  const [plate, setPlate] = useState('');
  const [car, setCar] = useState('');
  const carText = [plate.trim(), car.trim()].filter(Boolean).join(' · ');
  // Every sale says where it is handed over, first: the rest of checkout (card, payment) shows once it is chosen.
  const whereMissing = !where || (where === 'car' && !plate.trim());
  const whereGate = lines.length > 0 && !where;
  // A new basket is a new sale: the reference only survives retries of the same items.
  const basket = lines.map((l) => l.key + 'x' + l.qty).join(',');
  useEffect(() => { if (!done) setRef(newRef()); }, [basket]); // eslint-disable-line react-hooks/exhaustive-deps

  const dv = parse(disc);
  // Like the store: the dearest drink is the free one, and the discount applies to what is left.
  const drinkPrices = lines.filter((l) => l.p.stamp ?? l.p.group === 'drinks').map((l) => l.p.price);
  const free = useFree && card && card.card.rewards > 0 && drinkPrices.length ? r3(Math.max(...drinkPrices)) : 0;
  const base = r3(subtotal - free);
  // API 1.40: only the owner gives a discount.
  const discount = cashier ? 0 : r3(Math.min(base, discType === 'percent' ? (base * Math.min(100, dv)) / 100 : dv));
  const total = r3(base - discount);
  const cash = given.trim() ? parse(given) : null;
  const change = method === 'cash' && cash !== null ? r3(cash - total) : null;
  const short = change !== null && change < 0;
  const creditLeft = card?.card.credit ?? 0;
  const creditShort = method === 'credit' && creditLeft < total - 0.0005;

  const sale = useMutation({
    mutationFn: () => api.posSale(session, {
      ref, lines: lines.map((l) => ({ id: l.p.id, qty: l.qty, ...(l.choice ? { choice: l.choice.key } : {}), ...(l.note ? { note: l.note } : {}) })), method, discount: cashier ? 0 : dv, discount_type: discType,
      cash_given: method === 'cash' ? cash : null, expected_total: total, name: name.trim(), phone: phone.trim(),
      ...(where ? { where: where === 'shop' ? t('whereShop') : '🚗 ' + (carText || t('whereCar').replace('🚗 ', '')) } : {}),
      ...(card ? { loyalty: card.code, loyalty_redeem: free > 0 } : {}),
      ...(joining ? { loyalty_join: true } : {}),
    }),
    onSuccess: (r) => { tick('ok'); setDone(r); onDone(); },
    onError: (e) => { tick('warn'); showMessage(t('posNotSaved'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e instanceof ApiError && e.kind === 'network' ? t('posNetwork') : e.message); },
  });

  const reset = () => {
    setRef(newRef()); setWhere(''); setPlate(''); setCar(''); setMethod(first); setDiscType('amount'); setDisc(''); setGiven(''); setWho(false); setName(''); setPhone(''); setCard(null); setUseFree(false); setDone(null); sale.reset();
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
              {done.no ? (
                <View style={st.noBox}>
                  <Muted size={13}>{t('posOrderNo')}</Muted>
                  <Txt size={56} weight="bold">{String(done.no)}</Txt>
                </View>
              ) : <View style={st.okDot}><Icon name="check" size={30} tint={color.bg} /></View>}
              <Txt size={28} weight="bold">{money(done.total, lang)}</Txt>
              <Muted>{done.method_label}{done.pay_ref ? ' · ' + done.pay_ref : ''}{done.repeat ? ' · ' + t('posAlreadySaved') : ''}</Muted>
              {done.loyalty && !done.loyalty.failed && (
                <Muted center>{[done.loyalty.redeemed ? t('loyUsed') : '', done.loyalty.added > 0 ? t('loyAdded', { n: done.loyalty.added, name: done.loyalty.name }) : '', done.loyalty.new_rewards > 0 ? t('loyNowFree', { name: done.loyalty.name }) : '', t('loyStamps', { s: done.loyalty.stamps, of: done.loyalty.of })].filter(Boolean).join(' · ')}</Muted>
              )}
              {done.method === 'credit' && done.loyalty?.credit != null && <Muted center>{t('creditLeft', { x: money(done.loyalty.credit, lang) })}</Muted>}
              {done.loyalty?.link && !done.loyalty.failed && (
                <Muted center>{[done.loyalty.joined ? t('loyJoined', { name: done.loyalty.name }) : '', me?.whatsapp_automation ? t('loyMsgQueued') : ''].filter(Boolean).join(' · ')}</Muted>
              )}
              {done.change !== null && done.change > 0 && (
                <View style={st.change}><Txt size={15} weight="semibold" tint={color.green}>{t('posChange', { x: money(done.change, lang) })}</Txt></View>
              )}
            </View>
            {/* The customer hears from KOUB's WhatsApp (API 1.41); no receipt or tracking code to hand over here. */}
            <Button label={t('posNewSale')} icon="cash" onPress={() => { reset(); onClose(); }} />
          </ScrollView>
        ) : (
          <>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xl }}>
              <View style={st.card}>
                <OrderLines lines={lines} setLineQty={setLineQty} />
                {!lines.length && <Muted center style={{ paddingVertical: space.md }}>{t('posEmpty')}</Muted>}
              </View>

              {/* API 1.40: no name on the cup; the kiosk sees who took the order instead. */}
              {lines.length > 0 && (
                <View style={[{ gap: 8 }, whereGate && st.whereAsk]}>
                  <Txt size={whereGate ? 17 : 14} weight={whereGate ? 'bold' : 'semibold'}>{t('whereTitle')}</Txt>
                  <Segmented<'' | 'shop' | 'car'> items={[['shop', t('whereShop')], ['car', t('whereCar')]]} value={where} onChange={(v) => setWhere(v === where ? '' : v)} />
                  {where === 'car' && (
                    <Row gap={8}>
                      <TextInput value={plate} onChangeText={(v) => setPlate(v.slice(0, 12))} placeholder={t('carPlate')} placeholderTextColor={color.faint} maxLength={12} keyboardType="numbers-and-punctuation" style={[input, { flex: 2, minWidth: 0, textAlign: 'center', fontSize: 18, letterSpacing: 1 }]} />
                      <TextInput value={car} onChangeText={setCar} placeholder={t('carType')} placeholderTextColor={color.faint} maxLength={28} style={[input, { flex: 3, minWidth: 0 }]} />
                    </Row>
                  )}
                  {whereGate ? <Muted size={13}>{t('whereFirst')}</Muted> : whereMissing && <Muted size={12} tint={color.amber}>{t('plateNeeded')}</Muted>}
                </View>
              )}
              {!whereGate && (<>
              {loyaltyOn && (card ? (
                <View style={[st.card, { gap: 8 }]}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Txt size={15} weight="semibold">{t('loyCard') + ' · ' + card.card.name}</Txt>
                      <Muted size={12}>{[card.card.code, t('loyStamps', { s: card.card.stamps, of: card.card.of }), card.card.rewards > 0 ? t('loyFree', { n: card.card.rewards }) : ''].filter(Boolean).join(' · ')}</Muted>
                    </View>
                    <Touch onPress={() => { setCard(null); setUseFree(false); }} style={st.iconBtn} accessibilityLabel={t('loyRemove')}><Icon name="close" size={18} /></Touch>
                  </Row>
                  {card.card.rewards > 0 && (
                    <Touch onPress={() => (drinkPrices.length ? setUseFree(!useFree) : showMessage(t('loyCard'), t('loyNeedDrink')))} style={[st.pill, { alignSelf: 'flex-start' }, useFree && { backgroundColor: color.ink }]}>
                      <Txt size={13} weight="semibold" tint={useFree ? color.bg : color.ink}>{(useFree ? '✓ ' : '') + t('loyUseFree')}</Txt>
                    </Touch>
                  )}
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  <Button label={t('loyScan')} icon="gift" kind="light" onPress={() => setScan(true)} />
                  {/* API 1.42: the customer's number: their card gets the stamps by itself (or a new one is made). */}
                  <View style={[st.card, { gap: 8 }]}>
                    <Txt size={14} weight="semibold">{t('loyNoCard')}</Txt>
                    <TextInput value={phone} onChangeText={setPhone} placeholder={t('loyJoinPhone')} placeholderTextColor={color.faint} keyboardType="phone-pad" maxLength={20} style={[input, { textAlign: 'left', writingDirection: 'ltr' }]} />
                    {phone.trim() !== '' && <TextInput value={name} onChangeText={setName} placeholder={t('loyJoinName')} placeholderTextColor={color.faint} maxLength={80} style={input} />}
                    <Muted size={12}>{t('loyJoinHint')}</Muted>
                  </View>
                </View>
              ))}

              {/* API 1.40: the discount is the owner's only. */}
              {!cashier && (
                <>
                  <Txt size={14} weight="semibold">{t('posDiscount')}</Txt>
                  <Row gap={8}>
                    <TextInput value={disc} onChangeText={setDisc} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={color.faint} style={[input, { flex: 1, minWidth: 0 }]} />
                    <Segmented<'amount' | 'percent'> items={[['amount', lang === 'ar' ? 'د.ب' : 'BHD'], ['percent', '%']]} value={discType} onChange={setDiscType} style={{ width: 140 }} />
                  </Row>
                </>
              )}

              <Txt size={14} weight="semibold">{t('posMethod')}</Txt>
              <Segmented<PosMethod> items={(shown.length ? shown : [{ key: 'card' as PosMethod, label: t('posCard') }]).map((m) => [m.key, m.label])} value={method} onChange={setMethod} />
              {method === 'credit' && (
                <View style={[st.card, { gap: 4 }]}>
                  <Txt size={15} weight="semibold" tint={creditShort ? color.red : color.ink}>{creditShort ? t('creditShort', { x: money(creditLeft, lang) }) : t('creditAfter', { x: money(creditLeft, lang), y: money(r3(creditLeft - total), lang) })}</Txt>
                </View>
              )}
              {method === 'benefit' && benefitQr ? (
                // The customer scans the shop's BenefitPay QR and pays the total; staff complete the sale once it shows as paid.
                <View style={[st.card, { alignItems: 'center', gap: 8 }]}>
                  <View style={{ padding: 8, backgroundColor: '#FFFFFF', borderRadius: radius.md }}><QrCode value={benefitQr} size={210} /></View>
                  <Txt size={22} weight="bold">{money(total, lang)}</Txt>
                  <Muted center>{t('posBenefitScan')}</Muted>
                </View>
              ) : null}

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

              {!loyaltyOn && (who ? (
                <View style={{ gap: 8 }}>
                  <Txt size={14} weight="semibold">{t('posCustomer')}</Txt>
                  <TextInput value={name} onChangeText={setName} placeholder={t('posCustomerName')} placeholderTextColor={color.faint} maxLength={80} style={input} />
                  <TextInput value={phone} onChangeText={setPhone} placeholder={t('posCustomerPhone')} placeholderTextColor={color.faint} keyboardType="phone-pad" maxLength={20} style={[input, { textAlign: 'left', writingDirection: 'ltr' }]} />
                </View>
              ) : (
                <Touch onPress={() => setWho(true)} style={{ paddingVertical: 6 }}><Muted>{'+ ' + t('posAddCustomer')}</Muted></Touch>
              ))}
              </>)}
            </ScrollView>
            <View style={[st.bar, { position: 'relative', paddingBottom: insets.bottom + space.md, gap: 6 }]}>
              {free > 0 && <Row style={{ justifyContent: 'space-between' }}><Muted>{t('loyFreeLine')}</Muted><Muted>{'−' + money(free, lang)}</Muted></Row>}
              {discount > 0 && <Row style={{ justifyContent: 'space-between' }}><Muted>{t('posDiscount')}</Muted><Muted>{'−' + money(discount, lang)}</Muted></Row>}
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt size={16} weight="semibold">{t('posTotal')}</Txt>
                <Txt size={22} weight="bold">{money(total, lang)}</Txt>
              </Row>
              <Button label={t('posComplete')} icon="check" loading={sale.isPending} disabled={!lines.length || short || creditShort || sale.isPending || whereMissing || joinMissing} onPress={() => sale.mutate()} />
              {joinMissing && <Muted size={12} tint={color.amber} center>{t('loyJoinWrong')}</Muted>}
            </View>
          </>
        )}
      </KeyboardAvoidingView>
      <LoyaltyScan open={scan} onClose={() => setScan(false)} onCard={(c, code) => { setCard({ card: c, code }); setUseFree(false); setScan(false); }} />
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
  tileStep: { width: 32, height: 32, borderRadius: 16, backgroundColor: color.sunken, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 8, end: 8, minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 6, backgroundColor: color.ink, justifyContent: 'center' },
  training: { backgroundColor: color.amber, paddingHorizontal: space.lg, paddingVertical: 10 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: color.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  card: { padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
  // The hand-over choice while nothing is chosen: framed, so staff see it is the first step.
  whereAsk: { padding: space.md, borderRadius: radius.lg, borderWidth: 2, borderColor: color.amber, backgroundColor: color.surface },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  step: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.sunken, justifyContent: 'center' },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.surface, paddingHorizontal: 12, fontSize: 16, color: color.ink },
  panel: { width: 380, borderStartWidth: StyleSheet.hairlineWidth, borderStartColor: color.line, backgroundColor: color.surface, paddingHorizontal: space.lg, paddingTop: space.md },
  noBox: { alignItems: 'center', paddingHorizontal: 28, paddingVertical: 8, borderRadius: radius.lg, backgroundColor: color.sunken, marginBottom: 6 },
  okDot: { width: 56, height: 56, borderRadius: 28, backgroundColor: color.green, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  change: { marginTop: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: color.greenBg },
});
