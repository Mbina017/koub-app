// The day's delivery run: what is out today (and cash still out from earlier), by area, ready to hand to the driver.
import { useState } from 'react';
import { Linking, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useApiSession, useSession } from '../lib/session';
import { color, radius, space } from '../lib/theme';
import { money } from '../lib/format';
import type { Run, RunRow } from '../lib/types';
import { sharePdf } from '../lib/print';
import { showMessage } from '../lib/confirm';
import { Button, Empty, ErrorState, Muted, Row, Skeleton, TagChip, Touch, Txt } from '../components/ui';
import { Icon } from '../components/Icon';

const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

// One A4 sheet for the driver: by area, the number to call, the address and the cash to collect, with a tick box.
function runHtml(r: Run, t: ReturnType<typeof useSession>['t'], lang: 'ar' | 'en') {
  const areas = [...new Set(r.rows.map((x) => x.area))];
  const body = areas.map((a) => '<h2>' + esc(a) + '</h2><table>' + r.rows.filter((x) => x.area === a).map((x) =>
    '<tr><td class="n">#' + esc(x.number) + '</td><td><b>' + esc(x.name) + '</b><br>' + esc(x.address || '—') + '<br><small>' + esc(x.items) + '</small></td><td class="ph" dir="ltr">' + (x.call ? '+' + esc(x.call) : '') + '</td><td class="c">' + (x.cod_due !== null ? '<b>' + esc(money(x.cod_due, lang)) + '</b>' : esc(t('paidShort'))) + '</td><td class="tick">☐</td></tr>').join('') + '</table>').join('');
  return '<!doctype html><html dir="' + (lang === 'ar' ? 'rtl' : 'ltr') + '"><head><meta charset="utf-8"><style>body{font:13px -apple-system,Arial,sans-serif;margin:24px;color:#2b241f}h1{font-size:20px;margin:0}h2{font-size:15px;margin:18px 0 6px;border-bottom:2px solid #2b241f}table{width:100%;border-collapse:collapse}td{padding:8px 6px;border-bottom:1px solid #ddd;vertical-align:top}.n{white-space:nowrap;font-weight:bold}.ph{white-space:nowrap}.c{white-space:nowrap;text-align:center}.tick{font-size:20px;text-align:center}.sum{margin-top:6px;color:#555}</style></head><body><h1>KOUB · ' + esc(t('runTitle')) + ' · ' + esc(r.date) + '</h1><div class="sum">' + esc(t('runSummary', { n: r.count, x: money(r.cod_total, lang), c: r.cod_count })) + '</div>' + body + '</body></html>';
}

export default function DeliveryRun() {
  const session = useApiSession();
  const { t, lang } = useSession();
  const insets = useSafeAreaInsets();
  const [sharing, setSharing] = useState(false);
  const q = useQuery({ queryKey: ['run'], queryFn: () => api.run(session) });
  const r = q.data;
  const sections = r ? [...new Set(r.rows.map((x) => x.area))].map((a) => ({ title: a, data: r.rows.filter((x) => x.area === a) })) : [];
  const share = async () => {
    if (!r) return;
    setSharing(true);
    try { await sharePdf(runHtml(r, t, lang), 'KOUB-run-' + r.date); } catch (e) { showMessage(t('notPrinted'), (e as Error).message); } finally { setSharing(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Row style={[st.top, { paddingTop: insets.top + 6 }]}>
        <Touch onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={st.iconBtn} accessibilityLabel="back">
          <Icon name="back" size={24} rtl={lang === 'ar'} />
        </Touch>
        <View style={{ flex: 1 }}>
          <Txt size={19} weight="bold">{t('runTitle')}</Txt>
          {r && <Muted size={12}>{t('runSummary', { n: r.count, x: money(r.cod_total, lang), c: r.cod_count })}</Muted>}
        </View>
      </Row>
      {q.isError && !r ? <ErrorState onRetry={() => { q.refetch(); }} /> : !r ? (
        <View style={{ padding: space.lg, gap: space.md }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={120} r={radius.lg} />)}</View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(x) => String(x.id)}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: insets.bottom + 110 }}
          ListEmptyComponent={<Empty title={t('runEmpty')} body={t('runEmptyHint')} icon="truck" />}
          renderSectionHeader={({ section }) => <Txt size={15} weight="bold" style={{ marginTop: space.md, marginBottom: space.xs }}>{section.title + ' · ' + section.data.length}</Txt>}
          renderItem={({ item }) => <Stop x={item} />}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={color.ink} />}
        />
      )}
      {r && r.count > 0 && (
        <View style={[st.bar, { paddingBottom: insets.bottom + space.md }]}>
          <Button label={t('runShare')} icon="print" loading={sharing} onPress={share} />
        </View>
      )}
    </View>
  );
}

function Stop({ x }: { x: RunRow }) {
  const { t, lang } = useSession();
  return (
    <View style={st.card}>
      <Touch onPress={() => router.push({ pathname: '/order/[id]', params: { id: String(x.id) } })} haptic={false}>
        <Row style={{ justifyContent: 'space-between' }} align="flex-start">
          <View style={{ flex: 1, gap: 2 }}>
            <Txt size={15} weight="semibold">{'#' + x.number + ' · ' + x.name}</Txt>
            <Muted size={13}>{x.address || t('noAddress')}</Muted>
            <Muted size={12} lines={1}>{x.items}</Muted>
          </View>
          {x.cod_due !== null ? <TagChip label={t('collectX', { x: money(x.cod_due, lang) })} tone="amber" small /> : <TagChip label={t('paidShort')} tone="green" small />}
        </Row>
      </Touch>
      {!x.today && <Muted size={12} tint={color.amber}>{t('runEarlier')}</Muted>}
      <Row gap={8}>
        <Mini icon="phone" label={t('call')} disabled={!x.call} onPress={() => Linking.openURL('tel:+' + x.call)} />
        <Mini icon="whatsapp" label={t('whatsapp')} disabled={!x.whatsapp} onPress={() => Linking.openURL('https://wa.me/' + x.whatsapp)} />
        <Mini icon="pin" label={t('map')} disabled={!x.map} onPress={() => x.map && Linking.openURL(x.map)} />
      </Row>
    </View>
  );
}

function Mini({ icon, label, onPress, disabled }: { icon: 'phone' | 'whatsapp' | 'pin'; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Touch onPress={onPress} disabled={disabled} style={[st.mini, disabled && { opacity: 0.35 }]}>
      <Row gap={6} style={{ justifyContent: 'center' }}><Icon name={icon} size={17} /><Txt size={13} weight="medium">{label}</Txt></Row>
    </Touch>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space.md, paddingBottom: space.sm, gap: space.sm },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, marginBottom: space.sm },
  mini: { flex: 1, height: 40, borderRadius: radius.md, backgroundColor: color.sunken, justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: color.bg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: color.line },
});
