import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { color, font } from '../lib/theme';
import { useSession } from '../lib/session';
import { Button, Muted, Txt } from './ui';

// Face ID / fingerprint gate, shown on launch and after the app returns from the background.
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useSession();
  const ask = useCallback(async () => {
    const ok = await LocalAuthentication.authenticateAsync({ promptMessage: t('unlock') }).catch(() => null);
    if (ok?.success) onUnlock();
  }, [onUnlock, t]);
  useEffect(() => { ask(); }, [ask]);
  return (
    <View style={{ flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
      <Txt size={44} center style={{ fontFamily: font.brand, letterSpacing: 4 }}>KOUB</Txt>
      <Muted center>{t('faceLockHint')}</Muted>
      <Button label={t('unlock')} icon="lock" onPress={ask} style={{ alignSelf: 'stretch', marginTop: 24 }} />
    </View>
  );
}
