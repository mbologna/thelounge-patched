FROM docker.io/thelounge/thelounge:4.5.2@sha256:16eaa53fd6bfc648d99f5c38ae391bd5404079e876856ef9793e4397630b27c2

USER root

# One script per upstream PR (open, or still to be drafted): see patches/ and
# the table in README.md. Each fails the build if the code it edits changed
# upstream, and verify.js checks the SQLite patches on a real database. The
# scripts are bind-mounted, so they never become a layer of the image.
RUN --mount=type=bind,source=patches,target=/tmp/patches \
    node /tmp/patches/irc-framework-413-reconnect.js \
    && node /tmp/patches/thelounge-sqlite-wal.js \
    && node /tmp/patches/thelounge-5158-type-time-index.js \
    && node /tmp/patches/verify.js

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
