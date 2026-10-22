import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { color, space } from '../lib/theme';
import { num } from '../lib/format';
import { useSession } from '../lib/session';
import type { OrderSummary } from '../lib/types';
import { Icon } from './Icon';
import { Muted, Row, TagChip, Touch, Txt } from './ui';

// One order in a list: number, time, total, who, what, and its tags.
// In select mode (onSelect set) a tap ticks the order instead of opening it.
export function OrderRow({ o, last, compact, selected, onSelect }: { o: OrderSummary; last?: boolean; compact?: boolean; selected?: boolean; onSelect?: () => void }) {
  const { lang, t } = useSession();
  const body = (
    <View style={{ flex: 1 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={8}>
          <Txt size={15} weight="semibold">{'#' + o.number}</Txt>
          <Muted size={12}>{o.ago}</Muted>
        </Row>
        <Row gap={4}>
          <Txt size={16} weight="semibold" ltr>{num(o.total)}</Txt>
          <Icon name="chevron" size={16} tint={color.faint} rtl={lang === 'ar'} />
        </Row>
      </Row>
      <Txt size={14} lines={1} style={{ marginTop: 2 }}>
        {o.name}<Txt size={14} tint={color.muted}>{' · ' + o.items}</Txt>
      </Txt>
      {!compact && o.tags.length > 0 && (
        <View style={st.tags}>{o.tags.map((tg, i) => <TagChip key={i} label={tg.label} tone={tg.tone} small />)}</View>
      )}
    </View>
  );
  if (onSelect) return (
    <Touch onPress={onSelect} haptic={false} style={[st.row, !last && st.sep, selected && { backgroundColor: color.sunken }]} accessibilityRole="checkbox" accessibilityState={{ checked: !!selected }} accessibilityLabel={t('order', { n: o.number })}>
      <Row gap={12} align="flex-start">
        <View style={[st.tick, selected && st.ticked]}>{selected && <Icon name="check" size={14} stroke={2.6} tint={color.bg} />}</View>
        {body}
      </Row>
    </Touch>
  );
  return (
    <Touch onPress={() => router.push({ pathname: '/order/[id]', params: { id: String(o.id) } })} style={[st.row, !last && st.sep]} accessibilityLabel={t('order', { n: o.number })}>
      {body}
    </Touch>
  );
}

const st = StyleSheet.create({
  row: { paddingVertical: space.md, paddingHorizontal: space.lg },
  sep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.sm },
  tick: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: color.faint, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  ticked: { backgroundColor: color.ink, borderColor: color.ink },
});
