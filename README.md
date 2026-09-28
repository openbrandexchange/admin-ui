# Open Brand Exchange admin UI

The shared web interface for an Open Brand Exchange portal: one static single-page app with

- **the retailer portal** at `/`: browse the catalog, filter, select articles, paste an EAN list, download photos (original, web, square) and article data, prepare large zips, manage your account and API keys for your software;
- **the brand admin** at `/admin`: dashboard, catalog and article editor (sizes, EANs, photos, usage rights, AI provenance), imports with row-level problems, automatic upload (scheduled imports, access keys, ready-made recipes, notifications), retailers and their access, access requests, statistics and settings;
- **the public pages**: first-run setup, login, password reset, invitations and the "request access" form.

Every portal implementation (the Cloudflare, Google Cloud & Docker and web-hosting editions) serves this same build. It talks only to the REST Node Admin API described in [`spec/openapi/node-admin.yaml`](https://github.com/openbrandexchange/spec/blob/main/openapi/node-admin.yaml), plus the public access-request endpoint of the protocol.

Stack: React 19, TypeScript, Vite, TanStack Query (all server state: caching, optimistic updates, infinite lists) and TanStack Router, a typed REST client generated from the OpenAPI files (`openapi-typescript` + `openapi-fetch`), Tailwind CSS v4, i18next. No UI kit, ES2023, one ~150 kB (gzip) main bundle plus one chunk per language.

## Try it in 60 seconds

```sh
npm install
npm run mock
```

Open the printed URL. The whole portal API runs in your browser (a service worker seeded with the spec's fictional *Kestrel Outfitters* fixtures), so nothing else is needed.

| Who | Email | Password |
|---|---|---|
| Brand admin | `admin@kestrel.example` | `kestrel-admin-2026` |
| Retailer buyer | `buyer@shop.example` | `kestrel-shop-2026` |

- `?mock=reset` restores the demo data; `?mock=fresh` starts an empty portal that still needs setup (setup code `KESTREL-SETUP`).
- The demo accounts are set to Dutch, so after login the UI follows the account language unless you already picked a language on the login page.

## Languages

The UI ships all 24 official EU languages plus Norwegian Bokmål: bg cs da de el en es et fi fr ga hr hu it lt lv mt nb nl pl pt ro sk sl sv. English (`src/locales/en.json`) is the source; the other languages load on demand.

- The language comes from `navigator.languages`, can be switched on every page, and is remembered on the device and (when logged in) on the account. An explicit choice on the device wins over the account language.
- Product texts are shown in the reader's language, then English, then the first available.
- User-facing words follow the project glossary ([`spec/docs/glossary.md`](https://github.com/openbrandexchange/spec/blob/main/docs/glossary.md), machine-readable in `src/i18n/glossary.json`). Protocol terms never appear in the UI. The test suite checks every locale for missing keys, plural forms, placeholders and glossary terms.

## For node implementers

`npm run build` produces `dist/`, which you serve as static files. `dist/` is committed on `main` and tagged per release, so you can vendor it without Node.js.

1. **Routes.** Serve `dist/` at the portal root. Every path that is not a file and not an API path must return `dist/index.html` (SPA fallback), including `/admin/...`. Your API lives at `/admin/api/...` (Node Admin API) and `/obx/...` / `/.well-known/...` (protocol) on the same origin.
2. **Sub-path.** All asset paths are relative. `index.html` contains `<base href="/">`; if you mount the UI under a sub-path, rewrite that one tag (for example `<base href="/brand/">`). The UI resolves every API call and route against it.
3. **Session and CSRF.** The UI uses the cookie session and sends `X-CSRF-Token` (from `GET /admin/api/session`) on every unsafe request. `PATCH` bodies are sent as `application/merge-patch+json`.
4. **E-mails.** `dist/locales/<lang>.json` holds every UI string, including the `email.*` strings for invitations, access requests, approvals, rejections, finished zips and password resets. Pick the recipient's language, fall back to `en`, and interpolate `{{name}}`-style placeholders. `dist/locales/index.json` lists the languages.
5. **Images without an image library.** If your node reports `renditions_server_generated: false`, the brand admin creates the web and square versions in the browser and uploads them alongside the original.
6. **Branding.** Logo, accent colour, welcome text and display name come from the public branding endpoint. The portal is called "<brand> · <portal word>"; an optional `portal_name` (localized text) in branding overrides the word (see `NOTES.md`).

## Development

```sh
npm run dev                                   # against a real node: OBX_NODE_URL=http://localhost:8080 npm run dev
npm run mock                                  # against the in-browser mock node
npm test                                      # unit, component (React Testing Library) and locale tests
npm run e2e                                   # Playwright smoke tests on the mock build (desktop + phone)
npm run check                                 # typecheck + tests + production build
npm run gen:api -- ../spec                    # regenerate src/api/*.d.ts from the OpenAPI files
npm run sync-fixtures -- ../spec              # refresh the mock data from the spec fixtures
```

Code layout: `src/api` (typed client), `src/queries` (TanStack Query hooks, one file per area), `src/router.tsx` (routes and guards), `src/screens/{public,portal,admin}`, `src/ui` (small in-house controls), `src/i18n` and `src/locales`, `src/mock` (MSW handlers and in-memory node).

## License

Apache License 2.0, see [LICENSE](LICENSE). The page footer carries a small "Works with Open Brand Exchange" badge.
