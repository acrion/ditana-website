#!/usr/bin/env bash
# Build and publish the Ditana website.
#
# Builds the Astro site to ./dist/ and rsyncs it to the production server.
# Preserves the six directories that are managed separately (downloads,
# versions, ditana, ditana-testing, package-resources and build-history) by
# excluding them from --delete. build-history is written by the package
# pipeline rather than by this site, and the /builds/ dashboard reads it.
#
# Publishes nothing while the image of the current release, its .sha256 or its
# .sig is missing from the server's downloads directory, or while the image's
# size differs from the one its release notes state: the site would offer a
# release that cannot be downloaded. Nor while a translation is incomplete,
# outdated, or breaks a rule of its language: npm run i18n:check says which.
#
# The server is named by the ssh alias ditana-origin, which ~/.ssh/config maps
# to the origin's address and to the user that logs in. Cloudflare hides that
# address, and the repository is public, so it does not appear here.
#
# Run this from the website repository root.

set -euo pipefail

cd "$(dirname "$0")"

server=ditana-origin
webroot=/var/www/ditana.org

echo "→ Checking that the current release can be downloaded..."
node scripts/check-release-published.mjs "$server" "$webroot/downloads"

echo "→ Checking the translations..."
npm run i18n:check

echo "→ Building site..."
npm run build

echo "→ Publishing to production..."
rsync -avz --checksum --no-owner --no-group --delete \
    --exclude=/downloads \
    --exclude=/versions \
    --exclude=/ditana \
    --exclude=/ditana-testing \
    --exclude=/package-resources \
    --exclude=/build-history \
    --exclude=/docs/the-assistant/ica-benchmark-409f40f.log \
    ./dist/ "$server:$webroot/"

echo "✓ Done."
