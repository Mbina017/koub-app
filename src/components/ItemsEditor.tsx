// Change what is in an order (API 1.9): swap, add or remove items and change the mugs inside a set, while the order is
// still in the shop. Lines already in the order keep the price the customer paid; anything added is at the store price.
// The store checks stock and the new total, moves stock, and logs the change. Nothing is sent to the customer.
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, font, radius, space, tone } from '../lib/theme';
import { money } from '../lib/format';
import { showMessage } from '../lib/confirm';
import { itemsTotal } from '../lib/items';
import type { ItemsEdit, ItemsMethod, Order, PosProduct } from '../lib/types';
import { Button, ErrorState, Muted, Row, Skeleton, Touch, Txt, tap } from './ui';
import { Icon } from './Icon';

type Line = { key: string; item_id?: number; product_id: number; name: string; qty: number; unit: number; size: number; parts: Record<string, number>; changed: boolean };
const sum = (parts: Record<string, number>) => Object.values(parts).reduce((s, n) => s + n, 0);

export function ItemsEditor({ o, edit, onSaved, onClose }: { o: Order; edit: ItemsEdit; onSaved: (o: Order) => void; onClose: () => void }) {
  const session = useApiSession();
  const { t, lang } = useSession();
  const catalog = useQuery({ queryKey: ['pos-catalog'], queryFn: () => api.posCatalog(session) });
  const [lines, setLines] = useState<Line[]>(() => edit.lines.map((l) => ({
    key: 'i' + l.item_id, item_id: l.item_id, product_id: l.product_id, name: l.name, qty: l.qty, unit: l.unit, size: l.set_size,
    parts: Object.fromEntries(l.parts.map((p) => [p.name, p.qty])), changed: false,
  })));
  const [mugsFor, setMugsFor] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState<ItemsMethod | ''>('');

  const { total, diff } = itemsTotal(edit.total, edit.lines, lines);
  const products = (catalog.data?.products ?? []).filter((p) => p.group !== 'drinks');
  const shown = products.filter((p) => !search.trim() || (p.name + ' ' + p.sku).toLowerCase().includes(search.trim().toLowerCase()));
  const mugChoices = useMemo(() => {
    const own = lines.flatMap((l) => Object.keys(l.parts));
    return Array.from(new Set([...edit.mugs, ...own]));
  }, [edit.mugs, lines]);
  const setIncomplete = lines.find((l) => l.size > 0 && (!l.item_id || l.changed) && sum(l.parts) !== l.size);
  const needsMethod = !edit.cod && diff > 0;
  const changed = lines.length !== edit.lines.length || lines.some((l) => !l.item_id || l.changed || l.qty !== edit.lines.find((e) => e.item_id === l.item_id)?.qty);
  const ready = changed && lines.length > 0 && !setIncomplete && (!needsMethod || method !== '');

  const patch = (key: string, f: (l: Line) => Line | null) => setLines((ls) => ls.flatMap((l) => (l.key === key ? (f(l) ? [f(l)!] : []) : [l])));
  const add = (p: PosProduct) => {
    const size = edit.sets[String(p.id)] ?? 0;
    const same = size ? undefined : lines.find((l) => !l.item_id && l.product_id === p.id);
    if (same) { patch(same.key, (l) => ({ ...l, qty: Math.min(99, l.qty + 1) })); tap('select'); return; }
    const key = 'n' + p.id + '-' + Date.now();
    setLines((ls) => [...ls, { key, product_id: p.id, name: p.name, qty: 1, unit: p.price, size, parts: {}, changed: true }]);
    if (size) { setMugsFor(key); setPicking(false); }
    tap('select');
  };

  const save = useMutation({
    mutationFn: () => api.orderItems(session, o.id, {
      lines: lines.map((l) => ({
        ...(l.item_id ? { item_id: l.item_id } : { id: l.product_id }), qty: l.qty,
        ...(l.size > 0 && (!l.item_id || l.changed) ? { parts: Object.entries(l.parts).filter(([, n]) => n > 0).map(([name, qty]) => ({ name, qty })) } : {}),
      })),
      expected_total: total, method: needsMethod ? method : '',
    }),
    onSuccess: (data) => { onSaved(data); tap('select'); showMessage(t('editItems'), t('itemsSaved')); onClose(); },
    onError: (e) => showMessage(t('itemsNotSaved'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e instanceof ApiError && e.kind === 'network' ? t('errNetwork') : e.message),
  });

  return (
    <View style={{ gap: space.md }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt size={16} weight="semibold">{t('editItems')}</Txt>
        <Touch onPress={onClose} style={st.iconBtn} accessibilityLabel="close"><Icon name="close" size={20} /></Touch>
      </Row>
      <Muted size={12}>{t('itemsHint')}</Muted>

      {lines.map((l, i) => (
        <View key={l.key} style={[{ paddingVertical: 6, gap: 6 }, i > 0 && st.sep]}>
          <Row gap={10}>
            <View style={{ flex: 1 }}>
              <Txt size={15} weight="semibold" lines={2}>{l.name}</Txt>
              <Muted size={12}>{money(l.unit, lang)}</Muted>
            </View>
            <Row gap={6}>
              <Touch onPress={() => patch(l.key, (x) => (x.qty <= 1 ? null : { ...x, qty: x.qty - 1 }))} style={st.step} accessibilityLabel={l.qty <= 1 ? t('removeItem') : '-'}>
                {l.qty <= 1 ? <Icon name="close" size={16} tint={color.red} /> : <Txt size={18} weight="bold" center>−</Txt>}
              </Touch>
              <Txt size={16} weight="bold" style={{ minWidth: 24 }} center>{l.qty}</Txt>
              <Touch onPress={() => patch(l.key, (x) => ({ ...x, qty: Math.min(99, x.qty + 1) }))} style={st.step} accessibilityLabel="+"><Txt size={18} weight="bold" center>+</Txt></Touch>
            </Row>
          </Row>
          {l.size > 0 && (
            <View style={[st.inset, { backgroundColor: sum(l.parts) === l.size ? color.sunken : tone.amber.bg }]}>
              <Touch onPress={() => setMugsFor(mugsFor === l.key ? null : l.key)} haptic={false}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Txt size={13} weight="semibold" tint={sum(l.parts) === l.size ? color.ink : tone.amber.fg}>{t('mugsOf', { a: sum(l.parts), b: l.size })}</Txt>
                    <Muted size={12}>{Object.entries(l.parts).filter(([, n]) => n > 0).map(([n, q]) => n + ' × ' + q).join(lang === 'ar' ? '، ' : ', ') || t('pickMugs', { n: l.size })}</Muted>
                  </View>
                  <Txt size={13} weight="semibold">{mugsFor === l.key ? t('done') : t('changeMugs')}</Txt>
                </Row>
              </Touch>
              {mugsFor === l.key && mugChoices.map((m) => {
                const n = l.parts[m] ?? 0;
                const full = sum(l.parts) >= l.size;
                const setN = (v: number) => patch(l.key, (x) => ({ ...x, changed: true, parts: { ...x.parts, [m]: v } }));
                return (
                  <Row key={m} gap={8} style={{ paddingVertical: 4 }}>
                    <Txt size={14} weight={n ? 'semibold' : 'regular'} style={{ flex: 1 }}>{m}</Txt>
                    <Touch onPress={() => setN(Math.max(0, n - 1))} disabled={!n} style={[st.stepSm, !n && { opacity: 0.35 }]} accessibilityLabel="-"><Txt size={16} weight="bold" center>−</Txt></Touch>
                    <Txt size={14} weight="bold" style={{ minWidth: 18 }} center>{n}</Txt>
                    <Touch onPress={() => setN(n + 1)} disabled={full} style={[st.stepSm, full && { opacity: 0.35 }]} accessibilityLabel="+"><Txt size={16} weight="bold" center>+</Txt></Touch>
                  </Row>
                );
              })}
            </View>
          )}
        </View>
      ))}

      <Touch onPress={() => setPicking(!picking)} style={[{ paddingVertical: 10 }, st.sep]}>
        <Row gap={8}><Icon name={picking ? 'check' : 'plus'} size={18} /><Txt size={15} weight="semibold">{picking ? t('doneAdding') : t('addItems')}</Txt></Row>
      </Touch>
      {picking && (catalog.isError && !catalog.data ? <ErrorState onRetry={() => { catalog.refetch(); }} /> : !catalog.data ? <Skeleton h={140} r={radius.lg} /> : (
        <View style={{ gap: space.sm }}>
          <Row style={st.search}>
            <Icon name="search" size={18} tint={color.faint} />
            <TextInput value={search} onChangeText={setSearch} placeholder={t('posSearch')} placeholderTextColor={color.faint}
              style={{ flex: 1, fontSize: 15, color: color.ink, fontFamily: font.regular, textAlign: lang === 'ar' ? 'right' : 'left', paddingVertical: 10 }} />
          </Row>
          {shown.map((p) => {
            const out = p.stock !== null && p.stock <= 0;
            return (
              <Touch key={p.id} onPress={() => add(p)} disabled={out} style={[st.pick, out && { opacity: 0.45 }]} accessibilityLabel={p.name}>
                <View style={st.thumb}>{p.image ? <Image source={p.image} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Icon name="products" size={20} tint={color.faint} />}</View>
                <View style={{ flex: 1 }}>
                  <Txt size={14} weight="semibold" lines={1}>{p.name}</Txt>
                  <Muted size={12}>{money(p.price, lang) + (out ? ' · ' + t('posOut') : p.stock === null ? '' : ' · ' + t('stockN', { n: p.stock }))}</Muted>
                </View>
                <Icon name="plus" size={18} tint={color.muted} />
              </Touch>
            );
          })}
        </View>
      ))}

      <View style={[st.inset, { backgroundColor: diff > 0 ? tone.amber.bg : diff < 0 ? color.blueBg : color.sunken, gap: 4 }]}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt size={15} weight="semibold">{t('newTotal')}</Txt>
          <Txt size={17} weight="bold">{money(total, lang)}</Txt>
        </Row>
        <Txt size={13} weight="medium" tint={diff > 0 ? tone.amber.fg : diff < 0 ? color.blue : color.muted}>
          {edit.cod ? (diff ? t('codCollects', { x: money(total, lang) }) : t('diffNone')) : diff > 0 ? t('diffMore', { x: money(diff, lang) }) : diff < 0 ? t('diffLess', { x: money(-diff, lang) }) : t('diffNone')}
        </Txt>
      </View>
      {needsMethod && (
        <View style={{ gap: 8 }}>
          <Txt size={14} weight="semibold">{t('diffPaidBy')}</Txt>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {([['benefit', t('posBenefit')], ['cash', t('posCash')], ['card', t('posCard')], ['transfer', t('transfer')], ['free', t('freeChange')]] as [ItemsMethod, string][]).map(([k, label]) => (
              <Touch key={k} onPress={() => setMethod(k)} style={[st.chip, method === k && st.chipOn]}>
                <Txt size={13} weight="semibold" tint={method === k ? color.bg : color.ink}>{label}</Txt>
              </Touch>
            ))}
          </Row>
        </View>
      )}
      <Row gap={8}>
        <Button label={t('saveChanges')} icon="check" loading={save.isPending} disabled={!ready} onPress={() => save.mutate()} style={{ flex: 2 }} />
        <Button label={t('notNow')} kind="light" onPress={onClose} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}

const st = StyleSheet.create({
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  step: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.sunken, justifyContent: 'center', alignItems: 'center' },
  stepSm: { width: 30, height: 30, borderRadius: 15, backgroundColor: color.surface, justifyContent: 'center', alignItems: 'center' },
  inset: { borderRadius: radius.md, padding: space.md, gap: 2 },
  search: { gap: 8, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.md, backgroundColor: color.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  thumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: color.sunken, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: color.sunken },
  chipOn: { backgroundColor: color.ink },
});
