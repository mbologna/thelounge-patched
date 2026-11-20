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
| [`thelounge-keep-nick.js`](patches/thelounge-keep-nick.js) | When the nick is taken at connect, The Lounge appends a digit and saves that nick, so every later connect starts from it. It takes the real nick back only if the holder quits in a shared channel. With the patch the saved nick stays the configured one and The Lounge retries it every minute, backing off to every 10 minutes, and `/nick` of that same nick no longer cancels the retry. | Not opened yet (related: [#4816](https://github.com/thelounge/thelounge/issues/4816)) | The Lounge keeps the configured nick itself |
| [`thelounge-service-queries.js`](patches/thelounge-service-queries.js) | Every private message without a window opens a query window, so identifying to NickServ leaves a "NickServ" window behind (the server's reply, or with echo-message the client's own `IDENTIFY`, password included, which also lands in the message log), and so do bots that answer privately. With the patch, private messages from services go to the server window like notices, and the client's own message to a service, echoed back, isn't shown or stored. Services: NickServ, ChanServ, MemoServ, OperServ, HostServ, BotServ, SaslServ, plus the nicks in `THELOUNGE_SERVICE_NICKS` (comma-separated). | Not opened yet | The Lounge stops opening query windows for services |

Every patch edits the installed JavaScript and stops the build if the code it
expects is no longer there, so an upstream change can't silently drop a fix.
[`patches/verify.js`](patches/verify.js) then opens a fresh database through The
Lounge's own storage code and fails the build unless it is in WAL mode and has
the index. [`patches/verify-keep-nick.js`](patches/verify-keep-nick.js) drives the
patched nick code with stand-ins for the IRC connection and fails the build
unless the configured nick survives a collision, and
[`patches/verify-service-queries.js`](patches/verify-service-queries.js) drives the
message handler and fails it unless service messages stay out of query windows.

The two SQLite patches don't add a schema migration. The Lounge refuses to start
on a database whose schema version is newer than its own, so a migration with a
new version would make it impossible to go back to the official image. The
index uses the same name as #5158's migration, which skips it once released.
WAL mode is stored in the database file and stays after you switch back.

## Usage

```sh
docker run -d -p 9000:9000 -v thelounge:/var/opt/thelounge \
  ghcr.io/mbologna/thelounge-patched:4.5.2-r1
```

Install plugins and themes into the volume, the same way as with the official
image (`thelounge install <package>`). The image doesn't bundle any, because
the volume mounted on `/var/opt/thelounge` would hide them.

## Versioning

A release is the upstream The Lounge version, read from the `FROM` line in the
`Dockerfile`, plus this repository's release number on it: the git tag
`v4.5.2+r1` is the first release on The Lounge 4.5.2. A patch change, a base
image rebuild or a dependency update makes `r2`, and a new The Lounge version
starts again at `r1`. This is pattern B of the
[versioning standard](https://github.com/mbologna/.github/blob/main/VERSIONING.md).

Each release builds linux/amd64 and linux/arm64 images and pushes:

- `4.5.2-r1`, which never moves: pin it as `4.5.2-r1@sha256:…`;
- `4.5.2`, `4.5` and `latest`, which follow the newest release.

Renovate's default Docker versioning would read `-r1` as a fixed suffix and
never offer `-r2`. The shared preset (`github>mbologna/.github//renovate-config.json`)
gives this image regex versioning, so a consumer that extends it gets every
release.

[auto-release](https://github.com/mbologna/auto-release) tags on Mondays when a
`feat`, `fix`, `perf`, `revert` or breaking commit landed, or the `FROM` line
moved to a new The Lounge version; a CVE fix releases at once. Images built
before this scheme carry only the upstream version tag.

## When to retire this image

When the table above is empty. For #413 that takes more than a merge: The Lounge
pins irc-framework to a git commit in its `package.json`
(`github:kiwiirc/irc-framework#9578e59` in v4.5.2), not to a version range.
