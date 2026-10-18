# thelounge-patched

[![CI](https://github.com/mbologna/thelounge-patched/actions/workflows/ci.yml/badge.svg)](https://github.com/mbologna/thelounge-patched/actions/workflows/ci.yml)

The official [The Lounge](https://thelounge.chat) image with fixes that are
waiting to land upstream. Each fix is one script in [`patches/`](patches/),
matching one upstream pull request (open, or still to be written), so it can be
dropped as soon as a release of The Lounge includes it.

| Patch | What it fixes | Upstream | Drop when |
|---|---|---|---|
| [`irc-framework-413-reconnect.js`](patches/irc-framework-413-reconnect.js) | A network whose first connection fails (DNS not ready, a network hiccup), or whose registration fails, gives up with "will not reconnect" until a manual `/connect`. With the patch it retries with backoff. A kill within 5 seconds of registering (an aKill) is still not retried. | [kiwiirc/irc-framework#413](https://github.com/kiwiirc/irc-framework/pull/413) | A release of The Lounge pins an irc-framework commit that includes it |
| [`thelounge-5158-type-time-index.js`](patches/thelounge-5158-type-time-index.js) | With `deletionPolicy: "statusOnly"`, the storage cleaner's query has no matching index. On a large database it blocks the event loop for minutes every 5 minutes, and IRC traffic stops. | [thelounge/thelounge#5158](https://github.com/thelounge/thelounge/pull/5158) | A release of The Lounge includes it |
| [`thelounge-sqlite-wal.js`](patches/thelounge-sqlite-wal.js) | The message log uses SQLite's rollback journal, where any reader blocks the writer. A backup or digest job reading the database makes The Lounge's writes fail with "database is locked", and those messages are lost. WAL mode lets readers and the writer run side by side. | Not opened yet | The Lounge opens its database in WAL mode |

Every patch edits the installed JavaScript and stops the build if the code it
expects is no longer there, so an upstream change can't silently drop a fix.
[`patches/verify.js`](patches/verify.js) then opens a fresh database through The
Lounge's own storage code and fails the build unless it is in WAL mode and has
the index.

The two SQLite patches don't add a schema migration. The Lounge refuses to start
on a database whose schema version is newer than its own, so a migration with a
new version would make it impossible to go back to the official image. The
index uses the same name as #5158's migration, which skips it once released.
WAL mode is stored in the database file and stays after you switch back.

## Usage

```sh
docker run -d -p 9000:9000 -v thelounge:/var/opt/thelounge \
  ghcr.io/mbologna/thelounge-patched:4.5.2
```

Install plugins and themes into the volume, the same way as with the official
image (`thelounge install <package>`). The image doesn't bundle any, because
the volume mounted on `/var/opt/thelounge` would hide them.

The image tag is the upstream The Lounge version, read from the `FROM` line in
the `Dockerfile`. Images are built for linux/amd64 and linux/arm64 on every push
to `main`, and each build pushes that version tag again. A rebuild of the same
version therefore changes its digest, so pin `tag@sha256:…` and let Renovate
move the digest.

## When to retire this image

When the table above is empty. For #413 that takes more than a merge: The Lounge
pins irc-framework to a git commit in its `package.json`
(`github:kiwiirc/irc-framework#9578e59` in v4.5.2), not to a version range.
