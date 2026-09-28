# Notes: decisions and open questions

Where the spec or the brief left room, the simplest reading was chosen. Each item says what the UI does now and what would settle it.

## Spec gaps and readings

1. **One app, two areas.** The retailer portal (`/`) and the brand admin (`/admin`) are one SPA with one `index.html`. Guards redirect by role: retailers never reach `/admin`, admins can preview the portal ("View as retailer") with a banner. Nodes only need one SPA fallback.
2. **Portal name override.** The brief says a brand can override the local portal word, but `node-admin.yaml` has no such field. The UI reads an optional `portal_name` (localized text) from `PublicBranding` and `Settings.branding` when present, and edits it on Settings > Brand. **Proposal for the spec:** add `portal_name: LocalizedText | null` to both schemas.
3. **Colourless photos.** Photos uploaded in the article editor without a colour get the asset id `{style_number}_ALL_{position}`, mirroring the import naming rule. The spec does not define ids for colourless assets; worth stating in `import-format.md`.
4. **CSV delimiter.** Exports request `delimiter=comma` for en, ga and mt and `semicolon` for all other languages, because spreadsheet software in those locales expects it. The spec allows both; the choice lives in `src/i18n/languages.ts`.
5. **Account language vs. device.** After login the UI switches to the account's language unless the visitor picked a language on this device (stored in `localStorage` as `obx.lang`). Changing the language while logged in also updates the account (`PATCH /admin/api/me`), so e-mails follow.
6. **Client-side renditions.** When `Settings.node.renditions_server_generated` is false, the browser creates the web (max 2000 px JPEG) and square versions and uploads them with the original. The original bytes are never re-encoded.
7. **CSRF header in generated types.** The spec marks `X-CSRF-Token` as a required header parameter. `scripts/gen-api.mjs` makes it optional in the generated types because one middleware adds it; the wire behaviour is unchanged.
8. **Session expiry.** Any 401 from a query or mutation re-reads the session; only if the node confirms the session is gone does the UI go to `/login?redirect=…`. This avoids redirect loops when a single call is refused.
9. **No request cancellation.** Queries do not pass `AbortSignal` to `fetch`. jsdom's `AbortSignal` is rejected by Node's `fetch` in tests; in browsers the cost is at most one wasted response when a filter changes quickly.
10. **Statistics.** Download log entries are shown with a human verb per `kind`; unknown kinds show "Unknown", as the spec requires clients to ignore unknown values.

## Translations

- nl, de and fr were written with extra care for tone and domain words (Beeldbank, Händlerportal, Espace revendeurs). All other languages are complete and consistent with the glossary, but a native review by someone in the fashion retail trade is recommended before a customer launch, especially for the smaller languages.
- Irish (ga) and Maltese (mt) have five plural categories with initial mutations. Counted phrases in these two languages use a "label: count" form ("Grianghraif: 3") so every number reads correctly without per-number grammar. A native speaker may prefer full sentences.
- Plural keys use i18next's CLDR suffixes (`_zero`, `_one`, `_two`, `_few`, `_many`, `_other`). The locale test requires every integer category a language uses; `_many` is also present for Czech, Slovak, Lithuanian and Polish (fractions).

## Tests

- `tests/i18n.test.ts`: completeness, plural forms, placeholders, glossary terms, enum families, all error codes, e-mail strings and a ban on protocol words in user-facing text.
- `tests/app.test.tsx`: the real app (router + TanStack Query) against the MSW mock node in jsdom: sign-in, CSRF rotation, setup wizard, portal catalog/filters/selection/EAN list, access requests, access keys, publishing, imports, and language behaviour (account language, Greek switch, device choice).
- `e2e/smoke.spec.ts`: Playwright on the static mock build, desktop and phone: login, catalog, article page, deep-link reload, no sideways scrolling, Greek and Bulgarian switching.
