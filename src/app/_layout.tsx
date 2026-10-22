import { useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { Stack } from 'expo-router';
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

function Gate() {
  const { ready, session, lang, lock } = useSession();
  const [unlocked, setUnlocked] = useState(false);
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
