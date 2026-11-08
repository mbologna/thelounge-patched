FROM docker.io/thelounge/thelounge:4.5.2@sha256:16eaa53fd6bfc648d99f5c38ae391bd5404079e876856ef9793e4397630b27c2

# One script per upstream PR (open, or still to be drafted): see patches/ and
# the table in README.md. Each fails the build if the code it edits changed
# upstream, and verify.js checks the SQLite patches on a real database.
USER root
COPY patches/ /tmp/patches/
RUN node /tmp/patches/irc-framework-413-reconnect.js \
    && node /tmp/patches/thelounge-sqlite-wal.js \
    && node /tmp/patches/thelounge-5158-type-time-index.js \
    && node /tmp/patches/verify.js \
    && rm -rf /tmp/patches
USER node
