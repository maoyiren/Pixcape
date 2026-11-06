# Next.js PWA

CDPC's Next.js App Router owns the PWA manifest and service worker. The implementation is intentionally native and does not add a Vite PWA plugin or a Webpack-only Next.js wrapper.

## Included

- `app/manifest.ts`: install metadata, standalone display, root scope and app icons.
- `public/sw.js`: root-scoped service worker; pre-caches the offline page and app icons.
- `app/components/service-worker-register.tsx`: registers and checks for updates in production only.
- `app/offline/page.tsx`: network-failure fallback.

## Cache and privacy rules

- Never cache API, authentication, login, registration, account or admin requests.
- Never cache HTML navigation responses. Navigations are network-first and fall back to the offline page.
- Cache Next.js content-hashed assets cache-first; refresh other same-origin static assets from the network and use a cached copy only when offline.
- The service worker is served from `/sw.js` with root scope. Increment `CACHE_VERSION` when changing the pre-cache contract.

## SWC

Next.js uses its built-in SWC compiler for application compilation. SWC is not a PWA or service-worker runtime; the PWA lifecycle is provided by the Web App Manifest and browser Service Worker APIs. No separate SWC plugin is required.

## Validation

The Next.js preview/security workflow builds the app, builds runtime images for PostgreSQL/MySQL/SQLite, starts the Next.js server and runs the existing browser/security regression suites. The workflow also watches `public/**` so service-worker changes trigger validation.
