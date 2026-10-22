// New-order alerts. The phone asks for permission, gets an Expo push token and registers it with the store
// (POST koub/v1/app/push). The store then sends one alert per new order; see koub-site app-push.php.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { api, type Session } from './api';
import type { Lang } from './types';

export type PushResult = 'on' | 'off' | 'denied' | 'unsupported' | 'no_project' | 'demo' | 'error';
const TOKEN_KEY = 'koub.push-token.v1';

// Show alerts while the app is open too, like a messaging app.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

// The EAS project id comes from app.json (extra.eas.projectId) once the app is linked with `eas init`.
function projectId(): string | undefined {
  return (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
}

async function token(): Promise<string | PushResult> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', { name: 'New orders', importance: Notifications.AndroidImportance.MAX, sound: 'default', vibrationPattern: [0, 200, 120, 200] });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'denied';
  const id = projectId();
  if (!id) return 'no_project';
  return (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
}

export async function setPush(session: Session, on: boolean, quiet: boolean, lang: Lang): Promise<PushResult> {
  if ('demo' in session) return 'demo';
  try {
    // Removing an existing registration must not ask for permission or need a fresh Expo token.
    const saved = !on && Platform.OS !== 'web' ? await SecureStore.getItemAsync(TOKEN_KEY) : null;
    const t = saved ?? await token();
    if (t === 'unsupported' || t === 'denied' || t === 'no_project') return on ? t : Platform.OS === 'web' ? 'off' : 'error';
    if (Platform.OS !== 'web') await SecureStore.setItemAsync(TOKEN_KEY, t);
    const r = await api.push(session, { token: t, platform: Platform.OS === 'ios' ? 'ios' : 'android', enabled: on, quiet, lang });
    if (!r.enabled && Platform.OS !== 'web') await SecureStore.deleteItemAsync(TOKEN_KEY);
    return r.enabled ? 'on' : 'off';
  } catch {
    return 'error';
  }
}

// The last tapped alert. Web has no notifications, and the platform never changes at runtime, so this stays a stable hook.
export const useLastAlertTap: () => Notifications.NotificationResponse | null | undefined =
  Platform.OS === 'web' ? () => null : Notifications.useLastNotificationResponse;

// Order id from a tapped alert, if it is one of ours.
export function orderFromNotification(r: Notifications.NotificationResponse | null | undefined): number | null {
  const data = r?.notification.request.content.data as { order_id?: unknown; type?: unknown } | undefined;
  return data?.type === 'new_order' && Number.isInteger(data.order_id) ? (data.order_id as number) : null;
}

