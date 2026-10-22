import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { color, space } from '../lib/theme';
import { num } from '../lib/format';
import { useSession } from '../lib/session';
import type { OrderSummary } from '../lib/types';
import { Icon } from './Icon';
import { Muted, Row, TagChip, Touch, Txt } from './ui';

// One order in a list: number, time, total, who, what, and its tags.
export function OrderRow({ o, last, compact }: { o: OrderSummary; last?: boolean; compact?: boolean }) {
  const { lang, t } = useSession();
  return (
    <Touch onPress={() => router.push({ pathname: '/order/[id]', params: { id: String(o.id) } })} style={[st.row, !last && st.sep]} accessibilityLabel={t('order', { n: o.number })}>
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
    </Touch>
  );
}

const st = StyleSheet.create({
  row: { paddingVertical: space.md, paddingHorizontal: space.lg },
  sep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.sm },
});
