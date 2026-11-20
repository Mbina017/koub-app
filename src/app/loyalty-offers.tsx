// KOUB card offers (API 1.33), owner only: a free drink on the customer's birthday, and one for a regular who has been
// away longer than usual (at most every 90 days). Given once a day at 10:00; they show on the card and in the Wallet.
// API 1.34: KOUB credit — paid ahead with a bonus ("pay 10, get 11"): switch, packs, and what is on cards now.
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, font, radius, space } from '../lib/theme';
import { money } from '../lib/format';
import { showMessage } from '../lib/confirm';
import type { LoyaltyOffers } from '../lib/types';
import { Button, ErrorState, Muted, Row, Skeleton, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

export default function LoyaltyOffersScreen() {
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['loyalty-offers'], queryFn: () => api.loyaltyOffers(session) });
  const d = q.data;
  const save = useMutation({
    mutationFn: (next: { birthday: boolean; comeback: boolean }) => api.loyaltyOffersSet(session, next),
    onSuccess: (r) => qc.setQueryData(['loyalty-offers'], r),
    onError: (e) => showMessage(t('notUpdated'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e.message),
  });
  const row = (key: 'birthday' | 'comeback', title: string, hint: string, last = false) => d && (
    <Row style={[st.row, !last && st.line]} gap={12}>
      <View style={{ flex: 1, gap: 2 }}><Txt size={16} weight="semibold">{title}</Txt><Muted size={12}>{hint}</Muted></View>
      <Touch onPress={() => save.mutate({ birthday: d.birthday, comeback: d.comeback, [key]: !d[key] })} disabled={save.isPending} accessibilityRole="switch" accessibilityState={{ checked: d[key] }}
        style={[st.toggle, { backgroundColor: d[key] ? color.green : color.line, alignItems: d[key] ? 'flex-end' : 'flex-start' }]}>
        <View style={st.knob} />
      </Touch>
    </Row>
  );
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/more' as never))} style={st.iconBtn} accessibilityLabel="back"><Icon name="back" size={24} rtl={lang === 'ar'} /></Touch>
        <Txt size={19} weight="bold" style={{ flex: 1 }}>{t('offersTitle')}</Txt>
      </Row>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl, maxWidth: 640, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={color.ink} />}>
        {q.isError && !d ? <ErrorState onRetry={() => { q.refetch(); }} /> : !d ? <Skeleton h={160} r={radius.lg} /> : (
          <>
            <View style={[st.card, { paddingVertical: 4 }]}>
              {row('birthday', t('offerBirthday'), t('offerBirthdayHint', { n: d.birthdays }))}
              {row('comeback', t('offerComeback', { p: d.comeback_pct ?? 30 }), t('offerComebackHint', { n: d.comeback_days, v: d.comeback_valid_days ?? 2 }), true)}
            </View>
            <Muted size={12} center>{t('offersNote')}</Muted>
          </>
        )}
        <CreditCard />
      </ScrollView>
    </View>
  );
}

// KOUB credit: off until switched on; up to four packs, each "pay → get" (get at least pay, at most double).
function CreditCard() {
  const session = useApiSession();
  const { t, lang } = useSession();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['credit'], queryFn: () => api.credit(session) });
  const d = q.data;
  const [packs, setPacks] = useState<[string, string][]>([]);
  useEffect(() => { if (d) setPacks([...d.packs.map(([a, b]) => [String(a), String(b)] as [string, string]), ...Array(Math.max(0, 3 - d.packs.length)).fill(['', ''])].slice(0, 4)); }, [d]);
  const num = (v: string) => Number(v.replace(',', '.'));
  const clean = packs.map(([a, b]) => [num(a), num(b)] as [number, number]).filter(([a, b]) => a > 0 && b >= a && b <= a * 2);
  const save = useMutation({
    mutationFn: (on: boolean) => api.creditSet(session, { on, packs: clean }),
    onSuccess: (r) => qc.setQueryData(['credit'], r),
    onError: (e) => showMessage(t('notUpdated'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e.message),
  });
  if (!d) return q.isError ? null : <Skeleton h={160} r={radius.lg} />;
  const changed = JSON.stringify(clean) !== JSON.stringify(d.packs);
  return (
    <View style={[st.card, { paddingVertical: space.md, gap: 10 }]}>
      <Row gap={12}>
        <View style={{ flex: 1, gap: 2 }}><Txt size={16} weight="semibold">{'💳 ' + t('creditTitle')}</Txt><Muted size={12}>{t('creditHint')}</Muted></View>
        <Touch onPress={() => save.mutate(!d.on)} disabled={save.isPending || (!d.on && !clean.length)} accessibilityRole="switch" accessibilityState={{ checked: d.on }}
          style={[st.toggle, { backgroundColor: d.on ? color.green : color.line, alignItems: d.on ? 'flex-end' : 'flex-start' }]}>
          <View style={st.knob} />
        </Touch>
      </Row>
      {packs.map(([a, b], i) => (
        <Row key={i} gap={8}>
          <Muted size={13} style={{ width: 54 }}>{t('creditPay')}</Muted>
          <TextInput value={a} onChangeText={(v) => setPacks(packs.map((p, j) => (j === i ? [v, p[1]] : p)))} keyboardType="decimal-pad" placeholder="10" placeholderTextColor={color.faint} style={[st.input, { fontFamily: font.regular }]} />
          <Muted size={13} style={{ width: 54 }}>{t('creditGet')}</Muted>
          <TextInput value={b} onChangeText={(v) => setPacks(packs.map((p, j) => (j === i ? [p[0], v] : p)))} keyboardType="decimal-pad" placeholder="11" placeholderTextColor={color.faint} style={[st.input, { fontFamily: font.regular }]} />
        </Row>
      ))}
      {changed && <Button label={t('save')} loading={save.isPending} disabled={!clean.length || save.isPending} onPress={() => save.mutate(d.on)} />}
      <Muted size={12}>{t('creditReport', { x: money(d.outstanding, lang), n: d.cards, p: money(d.month_paid, lang), g: money(d.month_credit, lang) })}</Muted>
    </View>
  );
}

const st = StyleSheet.create({
  input: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.bg, paddingHorizontal: 10, fontSize: 16, color: color.ink, textAlign: 'center' },
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: 4, backgroundColor: color.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { paddingHorizontal: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
  row: { paddingVertical: 14, alignItems: 'center' },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  toggle: { width: 56, height: 32, borderRadius: 16, padding: 3, justifyContent: 'center', direction: 'ltr' },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF' },
});
