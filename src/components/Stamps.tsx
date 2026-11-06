// A loyalty card's stamps toward the next free drink, and the gift when one is waiting.
import { StyleSheet, View } from 'react-native';
import { color } from '../lib/theme';
import { Row, Txt } from './ui';
import { Icon } from './Icon';

export function Stamps({ stamps, of, rewards, size = 34 }: { stamps: number; of: number; rewards: number; size?: number }) {
  const d = { width: size, height: size, borderRadius: size / 2 };
  return (
    <Row gap={8} style={{ justifyContent: 'center' }}>
      {Array.from({ length: of }, (_, i) => (
        <View key={i} style={[st.dot, d, i < stamps && st.on]}>{i < stamps && <Icon name="check" size={size * 0.42} tint={color.bg} />}</View>
      ))}
      <View style={[st.dot, d, st.gift, rewards > 0 && st.giftOn]}>
        <Icon name="gift" size={size * 0.45} tint={rewards > 0 ? color.bg : color.amber} />
        {rewards > 1 && <View style={st.n}><Txt size={10} weight="bold" tint={color.bg} center>{rewards}</Txt></View>}
      </View>
    </Row>
  );
}

const st = StyleSheet.create({
  dot: { borderWidth: 1.5, borderColor: color.bar, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: color.ink, borderColor: color.ink },
  gift: { borderColor: color.amber },
  giftOn: { backgroundColor: color.amber },
  n: { position: 'absolute', top: -4, end: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: color.ink, justifyContent: 'center' },
});
