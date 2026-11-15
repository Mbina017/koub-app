// The POS options sheet (API 1.22): pick the drink of a combined item (Flat white / Latte / Cappuccino…), tap quick
// notes (no sugar, less ice…) or write one, choose how many, and add it to the order as its own line.
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useSession } from '../lib/session';
import { color, font, radius, space } from '../lib/theme';
import { money } from '../lib/format';
import type { PosChoice, PosProduct } from '../lib/types';
import { Button, Muted, Row, Touch, Txt } from './ui';
import { Icon } from './Icon';

export type PosPick = { choice: PosChoice | null; note: string; qty: number };

// Quick notes by kind of drink; the barista reads them on the hand-over list and the receipt.
const QUICK: Record<'hot' | 'cold' | 'other', ('optNoSugar' | 'optLessSugar' | 'optExtraHot' | 'optLessIce' | 'optNoIce')[]> = {
  hot: ['optNoSugar', 'optLessSugar', 'optExtraHot'],
  cold: ['optNoSugar', 'optLessSugar', 'optLessIce', 'optNoIce'],
  other: [],
};

export function PosOptions({ product, onClose, onAdd, onOut, outBusy }: { product: PosProduct | null; onClose: () => void; onAdd: (p: PosProduct, pick: PosPick) => void; onOut?: (p: PosProduct, out: boolean) => void; outBusy?: boolean }) {
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const [choice, setChoice] = useState<PosChoice | null>(null);
  const [quick, setQuick] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [qty, setQty] = useState(1);
  // A fresh sheet for every product.
  useEffect(() => { setChoice(product?.choices?.length === 1 ? product.choices[0] : null); setQuick([]); setText(''); setQty(1); }, [product]);
  if (!product) return null;

  const choices = product.choices ?? [];
  const kind = product.group !== 'drinks' || product.shelf === 'sweets' ? 'other' : product.temp === 'cold' ? 'cold' : 'hot';
  const note = [...quick.map((k) => t(k as never)), text.trim()].filter(Boolean).join('، ').slice(0, 80);
  const ready = !choices.length || !!choice;
  const toggle = (k: string) => setQuick((q) => (q.includes(k) ? q.filter((x) => x !== k) : [...q, k]));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.shade}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('posExit')} />
        <View style={[st.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <View style={st.grip} />
          <Row gap={12} style={{ marginBottom: space.sm }}>
            <View style={st.thumb}>{product.image ? <Image source={product.image} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Icon name="products" size={24} tint={color.faint} />}</View>
            <View style={{ flex: 1 }}>
              <Txt size={18} weight="bold" lines={2}>{product.name}</Txt>
              <Muted>{money(product.price, lang)}</Muted>
            </View>
            <Touch onPress={onClose} style={st.close} accessibilityLabel={t('posExit')}><Icon name="close" size={20} /></Touch>
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.md }} style={{ maxHeight: 420 }}>
            {choices.length > 0 && (
              <View style={{ gap: 8 }}>
                <Txt size={14} weight="semibold">{t('optPick')}</Txt>
                <Row gap={8} style={{ flexWrap: 'wrap' }}>
                  {choices.map((c) => {
                    const on = choice?.key === c.key;
                    return (
                      <Touch key={c.key} onPress={() => setChoice(c)} style={[st.choice, on && st.choiceOn]} accessibilityState={{ selected: on }}>
                        <Txt size={16} weight="semibold" tint={on ? color.bg : color.ink}>{c.label}</Txt>
                      </Touch>
                    );
                  })}
                </Row>
              </View>
            )}
            {kind !== 'other' && (
              <View style={{ gap: 8 }}>
                <Txt size={14} weight="semibold">{t('optNotes')}</Txt>
                <Row gap={8} style={{ flexWrap: 'wrap' }}>
                  {QUICK[kind].map((k) => {
                    const on = quick.includes(k);
                    return (
                      <Touch key={k} onPress={() => toggle(k)} style={[st.chip, on && st.chipOn]} accessibilityState={{ selected: on }}>
                        <Txt size={14} weight="semibold" tint={on ? color.bg : color.ink}>{(on ? '✓ ' : '') + t(k)}</Txt>
                      </Touch>
                    );
                  })}
                </Row>
              </View>
            )}
            <TextInput value={text} onChangeText={setText} placeholder={t('optNotePh')} placeholderTextColor={color.faint} maxLength={60}
              style={[st.input, { textAlign: lang === 'ar' ? 'right' : 'left', fontFamily: font.regular }]} />
          </ScrollView>
          {product.out_today ? (
            // Sold out today: the only thing to do here is put it back.
            <View style={{ marginTop: space.md, gap: 8 }}>
              <Muted center>{t('soldOutToday')}</Muted>
              {onOut && <Button label={t('markBack')} icon="check" loading={outBusy} onPress={() => onOut(product, false)} />}
            </View>
          ) : (
          <>
          <Row gap={12} style={{ marginTop: space.md }}>
            <Row gap={6}>
              <Touch onPress={() => setQty(Math.max(1, qty - 1))} style={st.step} accessibilityLabel="-"><Txt size={20} weight="bold" center>−</Txt></Touch>
              <Txt size={18} weight="bold" style={{ minWidth: 28 }} center>{qty}</Txt>
              <Touch onPress={() => setQty(Math.min(99, qty + 1))} style={st.step} accessibilityLabel="+"><Txt size={20} weight="bold" center>+</Txt></Touch>
            </Row>
            <Button label={t('optAdd', { x: money(product.price * qty, lang) })} icon="plus" disabled={!ready}
              onPress={() => onAdd(product, { choice, note, qty })} style={{ flex: 1 }} />
          </Row>
          {onOut && (
            <Touch onPress={() => onOut(product, true)} disabled={outBusy} style={{ alignSelf: 'center', paddingVertical: 10, marginTop: 4 }}>
              <Txt size={14} weight="semibold" tint={color.red}>{t('markOut')}</Txt>
            </Touch>
          )}
          </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  shade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: color.bg, borderTopLeftRadius: radius.lg + 8, borderTopRightRadius: radius.lg + 8, paddingHorizontal: space.lg, paddingTop: space.sm, width: '100%', maxWidth: 560, alignSelf: 'center' },
  grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: color.line, marginBottom: space.md },
  thumb: { width: 56, height: 56, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.sunken, alignItems: 'center', justifyContent: 'center' },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  choice: { minWidth: 96, paddingHorizontal: 18, paddingVertical: 14, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1.5, borderColor: color.line, alignItems: 'center' },
  choiceOn: { backgroundColor: color.ink, borderColor: color.ink },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: color.sunken },
  chipOn: { backgroundColor: color.ink },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.surface, paddingHorizontal: 12, fontSize: 16, color: color.ink },
  step: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.sunken, justifyContent: 'center' },
});
