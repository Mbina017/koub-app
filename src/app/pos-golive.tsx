// Go-live checklist (API 1.26), owner only: what the store itself says is ready (or not) before the POS takes real
// money, and the switches to leave training: turn training off, then delete the training sales (typed KOUB).
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, font, radius, space } from '../lib/theme';
import { showMessage } from '../lib/confirm';
import type { GoliveCheck } from '../lib/types';
import { Button, ErrorState, Muted, Row, Skeleton, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

// Where each check is fixed in the app (none: fixed from WP-CLI or the store).
const FIX: Partial<Record<GoliveCheck['key'], string>> = { staff: '/team', pin: '/team', practice_close: '/pos-close', refunds: '/pos-close', stock: '/(tabs)/products' };

export default function PosGolive() {
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['pos-golive'], queryFn: () => api.posGolive(session) });
  const [asking, setAsking] = useState<null | 'training_off' | 'training_on' | 'clear_training'>(null);
  const [typed, setTyped] = useState('');
  const act = useMutation({
    mutationFn: () => api.posGoliveAct(session, asking!, typed.trim().toUpperCase()),
    onSuccess: (r) => {
      setAsking(null); setTyped(''); qc.setQueryData(['pos-golive'], r);
      for (const k of ['pos-catalog', 'pos-today', 'pos-close', 'bar']) qc.invalidateQueries({ queryKey: [k] });
      if (r.deleted !== undefined) showMessage(t('glDeleted', { n: r.deleted }), '');
    },
    onError: (e) => showMessage(t('notUpdated'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e.message),
  });
  const d = q.data;
  const left = d ? d.checks.filter((c) => c.ok === false && c.key !== 'training').length : 0;
  const detail = (c: GoliveCheck) => {
    if (c.key === 'staff') return t('gld_staff', { a: c.active ?? 0, p: c.pending ?? 0 });
    if (c.key === 'stock') return t('gld_stock', { z: c.zero ?? 0, m: c.managed ?? 0 });
    if (c.key === 'practice_close') return t('gld_closes', { n: c.closes ?? 0 });
    if (c.key === 'refunds') return t('gld_owed', { n: c.owed ?? 0 });
    if (c.key === 'training') return t('gld_training', { n: c.sales ?? 0 });
    return '';
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/more' as never))} style={st.iconBtn} accessibilityLabel="back">
          <Icon name="back" size={24} rtl={lang === 'ar'} />
        </Touch>
        <Txt size={19} weight="bold" style={{ flex: 1 }}>{t('golive')}</Txt>
      </Row>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl, maxWidth: 720, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={color.ink} />}>
        {q.isError && !d ? <ErrorState onRetry={() => { q.refetch(); }} /> : !d ? [0, 1].map((i) => <Skeleton key={i} h={160} r={radius.lg} />) : (
          <>
            <View style={[st.card, { gap: 4, alignItems: 'center', paddingVertical: space.lg }]}>
              <Txt size={20} weight="bold" tint={left ? color.amber : color.green}>{left ? t('glNotReady', { n: left }) : t('glReady')}</Txt>
              <Muted center>{t('goliveHint')}</Muted>
            </View>
            <View style={[st.card, { gap: 0, paddingVertical: 4 }]}>
              {d.checks.map((c, i) => {
                const to = !c.ok ? FIX[c.key] : undefined;
                const row = (
                  <>
                    <View style={[st.dot, { backgroundColor: c.ok ? color.green : color.amber }]}><Icon name={c.ok ? 'check' : 'warn'} size={14} tint={color.bg} /></View>
                    <View style={{ flex: 1 }}>
                      <Txt size={15} weight="semibold">{t(('gl_' + c.key) as never)}</Txt>
                      {!!detail(c) && <Muted size={12}>{detail(c)}</Muted>}
                    </View>
                    {to && <Icon name="chevron" size={18} tint={color.faint} rtl={lang === 'ar'} />}
                  </>
                );
                return to
                  ? <Touch key={c.key} onPress={() => router.push(to as never)} style={[st.row, i > 0 && st.rowLine]}>{row}</Touch>
                  : <View key={c.key} style={[st.row, i > 0 && st.rowLine]}>{row}</View>;
              })}
            </View>
            <View style={[st.card, { gap: space.sm }]}>
              {d.training
                ? <Button label={t('glTrainingOff')} icon="check" onPress={() => setAsking('training_off')} />
                : <Button label={t('glTrainingOn')} kind="light" onPress={() => setAsking('training_on')} />}
              {!d.training && (d.checks.find((c) => c.key === 'training')?.sales ?? 0) > 0 && <Button label={t('glClear')} kind="ghost" onPress={() => setAsking('clear_training')} />}
              {asking && (
                <View style={{ gap: 8 }}>
                  <Muted>{t('glConfirm')}</Muted>
                  <TextInput value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} placeholder="KOUB" placeholderTextColor={color.faint}
                    style={[st.input, { fontFamily: font.medium, textAlign: 'center', letterSpacing: 4 }]} />
                  <Button label={asking === 'clear_training' ? t('glClear') : asking === 'training_off' ? t('glTrainingOff') : t('glTrainingOn')} loading={act.isPending}
                    disabled={typed.trim().toUpperCase() !== 'KOUB' || act.isPending} onPress={() => act.mutate()} />
                  <Button label={t('notNow')} kind="ghost" onPress={() => { setAsking(null); setTyped(''); }} />
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: 4, backgroundColor: color.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.bg, paddingHorizontal: 12, fontSize: 18, color: color.ink },
});
