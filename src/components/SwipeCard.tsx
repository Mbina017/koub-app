// A card staff can swipe sideways to do its main step (either direction), with the step's name showing underneath as
// it slides. A short drag springs back; past the threshold the card slides off and `onSwipe` runs. Taps still work.
// Built on PanResponder and Animated (no extra native module), so it runs in Expo Go and on the web preview.
import { useRef, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { color, radius } from '../lib/theme';
import { Row, Txt } from './ui';
import { Icon } from './Icon';

const THRESHOLD = 110;

export function SwipeCard({ children, label, onSwipe, disabled, style }: { children: ReactNode; label?: string; onSwipe?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const x = useRef(new Animated.Value(0)).current;
  const passed = useRef(false);
  const active = !!onSwipe && !!label && !disabled;
  // The responder is made once: it reads the latest props through these.
  const live = useRef({ active, onSwipe });
  live.current = { active, onSwipe };
  const pan = useRef(
    PanResponder.create({
      // Only clearly sideways drags: vertical scrolling keeps working.
      onMoveShouldSetPanResponder: (_, g) => live.current.active && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        x.setValue(g.dx);
        const over = Math.abs(g.dx) > THRESHOLD;
        if (over !== passed.current) { passed.current = over; if (over) Haptics.selectionAsync().catch(() => {}); }
      },
      onPanResponderRelease: (_, g) => {
        passed.current = false;
        if (Math.abs(g.dx) > THRESHOLD) {
          Animated.timing(x, { toValue: Math.sign(g.dx) * 600, duration: 160, useNativeDriver: true }).start(() => {
            live.current.onSwipe?.();
            // Back in place for the refreshed card (or if the step was refused).
            x.setValue(0);
          });
        } else Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      },
      onPanResponderTerminate: () => { passed.current = false; Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(); },
    }),
  ).current;
  const hint = x.interpolate({ inputRange: [-THRESHOLD, -20, 0, 20, THRESHOLD], outputRange: [1, 0.25, 0, 0.25, 1], extrapolate: 'clamp' });

  return (
    <View style={style}>
      {active && (
        <Animated.View style={[StyleSheet.absoluteFill, st.under, { opacity: hint }]} pointerEvents="none">
          {/* The step name on both edges, so it shows whichever way the card slides. */}
          <Row style={{ justifyContent: 'space-between', width: '100%', paddingHorizontal: 20 }}>
            {[0, 1].map((i) => <Row key={i} gap={6}><Icon name="check" size={20} tint={color.bg} /><Txt size={15} weight="semibold" tint={color.bg}>{label}</Txt></Row>)}
          </Row>
        </Animated.View>
      )}
      <Animated.View style={{ transform: [{ translateX: x }] }} {...(active ? pan.panHandlers : {})}>
        {children}
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  under: { borderRadius: radius.lg, backgroundColor: color.green, alignItems: 'center', justifyContent: 'center' },
});
