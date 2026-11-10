// New-order alerts. The phone asks for permission, gets an Expo push token and registers it with the store
// (POST koub/v1/app/push). The store then sends one alert per new order; see koub-site app-push.php.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api, type Session } from './api';
import type { Lang } from './types';

export type PushResult = 'on' | 'off' | 'denied' | 'unsupported' | 'no_project' | 'demo' | 'error';
// Alerts on this phone. New orders follow `on`; unfinished payments and stock can each be turned off (API 1.4).
export type PushPrefs = { on: boolean; quiet: boolean; unpaid: boolean; stock: boolean };
export const PUSH_DEFAULT: PushPrefs = { on: false, quiet: true, unpaid: true, stock: true };
export type PushKind = 'new_order' | 'unpaid' | 'stock';

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

export async function setPush(session: Session, p: PushPrefs, lang: Lang, on = p.on): Promise<PushResult> {
  if ('demo' in session) return 'demo';
  try {
    const t = await token();
    if (t === 'unsupported' || t === 'denied' || t === 'no_project') return on ? t : 'off';
    const kinds: PushKind[] = ['new_order', ...(p.unpaid ? ['unpaid' as const] : []), ...(p.stock ? ['stock' as const] : [])];
    const r = await api.push(session, { token: t, platform: Platform.OS === 'ios' ? 'ios' : 'android', enabled: on, quiet: p.quiet, lang, kinds });
    return r.enabled ? 'on' : 'off';
  } catch {
    return 'error';
  }
}

// The last tapped alert. Web has no notifications, and the platform never changes at runtime, so this stays a stable hook.
export const useLastAlertTap: () => Notifications.NotificationResponse | null | undefined =
  Platform.OS === 'web' ? () => null : Notifications.useLastNotificationResponse;

// Where a tapped alert opens, if it is one of ours: the new order, the unfinished payments list, pre-orders or products.
export type AlertTarget = { pathname: '/order/[id]'; params: { id: string } } | { pathname: '/unpaid' | '/preorders' | '/products' };
export function targetFromNotification(r: Notifications.NotificationResponse | null | undefined): AlertTarget | null {
  const data = r?.notification.request.content.data as { order_id?: unknown; type?: unknown } | undefined;
  switch (data?.type) {
    case 'new_order': return Number.isInteger(data.order_id) ? { pathname: '/order/[id]', params: { id: String(data.order_id) } } : null;
    case 'unpaid': return { pathname: '/unpaid' };
    case 'preorder_ready': return { pathname: '/preorders' };
    case 'sold_out': return { pathname: '/products' };
    default: return null;
  }
}
