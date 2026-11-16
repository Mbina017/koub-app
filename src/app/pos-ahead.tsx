// Order ahead (API 1.29), owner only: switch ordering on the menu (koubbh.com/menu, the one customer link since
// API 1.35) on or off, the hours, how many cups the bar takes per 15 minutes, and how soon the first pickup can be.
// Paid orders land on the hand-over list with their pickup time; car orders show the plate, car and where it is parked.
import { useEffect, useState } from 'react';
import { Linking, RefreshControl, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, font, radius, space } from '../lib/theme';
import { showMessage } from '../lib/confirm';
import { Button, ErrorState, Muted, Row, Skeleton, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

const hhmm = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s.trim());

export default function PosAhead() {
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['pos-ahead'], queryFn: () => api.posAhead(session) });
  const d = q.data;
  const [on, setOn] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cap, setCap] = useState('');
  const [lead, setLead] = useState('');
  useEffect(() => { if (d) { setOn(d.on); setFrom(d.from); setTo(d.to); setCap(String(d.cap)); setLead(String(d.lead)); } }, [d]);
  const save = useMutation({
    mutationFn: (next: boolean) => api.posAheadSet(session, { on: next, from: from.trim(), to: to.trim(), cap: Number(cap) || 6, lead: Number(lead) || 10 }),
    onSuccess: (r) => qc.setQueryData(['pos-ahead'], r),
    onError: (e) => { if (d) setOn(d.on); showMessage(t('notUpdated'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e.message); },
  });
  const valid = hhmm(from) && hhmm(to) && from.trim() < to.trim() && Number(cap) >= 1 && Number(lead) >= 5;
  const changed = !!d && (from !== d.from || to !== d.to || String(d.cap) !== cap || String(d.lead) !== lead);
  const input = [st.input, { fontFamily: font.regular }];
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/more' as never))} style={st.iconBtn} accessibilityLabel="back"><Icon name="back" size={24} rtl={lang === 'ar'} /></Touch>
        <Txt size={19} weight="bold" style={{ flex: 1 }}>{t('aheadTitle')}</Txt>
      </Row>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl, maxWidth: 640, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={color.ink} />}>
        {q.isError && !d ? <ErrorState onRetry={() => { q.refetch(); }} /> : !d ? [0, 1].map((i) => <Skeleton key={i} h={140} r={radius.lg} />) : (
          <>
            <View style={[st.card, { gap: 8 }]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Txt size={17} weight="bold">{on ? t('aheadOn') : t('aheadOff')}</Txt>
                  <Muted size={12}>{t('aheadHint')}</Muted>
                </View>
                <Touch onPress={() => { const v = !on; setOn(v); save.mutate(v); }} disabled={save.isPending || !valid} accessibilityRole="switch" accessibilityState={{ checked: on }}
                  style={[st.toggle, { backgroundColor: on ? color.green : color.line, alignItems: on ? 'flex-end' : 'flex-start' }]}>
                  <View style={st.knob} />
                </Touch>
              </Row>
              <Touch onPress={() => Linking.openURL(d.url).catch(() => {})} style={st.link}>
                <Txt size={14} weight="semibold" ltr>{d.url.replace(/^https?:\/\//, '')}</Txt>
                <Icon name="external" size={16} />
              </Touch>
              <Button label={t('aheadShare')} icon="whatsapp" kind="light" onPress={() => Share.share({ message: t('aheadShareMsg', { u: d.url }) }).catch(() => {})} />
            </View>

            <View style={[st.card, { gap: 10 }]}>
              <Txt size={15} weight="semibold">{t('aheadSettings')}</Txt>
              <Row gap={8}>
                <View style={{ flex: 1, gap: 4 }}><Muted size={12}>{t('aheadFrom')}</Muted><TextInput value={from} onChangeText={setFrom} placeholder="07:00" placeholderTextColor={color.faint} style={input} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
                <View style={{ flex: 1, gap: 4 }}><Muted size={12}>{t('aheadTo')}</Muted><TextInput value={to} onChangeText={setTo} placeholder="23:00" placeholderTextColor={color.faint} style={input} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
              </Row>
              <Row gap={8}>
                <View style={{ flex: 1, gap: 4 }}><Muted size={12}>{t('aheadCap')}</Muted><TextInput value={cap} onChangeText={setCap} keyboardType="number-pad" style={input} maxLength={2} /></View>
                <View style={{ flex: 1, gap: 4 }}><Muted size={12}>{t('aheadLead')}</Muted><TextInput value={lead} onChangeText={setLead} keyboardType="number-pad" style={input} maxLength={3} /></View>
              </Row>
              {!valid && <Muted size={12} style={{ color: color.red }}>{t('aheadInvalid')}</Muted>}
              {changed && <Button label={t('save')} loading={save.isPending} disabled={!valid || save.isPending} onPress={() => save.mutate(on)} />}
            </View>

            {on && (
              <View style={[st.card, { gap: 8 }]}>
                <Txt size={15} weight="semibold">{t('aheadSlots')}</Txt>
                {d.slots.length === 0 ? <Muted>{t('aheadNoSlots')}</Muted> : (
                  <Row gap={6} style={{ flexWrap: 'wrap' }}>
                    {d.slots.map((s) => (
                      <View key={s.t} style={[st.slot, s.free <= 0 && { opacity: 0.4 }]}>
                        <Txt size={14} weight="semibold" ltr>{s.label}</Txt>
                        <Muted size={11}>{t('aheadFree', { n: s.free })}</Muted>
                      </View>
                    ))}
                  </Row>
                )}
              </View>
            )}
            <Muted size={12} center>{t('aheadNote')}</Muted>
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
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12, borderRadius: radius.md, backgroundColor: color.sunken },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.bg, paddingHorizontal: 12, fontSize: 17, color: color.ink, textAlign: 'center' },
  // Our own switch: the web one draws its knob outside the track in right-to-left pages.
  toggle: { width: 56, height: 32, borderRadius: 16, padding: 3, justifyContent: 'center', direction: 'ltr' },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF' },
  slot: { minWidth: 70, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.md, backgroundColor: color.sunken, alignItems: 'center' },
});
