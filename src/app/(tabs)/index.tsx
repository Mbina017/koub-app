import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { useApiSession, useSession } from '../../lib/session';
import { color, radius, space, tone } from '../../lib/theme';
import { currency, money, num, pct, today } from '../../lib/format';
import { ordersCount } from '../../lib/i18n';
import type { Home as HomeData, HomePeriod } from '../../lib/types';
import { Card, ErrorState, FadeIn, Muted, Row, Screen, SectionTitle, Segmented, Skeleton, Touch, Txt } from '../../components/ui';
import { SalesLine } from '../../components/Charts';
import { OrderRow } from '../../components/OrderRow';
import { Icon, type IconName } from '../../components/Icon';
import { Logo } from '../../components/Logo';
import { RolePicker } from '../../components/Staff';

const dashboard = {
  ar: {
    title: 'لوحة الإدارة',
    overview: 'المبيعات حسب القناة',
    actions: 'اختصارات',
    pending: 'يحتاج متابعة اليوم',
    clear: 'ما في إجراء عاجل من اللي راجعناها.',
    all: 'عرض كل المتابعات',
    onlyActive: 'عرض المتابعات المفتوحة بس',
    kioskMissing: 'الأرقام مو متوفرة من لوحة الإدارة.',
    trend: 'حركة مبيعات الموقع',
    stale: 'آخر تحديث ما اكتمل. هذي آخر أرقام وصلتنا.',
  },
  en: {
    title: 'Owner dashboard',
    overview: 'Sales by channel',
    actions: 'Quick actions',
    pending: 'Needs attention today',
    clear: 'Nothing urgent in the queues shown here.',
    all: 'Show all queues',
    onlyActive: 'Show open queues only',
    kioskMissing: 'Kiosk figures are unavailable on this dashboard.',
    trend: 'Online sales trend',
    stale: 'Refresh failed. Showing the last figures received.',
  },
} as const;

// A staff account has no Home: its app opens on the till; Work, Orders and More are a tap away.
export default function HomeTab() {
  const { cashier, staffRole } = useSession();
  // Staff (API 1.40): first where they work, then their place's screen.
  if (!cashier) return <Home />;
  return !staffRole ? <RolePicker /> : <Redirect href={(staffRole === 'inside' ? '/work' : '/sell') as never} />;
}

function Home() {
  const session = useApiSession();
  const { t, lang, me } = useSession();
  const [period, setPeriod] = useState<HomePeriod>('today');
  const q = useQuery({ queryKey: ['home', period], queryFn: () => api.home(session, period), refetchInterval: 60_000 });
  const accessRevoked = q.error instanceof ApiError && (q.error.kind === 'auth' || q.error.kind === 'forbidden');
  const d = accessRevoked ? undefined : q.data;

  const copy = dashboard[lang];
  const header = (
    <View style={st.header}>
      <Row style={st.masthead}>
        <View style={{ flex: 1 }}>
          <Logo width={98} />
          <Muted size={13} style={{ marginTop: space.xs }}>{today(new Date(), lang)}</Muted>
        </View>
        <Touch onPress={() => router.push('/more')} style={st.avatar} accessibilityLabel={t('account')}>
          <Txt size={16} weight="semibold" tint={color.bg} center>{me?.initial ?? 'K'}</Txt>
        </Touch>
      </Row>
      <Txt size={33} weight="bold" style={st.title}>{copy.title}</Txt>
      <Muted size={13} style={st.actionLabel}>{copy.actions}</Muted>
      <View style={st.shortcuts}>
        <Shortcut icon="cash" title={t('posOpen')} primary onPress={() => router.push('/pos')} />
        <Shortcut icon="check" title={t('work')} onPress={() => router.push('/work' as never)} />
        <Shortcut icon="plus" title={t('newOrder')} onPress={() => router.push('/order-new')} />
      </View>
    </View>
  );

  return (
    <Screen header={header} refreshing={q.isRefetching} onRefresh={q.refetch}>
      {q.isError && d && <Muted size={14} tint={color.amber} style={st.stale}>{copy.stale}</Muted>}
      {q.isError && !d ? <ErrorState onRetry={q.refetch} /> : !d ? <HomeSkeleton /> : (
        <HomeBody d={d} period={period} onPeriod={setPeriod} />
      )}
    </Screen>
  );
}

function HomeBody({ d, period, onPeriod }: { d: HomeData; period: HomePeriod; onPeriod: (p: HomePeriod) => void }) {
  const { t, lang } = useSession();
  const copy = dashboard[lang];
  const [showAllQueues, setShowAllQueues] = useState(false);
  const change = pct(d.profit.change_pct);
  const label = { today: t('netProfitToday'), yesterday: t('netProfitYesterday'), month: t('netProfitMonth') }[period];
  const vs = { today: t('vsYesterday'), yesterday: t('vsDayBefore'), month: t('vsMonth') }[period];
  const n = d.needs;
  const prepBy = (
    [['bahrain', t('bahrain')], ['international', t('gcc')], ['pickup', t('pickup')], ['unknown', t('noAddress')]] as const
  ).filter(([k]) => n.prepare.by[k]).map(([k, l]) => n.prepare.by[k] + ' ' + l).join(' · ');
  type Queue = Omit<Parameters<typeof Tile>[0], 'onPress'> & { active: boolean; go: () => void };
  const queues: Queue[] = [
    { icon: 'truck', tint: 'amber', title: t('toPrepare'), value: num(n.prepare.count, 0), sub: prepBy || t('nothingWaiting'), active: n.prepare.count > 0, go: () => router.push({ pathname: '/orders', params: { view: 'active' } }) },
  ];
  if (d.work?.unpaid) queues.push({ icon: 'cash', tint: 'red', title: t('unpaidTitle'), value: num(d.work.unpaid.count, 0), sub: d.work.unpaid.count ? money(d.work.unpaid.value, lang) : t('noneWaiting'), active: d.work.unpaid.count > 0, go: () => router.push('/unpaid') });
  queues.push(
    { icon: 'cash', tint: 'amber', title: t('cashWithCourier'), value: money(n.cod.amount, lang), sub: n.cod.count ? t('notCollected', { n: ordersCount(n.cod.count, lang) }) : t('allCollected'), active: n.cod.count > 0, go: () => router.push({ pathname: '/orders', params: { view: 'cod' } }) },
    { icon: 'whatsapp', tint: 'red', title: t('waNotDelivered'), value: num(n.whatsapp.count, 0), sub: n.whatsapp.order_id ? t('orderNo', { n: n.whatsapp.order_id }) : t('allDelivered'), active: n.whatsapp.count > 0, go: () => (n.whatsapp.order_id ? router.push({ pathname: '/order/[id]', params: { id: String(n.whatsapp.order_id) } }) : router.push('/orders')) },
    { icon: 'gift', tint: 'blue', title: t('giftNeedsAddress'), value: num(n.gifts.count, 0), sub: n.gifts.count ? '' : t('noneWaiting'), active: n.gifts.count > 0, go: () => router.push({ pathname: '/orders', params: { view: 'gifts' } }) },
  );
  if (d.work) {
    queues.push({ icon: 'truck', tint: 'blue', title: t('outToday'), value: num(d.work.run.count, 0), sub: d.work.run.cod ? t('collectX', { x: money(d.work.run.cod, lang) }) : d.work.run.total ? t('openRun') : t('noneWaiting'), active: d.work.run.count > 0 || d.work.run.total > 0, go: () => router.push('/run') });
    if (n.preorder > 0) queues.push({ icon: 'products', tint: 'amber', title: t('preorderReady'), value: num(d.work.preorder_ready, 0), sub: t('preorderWaiting', { n: ordersCount(n.preorder, lang) }), active: n.preorder > 0, go: () => router.push('/preorders') });
  }
  const displayedQueues = showAllQueues ? queues : queues.filter((item) => item.active);
  const notes: { tone: keyof typeof tone; text: string; go: () => void }[] = [];
  if (n.preorder) notes.push({ tone: 'amber', text: t('preorderWaiting', { n: ordersCount(n.preorder, lang) }), go: () => (d.work ? router.push('/preorders') : router.push({ pathname: '/orders', params: { view: 'preorder' } })) });
  if (d.stock.out || d.stock.low) notes.push({ tone: 'amber', text: [d.stock.out ? t('stockOut', { n: d.stock.out }) : '', d.stock.low ? t('stockLow', { n: d.stock.low }) : ''].filter(Boolean).join(' · '), go: () => router.push({ pathname: '/products', params: { filter: d.stock.out ? 'out' : 'low' } }) });
  if (!d.profit.exact) notes.push({ tone: 'muted', text: t('missingCosts'), go: () => router.push('/numbers') });

  return (
    <FadeIn>
      <SectionTitle title={copy.pending} />
      {displayedQueues.length > 0 ? (
        <View style={st.tiles}>
          {displayedQueues.map(({ go, ...item }) => <Tile key={item.title} {...item} onPress={go} />)}
        </View>
      ) : (
        <View style={st.clear}>
          <Icon name="check" size={18} tint={color.green} />
          <Txt size={14} weight="medium" tint={color.green} style={{ flex: 1 }}>{copy.clear}</Txt>
        </View>
      )}
      {queues.some((item) => !item.active) && (
        <Touch onPress={() => setShowAllQueues(!showAllQueues)} style={st.queueToggle}
          accessibilityState={{ expanded: showAllQueues }}>
          <Txt size={14} weight="semibold" center>{showAllQueues ? copy.onlyActive : copy.all}</Txt>
        </Touch>
      )}

      <SectionTitle title={copy.overview} />
      <Segmented items={[['today', t('today')], ['yesterday', t('yesterday')], ['month', t('month')]]} value={period} onChange={onPeriod} />
      <View style={st.channels}>
        <Card style={st.channel} padded={false}>
          <View style={st.onlineHero}>
            <Row gap={8}>
              <Icon name="globe" size={20} tint={color.bg} />
              <Txt size={17} weight="semibold" tint={color.bg} style={{ flex: 1 }}>{t('online')}</Txt>
            </Row>
            <Muted size={14} tint={color.line}>{label + (d.profit.exact ? '' : ' · ' + t('estimate'))}</Muted>
            <Txt size={36} weight="bold" tint={color.bg} style={st.money}>{money(d.profit.value, lang)}</Txt>
            {change && <View style={[st.delta, { backgroundColor: change.up ? color.greenBg : color.redBg }]}><Txt size={12} weight="semibold" tint={change.up ? color.green : color.red}>{change.text + ' ' + vs}</Txt></View>}
            <Muted size={14} tint={color.line}>{t('fromSales', { sales: money(d.sales, lang), orders: ordersCount(d.orders, lang) })}</Muted>
          </View>
          {d.spark.length > 0 && (
            <View style={st.chart}>
              <Txt size={14} weight="semibold">{copy.trend}</Txt>
              <SalesLine points={d.spark} rtl={lang === 'ar'} height={76} />
            </View>
          )}
        </Card>
        <Card style={[st.channel, st.kiosk]} padded={false}>
          <View style={st.kioskBody}>
            <Row gap={8}>
              <Icon name="store" size={20} />
              <Txt size={17} weight="semibold" style={{ flex: 1 }}>{t('kioskTitle')}</Txt>
            </Row>
            {d.shop ? (
              <>
                <Muted size={14}>{t('booksResult') + (d.shop.exact ? '' : ' · ' + t('estimate'))}</Muted>
                <Txt size={36} weight="bold" tint={d.shop.profit < 0 ? color.red : color.ink} style={st.money}>{money(d.shop.profit, lang)}</Txt>
                <Muted size={14}>{t('shopLine', { x: money(d.shop.sales, lang), n: t('booksSalesN', { n: d.shop.count }), e: money(d.shop.expenses, lang) })}</Muted>
              </>
            ) : <Muted size={15}>{copy.kioskMissing}</Muted>}
          </View>
          <Touch onPress={() => router.push('/pos-books')} style={st.channelAction} accessibilityLabel={t('books')}>
            <Txt size={14} weight="semibold" style={{ flex: 1 }}>{t('books')}</Txt>
            <Icon name="chevron" size={18} tint={color.muted} rtl={lang === 'ar'} />
          </Touch>
        </Card>
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

function Shortcut({ icon, title, onPress, primary = false }: { icon: IconName; title: string; onPress: () => void; primary?: boolean }) {
  const fg = primary ? color.bg : color.ink;
  return (
    <Touch onPress={onPress} style={[st.shortcut, primary && st.shortcutPrimary]} accessibilityLabel={title}>
      <Icon name={icon} size={19} tint={fg} />
      <Txt size={13} weight="semibold" tint={fg} center>{title}</Txt>
    </Touch>
  );
}

function Tile({ icon, tint, title, value, sub, active, onPress }: { icon: IconName; tint: 'amber' | 'blue' | 'red'; title: string; value: string; sub: string; active: boolean; onPress: () => void }) {
  const zero = !active;
  return (
    <Touch onPress={onPress} style={st.tile} accessibilityLabel={[title, value, sub].filter(Boolean).join(', ')}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt size={13} weight="semibold" tint={zero ? color.muted : tone[tint].fg} style={{ flex: 1 }}>{title}</Txt>
        <View style={[st.tileIcon, { backgroundColor: zero ? color.sunken : tone[tint].bg }]}><Icon name={icon} size={16} tint={zero ? color.muted : tone[tint].fg} /></View>
      </Row>
      <Txt size={24} weight="bold" style={[st.money, { marginTop: 2 }]}>{value}</Txt>
      {sub ? <Muted size={13}>{sub}</Muted> : null}
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
  header: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  masthead: { justifyContent: 'space-between', alignItems: 'center' },
  title: { marginTop: space.md },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { marginTop: space.md, marginBottom: space.sm },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  shortcut: { flexGrow: 1, flexShrink: 1, flexBasis: 92, minHeight: 64, paddingHorizontal: space.sm, paddingVertical: space.sm, alignItems: 'center', justifyContent: 'center', gap: space.xs, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line },
  shortcutPrimary: { backgroundColor: color.ink, borderColor: color.ink },
  channels: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md },
  channel: { flexGrow: 1, flexShrink: 1, flexBasis: 310, minWidth: 0, overflow: 'hidden' },
  onlineHero: { backgroundColor: color.ink, padding: space.lg, gap: space.xs },
  chart: { padding: space.lg, gap: space.sm },
  kiosk: { backgroundColor: color.surface },
  kioskBody: { flex: 1, padding: space.lg, gap: space.xs },
  channelAction: { flexDirection: 'row', alignItems: 'center', minHeight: 50, paddingHorizontal: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  money: { fontVariant: ['tabular-nums'] },
  stale: { backgroundColor: color.amberBg, padding: space.md, borderRadius: radius.md, marginTop: space.md },
  delta: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1 },
  clear: { flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.sm, backgroundColor: color.greenBg, borderRadius: radius.md },
  queueToggle: { marginTop: space.sm, minHeight: 46, justifyContent: 'center', paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: color.line, alignSelf: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: 136, flexGrow: 1, flexShrink: 1, minHeight: 104, backgroundColor: color.surface, borderRadius: radius.md, padding: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, gap: 2 },
  tileIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, backgroundColor: color.sunken, marginVertical: space.md, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: color.ink },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.lg, paddingVertical: space.md },
  noteSep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
