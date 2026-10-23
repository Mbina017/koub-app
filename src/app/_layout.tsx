import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { Stack, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { targetFromNotification, useLastAlertTap } from '../lib/push';
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

// A tapped alert opens what it is about; any alert refreshes the lists.
function useAlerts(signedIn: boolean) {
  const last = useLastAlertTap();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    const target = targetFromNotification(last);
    const key = last?.notification.request.identifier ?? null;
    // Open each tapped alert once, after sign-in and unlock.
    if (!signedIn || !target || handled.current === key) return;
    handled.current = key;
    router.push(target);
  }, [last, signedIn]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationReceivedListener(() => {
      for (const k of ['home', 'orders', 'unpaid', 'preorders', 'products']) client.invalidateQueries({ queryKey: [k] });
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
          <Stack.Screen name="pos" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="pos-today" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
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
