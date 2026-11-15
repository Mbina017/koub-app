// Today's shop sales: the cash that should be in the drawer, card and BenefitPay totals, and every sale.
// A sale entered by mistake can be cancelled here the same day; the store puts its stock back.
// A cashier (API 1.15) sees only their own sales, and since API 1.19 no amounts or count: the screen is only for
// cancelling a sale entered by mistake, with the owner PIN. What each one sold is the owner's (staff report).
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, font, radius, space } from '../lib/theme';
import { money } from '../lib/format';
import { showMessage } from '../lib/confirm';
import type { CancelReason, PosMethod, RefundState } from '../lib/types';
import { Button, Empty, ErrorState, Muted, Row, Skeleton, TagChip, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

const time = (iso: string | null, lang: string) => (iso ? new Date(iso).toLocaleTimeString(lang === 'ar' ? 'ar-BH' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bahrain' }) : '');

export default function PosToday() {
  const session = useApiSession();
  const { t, lang, cashier } = useSession();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['pos-today'], queryFn: () => api.posToday(session), refetchInterval: 60_000 });
  // The sale being cancelled (API 1.26): why, what happened to the money, and whether the drink was made.
  const [asking, setAsking] = useState<{ id: number; number: string; method: PosMethod } | null>(null);
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [refund, setRefund] = useState<RefundState | null>(null);
  const [refRef, setRefRef] = useState('');
  const [made, setMade] = useState(false);
  const closeSheet = () => { setAsking(null); setPin(''); setReason(null); setRefund(null); setRefRef(''); setMade(false); };
  const cancel = useMutation({
    mutationFn: (id: number) => api.posVoid(session, id, { reason: reason ?? 'other', refund: reason === 'unpaid' ? 'none' : refund ?? 'owed', refund_ref: refRef.trim(), made, ...(cashier ? { owner_pin: pin } : {}) }),
    onSuccess: () => { closeSheet(); for (const k of ['pos-today', 'pos-catalog', 'pos-books', 'pos-close', 'home', 'products', 'numbers', 'orders', 'staff-report']) qc.invalidateQueries({ queryKey: [k] }); },
    onError: (e) => { setPin(''); showMessage(t('notUpdated'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e.message); },
  });
  const ask = (id: number, number: string, method: PosMethod) => setAsking({ id, number, method });
  const money2 = reason === 'unpaid' ? 'none' : refund;
  const refClean = refRef.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const canCancel = !!reason && !!money2 && (money2 !== 'done' || refClean.length >= 4) && (!cashier || pin.length >= 4);
  const d = q.data;
  const label: Record<PosMethod, string> = { cash: t('posCash'), card: t('posCard'), benefit: t('posBenefit'), credit: t('posCredit') };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/pos'))} style={st.iconBtn} accessibilityLabel="back">
          <Icon name="back" size={24} rtl={lang === 'ar'} />
        </Touch>
        <Txt size={19} weight="bold" style={{ flex: 1 }}>{cashier ? t('posCancelSale') : t('posToday')}</Txt>
      </Row>
      {q.isError && !d ? (
        <ErrorState onRetry={() => { q.refetch(); }} />
      ) : !d ? (
        <View style={{ padding: space.lg, gap: space.md }}>{[0, 1].map((i) => <Skeleton key={i} h={120} r={radius.lg} />)}</View>
      ) : (
        <FlatList
          data={d.sales}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: insets.bottom + space.xl }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={color.ink} />}
          ListHeaderComponent={d.total === null || !d.by_method ? (
            <Muted style={{ marginBottom: space.sm }}>{d.count === null ? t('posCancelHint') : t('posSalesN', { n: d.count })}</Muted>
          ) : (
            <View style={[st.card, { gap: 10, marginBottom: space.md }]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Muted>{t('posSalesN', { n: d.count ?? 0 })}</Muted>
                <Txt size={24} weight="bold">{money(d.total, lang)}</Txt>
              </Row>
              {(['cash', 'card', 'benefit'] as PosMethod[]).filter((m) => m !== 'cash' || (d.by_method?.cash ?? 0) > 0).map((m) => (
                <Row key={m} style={{ justifyContent: 'space-between' }}>
                  <Txt size={15}>{label[m]}</Txt>
                  <Txt size={15} weight="semibold">{money(d.by_method?.[m] ?? 0, lang)}</Txt>
                </Row>
              ))}
              <Muted size={12}>{t('posDrawerHint')}</Muted>
            </View>
          )}
          ListEmptyComponent={<Empty title={t('posNoSales')} icon="cash" />}
          renderItem={({ item: s }) => (
            <Row gap={10} style={[st.card, s.void && { opacity: 0.55 }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt size={15} weight="semibold">{'#' + s.number + (s.total === null ? '' : ' · ' + money(s.total, lang))}</Txt>
                <Muted size={12}>{[time(s.date, lang), s.method_label, t('posItemsN', { n: s.items }), s.staff ? t('soldBy', { n: s.staff }) : ''].filter(Boolean).join(' · ')}</Muted>
              </View>
              {s.void ? <TagChip label={t('posVoided')} tone="red" small /> : s.voidable === false ? (s.refunded ? <TagChip label={t('posRefunded')} tone="amber" small /> : null) : (
                <Touch
                  onPress={() => ask(s.id, s.number, s.method)}
                  disabled={cancel.isPending}
                  style={st.pill}
                >
                  <Txt size={13} weight="semibold" tint={color.red}>{t('posVoid')}</Txt>
                </Touch>
              )}
            </Row>
          )}
        />
      )}
      <Modal visible={!!asking} transparent animationType="fade" onRequestClose={() => { if (!cancel.isPending) closeSheet(); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.shade}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <View style={[st.card, st.sheet]}>
            <Txt size={17} weight="bold">{asking ? t('cancelTitle', { n: asking.number }) : ''}</Txt>
            <Txt size={14} weight="semibold">{t('cancelWhy')}</Txt>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {(['mistake', 'changed', 'unpaid', 'other'] as CancelReason[]).map((r) => (
                <Touch key={r} onPress={() => setReason(r)} style={[st.chip, reason === r && st.chipOn]} accessibilityState={{ selected: reason === r }}>
                  <Txt size={14} weight="semibold" tint={reason === r ? color.bg : color.ink}>{t(('why_' + r) as never)}</Txt>
                </Touch>
              ))}
            </Row>
            {reason && reason !== 'unpaid' && (
              <>
                <Txt size={14} weight="semibold">{t('cancelMoney')}</Txt>
                {(['done', 'owed', 'none'] as RefundState[]).map((m) => (
                  <Touch key={m} onPress={() => setRefund(m)} style={[st.option, refund === m && st.optionOn]} accessibilityState={{ selected: refund === m }}>
                    <Txt size={14} weight="semibold">{(refund === m ? '● ' : '○ ') + t(('money_' + m) as never)}</Txt>
                  </Touch>
                ))}
                {refund === 'done' && (
                  <TextInput value={refRef} onChangeText={(v) => setRefRef(v.slice(0, 30))} autoCapitalize="characters" autoCorrect={false}
                    placeholder={asking?.method === 'benefit' ? t('refundRefBenefit') : t('refundRefCard')} placeholderTextColor={color.faint}
                    style={[st.input, { textAlign: 'left', writingDirection: 'ltr' }]} />
                )}
              </>
            )}
            {reason === 'unpaid' && <Muted size={12}>{t('cancelUnpaidHint')}</Muted>}
            <Touch onPress={() => setMade(!made)} style={[st.option, made && st.optionOn]} accessibilityState={{ checked: made }}>
              <Txt size={14} weight="semibold">{(made ? '☑ ' : '☐ ') + t('cancelMade')}</Txt>
            </Touch>
            {cashier && (
              <>
                <Muted>{t('ownerPinNeeded')}</Muted>
                <TextInput value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry maxLength={6}
                  placeholder={t('ownerPinEnter')} placeholderTextColor={color.faint} style={st.pin} />
              </>
            )}
            <Button label={t('posVoid')} loading={cancel.isPending} disabled={!canCancel || cancel.isPending} onPress={() => asking && cancel.mutate(asking.id)} />
            <Button label={t('notNow')} kind="ghost" disabled={cancel.isPending} onPress={closeSheet} />
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: 4, backgroundColor: color.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: color.redBg },
  shade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: space.lg },
  sheet: { gap: space.sm, padding: space.lg },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: color.sunken },
  chipOn: { backgroundColor: color.ink },
  option: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.bg },
  optionOn: { borderColor: color.ink, borderWidth: 1.5 },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.bg, paddingHorizontal: 12, fontSize: 16, color: color.ink, fontFamily: font.regular },
  pin: { minHeight: 52, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.bg, fontSize: 22, letterSpacing: 8, textAlign: 'center', color: color.ink, fontFamily: font.medium },
});
