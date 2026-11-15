// End-of-day close (API 1.25). The card machine (EazyPay) and BenefitPay are not connected to the app, so whoever
// closes enters what the machine's settlement report and the Benefit statement say, without seeing what the
// system expects (a blind close). The owner sees the comparison: per method, every attempt, sales without a payment
// number, numbers used twice, cancelled sales, and the last 14 days.
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
import type { CloseMethod, Lang, PosCloseReport } from '../lib/types';
import { Button, ErrorState, Muted, Row, Segmented, Skeleton, TagChip, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

const METHODS: CloseMethod[] = ['card', 'benefit'];
const ymd = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bahrain' }).format(d);
const num = (s: string) => { const v = Number(s.replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(',', '.').trim()); return s.trim() === '' || Number.isNaN(v) ? null : v; };
const signed = (v: number, lang: Lang) => (v > 0 ? '+' : v < 0 ? '−' : '') + money(Math.abs(v), lang);
const timeOf = (iso: string | null, lang: string) => (iso ? new Date(iso).toLocaleTimeString(lang === 'ar' ? 'ar-BH' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bahrain' }) : '');
const dayLabel = (d: string, lang: string) => new Date(d + 'T12:00:00+03:00').toLocaleDateString(lang === 'ar' ? 'ar-BH' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Bahrain' });

export default function PosClose() {
  const session = useApiSession();
  const { t, lang, cashier } = useSession();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const today = ymd(new Date());
  const yesterday = ymd(new Date(Date.now() - 86_400_000));
  const [day, setDay] = useState(today);
  const [card, setCard] = useState('');
  const [benefit, setBenefit] = useState('');
  const [cardN, setCardN] = useState('');
  const [benefitN, setBenefitN] = useState('');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  // The comparison is the owner's only: a cashier never loads it.
  const q = useQuery({ queryKey: ['pos-close', day], queryFn: () => api.posClose(session, day), enabled: !cashier });
  const label: Record<CloseMethod, string> = { card: t('closeCardTotal'), benefit: t('closeBenefitTotal') };
  const short: Record<CloseMethod, string> = { card: t('posCard'), benefit: t('posBenefit') };
  const send = useMutation({
    mutationFn: () => api.posCloseSave(session, {
      date: day, counted: { card: num(card) ?? 0, benefit: num(benefit) ?? 0 },
      counts: { ...(num(cardN) !== null ? { card: num(cardN)! } : {}), ...(num(benefitN) !== null ? { benefit: num(benefitN)! } : {}) }, note: note.trim(),
    }),
    onSuccess: (r) => {
      setCard(''); setBenefit(''); setCardN(''); setBenefitN(''); setNote('');
      // A cashier is only ever told it was saved, whatever comes back.
      if (cashier || 'saved' in r) setSaved(true); else qc.setQueryData(['pos-close', day], r);
    },
    onError: (e) => showMessage(t('notUpdated'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e.message),
  });
  const ready = num(card) !== null && num(benefit) !== null && (num(card) ?? -1) >= 0 && (num(benefit) ?? -1) >= 0;
  const input = [st.input, { fontFamily: font.regular }];

  const form = (
    <View style={[st.card, { gap: space.sm }]}>
      <Txt size={17} weight="bold">{t('closeDay')}</Txt>
      {cashier && <Segmented<string> items={[[today, t('closeToday')], [yesterday, t('closeYesterday')]]} value={day} onChange={setDay} />}
      <Muted size={12}>{t('closeBlindHint')}</Muted>
      {METHODS.map((m) => (
        <View key={m} style={{ gap: 6 }}>
          <Txt size={14} weight="semibold">{label[m]}</Txt>
          <Row gap={8}>
            <TextInput value={m === 'card' ? card : benefit} onChangeText={m === 'card' ? setCard : setBenefit} keyboardType="decimal-pad" placeholder="0.000" placeholderTextColor={color.faint}
              style={[...input, { flex: 2, minWidth: 0, textAlign: 'left', writingDirection: 'ltr', fontSize: 20 }]} accessibilityLabel={label[m]} />
            <TextInput value={m === 'card' ? cardN : benefitN} onChangeText={m === 'card' ? setCardN : setBenefitN} keyboardType="number-pad" placeholder="#" placeholderTextColor={color.faint}
              style={[...input, { flex: 1, minWidth: 0, textAlign: 'center' }]} accessibilityLabel={t('closeCount')} />
          </Row>
        </View>
      ))}
      <Muted size={12}>{'# ' + t('closeCount')}</Muted>
      <TextInput value={note} onChangeText={setNote} placeholder={t('closeNote')} placeholderTextColor={color.faint} maxLength={300} multiline
        style={[...input, { minHeight: 60, textAlign: lang === 'ar' ? 'right' : 'left' }]} />
      <Button label={t('closeSend')} icon="check" loading={send.isPending} disabled={!ready || send.isPending} onPress={() => send.mutate()} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/pos'))} style={st.iconBtn} accessibilityLabel="back">
          <Icon name="back" size={24} rtl={lang === 'ar'} />
        </Touch>
        <Txt size={19} weight="bold" style={{ flex: 1 }}>{t('closeDay')}</Txt>
      </Row>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl, maxWidth: 720, width: '100%', alignSelf: 'center' }}
          refreshControl={cashier ? undefined : <RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={color.ink} />}>
          {cashier ? (saved ? (
            <View style={[st.card, { alignItems: 'center', gap: 8, paddingVertical: space.xl }]}>
              <View style={st.okDot}><Icon name="check" size={30} tint={color.bg} /></View>
              <Txt size={20} weight="bold">{t('closeSaved')}</Txt>
              <Muted center>{t('closeSavedHint')}</Muted>
              <Button label={t('posOpen')} kind="light" onPress={() => router.replace('/pos')} style={{ alignSelf: 'stretch', marginTop: space.sm }} />
            </View>
          ) : form) : q.isError && !q.data ? (
            <ErrorState onRetry={() => { q.refetch(); }} />
          ) : !q.data ? (
            [0, 1, 2].map((i) => <Skeleton key={i} h={110} r={radius.lg} />)
          ) : (
            <OwnerView r={q.data} day={day} setDay={setDay} form={form} label={short} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function OwnerView({ r, day, setDay, form, label }: { r: PosCloseReport; day: string; setDay: (d: string) => void; form: React.ReactNode; label: Record<CloseMethod, string> }) {
  const { t, lang } = useSession();
  const e = r.expected;
  const last = r.closes.length ? r.closes[r.closes.length - 1] : null;
  const diff = r.diff_now ?? last?.diff ?? null;
  const ok = diff ? METHODS.every((m) => Math.abs(diff[m]) < 0.0005) : null;
  return (
    <>
      {/* The last 14 days at a glance: tap a day to open it. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {r.days.map((d) => (
          <Touch key={d.date} onPress={() => setDay(d.date)} style={[st.day, d.date === day && st.dayOn]} accessibilityState={{ selected: d.date === day }}>
            <Txt size={12} weight="semibold" tint={d.date === day ? color.bg : color.ink}>{dayLabel(d.date, lang)}</Txt>
            <Txt size={16} tint={d.date === day ? color.bg : d.ok === null ? color.faint : d.ok ? color.green : color.red}>{d.ok === null ? '—' : d.ok ? '✓' : '!'}</Txt>
          </Touch>
        ))}
      </ScrollView>

      <View style={[st.card, { gap: 10 }]}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt size={17} weight="bold">{dayLabel(r.date, lang)}</Txt>
          {ok === null ? <TagChip label={t('closeNone')} tone="neutral" /> : <TagChip label={ok ? t('closeMatch') : t('closeNoMatch')} tone={ok ? 'green' : 'red'} />}
        </Row>
        {e.training && <Muted size={12}>{t('closeTraining')}</Muted>}
        <Row style={st.head}>
          <Muted style={{ flex: 1.4 }}> </Muted>
          <Muted style={st.cell}>{t('closeExpected')}</Muted>
          <Muted style={st.cell}>{t('closeCounted')}</Muted>
          <Muted style={st.cell}>{t('closeDiff')}</Muted>
        </Row>
        {METHODS.map((m) => {
          const d = diff?.[m] ?? null;
          return (
            <Row key={m}>
              <View style={{ flex: 1.4 }}>
                <Txt size={15} weight="semibold">{label[m]}</Txt>
                <Muted size={12}>{t('closeN', { n: e.by_method[m].count })}</Muted>
              </View>
              <Txt size={14} style={st.cell}>{money(e.by_method[m].total, lang)}</Txt>
              <Txt size={14} style={st.cell}>{last ? money(last.counted[m], lang) : '—'}</Txt>
              <Txt size={14} weight="bold" style={st.cell} tint={d === null ? color.faint : Math.abs(d) < 0.0005 ? color.green : color.red}>{d === null ? '—' : Math.abs(d) < 0.0005 ? '✓' : signed(d, lang)}</Txt>
            </Row>
          );
        })}
        {r.diff_now && last && METHODS.some((m) => Math.abs(r.diff_now![m] - last.diff[m]) >= 0.0005) && <Muted size={12}>{t('closeNowDiff')}</Muted>}
        {/* What to look into. */}
        {METHODS.map((m) => e.by_method[m].missing_ref > 0 && (
          <Row key={'miss' + m} gap={6}><Icon name="warn" size={16} tint={color.amber} /><Txt size={13} tint={color.amber}>{label[m] + ': ' + t('closeMissingRef', { n: e.by_method[m].missing_ref })}</Txt></Row>
        ))}
        {e.dup_refs > 0 && <Row gap={6}><Icon name="warn" size={16} tint={color.red} /><Txt size={13} tint={color.red}>{t('closeDupRefs', { n: e.dup_refs })}</Txt></Row>}
        {e.void.count > 0 && <Muted size={13}>{t('closeVoids', { n: e.void.count, x: money(e.void.total, lang) })}</Muted>}
      </View>

      {r.closes.length > 0 && (
        <View style={[st.card, { gap: 8 }]}>
          <Txt size={15} weight="semibold">{t('closeAttempts') + ' · ' + r.closes.length}</Txt>
          {[...r.closes].reverse().map((c, i) => (
            <View key={i} style={{ gap: 2, paddingVertical: 4, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: color.line }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt size={14} weight="semibold">{[timeOf(c.at, lang), c.by].filter(Boolean).join(' · ')}</Txt>
                <TagChip small label={c.ok ? t('closeMatch') : t('closeNoMatch')} tone={c.ok ? 'green' : 'red'} />
              </Row>
              <Muted size={12}>{METHODS.map((m) => label[m] + ' ' + money(c.counted[m], lang) + (Math.abs(c.diff[m]) >= 0.0005 ? ' (' + signed(c.diff[m], lang) + ')' : '')).join(' · ')}</Muted>
              {!!c.note && <Muted size={12}>{'“' + c.note + '”'}</Muted>}
            </View>
          ))}
        </View>
      )}

      {form}

      {e.sales.length > 0 && (
        <View style={[st.card, { gap: 6 }]}>
          <Txt size={15} weight="semibold">{t('closeSales')}</Txt>
          {e.sales.map((s) => (
            <Row key={s.id} gap={8} style={[{ paddingVertical: 4 }, s.void && { opacity: 0.5 }]}>
              <Txt size={13} weight="semibold" style={{ width: 34 }}>{s.no ? '#' + s.no : ''}</Txt>
              <Muted size={12} style={{ width: 46 }}>{timeOf(s.date, lang)}</Muted>
              <Muted size={12} style={{ flex: 1 }} lines={1}>{(s.method === 'benefit' ? t('posBenefit') : s.method === 'card' ? t('posCard') : t('posCash')) + (s.staff ? ' · ' + s.staff : '')}</Muted>
              <Txt size={12} ltr tint={s.pay_ref ? (s.dup_of ? color.red : color.ink) : color.amber} style={{ fontFamily: font.medium }}>{s.pay_ref ?? t('closeNoRef')}</Txt>
              <Txt size={13} weight="semibold" style={{ minWidth: 70, textAlign: 'right' }}>{s.void ? t('posVoided') : money(s.total, lang)}</Txt>
            </Row>
          ))}
        </View>
      )}
    </>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: 4, backgroundColor: color.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.bg, paddingHorizontal: 12, fontSize: 16, color: color.ink },
  okDot: { width: 56, height: 56, borderRadius: 28, backgroundColor: color.green, alignItems: 'center', justifyContent: 'center' },
  day: { width: 64, paddingVertical: 8, borderRadius: radius.md, backgroundColor: color.surface, alignItems: 'center', gap: 2 },
  dayOn: { backgroundColor: color.ink },
  head: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line, paddingBottom: 6 },
  cell: { flex: 1, textAlign: 'center' },
});
