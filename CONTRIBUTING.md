# Contributing

Thank you for helping. This is the shared web interface of every Open Brand Exchange portal, so a change here reaches brands and retailers in 25 languages through three portal editions. Small, focused pull requests are easiest to review.

## Before you start

- For anything bigger than a fix, open an issue first and describe the problem you want to solve.
- Security problems: never in a public issue, see [SECURITY.md](SECURITY.md).
- Changes to the API itself belong in the [spec](https://github.com/openbrandexchange/spec) repository first; the UI follows the spec.
- Be kind: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) applies everywhere in the project.

## Setting up

```sh
npm install
npm run mock          # the whole portal in your browser, no server needed
```

Log in as `admin@kestrel.example` / `kestrel-admin-2026` (brand) or `buyer@shop.example` / `kestrel-shop-2026` (retailer).

## What every change needs

```sh
npm run check         # lint, types, unit + component + language tests, build, bundle budget
npm run e2e           # Playwright: flows of both roles, accessibility (axe) and keyboard, desktop + phone
```

- **Tests test behaviour.** Component tests render the real app against the mock node (`tests/`); end-to-end tests drive a browser (`e2e/`). Do not assert on source code.
- **Words.** Follow the [glossary](https://github.com/openbrandexchange/spec/blob/main/docs/glossary.md): no protocol terms in the UI (say *EAN*, *automatic upload*, *API key for your software*). A new text needs all 25 languages in `src/locales/`; `npm test` fails on a missing key, plural form or placeholder. If you cannot translate a language, say so in the pull request and a maintainer will help.
- **States.** Every screen that loads data has a loading, empty and error state; forms validate next to the field; destructive actions ask first; success is confirmed where it happened (no success toasts).
- **Accessibility.** Keyboard reachable, visible focus, labels on every control, 4.5:1 text contrast. The axe tests must stay clean.
- **Size.** `npm run size` enforces the bundle budget. If you must raise it, do it in the same commit and say why.
- **`dist/`.** It is committed, because portals vendor it. Run `npm run build` and commit `dist/` with your change; CI checks that it matches.
- **Changelog.** Add a line under a new "Unreleased" heading in [CHANGELOG.md](CHANGELOG.md) for anything a user or a portal implementer notices.

## Sign your commits (DCO)

Contributions are accepted under the [Developer Certificate of Origin 1.1](https://developercertificate.org/): by signing off you state that you wrote the change or have the right to submit it under the project's licence (Apache-2.0). Add the sign-off with `git commit -s`, which appends

```
Signed-off-by: Your Name <you@example.com>
```

using your real name. No contributor licence agreement is needed.

## Licence

By contributing you agree that your contribution is licensed under the [Apache License 2.0](LICENSE).
