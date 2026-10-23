// App chrome strings. Data labels (tags, statuses, messages) come translated from the API.
import type { Lang } from './types';

const ar = {
  home: 'الرئيسية', orders: 'الطلبات', products: 'المنتجات', numbers: 'الأرقام', more: 'المزيد',
  today: 'اليوم', week: 'الأسبوع', month: 'الشهر', yesterday: 'أمس', days7: '7 أيام', dates: 'تاريخ',
  netProfitToday: 'صافي ربح اليوم', netProfitWeek: 'صافي الربح · آخر 7 أيام', netProfitMonth: 'صافي ربح الشهر', netProfit: 'صافي الربح',
  estimate: 'تقريبي', fromSales: 'من {sales} مبيعات · {orders}', vsYesterday: 'عن أمس', vsWeek: 'عن الأسبوع اللي قبله', vsMonth: 'عن الشهر اللي قبله', vsPrev: 'عن الفترة اللي قبلها',
  missingCosts: 'فيه تكاليف ناقصة، فالربح تقريبي',
  needsYou: 'يحتاجك', toPrepare: 'للتحضير', cashWithCourier: 'كاش عند المندوب', giftNeedsAddress: 'هدية تنتظر عنوان', waNotDelivered: 'واتساب ما وصل',
  nothingWaiting: 'ما في شي ينتظر', allCollected: 'كله انحصل', notCollected: '{n} ما انحصل', noneWaiting: 'ما في', allDelivered: 'كله وصل', orderNo: 'طلب #{n}',
  bahrain: 'البحرين', gcc: 'الخليج', pickup: 'استلام', noAddress: 'بدون عنوان',
  goalFor: 'هدف {m}', setGoalFor: 'حط هدف لشهر {m}', goalOf: '{a} من {b}', goalReached: 'وصلت الهدف. عساك عالقوة.', goalNeed: '{p}% وباقي {d} يوم. تحتاج {x} باليوم.', goalHint: 'تابع مبيعاتك مقابل هدف شهري من لوحة التحكم.',
  todayNotes: 'ملاحظات اليوم', latestOrders: 'آخر الطلبات', all: 'الكل', noOrders: 'ما في طلبات للحين.', seeAll: 'الكل',
  visitors: 'زوار الموقع', visitorsShort: 'زائر', pageviews: 'صفحة انشافت', ordered: 'طلبوا ({n})',
  stockOut: '{n} منتجات خلصت', stockLow: '{n} قرّبت تخلص', preorderWaiting: '{n} تنتظر وصول منتج الطلب المسبق',
  search: 'رقم الطلب، الاسم أو الرقم', searchProducts: 'اسم المنتج', allClear: 'كل شي خالص', emptyList: 'ما في طلبات في هالقائمة الحين.', noMatch: 'ما في نتائج تطابق البحث.',
  viewActive: 'للتحضير', viewPreorder: 'طلب مسبق', viewCod: 'كاش للتحصيل', viewGifts: 'هدايا بدون عنوان', viewAll: 'الكل',
  loadMore: 'حمّل أكثر', retry: 'جرّب مرة ثانية', offline: 'ما قدرنا نوصل للمتجر', offlineHint: 'تأكد من الإنترنت وجرّب مرة ثانية.',
  order: 'طلب #{n}', customer: 'العميل', buyer: 'المرسل', firstOrder: 'أول طلب له', nthOrder: 'طلبه رقم {n}', spentSoFar: '{x} لين الحين',
  whatsapp: 'واتساب', call: 'اتصال', copy: 'نسخ', copied: 'انتسخ', pickupFromKoub: 'استلام من KOUB', waitingRecipient: 'ننتظر المستلم يضيف عنوانه',
  giftFor: 'هدية لـ {n}', senderHidden: 'اسم المرسل مخفي عن المستلم', senderShown: 'اسم المرسل ظاهر', customerNote: 'ملاحظة العميل',
  items: 'المنتجات', qty: 'الكمية {n}', discount: 'خصم', delivery: 'التوصيل', refunded: 'مسترجع', total: 'الإجمالي',
  yourProfit: 'ربحك من الطلب', atMost: 'بحد أقصى ', productCost: 'تكلفة المنتجات', bag: 'الكيس', paymentFee: 'رسوم الدفع', actualDelivery: 'تكلفة التوصيل الفعلية', missing: 'ناقصة', estShort: 'تقريبي', beforeAds: 'قبل مصاريف الإعلانات.',
  messagesLog: 'رسائل العميل والسجل', noMessages: 'ما في رسائل للعميل في هالطلب.', fullLog: 'سجل الطلب الكامل', sentToCustomer: 'انرسلت للعميل',
  progress: 'مراحل الطلب', awaitingPayment: 'ينتظر الدفع', orderedCash: 'انطلب · كاش', orderedPaid: 'انطلب ودفع', preparing: 'التحضير', outForDelivery: 'طلع للتوصيل', readyPickup: 'جاهز للاستلام', now: 'الحين',
  testOrder: 'طلب تجربة: لا تحضّره ولا تراسل العميل.',
  actionsOnDashboard: 'المتجر يحتاج تحديث koub-tap عشان تسوي الإجراءات من التطبيق. الحين افتح الطلب من لوحة التحكم.',
  printSlip: 'اطبع البوليصة', printSlips: 'اطبع البوليصات', shareSlips: 'البوليصة · مشاركة وطباعة', notPrinted: 'ما انطبعت', needsUpdate: 'المتجر يحتاج تحديث koub-tap للطباعة من التطبيق.',
  select: 'تحديد', selectAll: 'تحديد الكل', clearAll: 'إلغاء التحديد', done: 'تم', nSelected: '{n} محدد', cashTotal: 'المجموع: {x}', pickOrders: 'اختار الطلبات', updatedN: 'انحدّث {n}', notUpdatedN: '{n} ما انحدّث', bulkMax: 'لين 20 طلب بكل مرة',
  notUpdated: 'ما انحدّث الطلب', notSaved: 'ما انحفظت الملاحظة', nothingToDo: 'ما في خطوة ثانية لهالطلب.', notNow: 'رجوع', addNote: 'ملاحظة للفريق (ما يشوفها العميل)', save: 'حفظ', openInDashboard: 'افتح في لوحة التحكم',
  sales: 'المبيعات', ordersCount: 'الطلبات', average: 'متوسط الطلب', afterCosts: 'بعد المنتجات والرسوم والتوصيل والإعلانات',
  salesByHour: 'المبيعات خلال اليوم', dailySales: 'المبيعات اليومية', whereMoney: 'وين راحت الفلوس', ofSales: 'من {x} مبيعات',
  sp_ads: 'إعلانات Meta', sp_goods: 'تكلفة المنتجات', sp_courier: 'التوصيل الفعلي', sp_gateway: 'رسوم الدفع', sp_packaging: 'الأكياس', sp_other: 'الاستضافة وغيرها', atLeast: 'على الأقل',
  ads: 'الإعلانات', roas: '{x}× عائد', spent: 'صرفت {x} · {y} للطلب', noAds: 'ما في مصروف إعلانات مسجل', cardCash: 'البطاقة والكاش', cardAfterFees: 'بطاقة بعد الرسوم {a} · كاش للتحصيل {b}',
  bestSellers: 'الأكثر مبيعاً', noSales: 'ما في مبيعات في هالفترة.', pieces: '{n} قطعة', orderMix: 'تفاصيل الطلبات', card: 'بطاقة', cod: 'كاش عند التوصيل', itemsSold: 'القطع المباعة', bundlesSold: 'الأطقم المباعة', shippingPaid: 'التوصيل اللي دفعه العملاء',
  carts: 'السلال المتروكة', reminded: 'تذكير', delivered: 'وصلت', recovered: 'رجعوا',
  missingTitle: 'التكاليف الناقصة', foreignOrders: '{n} طلبات بعملة ثانية ما انحسبت.',
  f_all: 'الكل', f_low: 'مخزون قليل', f_out: 'خلص', f_preorder: 'طلب مسبق', f_draft: 'مسودة',
  profitShort: 'ربحك {x}', costMissing: 'التكلفة ناقصة', soldOut: 'خلص', low: 'قليل', draft: 'مسودة', wantAlert: '{n} يبون تنبيه', inStock: '{n} بالمخزون', noProducts: 'ما في منتجات تطابق.', profitNote: '«ربحك» هو السعر ناقص تكلفة المنتج، قبل التوصيل والرسوم والإعلانات.',
  signInTitle: 'مساحة عملك، بجيبك.', signInSub: 'الطلبات والمنتجات والأرقام، كلها في تطبيق واحد.', storeUrl: 'رابط المتجر', username: 'اسم المستخدم', appPassword: 'كلمة مرور التطبيق', signIn: 'دخول', tryDemo: 'جرّب بالبيانات التجريبية',
  appPasswordHelp: 'من ووردبريس: المستخدمين ← ملفك ← Application Passwords. اكتب اسم «KOUB App» واضغط إضافة.',
  errAuth: 'اسم المستخدم أو كلمة مرور التطبيق غلط.', errForbidden: 'حسابك ما عنده صلاحية إدارة المتجر.', errNotFound: 'ما لقينا API التطبيق على هالمتجر. تأكد إن تحديث koub-tap منزّل.', errNetwork: 'ما قدرنا نوصل للمتجر. شيك على الرابط والإنترنت.', errFields: 'عبّي كل الخانات.',
  demoBanner: 'بيانات تجريبية', account: 'الحساب', signedInAs: 'داخل باسم {n}', store: 'المتجر', signOut: 'تسجيل خروج', faceLock: 'قفل بالبصمة / Face ID', faceLockHint: 'يطلب البصمة كل ما تفتح التطبيق.', unlock: 'افتح KOUB', version: 'الإصدار {v}', comingNext: 'جاي قريب', alerts: 'التنبيهات', orderAlerts: 'تنبيه لكل طلب جديد', orderAlertsHint: 'رقم الطلب والمبلغ ونوع التوصيل، بدون بيانات العميل.', pos: 'الكاشير', posExit: 'خروج من الكاشير', posToday: 'مبيعات اليوم', posSearch: 'دوّر منتج أو SKU', posNoProducts: 'ما في منتجات تنباع من الكاشير', posOut: 'خلص', posNoMore: 'المخزون في النظام {n} بس. عدّل المخزون إذا عندك أكثر.', posPay: 'الدفع · {n} · {x}', posCheckout: 'الدفع', posSold: 'تم البيع #{n}', posAlreadySaved: 'انحفظ من قبل', posChange: 'الباقي للعميل {x}', posShort: 'ناقص {x}', posShareReceipt: 'مشاركة الإيصال (PDF)', posWhatsappReceipt: 'إيصال على واتساب العميل', posNewSale: 'بيع جديد', posEmpty: 'ما في شي في البيع.', posDiscount: 'الخصم', posMethod: 'طريقة الدفع', posCash: 'كاش', posCard: 'مكينة البطاقة', posBenefit: 'بنفت باي', posCashGiven: 'الكاش المستلم (اختياري)', posCashHint: 'كم عطاك العميل؟', posCustomer: 'العميل (اختياري)', posCustomerName: 'الاسم', posCustomerPhone: 'رقم الواتساب', posAddCustomer: 'أضف العميل (اختياري، للإيصال)', posTotal: 'المجموع', posComplete: 'إتمام البيع', posNotSaved: 'البيع ما انحفظ', posNetwork: 'ما قدرنا نوصل للمتجر. اضغط «إتمام البيع» مرة ثانية؛ ما بينحسب مرتين.', posSalesN: '{n} بيع اليوم', posDrawerHint: 'الكاش لازم يطابق اللي في الدرج.', posNoSales: 'ما في مبيعات من المحل اليوم', posItemsN: '{n} قطع', posVoided: 'ملغي', posVoid: 'إلغاء', posVoidConfirm: 'تلغي بيع #{n}؟ المخزون يرجع، والمبلغ يطلع من مبيعات اليوم. لو المنتج كان خالص، يمكن تنرسل تنبيهات «رجع المخزون» للعملاء المنتظرين.', posRefunded: 'مسترجع', posOpen: 'افتح الكاشير', posOpenHint: 'بيع في المحل: كاش، بطاقة أو بنفت.', unpaidAlerts: 'دفع ما كمل', unpaidAlertsHint: 'طلب بطاقة ما اندفع بعد ساعة من إنشائه.', stockAlerts: 'المخزون', stockAlertsHint: 'منتج خلص، أو وصل مخزون لطلبات مسبقة تنتظره.', quietNight: 'بدون صوت بالليل', quietNightHint: 'من 11 بالليل لين 8 الصبح يوصل التنبيه بدون صوت.', push_denied: 'التنبيهات مقفولة لهالتطبيق. فعّلها من إعدادات الجوال.', push_unsupported: 'التنبيهات تشتغل على الجوال بس، مو على المتصفح أو المحاكي.', push_no_project: 'هالنسخة للتجربة وما فيها تنبيهات. تشتغل في نسخة KOUB الخاصة.', push_demo: 'التنبيهات تشتغل بعد ما تسجل دخول بمتجرك.', push_error: 'ما قدرنا نفعّل التنبيهات. تأكد إن تحديث koub-tap منزّل وجرّب مرة ثانية.', soonPush: 'إشعار فوري لكل طلب جديد', soonActions: 'تحضير وتحصيل وإلغاء من التطبيق', soonEdit: 'تعديل الأسعار والمخزون والصور', language: 'اللغة', languageHint: '«تلقائي» يتبع لغة لوحة التحكم.', langAuto: 'تلقائي', langAr: 'العربية', langEn: 'English',
  preorderBoard: 'الطلبات المسبقة حسب المنتج', byItem: 'حسب المنتج', waitingOrders: '{n} طلب ينتظر', neededQty: 'المطلوب {n}', stockN: 'المخزون {n}', arrivedPrepare: 'وصل · جهّز {n}', mixedNote: '{n} ينتظر منتج ثاني كمان، جهّزه من صفحة الطلب', oldestSince: 'أقدم طلب {x}', noPreorders: 'ما في طلبات مسبقة تنتظر', releasedN: 'انتقل {n} للتحضير', arrived: 'وصل المخزون', viewOrders: 'الطلبات',
  addStock: 'تعديل المخزون', stockAmount: 'كم حبة؟', addN: 'زيد', removeN: 'نقّص', stockAlertConfirm: '{n} عملاء طلبوا تنبيه لما يرجع. لو زدت المخزون يوصلهم واتساب إن المنتج رجع. نكمل؟', stockNotSaved: 'ما انحفظ المخزون', stockSaved: 'المخزون صار {n}', moreThanStock: 'المخزون {n} بس',
  runTitle: 'مشوار التوصيل', runSummary: '{n} طلب · كاش {x} من {c} طلب', runEmpty: 'ما في طلبات طالعة اليوم', runEmptyHint: 'لما تضغط «طلع للتوصيل» على طلب، يطلع هني.', runShare: 'ورقة السايق · مشاركة وطباعة', paidShort: 'مدفوع', collectX: 'حصّل {x}', runEarlier: 'طلع قبل اليوم والكاش ما انحصل', map: 'الخريطة', outToday: 'طالع للتوصيل اليوم', preorderReady: 'مسبقة مخزونها وصل', openRun: 'افتح المشوار',
  editContact: 'تعديل الأرقام والعنوان', editNumbers: 'تعديل الأرقام', whatsappNumber: 'رقم الواتساب', senderWhatsapp: 'واتساب المرسل', callNumber: 'رقم الاتصال (اختياري)', callHint: 'فاضي = نفس رقم الواتساب', recipientWa: 'واتساب المستلم', addressLabel: 'العنوان', areaLabel: 'المنطقة', outWarn: 'الطلب طالع للتوصيل. بلّغ السايق بأي تغيير.', contactSaved: 'انحفظ. الأزرار والبوليصة والواتساب صارت على البيانات الجديدة.', countryFixed: 'الدولة ما تتغير لأن سعر التوصيل يعتمد عليها.',
  unpaidTitle: 'دفع ما كمل', unpaidSummary: '{n} طلب · {x}', unpaidEmpty: 'كل الدفعات كاملة', unpaidEmptyHint: 'الطلبات اللي ما اكتمل دفعها بالبطاقة تطلع هني لمدة ١٤ يوم.', sendPayLink: 'أرسل رابط الدفع', handled: 'تم', handledConfirm: 'تشيل طلب #{n} من القائمة؟ ما يتغير شي بالطلب.', linkOpened: 'العميل فتح الرابط', linkShared: 'انجهز الرابط للإرسال', notPayable: 'ما ينفع يندفع من رابط · كلّمه واتساب', unpaidNote: 'ما ينرسل شي من المتجر. الزر يفتح الواتساب من جوالك والرسالة جاهزة.',
};
type Key = keyof typeof ar;
const en: Record<Key, string> = {
  home: 'Home', orders: 'Orders', products: 'Products', numbers: 'Numbers', more: 'More',
  today: 'Today', week: 'Week', month: 'Month', yesterday: 'Yesterday', days7: '7 days', dates: 'Dates',
  netProfitToday: "Today's net profit", netProfitWeek: 'Net profit · last 7 days', netProfitMonth: 'Net profit this month', netProfit: 'Net profit',
  estimate: 'estimate', fromSales: 'From {sales} sales · {orders}', vsYesterday: 'vs yesterday', vsWeek: 'vs previous 7 days', vsMonth: 'vs last month', vsPrev: 'vs previous period',
  missingCosts: 'Some costs are missing, so profit is approximate',
  needsYou: 'Needs you', toPrepare: 'To prepare', cashWithCourier: 'Cash with courier', giftNeedsAddress: 'Gift needs address', waNotDelivered: 'WhatsApp not delivered',
  nothingWaiting: 'Nothing waiting', allCollected: 'All collected', notCollected: '{n} not collected', noneWaiting: 'None waiting', allDelivered: 'All delivered', orderNo: 'Order #{n}',
  bahrain: 'Bahrain', gcc: 'GCC', pickup: 'pickup', noAddress: 'no address',
  goalFor: 'Goal for {m}', setGoalFor: 'Set a goal for {m}', goalOf: '{a} of {b}', goalReached: 'Goal reached. Well done.', goalNeed: '{p}% with {d} days left. You need {x} a day.', goalHint: 'Set a monthly sales goal from the dashboard.',
  todayNotes: "Today's notes", latestOrders: 'Latest orders', all: 'All', noOrders: 'No orders yet.', seeAll: 'All',
  visitors: 'Website visitors', visitorsShort: 'visitors', pageviews: 'page views', ordered: 'ordered ({n})',
  stockOut: '{n} sold out', stockLow: '{n} running low', preorderWaiting: '{n} waiting for pre-order stock',
  search: 'Order number, name or phone', searchProducts: 'Product name', allClear: 'All clear', emptyList: 'No orders in this list right now.', noMatch: 'Nothing matches this search.',
  viewActive: 'To prepare', viewPreorder: 'Pre-order', viewCod: 'Cash to collect', viewGifts: 'Gift address', viewAll: 'All',
  loadMore: 'Load more', retry: 'Try again', offline: "Couldn't reach the store", offlineHint: 'Check your connection and try again.',
  order: 'Order #{n}', customer: 'Customer', buyer: 'Buyer', firstOrder: 'First order', nthOrder: 'Order no. {n}', spentSoFar: '{x} so far',
  whatsapp: 'WhatsApp', call: 'Call', copy: 'Copy', copied: 'Copied', pickupFromKoub: 'Pickup from KOUB', waitingRecipient: 'Waiting for the recipient to add an address',
  giftFor: 'Gift for {n}', senderHidden: 'Sender hidden from recipient', senderShown: 'Sender name shown', customerNote: 'Customer note',
  items: 'Products', qty: 'Qty {n}', discount: 'Discount', delivery: 'Delivery', refunded: 'Refunded', total: 'Total',
  yourProfit: 'Your profit on this order', atMost: 'at most ', productCost: 'Product cost', bag: 'Bag', paymentFee: 'Payment fee', actualDelivery: 'Actual delivery cost', missing: 'missing', estShort: 'est.', beforeAds: 'Before advertising.',
  messagesLog: 'Customer messages & log', noMessages: 'No customer messages for this order.', fullLog: 'Full order log', sentToCustomer: 'sent to customer',
  progress: 'Order progress', awaitingPayment: 'Awaiting payment', orderedCash: 'Ordered · cash', orderedPaid: 'Ordered & paid', preparing: 'Preparing', outForDelivery: 'Out for delivery', readyPickup: 'Ready for pickup', now: 'Now',
  testOrder: 'TEST ORDER: do not prepare it or message the customer.',
  actionsOnDashboard: 'This store needs the koub-tap update for actions in the app. For now, open the order in the dashboard.',
  printSlip: 'Print slip', printSlips: 'Print slips', shareSlips: 'Slip · share or print', notPrinted: 'Not printed', needsUpdate: 'This store needs the koub-tap update to print from the app.',
  select: 'Select', selectAll: 'Select all', clearAll: 'Clear', done: 'Done', nSelected: '{n} selected', cashTotal: 'Total: {x}', pickOrders: 'Choose orders', updatedN: '{n} updated', notUpdatedN: '{n} not updated', bulkMax: 'Up to 20 orders at a time',
  notUpdated: 'Order not updated', notSaved: 'Note not saved', nothingToDo: 'No further steps for this order.', notNow: 'Back', addNote: 'Note for the team (customer never sees it)', save: 'Save', openInDashboard: 'Open in dashboard',
  sales: 'Sales', ordersCount: 'Orders', average: 'Average order', afterCosts: 'After products, fees, delivery and ads',
  salesByHour: 'Sales through the day', dailySales: 'Daily sales', whereMoney: 'Where the money went', ofSales: 'From {x} in sales',
  sp_ads: 'Meta ads', sp_goods: 'Product cost', sp_courier: 'Actual delivery', sp_gateway: 'Payment fees', sp_packaging: 'Bags', sp_other: 'Hosting & other', atLeast: 'at least',
  ads: 'Ads', roas: '{x}× return', spent: 'Spent {x} · {y} per order', noAds: 'No ad spend recorded', cardCash: 'Card & cash', cardAfterFees: 'Card after fees {a} · cash to collect {b}',
  bestSellers: 'Best sellers', noSales: 'No sales in this period.', pieces: '{n} items', orderMix: 'Order mix', card: 'Card', cod: 'Cash on delivery', itemsSold: 'Items sold', bundlesSold: 'Bundles sold', shippingPaid: 'Customer shipping paid',
  carts: 'Abandoned carts', reminded: 'Reminded', delivered: 'Delivered', recovered: 'Recovered',
  missingTitle: 'Missing costs', foreignOrders: '{n} orders in another currency are not counted.',
  f_all: 'All', f_low: 'Low stock', f_out: 'Sold out', f_preorder: 'Pre-order', f_draft: 'Draft',
  profitShort: 'profit {x}', costMissing: 'cost missing', soldOut: 'Sold out', low: 'Low', draft: 'Draft', wantAlert: '{n} want an alert', inStock: '{n} in stock', noProducts: 'No matching products.', profitNote: '“Profit” is price minus product cost, before delivery, fees and ads.',
  signInTitle: 'Your workspace, in your pocket.', signInSub: 'Orders, products and numbers in one app.', storeUrl: 'Store address', username: 'Username', appPassword: 'Application password', signIn: 'Sign in', tryDemo: 'Try with demo data',
  appPasswordHelp: 'In WordPress: Users → Profile → Application Passwords. Name it “KOUB App” and tap Add.',
  errAuth: 'Wrong username or application password.', errForbidden: 'This account cannot manage the store.', errNotFound: "The app API isn't on this store yet. Make sure the koub-tap update is installed.", errNetwork: "Couldn't reach the store. Check the address and your connection.", errFields: 'Fill in every field.',
  demoBanner: 'Demo data', account: 'Account', signedInAs: 'Signed in as {n}', store: 'Store', signOut: 'Sign out', faceLock: 'Face ID / fingerprint lock', faceLockHint: 'Asks every time you open the app.', unlock: 'Unlock KOUB', version: 'Version {v}', comingNext: 'Coming next', alerts: 'Alerts', orderAlerts: 'Alert for every new order', orderAlertsHint: 'Order number, total and delivery type. No customer details.', pos: 'Till', posExit: 'Close the till', posToday: "Today's sales", posSearch: 'Search a product or SKU', posNoProducts: 'No products to sell at the till', posOut: 'Sold out', posNoMore: 'The store shows only {n} in stock. Fix the stock count if you have more.', posPay: 'Pay · {n} · {x}', posCheckout: 'Payment', posSold: 'Sold #{n}', posAlreadySaved: 'already saved', posChange: 'Change to give {x}', posShort: '{x} short', posShareReceipt: 'Share receipt (PDF)', posWhatsappReceipt: "Receipt to the customer's WhatsApp", posNewSale: 'New sale', posEmpty: 'Nothing in the sale.', posDiscount: 'Discount', posMethod: 'Payment method', posCash: 'Cash', posCard: 'Card machine', posBenefit: 'BenefitPay', posCashGiven: 'Cash received (optional)', posCashHint: 'How much did the customer give?', posCustomer: 'Customer (optional)', posCustomerName: 'Name', posCustomerPhone: 'WhatsApp number', posAddCustomer: 'Add the customer (optional, for a receipt)', posTotal: 'Total', posComplete: 'Complete sale', posNotSaved: 'Sale not saved', posNetwork: "Couldn't reach the store. Press Complete sale again; it won't be counted twice.", posSalesN: '{n} sales today', posDrawerHint: 'Cash should match the drawer.', posNoSales: 'No shop sales today', posItemsN: '{n} items', posVoided: 'Cancelled', posVoid: 'Cancel', posVoidConfirm: "Cancel sale #{n}? The stock goes back and the amount leaves today's sales. If the item was sold out, waiting customers may get back-in-stock messages.", posRefunded: 'Refunded', posOpenHint: 'Sell in the shop: cash, card or BenefitPay.', posOpen: 'Open the till', unpaidAlerts: 'Unfinished payments', unpaidAlertsHint: 'A card order still unpaid an hour after it was placed.', stockAlerts: 'Stock', stockAlertsHint: 'An item sold out, or stock arrived for waiting pre-orders.', quietNight: 'Silent at night', quietNightHint: 'From 11pm to 8am alerts arrive without sound.', push_denied: 'Notifications are off for this app. Turn them on in your phone settings.', push_unsupported: 'Alerts work on a phone, not in a browser or simulator.', push_no_project: 'This preview build has no alerts. They work in the KOUB build.', push_demo: 'Alerts work once you sign in to your store.', push_error: "Couldn't turn alerts on. Make sure the koub-tap update is installed and try again.", soonPush: 'Instant alert for every new order', soonActions: 'Prepare, collect and cancel from the app', soonEdit: 'Edit prices, stock and photos', language: 'Language', languageHint: '“Auto” follows your dashboard language.', langAuto: 'Auto', langAr: 'العربية', langEn: 'English',
  preorderBoard: 'Pre-orders by item', byItem: 'By item', waitingOrders: '{n} orders waiting', neededQty: '{n} needed', stockN: '{n} in stock', arrivedPrepare: 'Arrived · prepare {n}', mixedNote: '{n} also wait for another item; prepare them from the order', oldestSince: 'oldest {x}', noPreorders: 'No pre-orders waiting', releasedN: '{n} moved to To prepare', arrived: 'Stock arrived', viewOrders: 'Orders',
  addStock: 'Change stock', stockAmount: 'How many?', addN: 'Add', removeN: 'Remove', stockAlertConfirm: '{n} customers asked to be told when this is back. Adding stock sends them a WhatsApp. Continue?', stockNotSaved: 'Stock not saved', stockSaved: 'Stock is now {n}', moreThanStock: 'Only {n} in stock',
  runTitle: 'Delivery run', runSummary: '{n} orders · cash {x} from {c}', runEmpty: 'Nothing out for delivery today', runEmptyHint: 'Orders show here once you press “Out for delivery”.', runShare: 'Driver sheet · share & print', paidShort: 'Paid', collectX: 'Collect {x}', runEarlier: 'Out before today, cash not collected', map: 'Map', outToday: 'Out for delivery today', preorderReady: 'Pre-orders in stock', openRun: 'Open the run',
  editContact: 'Edit numbers & address', editNumbers: 'Edit numbers', whatsappNumber: 'WhatsApp number', senderWhatsapp: 'Sender WhatsApp', callNumber: 'Call number (optional)', callHint: 'Empty = the WhatsApp number', recipientWa: 'Recipient WhatsApp', addressLabel: 'Address', areaLabel: 'Area', outWarn: 'This order is out for delivery. Tell the driver about any change.', contactSaved: 'Saved. Buttons, slip and WhatsApp now use the new details.', countryFixed: 'The country does not change: the delivery price depends on it.',
  unpaidTitle: 'Unfinished payments', unpaidSummary: '{n} orders · {x}', unpaidEmpty: 'Every payment went through', unpaidEmptyHint: 'Card orders that did not finish paying show here for 14 days.', sendPayLink: 'Send payment link', handled: 'Done', handledConfirm: 'Remove order #{n} from this list? Nothing changes on the order.', linkOpened: 'Customer opened the link', linkShared: 'Link prepared to send', notPayable: 'Cannot be paid from a link · message them', unpaidNote: 'Nothing is sent by the store. The button opens WhatsApp on your phone with the message ready.',
};

export type T = (key: Key, vars?: Record<string, string | number>) => string;
export function translator(lang: Lang): T {
  const table = lang === 'en' ? en : ar;
  return (key, vars) => {
    let s = table[key];
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
    return s;
  };
}

// Arabic counting, as koub_ui_count() does on the dashboard.
export function ordersCount(n: number, lang: Lang): string {
  if (lang === 'en') return n + (n === 1 ? ' order' : ' orders');
  if (n === 0) return 'ما في طلبات';
  if (n === 1) return 'طلب واحد';
  if (n === 2) return 'طلبين';
  return n + (n <= 10 ? ' طلبات' : ' طلب');
}
