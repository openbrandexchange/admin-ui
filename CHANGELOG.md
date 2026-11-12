# Changelog

All notable changes to the admin UI. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/): while the version is 0.x, a minor release may change what a node has to serve or support; a patch release never does.

Each release on GitHub has `obx-admin-ui-<version>.tar.gz` and `.zip` (the static `dist/` build plus this changelog), a CycloneDX SBOM of the runtime dependencies and `SHA256SUMS`. `dist/` on `main` and on every tag is the same build.

## [0.2.0] - 2026-11-12

Article data for fashion, shoes, bags and luggage, following spec 0.2.0 ([proposal 0002](https://github.com/openbrandexchange/spec/blob/main/docs/proposals/0002-product-data.md)). Additive: against a 0.1 node every screen works as before and the new parts stay hidden.

### Added

- **Label information on the retailer's article page**, in label order: composition per part with "recycled" and "organic", "Contains non-textile parts of animal origin" when the brand says so, footwear materials (upper, lining and sock, outer sole: leather, coated leather, textile, other materials), care instructions as text in label order, country of origin and certifications (scheme by its own name, licence number, whether the article or a material is certified). Only what the brand stated is shown.
- **Sizes with their measurements**: second size (jeans 30/32), colour family, and a column per measurement any size has (H × W × D, weight, volume and expanded volume, handle drop, strap length, laptop size, heel and shaft height, inside leg), in cm, kg, l and inch formatted for the reader's language.
- **Features** as readable labels: shell, wheels, lock, expandable, closure, laptop compartment, water resistance, detachable and adjustable parts, fit, sleeve length, neckline. Features outside the registry show with their own key.
- The article kind (`item_subtype`, for example "Cabin size" or "Ankle boot") as a tag next to the product type; the product type "Luggage".
- **Brand admin, article screen**: the same label information, measurements and features as retailers see them, and a notice when the label information is incomplete, with what is missing, why and the legal basis. The article form edits the kind, "non-textile parts of animal origin", the footwear materials and the certifications; materials accept `(recycled)` and `(organic)`. The size dialog edits the second size, the colour family and all measurements.
- **Label warnings in import results** (`fibre_composition_missing`, `animal_origin_unknown`, `footwear_materials_missing`, `fibre_percentages_not_100`): marked "Label", explained in plain words with the legal basis (Regulation (EU) No 1007/2011, Directive 94/11/EC), and stated to be warnings that do not block publishing.
- All new texts in the 25 languages; the legal line "Contains non-textile parts of animal origin" and the footwear words follow the official wording of each language. Certification schemes keep their own names (GOTS, OEKO-TEX® STANDARD 100, …).
- Mock mode: the spec's 0.2 fixtures (11 articles, among them the suitcase KO-1008, the laptop bag KO-1009 and the Chelsea boot KO-1010, with their images), and a checked import with label warnings in the import history. The mock's article data CSV has the 0.2 columns of the import format.

### Changed

- The API types are generated from spec 0.2.0. Materials are shown and saved with the 0.2 fibre flags: the 0.1 keys `recycled_polyester`, `organic_cotton` … read as the fibre with "recycled" or "organic".
- Saving an article or a size keeps the article data the form does not edit (features, attributes), so nothing a PIM or import sent is lost.
- The mock demo data is stored under a new key, so an open demo tab picks up the new articles.

### Fixed

- Mock mode: the catalog's article data download no longer answers "not found".

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
- The scheduled-import form offers only the kinds of source the node reports in `settings.node.source_kinds` (the Portal for Cloudflare cannot open SFTP); all three when the node does not say.
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
