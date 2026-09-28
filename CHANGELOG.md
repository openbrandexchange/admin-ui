# Changelog

All notable changes to the admin UI. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/): while the version is 0.x, a minor release may change what a node has to serve or support; a patch release never does.

Each release on GitHub has `obx-admin-ui-<version>.tar.gz` and `.zip` (the static `dist/` build plus this changelog), a CycloneDX SBOM of the runtime dependencies and `SHA256SUMS`. `dist/` on `main` and on every tag is the same build.

## [0.1.1] - 2026-09-28

### Fixed

- The file version picked in the "prepare a zip" dialog is the one the zip is made in. Each part of the page kept its own copy of the remembered choice, so a retailer who picked Web got originals.
- Website fields (setup wizard, brand settings, add retailer, access request) accept an address without `https://` and complete it when you leave the field. The add-retailer form checks the address inline instead of showing the node's raw message.
- An import with warnings only no longer says that rows with a problem were skipped.
- Approving an access request that asked for an API key offers "Show the key": a retailer who asked on the web page has no software that collects the key, so nobody could reach it before.
- After a wrong setup code, the refusal no longer shows up again on the next step once the right code is entered.
- A scheduled import with an `http://` address says it must start with `https://` instead of "points to a private network", and no longer shows the node's English detail with a `/config/url` code under it.
- A successful connection test shows its translated result once, not followed by the node's English sentence.
- Error boxes no longer show technical field codes such as `/config/url`.
- Checkboxes keep their size next to a long label.
- The not-found and error pages have their own main landmark, so screen readers can jump to their content.
- Clearing the text of one language (welcome text, portal name, image description) now really removes it. The UI sends `null` for that language in the merge patch; before, the node kept the old text.
- A scheduled import that changes from weekly to daily (or to hourly) no longer keeps the old weekday and time.
- The approval notice with the invitation link appears after approving an access request, also against a real node.
- An invitation link is never read again after it was accepted (a spent link no longer shows "no longer valid" right after creating the account).
- Phones showed a second "Log out" button in the retailer portal header.
- In the admin sidebar, "Log out" has its own row and no longer wraps next to the language picker.
- The brand admin overview no longer scrolls sideways on phones when retailer names are long.
- The invitation page names both the brand and the retailer the account is for.

### Added

- The setup wizard takes over a setup code from the address fragment (`/setup#code=…`), so a node's installer can open the wizard with the code filled in. The fragment never reaches the server.
- Settings → About this installation shows the cron address (and when it was last called) on nodes that report `settings.node.cron`.
- Inviting someone at a shop asks for the language of the e-mail, preset from the shop's country (a shop in Austria gets German).
- The admin's "Get started" list asks to set up e-mail while the node reports that it has none, and links to Settings → System: without e-mail, retailers get no invitations, access decisions or password links.
- Every screen that loads data shows a "Try again" button when loading fails (not for errors that would fail again, such as "not found"). The dashboard shows "—" for numbers it could not load instead of "…" forever.
- The catalog says when the selection is full instead of ignoring the tick; failed selection changes show an inline error.
- Blocking an account and removing the brand logo ask for confirmation first (unblocking does not). A logo over 5 MB gets an inline message instead of being ignored.
- Keyboard: a "Skip to content" link on every page, arrow keys in tab lists, focus moves to the new content after a page change and returns to the button that opened a dialog, a visible focus ring on article tiles, and scrollable tables and code blocks can be reached with Tab.
- A tab left open while the portal is upgraded reloads once to the new version instead of failing on a file of the old one.
- `dist/THIRD-PARTY-LICENSES.txt`, `dist/LICENSE` and `dist/NOTICE`, so every vendored copy carries its licences.
- [docs/node-integration.md](docs/node-integration.md) for portal implementers: routes, sub-paths, the Content-Security-Policy and other headers (every end-to-end test now runs under that policy), caching, API expectations, e-mails, upgrading, browsers.
- Release workflow (tag `v*`): archives, SBOM, checksums and a draft GitHub release. CI on every push and pull request: lint, typecheck, unit and component tests, all 25 languages, build, bundle size budget, `dist/` up to date, licence check, dependency audit, Playwright end-to-end and accessibility tests, and the API types and glossary checked against the spec.
- `SECURITY.md`, `CONTRIBUTING.md` (DCO sign-off), `CODE_OF_CONDUCT.md`, issue and pull request templates, Dependabot.

### Changed

- Downloads start as the web version until the retailer picks another one: ready for a webshop and much smaller than originals.
- Download texts no longer promise an e-mail (a portal without e-mail sends none); they point to Downloads.
- The invitation says the brand gave the shop access and invited you; several languages read "on behalf of the shop" before.
- The setup code hint no longer says the code is only in the log.
- The setup wizard says the company name is what retailers see at the top of every page, and that the first brand is just the first one in the catalog (it said retailers would see the brand).
- Secondary text is one shade darker, so it keeps a 4.5:1 contrast (WCAG AA) on the light grey backgrounds too.
- The API types are generated from the spec version that includes `branding.portal_name`.

## [0.1.0] - 2026-09-28

First release.

- The retailer portal: catalog with search and filters, article page, selection, EAN list, downloads of originals, web and square versions, article data as CSV, background zips for large sets, account and API keys for the retailer's software.
- The brand admin: dashboard, catalog and article editor (sizes and EANs, images, usage rights, AI provenance), imports with row-level problems, automatic upload (scheduled imports, access keys, ready-made recipes, notifications), retailers and their access, access requests, statistics, settings (brand and look, portal, defaults, team, account, system).
- Public pages: first-run setup, log in, password reset, invitations, request access.
- 25 languages (the 24 official EU languages and Norwegian Bokmål) with the project glossary, including the e-mail texts nodes send (`dist/locales/`).
- A mock mode that runs the whole portal API in the browser on the spec's fictional Kestrel Outfitters data.

[0.1.1]: https://github.com/openbrandexchange/admin-ui/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/openbrandexchange/admin-ui/releases/tag/v0.1.0
