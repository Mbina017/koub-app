// Till staff accounts (API 1.15), owner only: one till-only sign-in per person, switched off at once when needed,
// and the owner PIN that a cashier needs for a discount or to cancel a sale.
// A password is shown once, when the account is made, switched on again or given a new one.
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Modal, Platform, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, font, radius, space } from '../lib/theme';
import { confirmStep, showMessage } from '../lib/confirm';
import type { PosStaff, PosStaffSecret } from '../lib/types';
import { Button, Empty, ErrorState, Muted, Row, Skeleton, TagChip, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

const when = (iso: string | null, lang: string) =>
  iso ? new Date(iso).toLocaleString(lang === 'ar' ? 'ar-BH' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bahrain' }) : '';

export default function Staff() {
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['pos-staff'], queryFn: () => api.posStaff(session) });
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [pinOpen, setPinOpen] = useState(false);
  const [secret, setSecret] = useState<PosStaffSecret | null>(null);
  const old = q.error instanceof ApiError && q.error.message === 'no_route';
  const fail = (e: unknown) => showMessage(t('notUpdated'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e instanceof Error ? e.message : '');
  const after = (r: PosStaffSecret) => { qc.invalidateQueries({ queryKey: ['pos-staff'] }); qc.invalidateQueries({ queryKey: ['staff-report'] }); if (r.password) setSecret(r); };

  const add = useMutation({ mutationFn: () => api.posStaffAdd(session, name.trim()), onSuccess: (r) => { setName(''); after(r); }, onError: fail });
  const newPw = useMutation({ mutationFn: (id: number) => api.posStaffPassword(session, id), onSuccess: after, onError: fail });
  const active = useMutation({ mutationFn: (v: { id: number; on: boolean }) => api.posStaffActive(session, v.id, v.on), onSuccess: after, onError: fail });
  const savePin = useMutation({
    mutationFn: () => api.posOwnerPin(session, pin),
    onSuccess: () => { setPin(''); setPinOpen(false); qc.invalidateQueries({ queryKey: ['pos-staff'] }); showMessage(t('ownerPin'), t('ownerPinSaved')); },
    onError: fail,
  });
  const busy = add.isPending || newPw.isPending || active.isPending;
  const input = [st.input, { textAlign: (lang === 'ar' ? 'right' : 'left') as 'right' | 'left', fontFamily: font.regular }];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: color.bg }}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/more' as never))} style={st.iconBtn} accessibilityLabel="back">
          <Icon name="back" size={24} rtl={lang === 'ar'} />
        </Touch>
        <Txt size={19} weight="bold" style={{ flex: 1 }}>{t('staffTitle')}</Txt>
      </Row>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={color.ink} />}>
        {old ? (
          <View style={st.card}><Muted>{t('needsUpdate')}</Muted></View>
        ) : q.isError && !q.data ? (
          <ErrorState onRetry={() => { q.refetch(); }} />
        ) : !q.data ? (
          [0, 1].map((i) => <Skeleton key={i} h={110} r={radius.lg} />)
        ) : (
          <>
            {/* The owner PIN first: without it, staff can neither discount nor cancel. */}
            <View style={[st.card, { gap: 8 }]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row gap={8}><Icon name="lock" size={18} /><Txt size={16} weight="semibold">{t('ownerPin')}</Txt></Row>
                <TagChip label={q.data.pin_set ? t('ownerPinOn') : t('ownerPinSet')} tone={q.data.pin_set ? 'green' : 'amber'} small />
              </Row>
              <Muted size={13}>{q.data.pin_set ? t('ownerPinHint') : t('ownerPinMissing')}</Muted>
              {pinOpen ? (
                <>
                  <TextInput value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry maxLength={6} autoFocus
                    placeholder={t('ownerPinNew')} placeholderTextColor={color.faint} style={[st.input, st.pin]} />
                  <Button label={q.data.pin_set ? t('ownerPinChange') : t('ownerPinSet')} loading={savePin.isPending} disabled={pin.length < 4 || savePin.isPending} onPress={() => savePin.mutate()} />
                  <Button label={t('notNow')} kind="ghost" onPress={() => { setPin(''); setPinOpen(false); }} />
                </>
              ) : (
                <Button label={q.data.pin_set ? t('ownerPinChange') : t('ownerPinSet')} kind="light" icon="lock" onPress={() => setPinOpen(true)} />
              )}
            </View>

            <View style={[st.card, { gap: 8 }]}>
              <Txt size={16} weight="semibold">{t('staffAdd')}</Txt>
              <TextInput value={name} onChangeText={setName} placeholder={t('staffName')} placeholderTextColor={color.faint} maxLength={60} style={input} />
              <Button label={t('staffCreate')} icon="plus" loading={add.isPending} disabled={!name.trim() || busy} onPress={() => add.mutate()} />
            </View>

            {q.data.staff.length === 0 ? <Empty title={t('staffNone')} icon="users" /> : q.data.staff.map((s) => (
              <StaffCard key={s.id} s={s} busy={busy}
                onPassword={() => confirmStep({ label: t('staffNewPassword'), confirm: t('staffNewPwConfirm', { n: s.name }), tone: 'default' }, t('notNow'), () => newPw.mutate(s.id))}
                onToggle={() => (s.active
                  ? confirmStep({ label: t('staffTurnOff'), confirm: t('staffOffConfirm', { n: s.name }), tone: 'danger' }, t('notNow'), () => active.mutate({ id: s.id, on: false }))
                  : active.mutate({ id: s.id, on: true }))}
                when={when(s.last_sale, lang)} />
            ))}
          </>
        )}
      </ScrollView>
      <SecretSheet secret={secret} onClose={() => setSecret(null)} />
    </KeyboardAvoidingView>
  );
}

function StaffCard({ s, busy, onPassword, onToggle, when }: { s: PosStaff; busy: boolean; onPassword: () => void; onToggle: () => void; when: string }) {
  const { t } = useSession();
  return (
    <View style={[st.card, { gap: 8 }, !s.active && { opacity: 0.7 }]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Txt size={16} weight="semibold">{s.name}</Txt>
          <Muted size={12} ltr>{s.login}</Muted>
        </View>
        {!s.active && <TagChip label={t('staffOff')} tone="red" small />}
      </Row>
      <Muted size={12}>{when ? t('staffLastSale', { x: when }) : t('staffNoSale')}</Muted>
      <Row gap={8}>
        {s.active && (
          <Touch onPress={onPassword} disabled={busy} style={st.pill}><Txt size={13} weight="semibold">{t('staffNewPassword')}</Txt></Touch>
        )}
        <Touch onPress={onToggle} disabled={busy} style={[st.pill, s.active && { backgroundColor: color.redBg }]}>
          <Txt size={13} weight="semibold" tint={s.active ? color.red : color.ink}>{s.active ? t('staffTurnOff') : t('staffTurnOn')}</Txt>
        </Touch>
      </Row>
    </View>
  );
}

// The sign-in to hand over: shown once, then gone from the phone.
function SecretSheet({ secret, onClose }: { secret: PosStaffSecret | null; onClose: () => void }) {
  const { t, session } = useSession();
  const [copied, setCopied] = useState(false);
  const site = session && !('demo' in session) ? session.site.replace(/^https:\/\//, '') : 'koubbh.com';
  const text = secret ? t('staffLoginText', { s: site, u: secret.login ?? '', p: secret.password ?? '' }) : '';
  const close = () => { setCopied(false); onClose(); };
  return (
    <Modal visible={!!secret} transparent animationType="fade" onRequestClose={close}>
      <View style={st.shade}>
        <View style={[st.card, { gap: space.sm, padding: space.lg }]}>
          <Txt size={17} weight="bold">{secret ? t('staffLogin', { n: secret.staff.name }) : ''}</Txt>
          <Muted size={13}>{t('staffLoginHint')}</Muted>
          <View style={st.secret}>
            <Muted size={12}>{t('storeUrl')}</Muted><Txt size={15} weight="semibold" ltr>{site}</Txt>
            <Muted size={12} style={{ marginTop: 6 }}>{t('username')}</Muted><Txt size={15} weight="semibold" ltr>{secret?.login ?? ''}</Txt>
            <Muted size={12} style={{ marginTop: 6 }}>{t('appPassword')}</Muted><Txt size={15} weight="semibold" ltr>{secret?.password ?? ''}</Txt>
          </View>
          <Button label={copied ? t('copied') : t('staffCopy')} icon="copy" kind="light" onPress={() => { Clipboard.setStringAsync(text).then(() => setCopied(true)).catch(() => {}); }} />
          <Button label={t('staffShare')} icon="whatsapp" kind="light" onPress={() => { Linking.openURL('https://wa.me/?text=' + encodeURIComponent(text)).catch(() => {}); }} />
          <Button label={t('done')} onPress={close} />
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: 4, backgroundColor: color.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: color.sunken },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.bg, paddingHorizontal: 12, fontSize: 16, color: color.ink },
  pin: { fontSize: 22, letterSpacing: 8, textAlign: 'center', fontFamily: font.medium },
  shade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: space.lg },
  secret: { padding: space.md, borderRadius: radius.md, backgroundColor: color.sunken },
});
