# Changelog

All notable changes to the admin UI. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/): while the version is 0.x, a minor release may change what a node has to serve or support; a patch release never does.

Each release on GitHub has `obx-admin-ui-<version>.tar.gz` and `.zip` (the static `dist/` build plus this changelog), a CycloneDX SBOM of the runtime dependencies and `SHA256SUMS`. `dist/` on `main` and on every tag is the same build.

## [0.1.1] - 2026-09-28

### Fixed

- Clearing the text of one language (welcome text, portal name, image description) now really removes it. The UI sends `null` for that language in the merge patch; before, the node kept the old text.
- A scheduled import that changes from weekly to daily (or to hourly) no longer keeps the old weekday and time.
- The approval notice with the invitation link appears after approving an access request, also against a real node.
- An invitation link is never read again after it was accepted (a spent link no longer shows "no longer valid" right after creating the account).
- Phones showed a second "Log out" button in the retailer portal header.
- In the admin sidebar, "Log out" has its own row and no longer wraps next to the language picker.
- The brand admin overview no longer scrolls sideways on phones when retailer names are long.
- The invitation page names both the brand and the retailer the account is for.

### Added

- Every screen that loads data shows a "Try again" button when loading fails (not for errors that would fail again, such as "not found"). The dashboard shows "—" for numbers it could not load instead of "…" forever.
- The catalog says when the selection is full instead of ignoring the tick; failed selection changes show an inline error.
- Keyboard: a "Skip to content" link on every page, arrow keys in tab lists, focus moves to the new content after a page change and returns to the button that opened a dialog, a visible focus ring on article tiles, and scrollable tables and code blocks can be reached with Tab.
- A tab left open while the portal is upgraded reloads once to the new version instead of failing on a file of the old one.
- `dist/THIRD-PARTY-LICENSES.txt`, `dist/LICENSE` and `dist/NOTICE`, so every vendored copy carries its licences.
- [docs/node-integration.md](docs/node-integration.md) for portal implementers: routes, sub-paths, the Content-Security-Policy and other headers (every end-to-end test now runs under that policy), caching, API expectations, e-mails, upgrading, browsers.
- Release workflow (tag `v*`): archives, SBOM, checksums and a draft GitHub release. CI on every push and pull request: lint, typecheck, unit and component tests, all 25 languages, build, bundle size budget, `dist/` up to date, licence check, dependency audit, Playwright end-to-end and accessibility tests, and the API types and glossary checked against the spec.
- `SECURITY.md`, `CONTRIBUTING.md` (DCO sign-off), `CODE_OF_CONDUCT.md`, issue and pull request templates, Dependabot.

### Changed

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
