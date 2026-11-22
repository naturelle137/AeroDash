# TAF surface evidence

Synthetic EDDF forecast, fixed browser clock; no live weather or aircraft performance validation.

- [Desktop, 1440 px](desktop.png)
- [Mobile, 390 px](mobile.png)

Reproduce: build the app, then run `pnpm --filter frontend exec playwright test --config playwright.offline.config.ts weather-surface.spec.ts` in `web-dev`. Both viewports cover METAR regression, TAF change-period start/end, unknown groups, offline withdrawal, expiry, saved provenance/reload and pilot overrides. Unit tests additionally cover FM/BECMG/PROB, month rollover, future validity and malformed periods.
