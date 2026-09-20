# qiymetleri.com web-to-native migration

## Scope and decisions

- Target: Android application built with Expo, React Native, TypeScript, and Expo Router.
- Location: `mobile/` in this repository; existing frontend, backend, and scraper stay intact.
- Backend: the existing FastAPI service remains the source of truth and is accessed through an absolute `EXPO_PUBLIC_API_URL`.
- Authentication: no end-user authentication exists in the public web app. The informational `/login` page is included; all admin routes and admin authentication are excluded.
- Local Android emulator API URL: `http://10.0.2.2:8000`.
- Languages: Azerbaijani (`az`) and Russian (`ru`) with the selected language retained on-device.
- Parity means the same public content and behavior, expressed with native Android navigation and controls rather than a WebView.

## Public route inventory

| Web route | Native route | Bucket | Required behavior | Status |
| --- | --- | --- | --- | --- |
| `/[locale]` | `/` | nativize-now | popular products, six categories and counts, stores, search, favourites, language switch | [x] |
| `/[locale]/products` | `/products` | nativize-now | query search, category/brand/store filters, three public sort modes, result count, pagination, empty/error states | [x] |
| `/[locale]/products/[productId]` | `/products/[productId]` | nativize-now | image and summary, offers, safe retailer links, variants, attributes, 30-day price history, unavailable/not-found states | [x] |
| `/[locale]/login` | `/login` | nativize-now | same informational account content and catalogue CTA; no auth form | [x] |
| `/[locale]/about` | `/about` | nativize-now | same localized sections and CTA | [x] |
| `/[locale]/partnership` | `/partnership` | nativize-now | same localized sections and email CTA | [x] |
| `/[locale]/social` | `/social` | nativize-now | same localized sections and GitHub CTA | [x] |
| `/[locale]/contact` | `/contact` | nativize-now | same localized sections and email CTA | [x] |
| `/[locale]/terms` | `/terms` | nativize-now | same localized legal content and CTA | [x] |
| `/[locale]/privacy` | `/privacy` | nativize-now | same localized legal content and CTA | [x] |
| `/[locale]/personal-data` | `/personal-data` | nativize-now | same localized legal content and CTA | [x] |
| `/[locale]/consent` | `/consent` | nativize-now | same localized legal content and CTA | [x] |
| unknown public route | `+not-found` | nativize-now | localized not-found message and home/catalogue actions | [x] |

## Shared behavior checklist

- [x] Native stack navigation and Android back behavior.
- [x] Search from the home header and catalogue screen.
- [x] AZ/RU language switching updates all visible content and is retained across launches.
- [x] Product cards preserve name, lowest price, offer count, remote image fallback, and favourite toggle behavior.
- [x] Catalogue state is represented in Expo Router query parameters and survives navigation to product detail and back.
- [x] API requests have typed errors, cancellation through TanStack Query, retry limits, pull-to-refresh, and offline-aware UI.
- [x] External `http(s)` and `mailto:` links are validated before opening.
- [x] Loading, empty, unavailable, and not-found states match the web app's meaning.
- [x] Touch targets, roles, labels, and selected/disabled states are accessible.
- [x] Manrope and LT Superior bundled fonts and existing store/logo assets are reused.
- [x] Admin screens, admin API calls, and admin credentials are absent from the mobile bundle.

## Verification gates

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test -- --runInBand`
- [x] `npx expo export --platform android`
- [x] Existing backend tests remain green for public API coverage.
- [x] Running web baselines captured for home, catalogue, product detail, content, and not-found states.
- [x] Running Android app checked against those baselines for content and behavior.
- [x] Commit history is split into setup, navigation/localization, screens, API integration, and tests/polish.
- [x] Branch is pushed and a pull request is opened.

## Out of scope

- `/[locale]/admin/**`, admin login/session endpoints, scraper controls, store administration, anomaly review, and product matching administration.
- New user registration/login, because the public web application currently has no such functionality.
- iOS build or simulator verification.
