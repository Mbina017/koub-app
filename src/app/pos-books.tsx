// The shop's own books (API 1.7): till sales, product costs, card fees and the shop's expenses, never mixed with
// the online store. Expenses are entered here, one line each, under today or yesterday.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, font, radius, space } from '../lib/theme';
import { currency, dayMonth, money, num } from '../lib/format';
import { confirmStep, showMessage } from '../lib/confirm';
import type { PosMethod, ShopBooks, ShopExpenseCat, ShopPeriod } from '../lib/types';
import { Button, ErrorState, Muted, Row, Segmented, Skeleton, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

const newRef = () => 'exp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
// Bahrain's calendar day, as the store counts it.
const bhDay = (offset = 0) => new Date(Date.now() + 3 * 3600_000 - offset * 86400_000).toISOString().slice(0, 10);
// "3,5", "٣٫٥" and Arabic digits are all read as 3.5.
const parseAmount = (s: string) => Number(s.trim().replace(/[٫,]/g, '.').replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))));

export default function PosBooks() {
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<ShopPeriod>('today');
  const [adding, setAdding] = useState(false);
  // Keeps the screen (and a half-typed expense) while another period loads.
  const q = useQuery({ queryKey: ['pos-books', period], queryFn: () => api.posBooks(session, period), placeholderData: (prev) => prev });
  const d = q.data;
  const old = q.error instanceof ApiError && q.error.message === 'no_route';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: color.bg }}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/pos'))} style={st.iconBtn} accessibilityLabel="back">
          <Icon name="back" size={24} rtl={lang === 'ar'} />
        </Touch>
        <Txt size={19} weight="bold" style={{ flex: 1 }}>{t('books')}</Txt>
      </Row>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={color.ink} />}
      >
        <Segmented items={[['today', t('today')], ['yesterday', t('yesterday')], ['7days', t('days7')], ['month', t('month')]]} value={period} onChange={setPeriod} />
        {old ? (
          <View style={st.card}><Muted>{t('needsUpdate')}</Muted></View>
        ) : q.isError && !d ? (
          <ErrorState onRetry={() => { q.refetch(); }} />
        ) : !d ? (
          [0, 1, 2].map((i) => <Skeleton key={i} h={130} r={radius.lg} />)
        ) : (
          <Body d={d} adding={adding} setAdding={setAdding} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Body({ d, adding, setAdding }: { d: ShopBooks; adding: boolean; setAdding: (v: boolean) => void }) {
  const session = useApiSession();
  const { t, lang } = useSession();
  const qc = useQueryClient();
  const label: Record<PosMethod, string> = { cash: t('posCash'), card: t('posCard'), benefit: t('posBenefit') };
  const refresh = () => { for (const k of ['pos-books', 'home']) qc.invalidateQueries({ queryKey: [k] }); };
  const remove = useMutation({
    mutationFn: (e: { date: string; id: string }) => api.posExpenseRemove(session, e.date, e.id),
    onSuccess: refresh,
    onError: (e) => showMessage(t('notUpdated'), e.message),
  });

  return (
    <>
      {/* The shop's result, dark like a statement */}
      <View style={st.hero}>
        <Txt size={14} tint="rgba(247,243,236,0.72)">{t('booksResult') + (d.exact ? '' : ' · ' + t('estimate'))}</Txt>
        <Row gap={8} align="flex-end">
          <Txt size={40} weight="bold" tint={color.bg} style={{ lineHeight: 48, letterSpacing: -1 }} ltr>{num(d.profit)}</Txt>
          <Txt size={16} tint="rgba(247,243,236,0.72)" style={{ marginBottom: 7 }}>{currency(lang)}</Txt>
        </Row>
        <Txt size={12} tint="rgba(247,243,236,0.72)">{t('booksResultHint')}</Txt>
      </View>

      <View style={[st.card, { gap: 10 }]}>
        <Line label={t('booksSales')} sub={t('booksSalesN', { n: d.count })} value={money(d.sales, lang)} strong />
        <Line label={t('booksGoods')} value={'− ' + money(d.goods, lang)} />
        <Line label={t('booksFees')} value={'− ' + money(d.fees, lang)} />
        <Line label={t('booksExpenses')} value={'− ' + money(d.expenses, lang)} />
        {d.missing.length > 0 && <Muted size={12}>{t('booksMissing', { n: d.missing.slice(0, 4).join('، ') + (d.missing.length > 4 ? '…' : '') })}</Muted>}
      </View>

      <View style={[st.card, { gap: 8 }]}>
        <Muted size={13}>{t('booksByMethod')}</Muted>
        {(['cash', 'card', 'benefit'] as PosMethod[]).map((m) => <Line key={m} label={label[m]} value={money(d.by_method[m] ?? 0, lang)} />)}
      </View>

      {/* Expenses */}
      <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
        <Txt size={17} weight="bold">{t('booksExpenses')}</Txt>
        {!adding && (
          <Touch onPress={() => setAdding(true)} style={st.pill}>
            <Txt size={13} weight="semibold">{'+ ' + t('booksAdd')}</Txt>
          </Touch>
        )}
      </Row>
      {adding && <AddExpense categories={d.categories} onDone={() => { setAdding(false); refresh(); }} />}
      {d.by_category.length > 1 && (
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {d.by_category.map((c) => <View key={c.key} style={st.chip}><Txt size={12}>{c.label + ' · ' + num(c.value)}</Txt></View>)}
        </Row>
      )}
      <View style={st.card}>
        {d.entries.length ? d.entries.map((e, i) => (
          <Row key={e.id} gap={10} style={[{ paddingVertical: 8 }, i > 0 && st.sep]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt size={15} weight="semibold">{money(e.amount, lang) + ' · ' + e.cat_label}</Txt>
              <Muted size={12}>{[e.label, dayMonth(e.date, lang), e.by].filter(Boolean).join(' · ')}</Muted>
            </View>
            {e.removable && (
              <Touch
                onPress={() => confirmStep({ label: t('booksRemove'), confirm: t('booksRemoveConfirm', { x: money(e.amount, lang) }), tone: 'danger' }, t('notNow'), () => remove.mutate({ date: e.date, id: e.id }))}
                disabled={remove.isPending}
                style={[st.pill, { backgroundColor: color.redBg }]}
              >
                <Txt size={13} weight="semibold" tint={color.red}>{t('booksRemove')}</Txt>
              </Touch>
            )}
          </Row>
        )) : <Muted center style={{ paddingVertical: space.md }}>{t('booksNoExpenses')}</Muted>}
      </View>
      <Muted size={12}>{t('booksSeparate')}</Muted>
    </>
  );
}

function Line({ label, sub, value, strong }: { label: string; sub?: string; value: string; strong?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <View>
        <Txt size={15} weight={strong ? 'semibold' : 'regular'}>{label}</Txt>
        {sub ? <Muted size={12}>{sub}</Muted> : null}
      </View>
      <Txt size={strong ? 18 : 15} weight={strong ? 'bold' : 'semibold'}>{value}</Txt>
    </Row>
  );
}

function AddExpense({ categories, onDone }: { categories: ShopBooks['categories']; onDone: () => void }) {
  const session = useApiSession();
  const { t, lang } = useSession();
  const [ref, setRef] = useState(newRef);
  // The day is fixed on the first try, so a retry after a lost reply (even past midnight) finds the same line.
  const [sentDay, setSentDay] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState<ShopExpenseCat>('stock');
  const [what, setWhat] = useState('');
  const [day, setDay] = useState<0 | 1>(0);
  const value = parseAmount(amount);
  const save = useMutation({
    mutationFn: () => { const date = sentDay ?? bhDay(day); setSentDay(date); return api.posExpenseAdd(session, { ref, amount: value, cat, label: what.trim(), date }); },
    onSuccess: onDone,
    onError: (e) => showMessage(t('notUpdated'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e.message),
  });
  const input = [st.input, { textAlign: (lang === 'ar' ? 'right' : 'left') as 'right' | 'left', fontFamily: font.regular }];

  return (
    <View style={[st.card, { gap: space.sm }]}>
      <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder={t('booksAmount')} placeholderTextColor={color.faint} style={input} autoFocus />
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        {categories.map((c) => (
          <Touch key={c.key} onPress={() => setCat(c.key)} style={[st.chip, cat === c.key && st.chipOn]}>
            <Txt size={13} weight="semibold" tint={cat === c.key ? color.bg : color.ink}>{c.label}</Txt>
          </Touch>
        ))}
      </Row>
      <TextInput value={what} onChangeText={setWhat} placeholder={t('booksWhat')} placeholderTextColor={color.faint} maxLength={80} style={input} />
      <Segmented<'0' | '1'> items={[['0', t('booksDay')], ['1', t('booksYesterday')]]} value={String(day) as '0' | '1'} onChange={(k) => { setDay(k === '1' ? 1 : 0); setSentDay(null); setRef(newRef()); }} />
      <Row gap={8}>
        <Button label={t('notNow')} kind="ghost" onPress={onDone} style={{ flex: 1 }} />
        <Button label={t('booksSave')} loading={save.isPending} onPress={() => (value > 0 ? save.mutate() : showMessage(t('booksNeedAmount'), ''))} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: 4, backgroundColor: color.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { padding: space.lg, gap: 4, borderRadius: radius.lg, backgroundColor: color.ink },
  card: { padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: color.sunken },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: color.sunken },
  chipOn: { backgroundColor: color.ink },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.bg, paddingHorizontal: 12, fontSize: 16, color: color.ink },
});
