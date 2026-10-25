FROM docker.io/thelounge/thelounge:4.5.2@sha256:345af9c9d48d789f71a09d172fbc1bd3f250d47059c5a317497b67bd315989b7

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
