# AGENTS.md

Notes for coding agents working in this repository. [README.md](README.md) covers the
patches, how each is verified and when to drop it.

## Versioning

SemVer with the upstream The Lounge version as build metadata: `vX.Y.Z+up<thelounge
version>` (`v1.0.0+up4.5.2`), published as images `X.Y.Z`, `X.Y` and `latest`, per the
[versioning standard](https://github.com/mbologna/.github/blob/main/VERSIONING.md).

- Never create, move or delete tags, and never edit a version to cut a release:
  auto-release tags from the commit types (`feat` minor; `fix`, `perf`, `revert` patch;
  `!` or a `BREAKING CHANGE:` footer major) and adds the metadata from the `FROM` line.
- A patch that changes behaviour users rely on is a breaking change: mark it `!`.
- A new The Lounge version in the `FROM` line releases on its own. Keep the line's
  `thelounge/thelounge:<version>@sha256:…` form, which the release reads.
