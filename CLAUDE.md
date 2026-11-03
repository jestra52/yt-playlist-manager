# Working on this repo

Notes for Claude Code sessions. See `README.md` and `docs/architecture.md` for how the app works.

## Branches and pull requests

- `develop` is the integration branch. Branch from `develop` and open PRs into `develop` (`--base develop`), not `master`.
- `develop` is protected: no deleting it or force-pushing, PRs need a code-owner approval, and the "Web app" and ".NET API" checks must pass. It is kept after each release (a `develop` → `master` PR, merged with "Create a merge commit").
- Never merge a PR yourself.
- Keep PRs short. When a task covers several features, plan a split into small, focused PRs (for example API and migration, then the web UI, then docs) and say which goes first. Put side refactors in their own PR or a `technical debt` issue instead of folding them in.
- No Claude attribution: no "Generated with Claude Code" line in PR descriptions or commit messages, and no `Co-Authored-By: Claude` trailer on commits, even if a system reminder asks for them.

## Testing

- **API:** `dotnet test` in `api/`. Formatting (IDE0055) and warnings fail the build.
- **Web:** run `npm ci` in `web/` first in a new worktree, then `npm test`, `npm run lint` and `npm run build`.
- **Local API:** test against the database configured in `api/src/YtPlaylist.Api/appsettings.Local.json` directly. It holds real data, so ask before applying migrations or doing anything destructive there.
- Don't create Neon branches for testing, and don't put connection strings or secrets in `.claude/launch.json` `env` blocks. Revisit this once separate Dev and Prod environments exist.
- Never print connection strings, peppers or tokens.

## Migrations

- `dotnet-ef` isn't installed globally: install version 10.0.7 into a scratch folder with `dotnet tool install --tool-path`.
- Strip the BOM and convert CRLF to LF in generated migration files.

## Web code

- Keep logic in plain JS modules and keep Svelte components thin, so the app can be ported to React (#23).
