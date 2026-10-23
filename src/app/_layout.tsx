import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, Text, View } from 'react-native';
import { Stack, router, type ErrorBoundaryProps } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import { orderFromNotification, useLastAlertTap } from '../lib/push';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { IBMPlexSansArabic_400Regular } from '@expo-google-fonts/ibm-plex-sans-arabic/400Regular';
import { IBMPlexSansArabic_500Medium } from '@expo-google-fonts/ibm-plex-sans-arabic/500Medium';
import { IBMPlexSansArabic_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold';
import { IBMPlexSansArabic_700Bold } from '@expo-google-fonts/ibm-plex-sans-arabic/700Bold';
import { CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond/600SemiBold';
import { SessionProvider, useSession } from '../lib/session';
import { color } from '../lib/theme';
import { LockScreen } from '../components/LockScreen';

SplashScreen.preventAutoHideAsync().catch(() => {});

const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: (n, e: unknown) => n < 2 && (e as { kind?: string })?.kind === 'network' },
  },
});

// Refetch when the app comes back to the foreground, like a native app should.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));
}

// A tapped alert opens its order; any alert refreshes the order lists.
function useAlerts(signedIn: boolean) {
  const last = useLastAlertTap();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    const id = orderFromNotification(last);
    const key = last?.notification.request.identifier ?? null;
    // Open each tapped alert once, after sign-in and unlock.
    if (!signedIn || !id || handled.current === key) return;
    handled.current = key;
    router.push({ pathname: '/order/[id]', params: { id: String(id) } });
  }, [last, signedIn]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationReceivedListener(() => {
      client.invalidateQueries({ queryKey: ['home'] });
      client.invalidateQueries({ queryKey: ['orders'] });
    });
    return () => sub.remove();
  }, []);
}

function Gate() {
  const { ready, session, lang, lock } = useSession();
  const [unlocked, setUnlocked] = useState(false);
  useAlerts(!!session && (!lock || unlocked));
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  // Lock again whenever the app goes to the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'background') setUnlocked(false); });
    return () => sub.remove();
  }, []);
  if (!ready) return null;
  if (session && lock && !unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />;
  return (
    <View style={{ flex: 1, backgroundColor: color.bg, direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg }, animation: 'slide_from_right' }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="order/[id]" />
          <Stack.Screen name="preorders" />
          <Stack.Screen name="run" />
          <Stack.Screen name="unpaid" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </View>
  );
}

// Last resort for a crash while drawing a screen: a calm page instead of a blank one.
// Plain Text and both languages, because fonts, session and language may be what failed.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { SplashScreen.hideAsync().catch(() => {}); }, []);
  const details = error instanceof Error ? `${error.name}: ${error.message}\n${(error.stack ?? '').split('\n').slice(0, 8).join('\n')}` : String(error);
  return (
    <View style={{ flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', color: color.ink, textAlign: 'center' }}>صار خطأ غير متوقع</Text>
      <Text style={{ fontSize: 15, color: color.muted, textAlign: 'center' }}>Something went wrong</Text>
      <Pressable onPress={retry} style={{ marginTop: 16, backgroundColor: color.ink, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 }}>
        <Text style={{ color: color.bg, fontSize: 16, fontWeight: '600' }}>جرّب مرة ثانية · Try again</Text>
      </Pressable>
      <Pressable onPress={() => { Clipboard.setStringAsync(details).then(() => setCopied(true)).catch(() => {}); }} style={{ padding: 12 }}>
        <Text style={{ color: color.muted, fontSize: 13 }}>{copied ? 'تم النسخ · Copied' : 'انسخ تفاصيل الخطأ · Copy error details'}</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold, CormorantGaramond_600SemiBold });
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <SessionProvider>
          <StatusBar style="dark" />
          <Gate />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
