// KOUB card offers (API 1.33), owner only: a free drink on the customer's birthday, and one for a regular who has been
// away longer than usual (at most every 90 days). Given once a day at 10:00; they show on the card and in the Wallet.
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, radius, space } from '../lib/theme';
import { showMessage } from '../lib/confirm';
import type { LoyaltyOffers } from '../lib/types';
import { ErrorState, Muted, Row, Skeleton, Touch, Txt } from '../components/ui';
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
              {row('comeback', t('offerComeback'), t('offerComebackHint', { n: d.comeback_days }), true)}
            </View>
            <Muted size={12} center>{t('offersNote')}</Muted>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: 4, backgroundColor: color.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { paddingHorizontal: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
  row: { paddingVertical: 14, alignItems: 'center' },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  toggle: { width: 56, height: 32, borderRadius: 16, padding: 3, justifyContent: 'center', direction: 'ltr' },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF' },
});
