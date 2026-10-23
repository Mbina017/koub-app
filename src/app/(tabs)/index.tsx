import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useApiSession, useSession } from '../../lib/session';
import { color, font, radius, space, tone } from '../../lib/theme';
import { currency, money, num, pct, today } from '../../lib/format';
import { ordersCount } from '../../lib/i18n';
import type { Home as HomeData, HomePeriod } from '../../lib/types';
import { Card, ErrorState, FadeIn, Muted, Row, Screen, SectionTitle, Segmented, Skeleton, Touch, Txt } from '../../components/ui';
import { SalesLine } from '../../components/Charts';
import { OrderRow } from '../../components/OrderRow';
import { Icon, type IconName } from '../../components/Icon';

export default function Home() {
  const session = useApiSession();
  const { t, lang, me } = useSession();
  const [period, setPeriod] = useState<HomePeriod>('today');
  const q = useQuery({ queryKey: ['home', period], queryFn: () => api.home(session, period), refetchInterval: 60_000 });
  const d = q.data;

  const header = (
    <Row style={{ justifyContent: 'space-between', paddingHorizontal: space.lg, paddingBottom: space.md }}>
      <View>
        <Txt size={30} style={{ fontFamily: font.brand, letterSpacing: 3, lineHeight: 36 }} ltr>KOUB</Txt>
        <Muted>{today(new Date(), lang)}</Muted>
      </View>
      <Row gap={8}>
        {/* The shop till, one tap from home. */}
        <Touch onPress={() => router.push('/pos')} style={st.till} accessibilityLabel={t('pos')}>
          <Icon name="cash" size={18} tint={color.bg} />
          <Txt size={14} weight="semibold" tint={color.bg}>{t('pos')}</Txt>
        </Touch>
        <Touch onPress={() => router.push('/more')} style={st.avatar} accessibilityLabel={t('account')}>
          <Txt size={16} weight="semibold" tint={color.bg} center>{me?.initial ?? 'K'}</Txt>
        </Touch>
      </Row>
    </Row>
  );

  return (
    <Screen header={header} refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Segmented items={[['today', t('today')], ['7days', t('week')], ['month', t('month')]]} value={period} onChange={setPeriod} />
      {q.isError && !d ? <ErrorState onRetry={q.refetch} /> : !d ? <HomeSkeleton /> : <HomeBody d={d} period={period} />}
    </Screen>
  );
}

function HomeBody({ d, period }: { d: HomeData; period: HomePeriod }) {
  const { t, lang } = useSession();
  const change = pct(d.profit.change_pct);
  const label = { today: t('netProfitToday'), '7days': t('netProfitWeek'), month: t('netProfitMonth') }[period];
  const vs = { today: t('vsYesterday'), '7days': t('vsWeek'), month: t('vsMonth') }[period];
  const n = d.needs;
  const prepBy = (
    [['bahrain', t('bahrain')], ['international', t('gcc')], ['pickup', t('pickup')], ['unknown', t('noAddress')]] as const
  ).filter(([k]) => n.prepare.by[k]).map(([k, l]) => n.prepare.by[k] + ' ' + l).join(' · ');
  const notes: { tone: keyof typeof tone; text: string; go: () => void }[] = [];
  if (n.preorder) notes.push({ tone: 'amber', text: t('preorderWaiting', { n: ordersCount(n.preorder, lang) }), go: () => (d.work ? router.push('/preorders') : router.push({ pathname: '/orders', params: { view: 'preorder' } })) });
  if (d.stock.out || d.stock.low) notes.push({ tone: 'amber', text: [d.stock.out ? t('stockOut', { n: d.stock.out }) : '', d.stock.low ? t('stockLow', { n: d.stock.low }) : ''].filter(Boolean).join(' · '), go: () => router.push({ pathname: '/products', params: { filter: d.stock.out ? 'out' : 'low' } }) });
  if (!d.profit.exact) notes.push({ tone: 'muted', text: t('missingCosts'), go: () => router.push('/numbers') });

  return (
    <FadeIn>
      {/* Headline profit */}
      <View style={{ marginTop: space.xl }}>
        <Muted size={14}>{(d.shop ? t('online') + ' · ' : '') + label + (d.profit.exact ? '' : ' · ' + t('estimate'))}</Muted>
        <Row gap={8} align="flex-end" style={{ marginTop: 2 }}>
          <Txt size={52} weight="bold" style={{ lineHeight: 60, letterSpacing: -1.5 }} ltr>{num(d.profit.value)}</Txt>
          <Txt size={18} weight="medium" tint={color.muted} style={{ marginBottom: 10 }}>{currency(lang)}</Txt>
        </Row>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <Muted size={14}>{t('fromSales', { sales: money(d.sales, lang), orders: ordersCount(d.orders, lang) })}</Muted>
          {change && <View style={[st.delta, { backgroundColor: change.up ? color.greenBg : color.redBg }]}><Txt size={12} weight="semibold" tint={change.up ? color.green : color.red}>{change.text + ' ' + vs}</Txt></View>}
        </Row>
        <View style={{ marginTop: space.lg }}><SalesLine points={d.spark} rtl={lang === 'ar'} /></View>
      </View>

      {/* The shop till's own books: shown beside the online figures, never added to them. */}
      {d.shop && (
        <Touch onPress={() => router.push('/pos-books')} style={st.shop}>
          <Icon name="store" size={20} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt size={15} weight="semibold">{t('books') + (d.shop.exact ? '' : ' · ' + t('estimate'))}</Txt>
            <Muted size={13}>{t('shopLine', { x: money(d.shop.sales, lang), n: t('booksSalesN', { n: d.shop.count }), e: money(d.shop.expenses, lang) })}</Muted>
          </View>
          <Txt size={16} weight="bold" tint={d.shop.profit < 0 ? color.red : color.ink} ltr>{num(d.shop.profit)}</Txt>
          <Icon name="chevron" size={16} tint={color.faint} rtl={lang === 'ar'} />
        </Touch>
      )}

      {/* Needs you */}
      <SectionTitle title={t('needsYou')} />
      <View style={st.tiles}>
        <Tile icon="truck" tint="amber" title={t('toPrepare')} value={String(n.prepare.count)} sub={prepBy || t('nothingWaiting')} onPress={() => router.push({ pathname: '/orders', params: { view: 'active' } })} />
        <Tile icon="cash" tint="amber" title={t('cashWithCourier')} value={num(n.cod.amount)} sub={n.cod.count ? t('notCollected', { n: ordersCount(n.cod.count, lang) }) : t('allCollected')} onPress={() => router.push({ pathname: '/orders', params: { view: 'cod' } })} />
        {d.work && <Tile icon="truck" tint="blue" title={t('outToday')} value={String(d.work.run.count)} sub={d.work.run.cod ? t('collectX', { x: money(d.work.run.cod, lang) }) : d.work.run.total ? t('openRun') : t('noneWaiting')} onPress={() => router.push('/run')} />}
        {d.work && n.preorder > 0 && <Tile icon="products" tint="amber" title={t('preorderReady')} value={String(d.work.preorder_ready)} sub={t('preorderWaiting', { n: ordersCount(n.preorder, lang) })} onPress={() => router.push('/preorders')} />}
        {d.work?.unpaid && <Tile icon="cash" tint="red" title={t('unpaidTitle')} value={String(d.work.unpaid.count)} sub={d.work.unpaid.count ? money(d.work.unpaid.value, lang) : t('noneWaiting')} onPress={() => router.push('/unpaid')} />}
        <Tile icon="gift" tint="blue" title={t('giftNeedsAddress')} value={String(n.gifts.count)} sub={n.gifts.count ? '' : t('noneWaiting')} onPress={() => router.push({ pathname: '/orders', params: { view: 'gifts' } })} />
        <Tile icon="whatsapp" tint="red" title={t('waNotDelivered')} value={String(n.whatsapp.count)} sub={n.whatsapp.order_id ? t('orderNo', { n: n.whatsapp.order_id }) : t('allDelivered')} onPress={() => (n.whatsapp.order_id ? router.push({ pathname: '/order/[id]', params: { id: String(n.whatsapp.order_id) } }) : router.push('/orders'))} />
      </View>

      {/* Monthly goal */}
      <Card style={{ marginTop: space.md }}>
        {d.goal.goal ? (
          <>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt size={16} weight="semibold">{t('goalFor', { m: d.goal.month })}</Txt>
              <Muted>{t('goalOf', { a: num(d.goal.revenue, 0), b: num(d.goal.goal, 0) }) + ' ' + currency(lang)}</Muted>
            </Row>
            <View style={st.track}><View style={[st.fill, { width: `${d.goal.pct ?? 0}%` }]} /></View>
            <Muted>{(d.goal.pct ?? 0) >= 100 ? t('goalReached') : t('goalNeed', { p: d.goal.pct ?? 0, d: d.goal.days_left, x: money(d.goal.need_per_day ?? 0, lang) })}</Muted>
          </>
        ) : (
          <>
            <Txt size={16} weight="semibold">{t('setGoalFor', { m: d.goal.month })}</Txt>
            <Muted style={{ marginTop: 2 }}>{t('goalHint')}</Muted>
          </>
        )}
      </Card>

      {/* Visitors */}
      {d.visitors && (
        <Card style={{ marginTop: space.md }}>
          <Row gap={6}><Icon name="users" size={18} /><Txt size={16} weight="semibold">{t('visitors')}</Txt></Row>
          <Row style={{ marginTop: space.md }}>
            <Fig value={num(d.visitors.visitors, 0)} label={t('visitorsShort')} />
            <Fig value={num(d.visitors.pageviews, 0)} label={t('pageviews')} />
            <Fig value={d.visitors.visitors ? num((100 * d.visitors.orders) / d.visitors.visitors, 1) + '%' : '–'} label={t('ordered', { n: d.visitors.orders })} />
          </Row>
        </Card>
      )}

      {/* Signals */}
      {notes.length > 0 && (
        <Card style={{ marginTop: space.md }} padded={false}>
          <Row gap={6} style={{ padding: space.lg, paddingBottom: space.xs }}><Icon name="bulb" size={18} /><Txt size={16} weight="semibold">{t('todayNotes')}</Txt></Row>
          {notes.map((x, i) => (
            <Touch key={i} onPress={x.go} style={[st.note, i < notes.length - 1 && st.noteSep]}>
              <View style={[st.dot, { backgroundColor: tone[x.tone].fg }]} />
              <Txt size={14} style={{ flex: 1 }}>{x.text}</Txt>
              <Icon name="chevron" size={16} tint={color.faint} rtl={lang === 'ar'} />
            </Touch>
          ))}
        </Card>
      )}

      {/* Latest orders */}
      <SectionTitle title={t('latestOrders')} action={t('seeAll')} onAction={() => router.push({ pathname: '/orders', params: { view: 'all' } })} />
      <Card padded={false}>
        {d.latest.length ? d.latest.map((o, i) => <OrderRow key={o.id} o={o} last={i === d.latest.length - 1} compact />) : <Muted center style={{ padding: space.xl }}>{t('noOrders')}</Muted>}
      </Card>
    </FadeIn>
  );
}

function Tile({ icon, tint, title, value, sub, onPress }: { icon: IconName; tint: 'amber' | 'blue' | 'red'; title: string; value: string; sub: string; onPress: () => void }) {
  const zero = value === '0' || value === '0.0';
  return (
    <Touch onPress={onPress} style={st.tile}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt size={13} weight="semibold" tint={zero ? color.muted : tone[tint].fg} style={{ flex: 1 }} lines={2}>{title}</Txt>
        <View style={[st.tileIcon, { backgroundColor: zero ? color.sunken : tone[tint].bg }]}><Icon name={icon} size={16} tint={zero ? color.muted : tone[tint].fg} /></View>
      </Row>
      <Txt size={30} weight="bold" style={{ letterSpacing: -0.5, marginTop: 2 }} ltr>{value}</Txt>
      <Muted size={12} lines={2}>{sub || ' '}</Muted>
    </Touch>
  );
}

function Fig({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Txt size={22} weight="bold" ltr>{value}</Txt>
      <Muted size={12}>{label}</Muted>
    </View>
  );
}

function HomeSkeleton() {
  return (
    <View style={{ marginTop: space.xl, gap: space.md }}>
      <Skeleton w={140} h={14} />
      <Skeleton w={210} h={52} r={12} />
      <Skeleton w={240} h={14} />
      <Skeleton h={96} r={12} />
      <View style={st.tiles}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={118} r={radius.lg} style={{ width: '48.5%' }} />)}</View>
      <Skeleton h={90} r={radius.lg} />
    </View>
  );
}

const st = StyleSheet.create({
  shop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: space.lg, padding: space.md, borderRadius: radius.lg, backgroundColor: color.surface },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center' },
  till: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: color.ink },
  delta: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'space-between' },
  tile: { width: '48.2%', minHeight: 128, backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, gap: 2 },
  tileIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, backgroundColor: color.sunken, marginVertical: space.md, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: color.ink },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.lg, paddingVertical: space.md },
  noteSep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
