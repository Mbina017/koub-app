// Customer feedback (API 1.39), owner only: ratings and notes customers leave on their order page after pickup.
// Anonymous ones come without a name or order number. The owner sets the Google review link here; with it, a
// 5-star customer is offered "Rate us on Google".
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, font, radius, space } from '../lib/theme';
import { showMessage } from '../lib/confirm';
import { num } from '../lib/format';
import type { FeedbackItem, Lang } from '../lib/types';
import type { T } from '../lib/i18n';
import { Button, ErrorState, Muted, Row, Skeleton, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
const when = (iso: string, lang: Lang) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString(lang === 'ar' ? 'ar-BH' : 'en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

export default function PosFeedback() {
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['feedback'], queryFn: () => api.feedback(session) });
  const d = q.data;
  const [link, setLink] = useState('');
  useEffect(() => { if (d) setLink(d.review_url); }, [d]);
  const save = useMutation({
    mutationFn: (u: string) => api.feedbackSetLink(session, u),
    onSuccess: (r) => { qc.setQueryData(['feedback'], r); showMessage(t('fbSaved'), r.review_url ? t('fbGoogleOn') : t('fbGoogleOff')); },
    onError: (e) => showMessage(t('notUpdated'), e instanceof ApiError && e.message === 'no_route' ? t('needsUpdate') : e instanceof Error ? e.message : ''),
  });
  const changed = !!d && link.trim() !== d.review_url;
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/more' as never))} style={st.iconBtn} accessibilityLabel="back"><Icon name="back" size={24} rtl={lang === 'ar'} /></Touch>
        <Txt size={19} weight="bold" style={{ flex: 1 }}>{t('fbTitle')}</Txt>
      </Row>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl, maxWidth: 640, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={color.ink} />}>
        {q.isError && !d ? <ErrorState onRetry={() => { q.refetch(); }} /> : !d ? [0, 1, 2].map((i) => <Skeleton key={i} h={110} r={radius.lg} />) : (
          <>
            <Row gap={10}>
              <Summary label={t('fbMonth')} avg={d.month.avg} count={d.month.count} t={t} />
              <Summary label={t('fbAll')} avg={d.avg} count={d.count} t={t} />
            </Row>

            <View style={[st.card, { gap: 8 }]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt size={15} weight="semibold">{t('fbGoogle')}</Txt>
                <Txt size={12} weight="semibold" tint={d.review_url ? color.green : color.amber}>{d.review_url ? t('fbGoogleOn') : t('fbGoogleOff')}</Txt>
              </Row>
              <Muted size={12}>{t('fbGoogleHint')}</Muted>
              <TextInput value={link} onChangeText={setLink} placeholder="https://g.page/r/…/review" placeholderTextColor={color.faint}
                autoCapitalize="none" autoCorrect={false} keyboardType="url" style={[st.input, { fontFamily: font.regular }]} />
              {changed && <Button label={t('save')} loading={save.isPending} disabled={save.isPending} onPress={() => save.mutate(link.trim())} />}
              {!changed && !!d.review_url && <Button label={t('fbClear')} kind="light" disabled={save.isPending} onPress={() => { setLink(''); save.mutate(''); }} />}
            </View>

            {d.items.length === 0 ? <Muted center style={{ marginTop: space.lg }}>{t('fbNone')}</Muted> : d.items.map((f, i) => <Entry key={f.at + i} f={f} lang={lang} t={t} />)}

            <Muted size={12} center>{t('fbNote')}</Muted>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Summary({ label, avg, count, t }: { label: string; avg: number | null; count: number; t: T }) {
  return (
    <View style={[st.card, { flex: 1, alignItems: 'center', gap: 2 }]}>
      <Muted size={12}>{label}</Muted>
      <Txt size={30} weight="bold" ltr>{avg === null ? '—' : num(avg, 1)}<Txt size={18} tint={color.amber}> ★</Txt></Txt>
      <Muted size={12}>{t('fbCount', { n: count })}</Muted>
    </View>
  );
}

function Entry({ f, lang, t }: { f: FeedbackItem; lang: Lang; t: T }) {
  const low = f.stars <= 3;
  return (
    <View style={[st.card, { gap: 6 }, low && { borderWidth: 1, borderColor: color.amber }]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt size={18} tint={color.amber} ltr>{stars(f.stars)}</Txt>
        <Muted size={12}>{when(f.at, lang)}</Muted>
      </Row>
      <Txt size={15} tint={f.note ? color.ink : color.faint}>{f.note || t('fbNoNote')}</Txt>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <Muted size={12}>{f.anon ? t('fbAnon') : f.name || '—'}</Muted>
        {!f.anon && f.no ? <Muted size={12}>· {t('fbOrderNo', { n: f.no })}</Muted> : null}
        {low ? <Txt size={12} weight="semibold" tint={color.amber}>· {t('fbLow')}</Txt> : null}
      </Row>
    </View>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: 4, backgroundColor: color.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.bg, paddingHorizontal: 12, fontSize: 14, color: color.ink, textAlign: 'left', writingDirection: 'ltr' },
});
