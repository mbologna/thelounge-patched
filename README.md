# thelounge-patched

[![CI](https://github.com/mbologna/thelounge-patched/actions/workflows/ci.yml/badge.svg)](https://github.com/mbologna/thelounge-patched/actions/workflows/ci.yml)

The official [The Lounge](https://thelounge.chat) image with two patches and
two packages added:

- `patch-connection.js`: irc-framework retries when the first connection fails
  on DNS or the network, or when the socket opens but registration fails,
  instead of giving up until a manual `/connect`. It still doesn't retry a
  network that kills you within 5 seconds of registering (an aKill). This is a
  backport of [kiwiirc/irc-framework#413](https://github.com/kiwiirc/irc-framework/pull/413),
  which fixes [kiwiirc/irc-framework#211](https://github.com/kiwiirc/irc-framework/issues/211).
- `patch-sqlite-busytimeout.js`: the SQLite message log sets `busy_timeout`, so
  a write waits for another connection's lock instead of failing with
  "database is locked".
- [thelounge-plugin-apprise-push](https://github.com/mbologna/thelounge-plugin-apprise-push)
  and [thelounge-theme-chat](https://github.com/mbologna/thelounge-theme-chat),
  installed from npm.

```sh
docker run -d -p 9000:9000 -v thelounge:/var/opt/thelounge \
  ghcr.io/mbologna/thelounge-patched:latest
```

Images are built for linux/amd64 and linux/arm64 on every push to `main` and
weekly. The upstream version is the `FROM` tag in the `Dockerfile`.

## When to retire this image

The reconnect fix is the reason this image exists. Merging #413 alone is not
enough: The Lounge pins irc-framework to a git commit in its `package.json`
(`github:kiwiirc/irc-framework#9578e59` in v4.5.2), not to a version range. The
stock `thelounge/thelounge` image is enough once a release of The Lounge pins
a commit that includes #413. Until then, `patch-connection.js` fails the build
if irc-framework's source no longer matches, so an upstream change can't
silently drop the fix.

The other two additions don't justify an image of their own:

- `busy_timeout` mattered while the message log used SQLite's rollback journal,
  where an external reader (for example a digest job copying the database)
  blocks writes. In WAL mode, readers no longer block the writer, so setting
  `PRAGMA journal_mode=WAL` on the log database once is enough. The setting
  persists in the file.
- `/var/opt/thelounge` is usually a volume, which hides the packages installed
  in the image. Install them into the volume instead, with
  `thelounge install thelounge-plugin-apprise-push thelounge-theme-chat`.
