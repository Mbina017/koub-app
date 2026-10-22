import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, normalizeSite } from '../lib/api';
import { useSession } from '../lib/session';
import { color, font, radius, space } from '../lib/theme';
import { Button, Muted, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

export default function Login() {
  const { t, signIn, signInDemo } = useSession();
  const insets = useSafeAreaInsets();
  const [site, setSite] = useState('koubbh.com');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'in' | 'demo' | null>(null);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!site.trim() || !user.trim() || !password.trim()) return setError(t('errFields'));
    setError('');
    setBusy('in');
    try {
      await signIn({ site: normalizeSite(site), user: user.trim(), password: password.trim() });
    } catch (e) {
      const kind = e instanceof ApiError ? e.kind : 'network';
      setError(t(kind === 'auth' ? 'errAuth' : kind === 'forbidden' ? 'errForbidden' : kind === 'not_found' ? 'errNotFound' : 'errNetwork'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + 32, paddingHorizontal: space.xl, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Txt size={52} center style={{ fontFamily: font.brand, letterSpacing: 6, lineHeight: 60 }} ltr>KOUB</Txt>
        <Muted center size={11} style={{ letterSpacing: 2.5, marginBottom: 40 }} ltr>YOUR DAILY WORKSPACE</Muted>
        <Txt size={26} weight="bold">{t('signInTitle')}</Txt>
        <Muted size={15} style={{ marginTop: 4, marginBottom: 28 }}>{t('signInSub')}</Muted>

        <Field label={t('storeUrl')} value={site} onChange={setSite} icon="store" keyboard="url" />
        <Field label={t('username')} value={user} onChange={setUser} icon="users" />
        <Field label={t('appPassword')} value={password} onChange={setPassword} icon="lock" secure onSubmit={submit} />
        <Muted size={12} style={{ marginTop: -4, marginBottom: space.lg }}>{t('appPasswordHelp')}</Muted>

        {error ? (
          <View style={st.error}><Icon name="warn" size={18} tint={color.red} /><Txt size={14} tint={color.red} style={{ flex: 1 }}>{error}</Txt></View>
        ) : null}

        <Button label={t('signIn')} onPress={submit} loading={busy === 'in'} disabled={busy === 'demo'} />
        <Button label={t('tryDemo')} kind="ghost" onPress={async () => { setBusy('demo'); try { await signInDemo(); } finally { setBusy(null); } }} loading={busy === 'demo'} disabled={busy === 'in'} style={{ marginTop: space.md }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, icon, secure, keyboard, onSubmit }: { label: string; value: string; onChange: (v: string) => void; icon: 'store' | 'users' | 'lock'; secure?: boolean; keyboard?: 'url'; onSubmit?: () => void }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: space.md }}>
      <Txt size={13} weight="medium" tint={color.inkSoft} style={{ marginBottom: 6 }}>{label}</Txt>
      <View style={[st.input, focus && { borderColor: color.ink }]}>
        <Icon name={icon} size={19} tint={color.muted} />
        <TextInput
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          secureTextEntry={secure}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={keyboard === 'url' ? 'url' : 'default'}
          textContentType={secure ? 'password' : keyboard === 'url' ? 'URL' : 'username'}
          returnKeyType={onSubmit ? 'go' : 'next'}
          onSubmitEditing={onSubmit}
          style={st.text}
          placeholderTextColor={color.faint}
        />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  input: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, paddingHorizontal: 14 },
  text: { flex: 1, minWidth: 0, fontFamily: font.medium, fontSize: 15, color: color.ink, textAlign: 'left', writingDirection: 'ltr', height: 50 },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: color.redBg, borderRadius: radius.sm, padding: 12, marginBottom: space.md },
});
