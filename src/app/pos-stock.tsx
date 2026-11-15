// Ingredient stock (API 1.28), owner only. Two tabs:
// - Ingredients: what is left, days it lasts at last week's pace, low ones first; a delivery adds, a count sets the
//   real figure, waste takes out; add or change an ingredient (unit, low mark, cost per unit).
// - Recipes: what one cup of each drink uses (per drink choice when it differs), its cost and what it earns.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, font, radius, space } from '../lib/theme';
import { money } from '../lib/format';
import { showMessage } from '../lib/confirm';
import type { Ingredient, RecipeItem, StockProduct, StockUnit, StockView } from '../lib/types';
import { Button, ErrorState, Muted, Row, Segmented, Skeleton, TagChip, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

const num = (s: string) => { const v = Number(s.replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(',', '.').trim()); return s.trim() === '' || Number.isNaN(v) ? null : v; };
const fmt = (v: number) => (Math.round(v * 100) / 100).toLocaleString('en-US');

export default function PosStock() {
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['pos-stock'], queryFn: () => api.posStock(session) });
  const [tab, setTab] = useState<'ing' | 'recipes'>('ing');
  const put = (r: StockView) => qc.setQueryData(['pos-stock'], r);
  const fail = (e: Error) => showMessage(t('notUpdated'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e.message);
  const d = q.data;
  const unit = (u: StockUnit) => t(('unit_' + u) as never);
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/more' as never))} style={st.iconBtn} accessibilityLabel="back"><Icon name="back" size={24} rtl={lang === 'ar'} /></Touch>
        <Txt size={19} weight="bold" style={{ flex: 1 }}>{t('stockTitle')}</Txt>
      </Row>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl, maxWidth: 760, width: '100%', alignSelf: 'center' }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={color.ink} />}>
          <Segmented<'ing' | 'recipes'> items={[['ing', t('stockIngredients')], ['recipes', t('stockRecipes')]]} value={tab} onChange={setTab} />
          {q.isError && !d ? <ErrorState onRetry={() => { q.refetch(); }} /> : !d ? [0, 1, 2].map((i) => <Skeleton key={i} h={90} r={radius.lg} />) : tab === 'ing' ? (
            <>
              {d.ingredients.length === 0 && <Muted center>{t('stockEmpty')}</Muted>}
              {d.ingredients.map((x) => <IngredientCard key={x.id} x={x} unit={unit} onSaved={put} onError={fail} />)}
              <IngredientForm unit={unit} onSaved={put} onError={fail} />
            </>
          ) : (
            <>
              {d.ingredients.length === 0 ? <Muted center>{t('stockAddFirst')}</Muted> : d.products.map((p) => <RecipeCard key={p.id} p={p} ings={d.ingredients} unit={unit} onSaved={put} onError={fail} />)}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function IngredientCard({ x, unit, onSaved, onError }: { x: Ingredient; unit: (u: StockUnit) => string; onSaved: (r: StockView) => void; onError: (e: Error) => void }) {
  const session = useApiSession();
  const { t, lang } = useSession();
  const [why, setWhy] = useState<null | 'receive' | 'count' | 'waste' | 'edit'>(null);
  const [qty, setQty] = useState('');
  const m = useMutation({ mutationFn: () => api.posStockMove(session, x.id, num(qty) ?? 0, why as 'receive'), onSuccess: (r) => { setWhy(null); setQty(''); onSaved(r); }, onError });
  const full = Math.max(x.low * 3, x.stock, 1);
  return (
    <View style={[st.card, { gap: 8 }, x.is_low && { borderWidth: 1, borderColor: color.amber }]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt size={16} weight="bold" style={{ flex: 1 }}>{x.name}</Txt>
        {x.is_low && <TagChip label={t('ingLow')} tone="amber" small />}
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt size={22} weight="bold">{fmt(x.stock) + ' ' + unit(x.unit)}</Txt>
        <Muted size={12}>{x.days_left !== null ? t('stockDaysLeft', { n: fmt(x.days_left) }) : t('stockNoUse')}</Muted>
      </Row>
      <View style={st.bar}><View style={[st.fill, { width: `${Math.max(0, Math.min(100, (x.stock / full) * 100))}%`, backgroundColor: x.is_low ? color.amber : color.green }]} /></View>
      <Muted size={12}>{[x.per_day ? t('stockPerDay', { n: fmt(x.per_day), u: unit(x.unit) }) : '', x.low ? t('stockLowMark', { n: fmt(x.low) }) : '', x.cost ? money(x.cost, lang) + ' / ' + unit(x.unit) : ''].filter(Boolean).join(' · ')}</Muted>
      {why && why !== 'edit' ? (
        <Row gap={8}>
          <TextInput value={qty} onChangeText={setQty} keyboardType="decimal-pad" autoFocus placeholder={t(('stockQty_' + why) as never)} placeholderTextColor={color.faint} style={[st.input, { flex: 1, minWidth: 0 }]} />
          <Button label={t('save')} loading={m.isPending} disabled={num(qty) === null || (why !== 'count' && (num(qty) ?? 0) <= 0) || m.isPending} onPress={() => m.mutate()} />
          <Touch onPress={() => { setWhy(null); setQty(''); }} style={st.x}><Icon name="close" size={18} /></Touch>
        </Row>
      ) : why === 'edit' ? (
        <IngredientForm x={x} unit={unit} onSaved={(r) => { setWhy(null); onSaved(r); }} onError={onError} onCancel={() => setWhy(null)} />
      ) : (
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {(['receive', 'count', 'waste', 'edit'] as const).map((w) => (
            <Touch key={w} onPress={() => setWhy(w)} style={st.pill}><Txt size={13} weight="semibold">{t(('stockAct_' + w) as never)}</Txt></Touch>
          ))}
        </Row>
      )}
    </View>
  );
}

function IngredientForm({ x, unit, onSaved, onError, onCancel }: { x?: Ingredient; unit: (u: StockUnit) => string; onSaved: (r: StockView) => void; onError: (e: Error) => void; onCancel?: () => void }) {
  const session = useApiSession();
  const { t } = useSession();
  const [open, setOpen] = useState(!!x);
  const [name, setName] = useState(x?.name ?? '');
  const [u, setU] = useState<StockUnit>(x?.unit ?? 'g');
  const [low, setLow] = useState(x ? String(x.low || '') : '');
  const [cost, setCost] = useState(x ? String(x.cost || '') : '');
  const m = useMutation({
    mutationFn: () => api.posStockIng(session, { id: x?.id, name: name.trim(), unit: u, low: num(low) ?? 0, cost: num(cost) ?? 0 }),
    onSuccess: (r) => { if (!x) { setName(''); setLow(''); setCost(''); setOpen(false); } onSaved(r); }, onError,
  });
  if (!open) return <Button label={t('stockAdd')} icon="plus" kind="light" onPress={() => setOpen(true)} />;
  return (
    <View style={[!x && st.card, { gap: 8 }]}>
      {!x && <Txt size={15} weight="semibold">{t('stockAdd')}</Txt>}
      <TextInput value={name} onChangeText={setName} placeholder={t('stockName')} placeholderTextColor={color.faint} maxLength={40} style={st.input} />
      <Segmented<StockUnit> items={(['g', 'ml', 'pc'] as StockUnit[]).map((k) => [k, unit(k)])} value={u} onChange={setU} />
      <Row gap={8}>
        <TextInput value={low} onChangeText={setLow} keyboardType="decimal-pad" placeholder={t('stockLowPh')} placeholderTextColor={color.faint} style={[st.input, { flex: 1, minWidth: 0 }]} />
        <TextInput value={cost} onChangeText={setCost} keyboardType="decimal-pad" placeholder={t('stockCostPh', { u: unit(u) })} placeholderTextColor={color.faint} style={[st.input, { flex: 1, minWidth: 0 }]} />
      </Row>
      <Row gap={8}>
        <Button label={t('save')} loading={m.isPending} disabled={!name.trim() || m.isPending} onPress={() => m.mutate()} style={{ flex: 1 }} />
        <Button label={t('notNow')} kind="ghost" onPress={() => (onCancel ? onCancel() : setOpen(false))} />
      </Row>
    </View>
  );
}

function RecipeCard({ p, ings, unit, onSaved, onError }: { p: StockProduct; ings: Ingredient[]; unit: (u: StockUnit) => string; onSaved: (r: StockView) => void; onError: (e: Error) => void }) {
  const session = useApiSession();
  const { t, lang } = useSession();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState('');
  const [rows, setRows] = useState<Record<string, string>>({});
  const byId = Object.fromEntries(ings.map((i) => [i.id, i]));
  const load = (c: string) => { setChoice(c); const r = p.recipe[c] ?? (c ? p.recipe[''] ?? [] : []); setRows(Object.fromEntries(r.map((x) => [x.ing, String(x.qty)]))); };
  const m = useMutation({
    mutationFn: () => api.posStockRecipe(session, p.id, choice, Object.entries(rows).map(([ing, v]) => ({ ing, qty: num(v) ?? 0 })).filter((x) => x.qty > 0) as RecipeItem[]),
    onSuccess: (r) => { setOpen(false); onSaved(r); }, onError,
  });
  const summary = (p.recipe[''] ?? []).map((x) => (byId[x.ing]?.name ?? x.ing) + ' ' + fmt(x.qty) + (byId[x.ing] ? unit(byId[x.ing].unit) : '')).join(' · ');
  return (
    <View style={[st.card, { gap: 8 }]}>
      <Touch onPress={() => { if (!open) load(''); setOpen(!open); }} style={{ gap: 4 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt size={16} weight="bold" style={{ flex: 1 }}>{p.name}</Txt>
          <Txt size={14} weight="semibold">{money(p.price, lang)}</Txt>
        </Row>
        {p.cost !== null ? (
          <Muted size={12}>{t('stockCupCost', { c: money(p.cost, lang), m: money(p.margin ?? 0, lang), pct: Math.round(((p.margin ?? 0) / (p.price || 1)) * 100) })}</Muted>
        ) : <Muted size={12} style={{ color: color.amber }}>{t('stockNoRecipe')}</Muted>}
        {!!summary && !open && <Muted size={12}>{summary}</Muted>}
      </Touch>
      {open && (
        <View style={{ gap: 8 }}>
          {p.choices.length > 0 && (
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {[{ key: '', label: t('stockAllChoices') }, ...p.choices].map((c) => (
                <Touch key={c.key} onPress={() => load(c.key)} style={[st.pill, choice === c.key && st.pillOn]}>
                  <Txt size={13} weight="semibold" tint={choice === c.key ? color.bg : color.ink}>{c.label + (c.key && p.recipe[c.key] ? ' ✓' : '')}</Txt>
                </Touch>
              ))}
            </Row>
          )}
          {ings.map((i) => (
            <Row key={i.id} gap={8}>
              <Txt size={14} style={{ flex: 1 }}>{i.name}</Txt>
              <TextInput value={rows[i.id] ?? ''} onChangeText={(v) => setRows({ ...rows, [i.id]: v })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={color.faint}
                style={[st.input, { width: 90, textAlign: 'center' }]} />
              <Muted size={12} style={{ width: 34 }}>{unit(i.unit)}</Muted>
            </Row>
          ))}
          <Muted size={12}>{t('stockRecipeHint')}</Muted>
          <Button label={t('save')} loading={m.isPending} onPress={() => m.mutate()} />
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: 4, backgroundColor: color.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
  bar: { height: 8, borderRadius: 4, backgroundColor: color.sunken, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: color.sunken },
  pillOn: { backgroundColor: color.ink },
  x: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 44, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.bg, paddingHorizontal: 12, fontSize: 16, color: color.ink, fontFamily: font.regular },
});
