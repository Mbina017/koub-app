# KOUB app

The KOUB workspace on iOS and Android: orders, products and numbers from koubbh.com, in Arabic first.
Built with Expo (React Native) and Expo Router.

| Home | Orders | Order | Numbers | Products |
| --- | --- | --- | --- | --- |
| ![](docs/screens/1-home.png) | ![](docs/screens/2-orders.png) | ![](docs/screens/3-order.png) | ![](docs/screens/4-numbers.png) | ![](docs/screens/5-products.png) |

Screens show invented demo data.

## Phase 1 (this version)
- Sign in with the store address, username and a WordPress **Application Password**. Credentials stay in the phone's keychain.
- **Home**: net profit (today / week / month) with the cumulative sales line, “needs you” tiles, monthly goal, website visitors, signals and the latest orders. Refreshes every minute.
- **Orders**: the dashboard's queues (to prepare, pre-order, cash to collect, gift address, all), destination filter, search, infinite scroll.
- **Order**: progress, customer with WhatsApp / Call / Copy, gift details, items and totals, payment, profit before ads, WhatsApp messages and the order log.
- **Numbers**: profit, KPIs, sales chart, where the money went, ads return, card and cash, best sellers, countries, order mix, abandoned carts.
- **Products**: stock buckets, search, price and unit profit, waiting stock alerts.
- **More**: Face ID / fingerprint lock, sign out.
- Demo mode (“Try with demo data”) with invented data, no store needed.
- Pull to refresh, skeleton loading, haptics, refresh when the app returns to the foreground.

Phase 1 is read-only. Order actions, push notifications and product editing come next.

## Requirements on the store
The koub-tap update with the app API (`Mbina017/koub-site`, `app-api.php`) must be installed. Until then, sign-in shows “The app API isn't on this store yet”.

## Run it
```sh
npm install
npx expo start          # scan the QR code with Expo Go (iOS / Android)
npm run typecheck
npm test
```

## Release (later)
Store builds use EAS (`npx eas-cli build`), which needs an Apple Developer account (99 USD a year) and a Google Play developer account (25 USD once). Bundle id: `bh.koub.app`.

## Structure
```
src/app/            screens (Expo Router)
  (tabs)/           Home, Orders, Products, Numbers, More
  order/[id].tsx    order screen
  login.tsx
src/components/     UI kit, charts, icons, order row, lock screen
src/lib/            API client, session, demo data, formatting, translations, theme
```
