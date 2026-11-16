import { StyleSheet, View, Pressable } from 'react-native';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useApiSession, useSession } from '../../lib/session';
import { color, shadow } from '../../lib/theme';
import { Icon, type IconName } from '../../components/Icon';
import { Txt, tap } from '../../components/ui';

const TABS: { name: string; icon: IconName; label: 'home' | 'orders' | 'products' | 'numbers' | 'more' | 'work' | 'tabNewOrder' }[] = [
  { name: 'index', icon: 'home', label: 'home' },
  { name: 'sell', icon: 'cash', label: 'tabNewOrder' },
  { name: 'work', icon: 'check', label: 'work' },
  { name: 'orders', icon: 'orders', label: 'orders' },
  { name: 'products', icon: 'products', label: 'products' },
  { name: 'numbers', icon: 'numbers', label: 'numbers' },
  { name: 'more', icon: 'more', label: 'more' },
];

// Staff (API 1.40): outside, "New order" and "My orders"; in the kiosk, the kiosk screen alone (no bar).
// The owner keeps the five tabs and opens Work and the till from Home.
const STAFF_TABS = { outside: ['sell', 'work'], inside: ['work'] } as const;

// The five-tab bar from the dashboard, with the "to prepare" badge on Orders.
function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useSession();
  const session = useApiSession();
  // Shares the Home query, refreshed every minute so the badge stays current.
  const { cashier, staffRole } = useSession();
  // Staff have no Home figures; their badge waits for a store that gives it to them.
  const home = useQuery({ queryKey: ['home', 'today'], queryFn: () => api.home(session, 'today'), refetchInterval: 60_000, enabled: !cashier });
  const waiting = home.data?.needs.prepare.count ?? 0;
  // Staff with one screen (the kiosk), or still choosing where they work, have no tab bar.
  if (cashier && staffRole !== 'outside') return null;
  const staffTabs: readonly string[] = STAFF_TABS.outside;
  return (
    <View style={[st.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, i) => {
        const tab = TABS.find((x) => x.name === route.name);
        // Staff (API 1.16): orders and more; the till opens from both.
        if (!tab || (cashier ? !staffTabs.includes(tab.name) : tab.name === 'work' || tab.name === 'sell')) return null;
        const label = cashier && tab.name === 'work' ? 'tabMyOrders' : tab.label;
        const on = state.index === i;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t(label)}
            onPress={() => {
              const e = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!on && !e.defaultPrevented) { tap('select'); navigateToTab(route.key); }
            }}
            style={st.item}
          >
            <View>
              <Icon name={tab.icon} size={25} stroke={on ? 2 : 1.6} tint={on ? color.ink : color.faint} />
              {tab.name === 'orders' && waiting > 0 && <View style={st.badge}><Txt size={10} weight="bold" tint={color.bg} center ltr>{String(waiting)}</Txt></View>}
            </View>
            <Txt size={11} weight={on ? 'semibold' : 'medium'} tint={on ? color.ink : color.faint} center style={{ marginTop: 2 }}>{t(label)}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.bg } }}>
      {TABS.map((tab) => <Tabs.Screen key={tab.name} name={tab.name} />)}
    </Tabs>
  );
}

const st = StyleSheet.create({
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', paddingTop: 8,
    backgroundColor: color.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line, ...shadow.card,
  },
  item: { flex: 1, alignItems: 'center' },
  badge: { position: 'absolute', top: -5, end: -10, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: color.amber, borderWidth: 2, borderColor: color.surface, justifyContent: 'center' },
});
