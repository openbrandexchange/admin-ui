# Notes: decisions and open questions

Where the spec or the project requirements left room, the simplest reading was chosen. Each item says what the UI does now and what would settle it.

## Spec gaps and readings

1. **One app, two areas.** The retailer portal (`/`) and the brand admin (`/admin`) are one SPA with one `index.html`. Guards redirect by role: retailers never reach `/admin`, admins can preview the portal ("View as retailer") with a banner. Nodes only need one SPA fallback.
2. **Portal name override.** Settled: `branding.portal_name` (LocalizedText or null) is in `node-admin.yaml` for `PublicBranding` and `Settings.branding`; the UI edits it on Settings > Brand and all nodes use that name.
3. **Colourless photos.** Photos uploaded in the article editor without a colour get the asset id `{style_number}_ALL_{position}`, mirroring the import naming rule. Settled across the project: the spec documents this id in `import-format.md`.
4. **CSV delimiter.** Exports request `delimiter=comma` for en, ga and mt and `semicolon` for all other languages, because spreadsheet software in those locales expects it. The spec allows both; the choice lives in `src/i18n/languages.ts`.
5. **Account language vs. device.** After login the UI switches to the account's language unless the visitor picked a language on this device (stored in `localStorage` as `obx.lang`). Changing the language while logged in also updates the account (`PATCH /admin/api/me`), so e-mails follow.
6. **Client-side renditions.** When `Settings.node.renditions_server_generated` is false, the browser creates the web (max 2000 px JPEG) and square versions and uploads them with the original. The original bytes are never re-encoded.
7. **CSRF header in generated types.** The spec marks `X-CSRF-Token` as a required header parameter. `scripts/gen-api.mjs` makes it optional in the generated types because one middleware adds it; the wire behaviour is unchanged.
8. **Session expiry.** Any 401 from a query or mutation re-reads the session; only if the node confirms the session is gone does the UI go to `/login?redirect=…`. This avoids redirect loops when a single call is refused.
9. **No request cancellation.** Queries do not pass `AbortSignal` to `fetch`. jsdom's `AbortSignal` is rejected by Node's `fetch` in tests; in browsers the cost is at most one wasted response when a filter changes quickly.
10. **Statistics.** Download log entries are shown with a human verb per `kind`; unknown kinds show "Unknown", as the spec requires clients to ignore unknown values.
11. **Merge patches clear with null.** Every PATCH is a JSON merge patch; a language whose text was cleared is sent as `null` (`localizedPatch` in `src/lib/localized.ts`), and an import schedule sends `null` for a weekday or time that no longer applies. The mock node applies real RFC 7396 merge patches so the tests catch a regression.
12. **After an upgrade.** An open tab that asks for a lazily loaded file of the previous version reloads once (`vite:preloadError`, at most once a minute; TanStack Router has the same guard for route modules). Nodes can avoid even that by keeping the previous `assets/` files for a while (docs/node-integration.md).
13. **Focus after navigation.** When the page changes and the focused element disappeared, focus moves to `<main>`; filter and search changes on the same page never move focus.

## Translations

- nl, de and fr were written with extra care for tone and domain words (Beeldbank, Händlerportal, Espace revendeurs). All other languages are complete and consistent with the glossary, but a native review by someone in the fashion retail trade is recommended before a customer launch, especially for the smaller languages.
- Irish (ga) and Maltese (mt) have five plural categories with initial mutations. Counted phrases in these two languages use a "label: count" form ("Grianghraif: 3") so every number reads correctly without per-number grammar. A native speaker may prefer full sentences.
- Plural keys use i18next's CLDR suffixes (`_zero`, `_one`, `_two`, `_few`, `_many`, `_other`). The locale test requires every integer category a language uses; `_many` is also present for Czech, Slovak, Lithuanian and Polish (fractions).

## Tracked open issues

Things a user or implementer could run into that this repository cannot settle alone. Each has a reason and what would close it.

1. **Native review of 21 languages.** nl, de and fr were written with extra care; the other 21 are complete and follow the glossary, but no native speaker from the fashion trade has reviewed them. Close: a review per language before a customer launch in that market.
2. **Irish and Maltese counted phrases** use "label: count" ("Grianghraif: 3"). Correct for every number, but a native speaker may prefer full sentences. Close: native review (item 1).
3. **GDPR self-service export of a retailer's data, retention settings and an audit log of admin actions** are not screens yet: the Node Admin API has no endpoints for them. Deleting a retailer (with its accounts and API keys) and deleting single accounts already work. Close: endpoints in `spec/openapi/node-admin.yaml`, then screens here (Retailer > "Export data", Settings > "Retention", Settings > "Activity log").
4. **Keyboard users tab through all filters** before they reach the article grid on the catalog. The skip link goes to the page content, which starts with the filters. Close: a second skip link "Skip to results", if testing with users shows it is needed.
5. **The spec cross-check job in CI** only runs when the `OBX_READ_TOKEN` secret exists (the spec repository is private). Close: the owner adds the secret, or the spec repository becomes public.

## Tests

- `tests/i18n.test.ts`: completeness, plural forms, placeholders, glossary terms, enum families, all error codes, e-mail strings and a ban on protocol words in user-facing text.
- `tests/app.test.tsx`: the real app (router + TanStack Query) against the MSW mock node in jsdom: sign-in, CSRF rotation, setup wizard, portal catalog/filters/selection/EAN list, access requests, access keys, publishing, imports, and language behaviour (account language, Greek switch, device choice).
- `tests/states.test.tsx`: failed loads with "Try again" (and none where a retry cannot help), a full selection, inline errors for failed selection changes, the invitation text, merge patches that really clear removed texts.
- `e2e/` (Playwright on the static mock build, desktop and phone, served with the strict Content-Security-Policy of `vite.config.ts`; any violation fails the test):
  - `smoke.spec.ts`: login, catalog, article page, deep-link reload, no sideways scrolling, Greek and Bulgarian switching;
  - `flows.spec.ts`: the main flows of both roles and the public pages;
  - `a11y.spec.ts`: axe-core (WCAG 2.1 A/AA) on every screen, plus open dialogs and one-time secrets inside the flows;
  - `keyboard.spec.ts`: skip link, focus after navigation, keyboard-only login, selecting with Space, dialogs (Enter, Escape, focus back), arrow keys in tabs;
  - `upgrade.spec.ts`: a tab left open during an upgrade reloads instead of breaking, without a reload loop.
