// Building blocks shared by every screen.
import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type ScrollViewInstance, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, radius, shadow, space, tone as tones, type Tone } from '../lib/theme';
import { useSession } from '../lib/session';
import { Icon, type IconName } from './Icon';

export function tap(kind: 'light' | 'select' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'select') Haptics.selectionAsync().catch(() => {});
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';
export function Txt({ children, size = 15, weight = 'regular', tint = color.ink, center, style, lines, ltr }: { children: ReactNode; size?: number; weight?: Weight; tint?: string; center?: boolean; style?: StyleProp<TextStyle>; lines?: number; ltr?: boolean }) {
  const { lang } = useSession();
  const rtl = lang === 'ar' && !ltr;
  return (
    <Text numberOfLines={lines} style={[{ fontFamily: font[weight], fontSize: size, lineHeight: Math.round(size * 1.45), color: tint, textAlign: center ? 'center' : rtl ? 'right' : 'left', writingDirection: ltr ? 'ltr' : rtl ? 'rtl' : 'ltr' }, style]}>
      {children}
    </Text>
  );
}
export const Muted = (p: Parameters<typeof Txt>[0]) => <Txt size={13} tint={color.muted} {...p} />;

// Press feedback like native apps: a quick shrink, plus a light tap on phones.
// Size and placement keys belong to the pressable box, so flex and % widths work like on a plain View.
const OUTER = ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'width', 'minWidth', 'maxWidth', 'alignSelf', 'margin', 'marginTop', 'marginBottom', 'marginStart', 'marginEnd', 'marginHorizontal', 'marginVertical'] as const;
export function Touch({ children, style, onPress, haptic = true, disabled, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; haptic?: boolean; children: ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  const flat = { ...(StyleSheet.flatten(style) ?? {}) } as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  for (const k of OUTER) if (k in flat) { outer[k] = flat[k]; delete flat[k]; }
  // The inner box fills the pressable, so tiles in one row share a height.
  flat.flexGrow = 1;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: Platform.OS !== 'web', speed: 40, bounciness: 0 }).start();
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      onPress={(e) => { if (haptic) tap(); onPress?.(e); }}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      style={outer as ViewStyle}
    >
      <Animated.View style={[flat as ViewStyle, { transform: [{ scale }] }, disabled && { opacity: 0.45 }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return <View style={[s.card, padded && { padding: space.lg }, style]}>{children}</View>;
}

export function Row({ children, style, gap = space.sm, align = 'center' }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number; align?: ViewStyle['alignItems'] }) {
  return <View style={[{ flexDirection: 'row', alignItems: align, gap }, style]}>{children}</View>;
}

export function TagChip({ label, tone = 'neutral', small }: { label: string; tone?: Tone; small?: boolean }) {
  const t = tones[tone] ?? tones.neutral;
  return (
    <View style={[s.tag, { backgroundColor: t.bg }, small && { paddingVertical: 2, paddingHorizontal: 8 }]}>
      <Txt size={small ? 11 : 12} weight="medium" tint={t.fg}>{label}</Txt>
    </View>
  );
}

// Segmented control: a sliding ink pill, the way iOS apps switch periods.
export function Segmented<K extends string>({ items, value, onChange, style }: { items: [K, string][]; value: K; onChange: (k: K) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.seg, style]} accessibilityRole="tablist">
      {items.map(([k, label]) => {
        const on = k === value;
        return (
          <Pressable key={k} onPress={() => { if (!on) { tap('select'); onChange(k); } }} style={[s.segItem, on && s.segOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <Txt size={13} weight={on ? 'semibold' : 'medium'} tint={on ? color.bg : color.inkSoft} center>{label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

// Horizontal filter chips with counts.
export function Chips<K extends string>({ items, value, onChange }: { items: { key: K; label: string; count?: number }[]; value: K; onChange: (k: K) => void }) {
  const { lang } = useSession();
  const ref = useRef<ScrollViewInstance>(null);
  const rtl = lang === 'ar';
  // Horizontal scroll views ignore RTL on some platforms, so lay out left-to-right, reverse, and start at the right end.
  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} onContentSizeChange={() => rtl && ref.current?.scrollToEnd({ animated: false })} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg, direction: 'ltr' }} style={{ flexGrow: 0, direction: 'ltr' }}>
      {(rtl ? [...items].reverse() : items).map(({ key, label, count }) => {
        const on = key === value;
        return (
          <Pressable key={key} onPress={() => { if (!on) { tap('select'); onChange(key); } }} style={[s.chip, on && s.chipOn, { direction: rtl ? 'rtl' : 'ltr' }]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <Txt size={13} weight={on ? 'semibold' : 'medium'} tint={on ? color.bg : color.ink}>{label}</Txt>
            {count !== undefined && <View style={[s.chipCount, on && { backgroundColor: 'rgba(247,243,236,0.18)' }]}><Txt size={11} weight="semibold" tint={on ? color.bg : color.muted} ltr>{String(count)}</Txt></View>}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function SectionTitle({ title, action, onAction, icon }: { title: string; action?: string; onAction?: () => void; icon?: IconName }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: space.sm, marginTop: space.xl }}>
      <Row gap={6}>{icon && <Icon name={icon} size={18} />}<Txt size={17} weight="semibold">{title}</Txt></Row>
      {action && <Pressable onPress={onAction} hitSlop={10}><Txt size={14} weight="medium" tint={color.muted}>{action}</Txt></Pressable>}
    </Row>
  );
}

// Shimmering placeholder while data loads, instead of a spinner.
export function Skeleton({ h = 16, w = '100%', r = 8, style }: { h?: number; w?: ViewStyle['width']; r?: number; style?: StyleProp<ViewStyle> }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[{ height: h, width: w, borderRadius: r, backgroundColor: color.sunken, opacity: pulse }, style]} />;
}

export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 320, delay, useNativeDriver: Platform.OS !== 'web' }).start(); }, [v, delay]);
  return <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>{children}</Animated.View>;
}

export function Empty({ title, body, icon = 'check' }: { title: string; body?: string; icon?: IconName }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}><Icon name={icon} size={26} tint={color.muted} /></View>
      <Txt size={17} weight="semibold" center>{title}</Txt>
      {body ? <Muted center style={{ marginTop: 4 }}>{body}</Muted> : null}
    </View>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useSession();
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}><Icon name="warn" size={26} tint={color.red} /></View>
      <Txt size={17} weight="semibold" center>{t('offline')}</Txt>
      <Muted center style={{ marginTop: 4, marginBottom: space.lg }}>{t('offlineHint')}</Muted>
      <Button label={t('retry')} onPress={onRetry} kind="ghost" />
    </View>
  );
}

export function Button({ label, onPress, kind = 'primary', icon, loading, disabled, style }: { label: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'light'; icon?: IconName; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const fg = kind === 'primary' ? color.bg : color.ink;
  return (
    <Touch onPress={onPress} disabled={disabled || loading} style={[s.btn, kind === 'primary' && s.btnPrimary, kind === 'ghost' && s.btnGhost, kind === 'light' && s.btnLight, style]}>
      {loading ? <ActivityIndicator color={fg} /> : <Row gap={8} style={{ justifyContent: 'center' }}>{icon && <Icon name={icon} size={19} tint={fg} />}<Txt size={15} weight="semibold" tint={fg}>{label}</Txt></Row>}
    </Touch>
  );
}

// Every tab screen: safe area, large title, pull to refresh.
export function Screen({ title, right, children, refreshing, onRefresh, header, scroll = true }: { title?: string; right?: ReactNode; children: ReactNode; refreshing?: boolean; onRefresh?: () => void; header?: ReactNode; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const { session, t } = useSession();
  const head = (
    <View style={{ paddingTop: insets.top + space.sm }}>
      {session && 'demo' in session && <View style={s.demo}><Txt size={11} weight="semibold" tint={color.amber} center>{t('demoBanner')}</Txt></View>}
      {title && <Row style={{ justifyContent: 'space-between', paddingHorizontal: space.lg, paddingBottom: space.sm }}><Txt size={30} weight="bold" style={{ letterSpacing: -0.5 }}>{title}</Txt>{right}</Row>}
      {header}
    </View>
  );
  if (!scroll) return <View style={s.screen}>{head}{children}</View>;
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: insets.bottom + 110 }} refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={color.ink} /> : undefined} keyboardShouldPersistTaps="handled">
      {head}
      <View style={{ paddingHorizontal: space.lg }}>{children}</View>
    </ScrollView>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  card: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, ...shadow.card },
  tag: { borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 10, alignSelf: 'flex-start' },
  seg: { flexDirection: 'row', backgroundColor: color.sunken, borderRadius: radius.pill, padding: 3 },
  segItem: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill },
  segOn: { backgroundColor: color.ink, ...shadow.card },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: color.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  chipOn: { backgroundColor: color.ink, borderColor: color.ink },
  chipCount: { minWidth: 20, paddingHorizontal: 5, borderRadius: radius.pill, backgroundColor: color.sunken, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: space.xl },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: color.sunken, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  btn: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  btnPrimary: { backgroundColor: color.ink },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: color.line },
  btnLight: { backgroundColor: color.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  demo: { alignSelf: 'center', backgroundColor: color.amberBg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2, marginBottom: 4 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: color.line },
});
