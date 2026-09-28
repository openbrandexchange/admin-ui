# Open Brand Exchange admin UI

The shared web interface for an Open Brand Exchange portal: one static single-page app with

- **the retailer portal** at `/`: browse the catalog, filter, select articles, paste an EAN list, download photos (original, web, square) and article data, prepare large zips, manage your account and API keys for your software;
- **the brand admin** at `/admin`: dashboard, catalog and article editor (sizes, EANs, photos, usage rights, AI provenance), imports with row-level problems, automatic upload (scheduled imports, access keys, ready-made recipes, notifications), retailers and their access, access requests, statistics and settings;
- **the public pages**: first-run setup, login, password reset, invitations and the "request access" form.

Every portal implementation (the Cloudflare, Google Cloud & Docker and web-hosting editions) serves this same build. It talks only to the REST Node Admin API described in [`spec/openapi/node-admin.yaml`](https://github.com/openbrandexchange/spec/blob/main/openapi/node-admin.yaml), plus the public access-request endpoint of the protocol.

Stack: React 19, TypeScript, Vite, TanStack Query (all server state: caching, optimistic updates, infinite lists) and TanStack Router, a typed REST client generated from the OpenAPI files (`openapi-typescript` + `openapi-fetch`), Tailwind CSS v4, i18next. No UI kit, ES2023, one ~150 kB (gzip) main bundle plus one chunk per language.

## Try it in 60 seconds

Needs Node.js 20.19 or newer.

```sh
git clone https://github.com/openbrandexchange/admin-ui.git
cd admin-ui
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

`npm run build` produces `dist/`, which you serve as static files. `dist/` is committed on `main` and on every release tag (CI checks it is the build of that commit), so you can vendor it without Node.js. Each GitHub release also has a tarball and zip of it, an SBOM and checksums.

The full guide is [docs/node-integration.md](docs/node-integration.md): routes and SPA fallback, sub-paths, the Content-Security-Policy and other headers the UI works under, caching, what the UI expects from your API (CSRF, merge patches, errors), e-mail strings, upgrading and browser support. In short:

1. **Routes.** Serve `dist/` at the portal root; every `GET` for HTML that is not a file or an API path returns `dist/index.html`, including `/admin/...`. The API lives at `/admin/api/...` (Node Admin API) and `/obx/...`, `/.well-known/...` (protocol) on the same origin.
2. **Sub-path.** Rewrite `<base href="/">` in `index.html`, nothing else.
3. **Headers.** `default-src 'self'` with `img-src 'self' data: blob: https:` is all the UI needs: no inline scripts or styles, no third-party requests. Every end-to-end test runs under that policy.
4. **Session and CSRF.** Cookie session; `X-CSRF-Token` (from `GET /admin/api/session`) on every unsafe request. `PATCH` bodies are JSON merge patches (`application/merge-patch+json`) in which `null` removes a member.
5. **E-mails.** `dist/locales/<lang>.json` holds every string, including the `email.*` groups; `dist/locales/index.json` lists the languages.
6. **Images without an image library.** With `renditions_server_generated: false` the brand's browser makes the web and square versions.
7. **Branding.** Logo, accent colour, welcome text and name from the public branding endpoint; the portal is called "<brand> · <portal word>", and `branding.portal_name` overrides the word per language.

## Development

```sh
npm run dev                                   # against a real node: OBX_NODE_URL=http://localhost:8080 npm run dev
npm run mock                                  # against the in-browser mock node
npm test                                      # unit, component (React Testing Library) and language tests
npm run e2e                                   # Playwright on the mock build: both roles' flows, axe, keyboard, desktop + phone
npm run check                                 # lint + typecheck + tests + production build + bundle budget
npm run licenses                              # licences of all dependencies
npm run gen:api -- ../spec                    # regenerate src/api/*.d.ts from the OpenAPI files
npm run sync-fixtures -- ../spec              # refresh the mock data from the spec fixtures
```

Code layout: `src/api` (typed client), `src/queries` (TanStack Query hooks, one file per area), `src/router.tsx` (routes and guards), `src/screens/{public,portal,admin}`, `src/ui` (small in-house controls), `src/i18n` and `src/locales`, `src/mock` (MSW handlers and in-memory node), `tests/` (Vitest), `e2e/` (Playwright).

### Quality gates

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on every push and pull request, and every step also runs locally:

- ESLint (TypeScript, React hooks, jsx-a11y) and `tsc`, on Node 20, 22 and 24;
- unit and component tests, including a completeness check of all 25 languages (keys, plural forms, placeholders, glossary words);
- the production build, a gzip bundle budget (`scripts/check-bundle.mjs`) and a check that the committed `dist/` is that build;
- Playwright end-to-end tests of the main flows of both roles, axe-core (WCAG 2.1 AA) on every screen and open dialog, keyboard paths, all under a strict Content-Security-Policy;
- licence check of all dependencies and `npm audit` of what ships;
- when the `OBX_READ_TOKEN` secret is set (needed while the spec repository is private): the generated API types and the glossary checked against the spec.

Dependabot proposes dependency updates weekly.

### Releases

Versions follow [semantic versioning](https://semver.org/); see [CHANGELOG.md](CHANGELOG.md). To release: set the version in `package.json`, add its section to the changelog, run `npm run build`, commit `dist/`, then tag `vX.Y.Z` on that commit and push the tag. [`.github/workflows/release.yml`](.github/workflows/release.yml) then builds the archives, the SBOM and checksums with build provenance, and opens a draft GitHub release to review. `scripts/package-release.sh` makes the same files locally in `release/`.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) (commits are signed off under the DCO) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Report vulnerabilities privately to security@openbrandexchange.com ([SECURITY.md](SECURITY.md)). Questions: hello@openbrandexchange.com.

## License

Apache License 2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE). The page footer carries a small "Works with Open Brand Exchange" badge.

An initiative of Richard Lindhout · Open Brand Exchange Foundation (in formation).
