# Serving the admin UI from a portal

For people who build or run an Open Brand Exchange portal (the Cloudflare, Google Cloud & Docker and web-hosting editions, or your own). The UI is a folder of static files; your portal serves it and answers the API it calls.

## 1. Get a release

Use a tagged release, never an arbitrary commit.

- **From git:** `dist/` on the tag `vX.Y.Z` is the release build (CI checks that it matches the source of that commit).
- **From the GitHub release:** `obx-admin-ui-X.Y.Z.tar.gz` (or `.zip`) holds the same files in a folder `obx-admin-ui-X.Y.Z/`, plus `README.md` and `CHANGELOG.md`. Verify it first:

```sh
sha256sum -c SHA256SUMS --ignore-missing
gh attestation verify obx-admin-ui-X.Y.Z.tar.gz --repo openbrandexchange/admin-ui   # built by this repository's release workflow
```

`obx-admin-ui-X.Y.Z.sbom.cdx.json` is a CycloneDX SBOM of the JavaScript that ships. `THIRD-PARTY-LICENSES.txt`, `LICENSE` and `NOTICE` are inside the folder; keep them next to the files you serve.

Versions follow semantic versioning. While the version is 0.x, a minor release may need something new from your portal (it says so under "Changed" or "Added" in the changelog); a patch release never does.

## 2. Routes

| Path | Serve |
|---|---|
| `/assets/*`, `/locales/*`, `/THIRD-PARTY-LICENSES.txt`, `/LICENSE`, `/NOTICE` | the file from the folder |
| `/admin/api/*` | your Node Admin API ([`spec/openapi/node-admin.yaml`](https://github.com/openbrandexchange/spec/blob/main/openapi/node-admin.yaml)) |
| `/obx/*`, `/.well-known/*` | the protocol |
| every other `GET` that accepts `text/html` | `index.html` (SPA fallback), including `/admin/...`, `/invite/{token}`, `/reset-password/{token}` |

**Sub-path.** All asset paths are relative. `index.html` has `<base href="/">`; to serve the portal under `/brand/`, rewrite only that tag to `<base href="/brand/">`. Every route and API call resolves against it.

## 3. Headers

The UI works under this Content-Security-Policy and needs nothing looser. Every Playwright run serves exactly this policy and fails on any violation, so it stays true.

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

- `img-src https:` is only needed when image URLs point to another host (signed URLs from object storage or a CDN). If every image comes from the portal itself, use `img-src 'self' data: blob:`.
- `data:` is the favicon; `blob:` is the image preview while a brand uploads.
- The UI never embeds itself or other sites: keep `frame-ancestors 'none'`.

Also send:

```
X-Content-Type-Options: nosniff
Referrer-Policy: same-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains     # only when served over HTTPS
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**Caching.** Files under `/assets/` have a content hash in their name: `Cache-Control: public, max-age=31536000, immutable`. `index.html` must be revalidated on every visit (`Cache-Control: no-cache`) so an upgrade reaches everyone at once. `/locales/*.json`: `max-age=3600` or `no-cache`.

## 4. What the UI expects from your API

- **Session and CSRF.** Cookie session; the UI reads `csrf_token` from `GET /admin/api/session` and sends it as `X-CSRF-Token` on every `POST`, `PUT`, `PATCH` and `DELETE`. On `403 csrf_failed` it re-reads the session once and retries.
- **PATCH is a JSON merge patch** (`application/merge-patch+json`, RFC 7396). Objects merge member by member and `null` removes a member. The UI relies on this: when a brand clears the text of one language (welcome text, portal name, image description), the patch carries `"en": null` for that language. A portal that replaces objects wholesale, or that stores `null` instead of removing the member, still shows correct results; one that ignores `null` keeps text the brand removed.
- **Errors** are `application/problem+json` with `obx_error`. The UI translates every error code of the spec; for an unknown code it shows your `detail`. Validation errors with `errors[].pointer` (JSON Pointer) appear next to the matching field.
- **401** anywhere: the UI re-reads the session and goes to `/login?redirect=…` only when the session is really gone.
- **Images without an image library.** Report `node.renditions_server_generated: false` in the settings and the brand's browser makes the web (max 2000 px JPEG) and square versions and uploads them with the original. The original bytes are never re-encoded.
- **Brand's portal name.** `branding.portal_name` (text per language) replaces the glossary's portal word; without a text for the reader's language the UI uses the brand's `en` text, then its first text, then the glossary word.

## 5. E-mails

`/locales/<lang>.json` holds every UI string, including the `email.*` groups (`invite`, `accessRequestReceived`, `accessRequestNew`, `accessApproved`, `accessRejected`, `zipReady`, `passwordReset`, plus the common lines). Use the recipient's language and fall back to `en`; placeholders are `{{name}}`. `/locales/index.json` lists the languages. How the lines are put together is described in the spec's `NOTES.md` ("Shared node conventions") so every edition sends the same e-mail.

## 6. Upgrading

1. Read the changelog between your version and the new one.
2. Replace the folder. Keeping the previous version's `assets/` files next to the new ones (they have different names) spares visitors who are in the middle of a session a reload; without them, an open tab that needs a file of the old version reloads itself once and continues on the new version.
3. Keep `index.html` uncached (section 3), so every new page load gets the new version.
4. Asset requests that do not exist must get a `404`, never `index.html`: the SPA fallback is only for requests that accept `text/html`.

## 7. Browsers

Current versions of Chrome, Edge, Firefox and Safari (desktop, iOS and Android), about the last two years. The build targets ES2023; there is no support for Internet Explorer or legacy Edge. JavaScript is required (`<noscript>` says so).
