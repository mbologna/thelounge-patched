# thelounge-patched

[![CI](https://github.com/mbologna/thelounge-patched/actions/workflows/ci.yml/badge.svg)](https://github.com/mbologna/thelounge-patched/actions/workflows/ci.yml)

The official [The Lounge](https://thelounge.chat) image with fixes that are
waiting to land upstream. Each fix is one script in [`patches/`](patches/),
matching one upstream pull request (open, or still to be written), so it can be
dropped as soon as a release of The Lounge includes it.

| Patch | What it fixes | Upstream | Drop when |
|---|---|---|---|
| [`irc-framework-413-reconnect.js`](patches/irc-framework-413-reconnect.js) | A network whose first connection fails (DNS not ready, a network hiccup), or whose registration fails, gives up with "will not reconnect" until a manual `/connect`. With the patch it retries with backoff. A kill within 5 seconds of registering (an aKill) is still not retried. | [kiwiirc/irc-framework#413](https://github.com/kiwiirc/irc-framework/pull/413), pin bump asked in [thelounge#5177](https://github.com/thelounge/thelounge/issues/5177) | A release of The Lounge pins an irc-framework commit that includes it |
| [`thelounge-5158-type-time-index.js`](patches/thelounge-5158-type-time-index.js) | With `deletionPolicy: "statusOnly"`, the storage cleaner's query has no matching index. On a large database it blocks the event loop for minutes every 5 minutes, and IRC traffic stops. | [thelounge/thelounge#5158](https://github.com/thelounge/thelounge/pull/5158) | A release of The Lounge includes it |
| [`thelounge-sqlite-wal.js`](patches/thelounge-sqlite-wal.js) | The message log uses SQLite's rollback journal, where any reader blocks the writer. A backup or digest job reading the database makes The Lounge's writes fail with "database is locked", and those messages are lost. WAL mode lets readers and the writer run side by side. | [thelounge/thelounge#5175](https://github.com/thelounge/thelounge/pull/5175) (closes [#4773](https://github.com/thelounge/thelounge/issues/4773)) | The Lounge opens its database in WAL mode |
| [`thelounge-keep-nick.js`](patches/thelounge-keep-nick.js) | When the nick is taken at connect, The Lounge appends a digit and saves that nick, so every later connect starts from it. It takes the real nick back only if the holder quits in a shared channel. With the patch the saved nick stays the configured one and The Lounge retries it every minute, backing off to every 10 minutes, and `/nick` of that same nick no longer cancels the retry. | Covered in part by the open [thelounge/thelounge#4973](https://github.com/thelounge/thelounge/pull/4973), which keeps the saved nick but reclaims it only when the holder quits or changes nick, without retrying (related: [#4350](https://github.com/thelounge/thelounge/issues/4350), [#4816](https://github.com/thelounge/thelounge/issues/4816)) | The Lounge keeps the configured nick and retries it itself |
| [`thelounge-service-queries.js`](patches/thelounge-service-queries.js) | Every private message without a window opens a query window, so identifying to NickServ leaves a "NickServ" window behind (the server's reply, or with echo-message the client's own `IDENTIFY`, password included, which also lands in the message log), and so do bots that answer privately. With the patch, private messages from services go to the server window like notices, and the client's own message to a service, echoed back, isn't shown or stored. Nothing a service sends counts as a highlight, in any window, so NickServ's "You are now logged in as …" or a bot's "nick: invite sent" no longer notifies on every connect. Services: NickServ, ChanServ, MemoServ, OperServ, HostServ, BotServ, SaslServ, plus the nicks in `THELOUNGE_SERVICE_NICKS` (comma-separated). | [thelounge/thelounge#5176](https://github.com/thelounge/thelounge/pull/5176) | The Lounge stops opening query windows for services |
| [`thelounge-msgid-dedup.js`](patches/thelounge-msgid-dedup.js) | Servers and bouncers can send a message the client already has: ergo sends a private conversation again (an IRCv3 `chathistory` batch) when The Lounge opens the query window for a new sender, and bouncers play back their buffer on reconnect. The Lounge stores and notifies each copy, so the first private message from a new sender is logged twice, counted as two unread and notified twice, in the browser and through Web Push. With the patch, a message whose IRCv3 `msgid` matches one of the last 200 messages of its window is dropped before it is stored or notified. Messages without a `msgid` are handled as before. | PR to come (branch mbologna/thelounge:msgid-dedup) | A release of The Lounge drops messages it already holds by `msgid` |

Every patch edits the installed JavaScript and stops the build if the code it
expects is no longer there, so an upstream change can't silently drop a fix.
[`patches/verify.js`](patches/verify.js) then opens a fresh database through The
Lounge's own storage code and fails the build unless it is in WAL mode and has
the index. [`patches/verify-keep-nick.js`](patches/verify-keep-nick.js) drives the
patched nick code with stand-ins for the IRC connection and fails the build
unless the configured nick survives a collision, and
[`patches/verify-service-queries.js`](patches/verify-service-queries.js) drives the
message handler and fails it unless service messages stay out of query windows
and never highlight. [`patches/verify-msgid-dedup.js`](patches/verify-msgid-dedup.js)
replays a private message with the same `msgid` and fails the build unless it is
stored and notified once.

The two SQLite patches don't add a schema migration. The Lounge refuses to start
on a database whose schema version is newer than its own, so a migration with a
new version would make it impossible to go back to the official image. The
index uses the same name as #5158's migration, which skips it once released.
WAL mode is stored in the database file and stays after you switch back.

## Usage

```sh
docker run -d -p 9000:9000 -v thelounge:/var/opt/thelounge \
  ghcr.io/mbologna/thelounge-patched:1.0.0
```

Install plugins and themes into the volume, the same way as with the official
image (`thelounge install <package>`). The image doesn't bundle any, because
the volume mounted on `/var/opt/thelounge` would hide them.

`THELOUNGE_SERVICE_NICKS` (`-e THELOUNGE_SERVICE_NICKS=Q,X`) adds nicks to
the services whose private messages stay out of query windows.
[thelounge-plugin-apprise-push](https://github.com/mbologna/thelounge-plugin-apprise-push)
2.0 and later reads the same variable and sends no push notification for
those nicks.

## Versioning

Releases are this repository's own SemVer with the upstream The Lounge version
as build metadata: the git tag `v1.0.0+up4.5.2` is version 1.0.0 of these
patches, on The Lounge 4.5.2, read from the `FROM` line in the `Dockerfile`.
[auto-release](https://github.com/mbologna/auto-release) cuts them on Mondays
from the Conventional Commits (`feat` minor; `fix`, `perf`, `revert` patch; a
breaking change major), and a new The Lounge version releases on its own; a CVE
fix releases at once. See the
[versioning standard](https://github.com/mbologna/.github/blob/main/VERSIONING.md).

Each release builds linux/amd64 and linux/arm64 images, tagged `X.Y.Z`, `X.Y`
and `latest` (image tags can't carry the `+`). Pin `X.Y.Z@sha256:…`; the
release notes and the git tag say which The Lounge version it is.

## When to retire this image

When the table above is empty. For #413 that takes more than a merge: The Lounge
pins irc-framework to a git commit in its `package.json`
(`github:kiwiirc/irc-framework#9578e59` in v4.5.2), not to a version range.

None can be dropped yet (checked 2026-11-23):

- irc-framework merged #413 on 2026-11-19, but The Lounge still pins an older
  commit on the `max/05-01-ircv3` branch, which it needs for multiline; the
  pin bump is asked in
  [thelounge#5177](https://github.com/thelounge/thelounge/issues/5177)
  ([#45](https://github.com/mbologna/thelounge-patched/issues/45)).
- #5158 is still open
  ([#46](https://github.com/mbologna/thelounge-patched/issues/46)).
- The Lounge still opens its database in rollback-journal mode; pull request
  [thelounge#5175](https://github.com/thelounge/thelounge/pull/5175)
  ([#47](https://github.com/mbologna/thelounge-patched/issues/47)).
- The Lounge still saves the fallback nick; the open pull request
  [thelounge#4973](https://github.com/thelounge/thelounge/pull/4973) fixes
  that but doesn't retry the nick
  ([#48](https://github.com/mbologna/thelounge-patched/issues/48)).
- The Lounge still opens query windows for services; pull request
  [thelounge#5176](https://github.com/thelounge/thelounge/pull/5176)
  ([#49](https://github.com/mbologna/thelounge-patched/issues/49)).

## Related projects

- [thelounge-digest](https://github.com/mbologna/thelounge-digest): a
  scheduled digest of The Lounge's channel logs, sent through Apprise.
- [thelounge-plugin-apprise-push](https://github.com/mbologna/thelounge-plugin-apprise-push):
  push notifications for highlights and private messages through Apprise.
- [thelounge-theme-chat](https://github.com/mbologna/thelounge-theme-chat): a
  light and dark theme with digest-style messages.
