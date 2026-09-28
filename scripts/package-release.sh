#!/usr/bin/env bash
# Packs the built dist/ into release assets: a tarball and a zip of the static files, a
# CycloneDX SBOM of the runtime dependencies, and SHA-256 checksums of all of them.
# Used by .github/workflows/release.yml; runs the same locally (nothing is uploaded):
#   npm ci && npm run build && scripts/package-release.sh [version]
set -euo pipefail
cd "$(dirname "$0")/.."

version="${1:-$(node -p "require('./package.json').version")}"
version="${version#v}"
pkg_version="$(node -p "require('./package.json').version")"
if [[ "$version" != "$pkg_version" ]]; then
  echo "✗ tag v$version does not match package.json version $pkg_version" >&2
  exit 1
fi
[[ -f dist/index.html && -d dist/locales ]] || { echo "✗ dist/ is missing; run npm run build first" >&2; exit 1; }

name="obx-admin-ui-$version"
out="release"
rm -rf "$out" && mkdir -p "$out/$name"
cp -R dist/. "$out/$name/"
cp README.md CHANGELOG.md "$out/$name/"

# Reproducible archives: sorted entries, fixed owner and mtime (the commit time).
epoch="$(git log -1 --format=%ct 2>/dev/null || date +%s)"
( cd "$out" && find "$name" -exec touch -h -d "@$epoch" {} + 2>/dev/null || find "$name" -exec touch -h -t "$(date -r "$epoch" +%Y%m%d%H%M.%S)" {} + )
if tar --version 2>/dev/null | grep -q GNU; then
  tar -C "$out" --sort=name --owner=0 --group=0 --numeric-owner --mtime="@$epoch" -cf - "$name" | gzip -n -9 > "$out/$name.tar.gz"
else
  ( cd "$out" && find "$name" -print | LC_ALL=C sort | tar -cf - --uid 0 --gid 0 -n -T - | gzip -n -9 > "$name.tar.gz" )
fi
( cd "$out" && find "$name" -print | LC_ALL=C sort | TZ=UTC zip -q -X -@ "$name.zip" )

# SBOM of what ships (runtime dependencies only).
npx --yes @cyclonedx/cyclonedx-npm@4 --omit dev --output-reproducible --output-format JSON --output-file "$out/$name.sbom.cdx.json" >/dev/null

rm -rf "$out/${name:?}"
sums="$(cd "$out" && { command -v sha256sum >/dev/null && sha256sum "$name".* || shasum -a 256 "$name".*; })"
printf '%s\n' "$sums" > "$out/SHA256SUMS"
echo "✓ release assets in $out/:"
ls -l "$out"
