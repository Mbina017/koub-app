// Scan a KOUB loyalty card's QR (or type its code) at the till. The store finds the card; the till then adds the
// sale's paid drinks to it as stamps, or uses a free drink waiting on it (API 1.11 sale fields).
import { useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, font, radius, space } from '../lib/theme';
import type { LoyaltyCard } from '../lib/types';
import { Button, Muted, Row, Touch, Txt } from './ui';
import { Icon } from './Icon';

export function LoyaltyScan({ open, onClose, onCard }: { open: boolean; onClose: () => void; onCard: (c: LoyaltyCard, code: string) => void }) {
  const session = useApiSession();
  const { t } = useSession();
  const insets = useSafeAreaInsets();
  const [perm, ask] = useCameraPermissions();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // The camera reports the same code many times a second: look it up once.
  const seen = useRef('');

  const find = async (raw: string) => {
    const code = raw.trim();
    if (!code || busy) return;
    setBusy(true); setError('');
    try {
      const card = await api.loyaltyCard(session, code);
      seen.current = ''; setTyped('');
      onCard(card, code);
    } catch (e) {
      seen.current = '';
      setError(e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e instanceof Error && e.message !== 'not_found' ? e.message : t('loyType'));
    } finally {
      setBusy(false);
    }
  };
  const close = () => { setError(''); setTyped(''); seen.current = ''; onClose(); };

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <Row style={[st.top, { paddingTop: Platform.OS === 'ios' ? space.md : insets.top + 6 }]}>
          <Txt size={19} weight="bold" style={{ flex: 1, paddingHorizontal: space.sm }}>{t('loyScan')}</Txt>
          <Touch onPress={close} style={st.iconBtn} accessibilityLabel="close"><Icon name="close" size={22} /></Touch>
        </Row>
        <View style={{ padding: space.lg, gap: space.md }}>
          <View style={st.camera}>
            {Platform.OS === 'web' ? null : perm?.granted ? (
              <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={({ data }) => { if (data && data !== seen.current && !busy) { seen.current = data; find(data); } }} />
            ) : (
              <View style={{ alignItems: 'center', gap: space.sm, padding: space.lg }}>
                <Muted center>{t('loyNoCamera')}</Muted>
                <Button label={t('loyAllowCamera')} kind="light" onPress={() => { ask().catch(() => {}); }} />
              </View>
            )}
          </View>
          <Muted>{t('loyType')}</Muted>
          <Row gap={8}>
            <TextInput value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} placeholder="ABCD-2345" placeholderTextColor={color.faint}
              onSubmitEditing={() => find(typed)} style={[st.input, { flex: 1, textAlign: 'left', writingDirection: 'ltr' }]} />
            <Button label={t('loyFind')} onPress={() => find(typed)} loading={busy} disabled={!typed.trim() || busy} style={{ minWidth: 90 }} />
          </Row>
          {error ? <Txt size={14} tint={color.red}>{error}</Txt> : null}
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: 4, backgroundColor: color.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  camera: { height: 300, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.sunken, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.surface, paddingHorizontal: 12, fontSize: 16, color: color.ink, fontFamily: font.medium },
});
