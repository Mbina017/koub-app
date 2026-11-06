// KOUB loyalty cards (API 1.11): how the card is doing, the counter QR to print, finding a customer's card,
// and the regulars who stopped coming, to message from your own WhatsApp. The store sends nothing.
import { useState, type ReactNode } from 'react';
import { FlatList, Linking, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, font, radius, space } from '../lib/theme';
import { awayMessage, cardLinkMessage, waLink } from '../lib/loyalty';
import { posterHtml } from '../lib/poster';
import { sharePdf } from '../lib/print';
import { showMessage } from '../lib/confirm';
import type { LoyaltyCard } from '../lib/types';
import { Button, Empty, ErrorState, Muted, Row, Skeleton, TagChip, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';
import { Stamps } from '../components/Stamps';

export default function Loyalty() {
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['loyalty'], queryFn: () => api.loyalty(session) });
  const [phone, setPhone] = useState('');
  const [found, setFound] = useState<LoyaltyCard | null>(null);
  const fail = (e: Error) => showMessage(t('notUpdated'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e.message);
  const find = useMutation({
    mutationFn: () => api.loyaltyFind(session, phone.trim()),
    onSuccess: setFound,
    onError: (e) => { setFound(null); showMessage(t('loyNotFound'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e.message); },
  });
  // WhatsApp opens on this phone with the message ready; the list then moves them down.
  const contact = useMutation({
    mutationFn: async (c: LoyaltyCard) => { await Linking.openURL(waLink(c.whatsapp, awayMessage(c))); return api.loyaltyContacted(session, c.id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty'] }),
    onError: fail,
  });
  const d = q.data;
  const noUpdate = q.error instanceof ApiError && q.error.message === 'no_route';

  const header = d ? (
    <View style={{ gap: space.md }}>
      <View style={st.card}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Stat n={d.members} label={t('loyMembers')} />
          <Stat n={d.active_30} label={t('loyActive30')} />
          <Stat n={d.stamps_30} label={t('loyStamps30')} />
          <Stat n={d.rewards_waiting} label={t('loyWaiting')} />
        </Row>
        <Muted size={12} center>{t('loyRule', { n: d.rule.stamps, m: d.rule.max_per_sale })}</Muted>
      </View>
      {!d.wallet.apple && !d.wallet.google && (
        <View style={[st.card, { backgroundColor: color.amberBg, borderColor: color.amberBg }]}><Txt size={13} tint={color.amber}>{t('loyNoWallet')}</Txt></View>
      )}
      <Button label={t('loyPoster')} icon="print" kind="light" onPress={() => sharePdf(posterHtml(d.join_url, d.rule.stamps, lang), 'KOUB-card-QR').catch(() => {})} />

      <Txt size={16} weight="bold" style={{ marginTop: space.sm }}>{t('loyFindTitle')}</Txt>
      <Row gap={8}>
        <TextInput value={phone} onChangeText={setPhone} placeholder={t('posCustomerPhone')} placeholderTextColor={color.faint} keyboardType="phone-pad" maxLength={20}
          style={[st.input, { flex: 1, minWidth: 0 }]} onSubmitEditing={() => phone.trim() && find.mutate()} />
        <Button label={t('loyFind')} onPress={() => find.mutate()} disabled={!phone.trim() || find.isPending} loading={find.isPending} style={{ minWidth: 96 }} />
      </Row>
      {found && <CardRow c={found} action={<Button label={t('loySendCard')} icon="whatsapp" kind="light" onPress={() => Linking.openURL(waLink(found.whatsapp, cardLinkMessage(found))).catch(() => {})} />} />}

      <Txt size={16} weight="bold" style={{ marginTop: space.sm }}>{t('loyAwayTitle')}</Txt>
      {d.away.length > 0 && <Muted size={12}>{t('loyAwayHint')}</Muted>}
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={st.iconBtn} accessibilityLabel="back">
          <Icon name="back" size={24} rtl={lang === 'ar'} />
        </Touch>
        <Txt size={19} weight="bold" style={{ flex: 1 }}>{t('loyTitle')}</Txt>
      </Row>
      {noUpdate ? <Empty title={t('needsUpdate')} icon="warn" /> : q.isError && !d ? <ErrorState onRetry={() => { q.refetch(); }} /> : !d ? (
        <View style={{ padding: space.lg, gap: space.md }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={110} r={radius.lg} />)}</View>
      ) : (
        <FlatList
          data={d.away}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl }}
          ListHeaderComponent={header ?? undefined}
          ListEmptyComponent={<Empty title={t('loyAwayEmpty')} body={t('loyAwayEmptyHint')} icon="check" />}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={color.ink} />}
          renderItem={({ item: c }) => (
            <CardRow c={c} away action={
              <Button label={t('loyMessage')} icon="whatsapp" kind={c.contacted ? 'light' : 'primary'} disabled={contact.isPending} loading={contact.isPending && contact.variables?.id === c.id} onPress={() => contact.mutate(c)} />
            } />
          )}
        />
      )}
    </View>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return <View style={{ flex: 1, alignItems: 'center', gap: 2 }}><Txt size={20} weight="bold">{String(n)}</Txt><Muted size={11} center>{label}</Muted></View>;
}

function CardRow({ c, away, action }: { c: LoyaltyCard; away?: boolean; action: ReactNode }) {
  const { t } = useSession();
  return (
    <View style={st.card}>
      <Row style={{ justifyContent: 'space-between' }} align="flex-start">
        <View style={{ flex: 1, gap: 2 }}>
          <Txt size={15} weight="semibold">{c.name}</Txt>
          <Muted size={12}>{[away && c.days !== undefined ? t('loyAwayDays', { n: c.days }) : c.ago ? t('loyLastVisit', { x: c.ago }) : t('loyNoVisit'), t('loyVisits', { n: c.visits })].join(' · ')}</Muted>
        </View>
        <Txt size={13} weight="semibold" ltr>{c.code}</Txt>
      </Row>
      <Stamps stamps={c.stamps} of={c.of} rewards={c.rewards} size={28} />
      {(c.rewards > 0 || c.contacted) && (
        <View style={st.tags}>
          {c.rewards > 0 && <TagChip label={t('loyRewardsWaiting', { n: c.rewards })} tone="amber" small />}
          {c.contacted && <TagChip label={t('loyContacted')} tone="green" small />}
        </View>
      )}
      {action}
    </View>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: space.sm },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.md, gap: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.surface, paddingHorizontal: 12, fontSize: 16, color: color.ink, fontFamily: font.regular, textAlign: 'left', writingDirection: 'ltr' },
});
