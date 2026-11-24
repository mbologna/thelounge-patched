FROM docker.io/thelounge/thelounge:4.5.2@sha256:5c3776545c24c8e04ce9520d8aab7320209043aad246ac710dc3339bfda4c772

USER root

# Alpine's security fixes published since the upstream image was built.
RUN apk upgrade --no-cache

# One script per upstream PR (open, or still to be drafted): see patches/ and
# the table in README.md. Each fails the build if the code it edits changed
# upstream. verify.js checks the SQLite patches on a real database, and
# verify-keep-nick.js, verify-service-queries.js and verify-msgid-dedup.js
# check the nick, query window and msgid patches. The scripts are
# bind-mounted, so they never become a layer of the image.
RUN --mount=type=bind,source=patches,target=/tmp/patches \
    node /tmp/patches/irc-framework-413-reconnect.js \
    && node /tmp/patches/thelounge-sqlite-wal.js \
    && node /tmp/patches/thelounge-5158-type-time-index.js \
    && node /tmp/patches/thelounge-keep-nick.js \
    && node /tmp/patches/thelounge-service-queries.js \
    && node /tmp/patches/thelounge-msgid-dedup.js \
    && node /tmp/patches/verify.js \
    && node /tmp/patches/verify-keep-nick.js \
    && node /tmp/patches/verify-service-queries.js \
    && node /tmp/patches/verify-msgid-dedup.js

# The node base image also ships npm, npx, corepack and a global yarn. The
# Lounge needs none of them: `thelounge install` runs the yarn that is one of
# its own dependencies, under node. Removing them keeps their bundled
# dependencies, and those dependencies' CVEs, out of the image. The upstream
# image has no /tmp; earlier builds of this one did (root-owned, 0755), so
# it stays.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
        /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
        /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-v* \
    && install -d -m 0755 /tmp

USER node
