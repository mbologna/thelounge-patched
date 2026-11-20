# AGENTS.md

Notes for coding agents working in this repository. [README.md](README.md) covers the
patches, how each is verified and when to drop it.

## Versioning

Upstream version plus release number: git tag `v<thelounge version>+r<N>` (`v4.5.2+r1`),
image `4.5.2-r1` plus the moving `4.5.2`, `4.5` and `latest` (pattern B of the
[versioning standard](https://github.com/mbologna/.github/blob/main/VERSIONING.md)).

- Never create, move or delete tags: auto-release tags from the commits. N goes up with
  every release on the same The Lounge version and back to 1 when the `FROM` line moves
  to a new one.
- Commit types decide whether a release is cut (`feat`, `fix`, `perf`, `revert`, breaking),
  not what the tag says. Write Conventional Commit subjects.
- The upstream version comes from the `FROM` line of the `Dockerfile`; keep its
  `thelounge/thelounge:<version>@sha256:…` form, which the release reads.
