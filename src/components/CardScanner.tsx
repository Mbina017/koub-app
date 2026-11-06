// Scan a KOUB loyalty card at the till: the QR on the customer's Wallet card or card page.
// The code can also be typed (8 characters under the QR), for a cracked screen or a phone the camera cannot read.
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../lib/session';
import { cleanCode } from '../lib/loyalty';
import { color, font, radius, space } from '../lib/theme';
import { Button, Muted, Row, Touch, Txt } from './ui';
import { Icon } from './Icon';

export function CardScanner({ open, busy, onCode, onClose }: { open: boolean; busy: boolean; onCode: (code: string) => void; onClose: () => void }) {
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const [perm, ask] = useCameraPermissions();
  const [typed, setTyped] = useState('');
  const last = useRef('');
  const camera = Platform.OS !== 'web';
  const typedCode = cleanCode(typed);

  const close = () => { setTyped(''); last.current = ''; onClose(); };
  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: color.bg }}>
        <Row style={[st.top, { paddingTop: Platform.OS === 'ios' ? space.md : insets.top + 6 }]}>
          <Txt size={19} weight="bold" style={{ flex: 1, paddingHorizontal: space.sm }}>{t('loyScanTitle')}</Txt>
          <Touch onPress={close} style={st.iconBtn} accessibilityLabel={t('posExit')}><Icon name="close" size={22} /></Touch>
        </Row>
        <View style={{ padding: space.lg, gap: space.md, flex: 1 }}>
          {camera && (perm?.granted ? (
            <View style={st.frame}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={busy ? undefined : ({ data }) => {
                  const code = cleanCode(data);
                  // The camera reports the same QR many times a second: act once per code.
                  if (!code || code === last.current) return;
                  last.current = code;
                  onCode(code);
                }}
              />
              <View pointerEvents="none" style={st.aim} />
            </View>
          ) : (
            <View style={[st.frame, st.ask]}>
              <Icon name="gift" size={34} tint={color.faint} />
              <Muted center>{perm && !perm.canAskAgain ? t('loyCameraDenied') : t('loyCameraWhy')}</Muted>
              {(!perm || perm.canAskAgain) && <Button label={t('loyCameraAllow')} kind="light" onPress={() => { ask().catch(() => {}); }} />}
            </View>
          ))}
          <Muted center>{camera ? t('loyScanHint') : t('loyTypeHint')}</Muted>
          <Row gap={8}>
            <TextInput value={typed} onChangeText={setTyped} placeholder="K7Q4-9XM2" placeholderTextColor={color.faint} autoCapitalize="characters" autoCorrect={false} maxLength={14}
              style={[st.input, { flex: 1, minWidth: 0, fontFamily: font.semibold, textAlign: lang === 'ar' ? 'right' : 'left' }]} onSubmitEditing={() => typedCode && onCode(typedCode)} />
            <Button label={t('loyFind')} onPress={() => typedCode && onCode(typedCode)} disabled={!typedCode || busy} loading={busy} style={{ minWidth: 96 }} />
          </Row>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: 4, backgroundColor: color.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  frame: { aspectRatio: 1, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.ink },
  ask: { backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg },
  aim: { position: 'absolute', top: '20%', left: '20%', right: '20%', bottom: '20%', borderWidth: 3, borderColor: color.bg, borderRadius: radius.md, opacity: 0.85 },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.surface, paddingHorizontal: 12, fontSize: 17, color: color.ink, letterSpacing: 1 },
});
