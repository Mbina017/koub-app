import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../lib/api';
import { KOUB_AUTH_ORIGIN } from '../lib/app-environment';
import { useSession } from '../lib/session';
import { color, font, radius, space } from '../lib/theme';
import { Button, Muted, Row, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';

export default function Login() {
  const { t, lang, setLangPref, signIn, signInDemo, restoreFailed, retryRestore } = useSession();
  const ar = lang === 'ar';
  const insets = useSafeAreaInsets();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [focus, setFocus] = useState<'id' | 'password' | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'sign-in' | 'demo' | null>(null);
  const running = useRef(false);
  const passRef = useRef<TextInputInstance>(null);
  const idLabel = t('username');
  const passwordLabel = ar ? 'كلمة المرور' : 'Password';
  const revealLabel = reveal ? (ar ? 'إخفاء' : 'Hide') : (ar ? 'إظهار' : 'Show');

  const submit = async () => {
    if (running.current) return;
    if (!id.trim() || !password.trim()) return setError(t('errFields'));
    running.current = true; setBusy('sign-in'); setError('');
    try {
      await signIn({ site: KOUB_AUTH_ORIGIN, user: id.trim(), password: password.trim() });
      setPassword('');
    } catch (e) {
      setError(e instanceof ApiError && e.kind === 'refused' ? e.message : e instanceof ApiError && e.kind === 'auth' ? t('errAuth') : e instanceof ApiError && e.kind === 'forbidden' ? t('errForbidden') : t('errNetwork'));
    } finally {
      running.current = false; setBusy(null);
    }
  };
  const openDemo = async () => {
    if (running.current) return;
    running.current = true; setBusy('demo');
    try { await signInDemo(); } catch { setError(t('errNetwork')); }
    finally { running.current = false; setBusy(null); }
  };

  return (
    <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
        <View style={s.shell}>
          <Row style={s.head}>
            <Logo width={112} />
            <Touch style={s.lang} onPress={() => setLangPref(ar ? 'en' : 'ar')} accessibilityLabel={t('language')}>
              <Icon name="globe" size={16} /><Txt size={14} weight="semibold">{ar ? 'English' : 'العربية'}</Txt>
            </Touch>
          </Row>

          <View style={s.hero}>
            <Txt size={13} weight="bold" tint="#E4B38F" style={s.eyebrow}>{ar ? 'مساحة عمل كوب' : 'KOUB WORKSPACE'}</Txt>
            <Txt size={33} weight="bold" tint={color.bg}>{ar ? 'حيّاك في كوب.' : 'Welcome to KOUB.'}</Txt>
            <Txt size={15} tint="#E6D5C7">{ar ? 'الكاشير والطلبات وإدارة المحل، في مكان واحد.' : 'Checkout, orders and shop management in one place.'}</Txt>
          </View>

          <View style={s.card}>
            <Txt size={23} weight="bold">{ar ? 'تسجيل الدخول' : 'Sign in'}</Txt>
            <Muted size={14}>{ar ? 'ادخل باسم المستخدم وكلمة مرور حساب كوب.' : 'Use your existing KOUB username and account credential.'}</Muted>
            {restoreFailed && (
              <View style={s.notice}>
                <Txt size={14} tint={color.amber}>{ar ? 'ما قدرنا نتحقق من دخولك المحفوظ. تقدر تعيد المحاولة بدون ما تكتب بياناتك.' : 'Could not verify your saved sign-in. Retry without reentering your details.'}</Txt>
                <Button label={ar ? 'أعد المحاولة' : 'Retry saved sign-in'} kind="light" onPress={retryRestore} />
              </View>
            )}
            <View style={s.field}>
              <Txt size={14} weight="semibold">{idLabel}</Txt>
              <Row style={[s.inputRow, focus === 'id' && s.focus]}>
                <Icon name="users" size={19} tint={color.muted} />
                <TextInput value={id} onChangeText={setId} onFocus={() => setFocus('id')} onBlur={() => setFocus(null)}
                  accessibilityLabel={idLabel} editable={!busy} maxLength={60}
                  keyboardType={'default'} textContentType={'username'}
                  autoCapitalize="none" autoCorrect={false} returnKeyType="next" onSubmitEditing={() => passRef.current?.focus()}
                  placeholderTextColor={color.muted} style={s.input} />
              </Row>
            </View>
            <View style={s.field}>
              <Txt size={14} weight="semibold">{passwordLabel}</Txt>
              <Row style={[s.inputRow, focus === 'password' && s.focus]}>
                <Icon name="lock" size={18} tint={color.muted} />
                <TextInput ref={passRef} value={password} onChangeText={setPassword} onFocus={() => setFocus('password')} onBlur={() => setFocus(null)}
                  accessibilityLabel={passwordLabel} editable={!busy} secureTextEntry={!reveal} textContentType="password" autoCapitalize="none"
                  autoCorrect={false} maxLength={200} returnKeyType="go" onSubmitEditing={submit} style={s.input} />
                <Touch style={s.show} accessibilityLabel={revealLabel} disabled={!!busy} onPress={() => setReveal(!reveal)}>
                  <Txt size={13} weight="semibold">{revealLabel}</Txt>
                </Touch>
              </Row>
            </View>
            {error ? <View style={s.error} accessibilityLiveRegion="polite"><Txt tint={color.red} size={14}>{error}</Txt></View> : null}
            <Button label={t('signIn')} onPress={submit} loading={busy === 'sign-in'} disabled={busy === 'demo'} />
            {Platform.OS !== 'web' && <Muted center size={13}>{ar ? 'دخولك يظل محفوظ على هالجهاز.' : 'Your sign-in stays saved on this device.'}</Muted>}
          </View>
          <Button label={ar ? 'موظف يديد؟ اطلب حساب' : 'New staff? Request an account'} kind="light" icon="users" disabled={!!busy}
            onPress={() => router.push('/register' as never)} />
          {Platform.OS !== 'web' && <Button label={t('tryDemo')} kind="ghost" onPress={openDemo} loading={busy === 'demo'} disabled={busy === 'sign-in'} />}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.bg },
  scroll: { paddingHorizontal: space.lg, flexGrow: 1 },
  shell: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: space.md },
  head: { justifyContent: 'space-between', minHeight: 48, marginBottom: space.xs },
  lang: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 44, paddingHorizontal: 13, borderRadius: radius.pill, backgroundColor: color.sunken },
  hero: { backgroundColor: color.ink, borderRadius: 25, padding: space.xl, gap: space.xs },
  eyebrow: { letterSpacing: 0.7 },
  card: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, borderRadius: 25, padding: space.lg, gap: space.md },
  field: { gap: 6 },
  inputRow: { minHeight: 54, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: color.bg },
  focus: { borderColor: color.ink },
  input: { flex: 1, minWidth: 0, minHeight: 50, color: color.ink, fontFamily: font.medium, fontSize: 16, textAlign: 'left', writingDirection: 'ltr' },
  show: { minHeight: 44, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  notice: { padding: space.md, borderRadius: radius.sm, backgroundColor: color.amberBg, gap: space.sm },
  error: { padding: space.md, borderRadius: radius.sm, backgroundColor: color.redBg },
});
