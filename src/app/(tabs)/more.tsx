import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';
import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../lib/session';
import { color, radius, space } from '../../lib/theme';
import { Card, Muted, Row, Screen, SectionTitle, Segmented, Touch, Txt } from '../../components/ui';
import type { LangPref } from '../../lib/session';
import { Icon, type IconName } from '../../components/Icon';

export default function More() {
  const { t, me, session, lock, setLock, signOut, langPref, setLangPref } = useSession();
  const client = useQueryClient();
  const [canLock, setCanLock] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    LocalAuthentication.hasHardwareAsync().then(async (hw) => setCanLock(hw && (await LocalAuthentication.isEnrolledAsync()))).catch(() => {});
  }, []);
  const site = session && !('demo' in session) ? session.site.replace(/^https:\/\//, '') : t('demoBanner');

  return (
    <Screen title={t('more')}>
      <Card style={{ marginTop: space.sm }}>
        <Row gap={12}>
          <View style={st.avatar}><Txt size={20} weight="semibold" tint={color.bg} center>{me?.initial ?? 'K'}</Txt></View>
          <View style={{ flex: 1 }}>
            <Txt size={17} weight="semibold">{me?.name ?? ''}</Txt>
            <Muted ltr style={{ textAlign: 'auto' }}>{site}</Muted>
          </View>
        </Row>
      </Card>

      <SectionTitle title={t('language')} icon="globe" />
      <Segmented<LangPref>
        items={[['ar', t('langAr')], ['en', t('langEn')], ['auto', t('langAuto')]]}
        value={langPref}
        // Refetch so tags and statuses from the store come back in the new language too.
        onChange={async (p) => { await setLangPref(p); client.invalidateQueries(); }}
      />
      <Muted size={12} style={{ marginTop: 6 }}>{t('languageHint')}</Muted>

      <SectionTitle title={t('account')} />
      <Card padded={false}>
        {canLock && (
          <Item icon="lock" label={t('faceLock')} sub={t('faceLockHint')} right={<Switch value={lock} onValueChange={setLock} trackColor={{ true: color.ink, false: color.line }} />} />
        )}
        <Item icon="logout" label={t('signOut')} danger last onPress={async () => { client.clear(); await signOut(); }} />
      </Card>

      <SectionTitle title={t('comingNext')} />
      <Card padded={false}>
        <Item icon="bell" label={t('soonPush')} soon />
        <Item icon="truck" label={t('soonActions')} soon />
        <Item icon="edit" label={t('soonEdit')} soon last />
      </Card>

      <Muted size={12} center style={{ marginTop: space.xl }}>{'KOUB · ' + t('version', { v: Constants.expoConfig?.version ?? '1.0.0' })}</Muted>
    </Screen>
  );
}

function Item({ icon, label, sub, right, onPress, danger, soon, last }: { icon: IconName; label: string; sub?: string; right?: React.ReactNode; onPress?: () => void; danger?: boolean; soon?: boolean; last?: boolean }) {
  const { t } = useSession();
  const body = (
    <Row gap={12} style={[st.item, !last && st.sep]}>
      <View style={[st.icon, danger && { backgroundColor: color.redBg }]}><Icon name={icon} size={19} tint={danger ? color.red : color.ink} /></View>
      <View style={{ flex: 1 }}>
        <Txt size={15} weight="medium" tint={danger ? color.red : color.ink}>{label}</Txt>
        {sub && <Muted size={12}>{sub}</Muted>}
      </View>
      {soon && <View style={st.soon}><Txt size={11} weight="semibold" tint={color.muted}>{t('comingNext')}</Txt></View>}
      {right}
    </Row>
  );
  return onPress ? <Touch onPress={onPress}>{body}</Touch> : body;
}

const st = StyleSheet.create({
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center' },
  item: { paddingHorizontal: space.lg, paddingVertical: space.md },
  sep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: color.sunken, alignItems: 'center', justifyContent: 'center' },
  soon: { backgroundColor: color.sunken, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
});
