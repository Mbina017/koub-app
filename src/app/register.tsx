// Staff sign-up (API 1.16): name, phone, a username and a password. The account waits for the owner's approval;
// once approved, the staff member signs in on the login screen with the same username and password.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, normalizeSite, staffSignUp } from '../lib/api';
import { useSession } from '../lib/session';
import { color, font, radius, space } from '../lib/theme';
import { Button, Muted, Row, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

export default function Register() {
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ site?: string }>();
  const [site] = useState(params.site || 'koubbh.com');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !user.trim() || !pass) return setError(t('errFields'));
    if (!/^[a-z0-9._-]{3,30}$/i.test(user.trim())) return setError(t('regUserRule'));
    if (pass.length < 8) return setError(t('regPassRule'));
    if (pass !== pass2) return setError(t('regPassMatch'));
    setError(''); setBusy(true);
    try {
      await staffSignUp(normalizeSite(site), { name: name.trim(), phone: phone.trim(), username: user.trim().toLowerCase(), password: pass });
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError && e.kind === 'refused' ? e.message : e instanceof ApiError && e.kind === 'not_found' ? t('errNotFound') : t('errNetwork'));
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, value: string, onChange: (v: string) => void, opts: { secure?: boolean; phone?: boolean; ascii?: boolean } = {}) => (
    <View style={{ marginBottom: space.md }}>
      <Txt size={13} weight="medium" tint={color.inkSoft} style={{ marginBottom: 6 }}>{label}</Txt>
      <TextInput value={value} onChangeText={onChange} secureTextEntry={opts.secure} autoCapitalize="none" autoCorrect={false}
        keyboardType={opts.phone ? 'phone-pad' : 'default'} textContentType={opts.secure ? 'newPassword' : opts.ascii ? 'username' : 'none'}
        style={[st.input, { textAlign: opts.secure || opts.phone || opts.ascii ? 'left' : lang === 'ar' ? 'right' : 'left', writingDirection: opts.secure || opts.phone || opts.ascii ? 'ltr' : undefined }]}
        placeholderTextColor={color.faint} />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, paddingHorizontal: space.xl, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Row style={{ marginBottom: space.lg }}>
          <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/login' as never))} style={st.iconBtn} accessibilityLabel="back">
            <Icon name="back" size={24} rtl={lang === 'ar'} />
          </Touch>
        </Row>
        <Txt size={26} weight="bold">{t('regTitle')}</Txt>
        <Muted size={15} style={{ marginTop: 4, marginBottom: 24 }}>{t('regSub')}</Muted>
        {sent ? (
          <View style={st.ok}>
            <Icon name="check" size={22} tint={color.green} />
            <Txt size={15} style={{ flex: 1 }}>{t('regSent')}</Txt>
          </View>
        ) : (
          <>
            {field(t('regName'), name, setName)}
            {field(t('regPhone'), phone, setPhone, { phone: true })}
            {field(t('username'), user, setUser, { ascii: true })}
            <Muted size={12} style={{ marginTop: -8, marginBottom: space.md }}>{t('regUserRule')}</Muted>
            {field(t('regPassword'), pass, setPass, { secure: true })}
            {field(t('regPassword2'), pass2, setPass2, { secure: true })}
            {error ? <View style={st.error}><Icon name="warn" size={18} tint={color.red} /><Txt size={14} tint={color.red} style={{ flex: 1 }}>{error}</Txt></View> : null}
            <Button label={t('regSend')} onPress={submit} loading={busy} />
          </>
        )}
        {sent && <Button label={t('regBack')} kind="light" onPress={() => (router.canGoBack() ? router.back() : router.replace('/login' as never))} style={{ marginTop: space.lg }} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { height: 52, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, paddingHorizontal: 14, fontFamily: font.medium, fontSize: 15, color: color.ink },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: color.redBg, borderRadius: radius.sm, padding: 12, marginBottom: space.md },
  ok: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: color.greenBg, borderRadius: radius.md, padding: 16 },
});
