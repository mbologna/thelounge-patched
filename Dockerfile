FROM docker.io/thelounge/thelounge:4.5.2@sha256:708fbedbec293e6a80c30300a8786355539035f9ca35751af40d96eec280b710

# Patch irc-framework to retry on DNS/connection failures at container startup.
# Without this, a DNS failure on the first-ever connect attempt (e.g. container
# starts during a brief network hiccup) causes The Lounge to give up immediately
# and never reconnect until a user manually runs /connect.
#
# Fix: https://github.com/kiwiirc/irc-framework/issues/211
USER root
COPY patch-connection.js /tmp/patch-connection.js
RUN node /tmp/patch-connection.js && rm /tmp/patch-connection.js

# Patch thelounge sqlite message storage to wait on locks (busy_timeout)
# instead of failing writes with "database is locked" while an external
# reader (chat-digest snapshot) briefly holds a read lock on the log DB.
COPY patch-sqlite-busytimeout.js /tmp/patch-sqlite-busytimeout.js
RUN node /tmp/patch-sqlite-busytimeout.js && rm /tmp/patch-sqlite-busytimeout.js

# Install apprise-push plugin and chat theme from npm
RUN mkdir -p /var/opt/thelounge/packages && \
    cd /var/opt/thelounge/packages && \
    npm install thelounge-plugin-apprise-push thelounge-theme-chat
USER node
