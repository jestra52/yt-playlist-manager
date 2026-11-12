# Yuzu Tapes Playlist Manager 🍋

Keep your own playlists of videos (music, talks, recipes, anything you want to keep), put them in order, keep notes, and play them in place. YouTube is the first source. Each video shows its artist, guessed from YouTube and editable, and a playlist imported from YouTube can be synced with it again later. Everything is stored in a **SQLite database inside your browser**, so the app works offline. An **ASP.NET Core API** with **Entity Framework Core** syncs that database with **PostgreSQL** (Neon) so your phone and laptop stay in step. The web app is hosted on **Netlify**; the API runs as a Docker container on **Render**, and Netlify forwards `/api` to it.

## Contents

- [Screenshots](#screenshots)
- [How it fits together](#how-it-fits-together)
- [Project layout](#project-layout)
  - [Layers](#layers) · [Styles](#styles) · [How sync works](#how-sync-works)
- [Run it locally](#run-it-locally)
  - [The web app (web-react)](#the-web-app-web-react) · [Local settings](#local-settings)
- [Deploy](#deploy)
  - [1. Neon](#1-create-the-database-on-neon) · [2. Render](#2-deploy-the-api-on-render) · [3. Netlify](#3-deploy-the-web-app-on-netlify) · [4. Connect your devices](#4-connect-your-devices) · [Automatic deploys](#automatic-deploys-only-what-changed)
- [Versions and releases](#versions-and-releases)
- [Importing YouTube playlists](#importing-youtube-playlists)
  - [Syncing a playlist from YouTube](#syncing-a-playlist-from-youtube)
- [Reports and Compare](#reports-and-compare)
- [Notes and limits](#notes-and-limits)
- [License](#license)
- [Trademark](#trademark)
- [Architecture](docs/architecture.md) (separate page)

## Screenshots

| Light | Dark |
| --- | --- |
| ![A City Pop playlist in the light theme: sidebar with two playlists, the All and Missing tabs, the Sort control and search, and numbered videos with thumbnails, each showing its artists, such as "Ryo Tanabe & Aoi Kanda" or "Aoi Kanda feat. Sora Minami", and the channel that uploaded it](docs/screenshots/playlist-light.png) | ![The same playlist in the dark theme](docs/screenshots/playlist-dark.png) |

**Compare with an old report.** Load a report you saved earlier to see which videos the playlist no longer has, then add them back in their old place:

![Compare dialog with a report that has artists: 12 items in the report, 10 still here, 2 missing, listed by number, title and artist](docs/screenshots/compare-report.png)

**Playing.** Click a thumbnail to play a video in place. The video stays in view while the list scrolls, and **Previous** and **Next** move through the playlist, skipping Missing items. **Shuffle** changes what they pick, in a shuffled order that doesn't repeat, and resets when you switch playlists. It never changes the playlist. Nothing moves on by itself.

**Moving a video.** Click the number on a row to type the position it should go to, or send it to the **Top** or **Bottom**. The number is always the video's place in the whole playlist, even with a filter or search on.

**Missing items** wait for their YouTube link; paste it and the video gets its title, channel and thumbnail. Any other video's link can be changed with **Change link**, keeping its notes and place:

![Missing filter showing a video deleted on YouTube and a placeholder from a report, each with a box to paste a YouTube link](docs/screenshots/missing-items.png)

**Sorting.** **Sort** shows a playlist by **Artist** (A to Z, then by title), **Title**, or with **Missing** videos first, and works together with the filter and search. It only changes the view: the playlist keeps its order, rows keep their numbers, and moving a video waits until you're back on **Default**. Switching playlists goes back to **Default**.

**Artists.** Under each title the app shows the artists, then the channel that uploaded the video: "Ryo Tanabe & Aoi Kanda · uploaded by …". A video can have several main artists and featured ones ("Aoi Kanda feat. Sora Minami"). They're guessed from YouTube Music's "Artist - Topic" channels and from titles like "Artist - Song", "A & B - Song", "A × B" or "Song (feat. C)"; a guess has an ⓘ badge, because it may be wrong. Click the ⓘ or the pencil to edit them: add a main or featured artist, reorder or remove them, with suggestions from your library that keep one spelling for each. Once your library knows a name with "&" or "," in it, like a band, guesses keep it whole. Click an artist to search for them, which finds the videos where they're main or featured.

**Videos deleted on YouTube** keep their place: they show a "Deleted" thumbnail, count under the **Missing** filter, and wait for another link, like Missing items.

<img src="docs/screenshots/phone.png" alt="The playlist on a phone in the dark theme, with buttons for YouTube, compare, report and delete in the header" width="300" align="right" />

**On a phone** the sidebar folds away behind the menu button, as it does in any window under 1024px, and the header buttons shrink to icons: YouTube, compare, download report, delete.

The screenshots use sample data and placeholder thumbnails.

<br clear="right" />

## How it fits together

```
┌──────────── Browser ────────────┐       ┌── Netlify ──┐       ┌────── Render ───────┐      ┌──── Neon ────┐
│ React components (daisyUI)      │       │ web app     │       │ ASP.NET Core API    │      │ PostgreSQL   │
│ ↓ call                          │ HTTPS │             │ HTTPS │  POST /api/sync     │ EF   │ playlists    │
│ Redux slices + thunks           │──────►│ /api/* proxy│──────►│  GET  /api/oembed   │─────►│ videos       │
│ ↓ read / write                  │       └─────────────┘       │  GET  /api/playlist │ Core │ sync_counter │
│ Repositories ↔ SQLite (sql.js)  │                             └─────────────────────┘      └──────────────┘
│ ↕ saved to IndexedDB            │
└─────────────────────────────────┘
```

Components, deployment and data model (ER) diagrams: [docs/architecture.md](docs/architecture.md).

## Project layout

```
netlify.toml                 Netlify build for the web app (web-react)
render.yaml                  Render Blueprint for the API container
.github/workflows/ci.yml     builds and tests the web app and the API on every push
web-react/                   the web app: React 19, Redux Toolkit, daisyUI, Vite, TypeScript
  index.html                 page shell; loads public/theme-boot.js before the first paint
  public/
    _headers                 security headers (CSP) for Netlify
    theme-boot.js            sets the saved or system theme so a reload never flashes
  scripts/write-redirects.mjs  writes the Netlify /api proxy rule from API_ORIGIN
  src/
    main.tsx                 opens the database, creates the store, loads the library, starts auto-sync
    App.tsx                  the store provider and the app shell
    app/store.ts             Redux store (one slice per domain), typed hooks and thunks
    domains/
      playlists/             playlists.slice, .selectors, .thunks; backups.thunks
        components/          page/ (header, name, description), sidebar/, reports/ (Compare, backups), youtube/
      videos/                videos.slice (filter, search, sort, player, shuffle), .selectors, .thunks
        components/          add/, list/, row/ (number, artists, notes, actions), toolbar/, player/
      sync/                  sync.slice, .selectors, .thunks; chain.thunks, pairing.thunks;
                             auto-sync.ts (listener middleware that syncs after edits)
        components/          chain/, code/, connection/, settings/, start/, status/
      ui/                    ui.slice (theme, sidebar, settings dialog, notices)
        components/          layout/ (shell, sidebar), dialog/, feedback/ (notices), appearance/
      */*.test.ts(x)         Vitest + Testing Library, against a real SQLite database (sql.js)
    shared/components/       Icon
    styles/
      tailwind.css           Tailwind v4 + daisyUI 5 + the light and dark themes
      _tokens.scss           Sass tokens (mapped to daisyUI CSS variables) for *.module.scss
packages/
  core/                      shared logic in TypeScript, no UI (@ytpm/core)
    src/db/                  SQLite wrapper (sql.js + Drizzle), tables.ts, generated migrations,
                             IndexedDB persistence
    src/playlists/           playlists and backups repositories; report.ts, report-compare.ts
                             (reports and Compare); youtube-sync.ts (comparing with YouTube)
    src/videos/              videos.repository.ts; youtube.ts (links), artist.ts (guessing an artist),
                             artist-credits.ts (several artists); metadata and playlist clients
    src/sync/                sync.repository.ts (cursor, settings, dirty rows), sync.client.ts (HTTP);
                             chain, recovery and pairing codes, QR scanning, reminders
  eslint-config/             shared ESLint rules (@ytpm/eslint-config)
api/                         .NET 10 solution (YtPlaylist.slnx)
  Dockerfile                 API image for Render
  compose.yaml               local PostgreSQL for development
  stylecop.globalconfig      one type per file, named after the type (checked on every build)
  src/
    YtPlaylist.Models/          entities and every DTO: the API's request/response contracts (Api/, Sync/,
                                YouTube/) and YouTube's responses (YouTube/DataApi, YouTube/OEmbed);
                                no references to other projects
    YtPlaylist.Domain/          ID rules, limits, validation errors
    YtPlaylist.Application/     use cases (SyncService), validation, ports (ISyncStore, YouTube sources),
                                errors in YouTube/Exceptions
    YtPlaylist.Infrastructure/  EF Core: AppDbContext, entity configurations, migrations, EfSyncStore;
                                HTTP clients for YouTube oEmbed, Data API and playlist feed
    YtPlaylist.Api/             ASP.NET Core minimal API: endpoints, bearer-token auth, CORS
  tests/YtPlaylist.Tests/       xUnit: validation, sync store (SQLite + PostgreSQL), YouTube clients, endpoints
```

### Layers

Each domain in `web-react/src/domains` is split the same way, and calls only go downwards:

1. **Presentation:** React components styled with daisyUI classes, one component per file. Anything daisyUI doesn't cover goes in a `*.module.scss` next to the component; there are no inline styles.
2. **State:** one Redux Toolkit slice per domain holds what the views need (the loaded playlists and videos, the filter, search and sort, the player, sync status). Selectors derive the rest, such as the visible rows or what plays next, so components only read and dispatch.
3. **Use cases:** thunks (`*.thunks.ts`) run the domain's actions: `addEntries`, `moveToPosition`, `saveArtists`, `syncNow`… They write through `@ytpm/core` and then dispatch what changed.
4. **Data:** repositories in `packages/core` query the local database with Drizzle ORM, so values always travel as parameters and never as SQL text; clients talk HTTP.
5. **Core:** the SQLite wrapper, the table definitions, the migrations and the IndexedDB persistence.

Domains don't call sync: `auto-sync.ts` is a listener middleware that sees the slices' "changed" actions and schedules a background sync, so playlists and videos don't depend on it.

The API follows the same idea with one project per layer: **Api** (HTTP) → **Application** (use cases and interfaces) → **Domain** (entities and rules), with **Infrastructure** implementing the Application interfaces with EF Core and `HttpClient`.

### Styles

Tailwind v4 and daisyUI are loaded from plain CSS (`styles/tailwind.css`), because Tailwind v4 reads its own directives and isn't designed to run through Sass. Components use daisyUI classes first; what they need beyond that lives in a `*.module.scss` next to the component, which can `@use` the shared `styles/_tokens.scss`. The app has two daisyUI themes, `light` and `dark`; the switch at the bottom of the sidebar follows the system or pins one, and `theme-boot.js` applies it before the first paint.

### How sync works

**Sync chains.** Each library is a *sync chain*, joined with its code: 24 words (a standard BIP-39 phrase) that encode a 256-bit secret, with a checksum that catches typos on the device. There are no accounts or passwords.

* **Create a chain** on one device (`POST /api/chains`): the API generates the secret and shows its code once, with **10 recovery codes**. Save them (download as `.txt`, copy, print, or the QR code for the words), and type back three of the words to confirm.
* **Join it** on another device by typing, pasting or scanning the code (`POST /api/chains/join`). Joining merges that device's playlists into the chain.
* **Or add a device with a pairing code**, without the 24 words: on a device in the chain, **Show a pairing code** (`POST /api/chain/pairing`) gives an 8-character code like `7K3Q-D9X2` and its QR code. On the new device, **Enter a pairing code** (or scan it) asks to join (`POST /api/chains/pair`), and the first device asks "Allow Chrome on Android to join?". Only after **Allow** does the new device get its credential (`POST /api/pairing/status`). A code works once, for 10 minutes, and the request has to be approved within 5. See [docs/architecture.md](docs/architecture.md) for the flow.
* **Scanning:** on a phone, **Scan a QR code instead** opens the camera and reads either the chain code's QR code (from the save step) or a pairing code's. It uses the browser's `BarcodeDetector` where there is one and [jsQR](https://github.com/cozmo/jsQR) elsewhere; the image never leaves the device.
* **Each device gets its own credential** and syncs with it; it doesn't keep the code. The sync settings list the chain's devices, where any of them can be removed; a removed device stops syncing at once and keeps its playlists.
* **Generate a new code** if the code leaked or a device was lost: the old code and recovery codes stop working, and every other device is removed (`POST /api/chain/replace`). **Generate new recovery codes** replaces only the recovery codes (`POST /api/chain/recovery-codes`). **Leave** takes one device out; **Delete** removes the chain and the server's copy of its data.
* **Recover with a recovery code** when every device is gone and the code is lost (`POST /api/chains/recover`). A recovery code is 20 characters (`XXXXX-XXXXX-XXXXX-XXXXX`, about 100 random bits) and works once. Recovering gives the chain a new code and new recovery codes, removes every old device, and joins this device, which merges its local playlists into the chain. The chain's data stays.
* **The recovery hook:** every way of replacing a chain's code (recovering, a new code, and later the cleanup of abandoned chains) runs the same step in one transaction. It sets the new secret, removes the old devices, replaces the recovery codes and writes the audit log. It also takes the same lock as a sync, so it never lands halfway through one, and a device it removed can't write afterwards. Requests with an old credential get a 401 that says the chain was replaced or recovered.
* **Activity:** the sync settings show the chain's audit log (`GET /api/chain/events`): devices joined, left and removed, pairing codes created, approved and refused, new codes, new recovery codes and recoveries, with the device that did it. No secrets.
* **Reminders:** a notice when this is the only device and the chain has no recovery codes (e.g. a chain created before they existed), and every 90 days a "Do you still have your sync chain code and recovery codes?" check-in.
* The server never stores a code, a recovery code or a credential, only their HMAC-SHA256 keyed with `SYNC_PEPPER`, which lives outside the database. Creating, joining and claiming are rate limited (10 per minute per IP), and recovering and entering pairing codes more strictly. Five wrong codes of any kind from one IP within 15 minutes lock it out of joining, pairing and recovering for 15 minutes. Three refused pairing attempts on a chain within an hour (denied requests, or a used code entered again) pause pairing for that chain for an hour, and every device in it shows a notice. Failed attempts are logged without the code. Everything is kept in PostgreSQL and the API's memory; there's no Redis (why: [docs/architecture.md](docs/architecture.md)).
* **From the old shared token:** data synced with `SYNC_TOKEN` before sync chains belongs to a *legacy* chain. A device that still has the token saved offers **Turn it into a sync chain** (`POST /api/chains/claim`), once; it then gets the chain's code to add the other devices, and the token isn't needed anymore.

**Syncing rows.**

* Every synced row has `updated_at` (ms), `deleted` (tombstone) and, locally, `dirty`.
* `POST /api/sync` sends `{ since, changes }` with the device's credential: every dirty row plus the last server cursor the device has seen. Everything it reads and writes is scoped to the device's chain.
* The server applies rows in one transaction with **last-write-wins** (`updated_at` must be newer), stamps each with an increasing `seq`, and answers with every row whose `seq > since` and a new cursor (paged with `hasMore`). Each sync first locks the single `sync_counter` row, so writes are serialized and `seq` values are committed in order; a device never skips a row.
* The client clears `dirty` only for rows that weren't edited again during the request, then applies the server rows with the same last-write-wins rule.
* Newer fields are optional on both sides, so devices and servers of different versions keep working together: when a device's app is older and doesn't send a field (e.g. a video's `artist`, a playlist's `source`), the server keeps the stored value, and the web app keeps its local value when an older server doesn't send it.
* When the database closes a connection (Neon does when it pauses after being idle), the API retries the request on a new connection.

Sync runs after edits (2.5 s debounce), on opening the app, when the tab or the network comes back, and from the sync button. There is no timer, so a device left open picks up other devices' changes when you come back to it.

## Run it locally

Requirements: Node 22+, the [.NET 10 SDK](https://dotnet.microsoft.com/download), and Docker (for a local PostgreSQL).

```bash
# 1. local PostgreSQL (keeps running)
cd api && docker compose up -d

# 2. local settings: copy the examples (the copies are git-ignored)
cp src/YtPlaylist.Api/appsettings.Local.example.json src/YtPlaylist.Api/appsettings.Local.json
                                           # DATABASE_URL, SYNC_PEPPER (any random 32+ characters), YOUTUBE_API_KEY
cp ../web-react/.env.example ../web-react/.env   # optional: API_URL for the dev proxy

# 3. API on http://localhost:8787. Reads appsettings.Local.json and applies the EF Core migrations on start
dotnet run --project src/YtPlaylist.Api

# 4. web app: npm workspaces (web-react/ and packages/) install from the repository root;
#    Vite proxies /api to API_URL (http://localhost:8787 by default)
cd .. && npm install && npm run dev -w web-react    # http://localhost:5174
```

In the app, open the sync settings at the bottom of the sidebar and choose **Create a sync chain**. To try a second device, open the app in another browser (or a private window) and **Join with a code**. The app works without steps 1 to 3; it just stays on one device.

**Using a hosted database locally:** if `DATABASE_URL` in `appsettings.Local.json` points at a hosted database instead of the local one, the API applies its pending migrations there when it starts. To try a branch that changes the database without touching production, point the API at a copy instead: on Neon, create a branch of the database and set `DATABASE_URL` to its connection string for that run (an environment variable wins over the settings file). Delete the branch when you're done. A Neon branch inherits its parent's roles **and passwords**, so its connection string carries the production password: keep it out of anything shared or committed, or create a separate role on the branch for testing.

### The web app (web-react)

The web app lives in `web-react/`, with React, daisyUI, Redux Toolkit and TypeScript (see [Project layout](#project-layout)). It uses `packages/core` and the `react` part of the shared lint rules, and CI checks it in its own job. `npm run build -w web-react && npm run preview -w web-react` serves the production build with the real security headers.

### Local settings

Settings and secrets for local development live in two git-ignored files, each with a committed example to copy from:

| File | Copy from | Read by | Settings |
| --- | --- | --- | --- |
| `api/src/YtPlaylist.Api/appsettings.Local.json` | `appsettings.Local.example.json` (same folder) | `dotnet run`, only in the Development environment | `DATABASE_URL`, `SYNC_PEPPER`, `SYNC_TOKEN` (only to claim old data), `YOUTUBE_API_KEY`, `ALLOWED_ORIGIN` |
| `web-react/.env` | `web-react/.env.example` | `npm run dev` and `npm run preview` | `API_URL` (where the dev server forwards `/api`) |

Variables set in the shell win over both files, and deployed hosts (Render, Netlify) use their own environment settings with the same names, never these files. `appsettings.Local.json` is a standard .NET JSON settings file (comments allowed) loaded just below the environment variables. `.gitignore` covers it and `.env` files, and the API project never copies it to the build output, so it can't reach the published app or the Docker image (`api/.dockerignore` leaves it out too).

Upgrading from an older checkout that used `api/.env`: copy its values into `appsettings.Local.json` (same names) and delete `api/.env`; it is no longer read.

Tests:

```bash
cd api && dotnet test                     # validation, sync store on SQLite, YouTube clients, endpoints
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ytplaylist dotnet test   # also on PostgreSQL
npm test -w packages/core                 # shared logic (TypeScript): link parsing, artists, reports, YouTube sync comparison
npm run typecheck -w packages/core        # TypeScript types of the shared logic
npm test -w web-react                     # slices, thunks and components (Vitest + Testing Library), on SQLite
npm run typecheck -w web-react            # TypeScript types of the web app
```

Database changes: edit the entity configurations in `YtPlaylist.Infrastructure/Persistence/Configurations`, then add a migration from `api/`:

```bash
dotnet tool install --global dotnet-ef
dotnet ef migrations add <Name> --project src/YtPlaylist.Infrastructure --output-dir Persistence/Migrations
```

Without installing the tool, .NET 10 can run it once at the version the project uses: `dotnet tool exec dotnet-ef@<EF Core version> --yes -- migrations add …` (the version is in `api/Directory.Packages.props`). The generated files start with a byte-order mark; remove it so they match the repository's `.editorconfig` (`charset = utf-8`).

A test (`MigrationsMatchTheModel`) fails if the model changes without a migration. The API applies pending migrations when it starts.

The browser database works the same way with Drizzle ORM: edit the tables in `packages/core/src/db/tables.ts`, then generate a migration:

```bash
npm run db:generate -w packages/core   # writes packages/core/src/db/migrations/NNNN_*.sql and its snapshot; commit them
```

The app applies new migrations when it opens the database, and CI fails if `tables.ts` changes without a migration.

Linting and formatting (in `web-react/` and in `packages/core`):

```bash
npm run lint          # ESLint: errors for likely bugs, warnings for clean-up
npm run lint:fix      # fix what ESLint can fix automatically
npm run format        # Prettier, using .editorconfig (4-space indent, 120 columns, single quotes)
npm run format:check
```

Rules live in `packages/eslint-config` (`@ytpm/eslint-config`): `base` for JavaScript, plus `typescript` and `react` (JSX and hooks) parts that each package picks in its own `eslint.config.js`. In VS Code (or VSCodium), install the recommended extensions from `.vscode/extensions.json` to see ESLint errors and warnings underlined as you type.

Debugging (VS Code or VSCodium, **Run and Debug**): **Web app (Edge)** or **Web app (Chrome)** starts the dev server and opens the app with breakpoints in `web-react/` and `packages/core` (TypeScript, through source maps); **Core: all tests** and **Core: current test file** run the shared package's Vitest tests under the debugger. The configurations are in `.vscode/launch.json` and `.vscode/tasks.json`.

## Deploy

Three free services: **Neon** (database), **Render** (API) and **Netlify** (web app).

### 1. Create the database on Neon

1. Sign up at [neon.tech](https://neon.tech) and create a project.
2. Copy the connection string from **Connect**. It looks like `postgresql://user:password@ep-….neon.tech/neondb?sslmode=require`.

The API creates its tables (EF Core migrations) the first time it starts.

### 2. Deploy the API on Render

1. In [Render](https://render.com): **New → Blueprint**, connect this GitHub repository, and pick `render.yaml`.
2. When Render asks for the values:

   | Variable          | Value                                                     |
   | ----------------- | --------------------------------------------------------- |
   | `DATABASE_URL`    | the Neon connection string from step 1                    |
   | `SYNC_PEPPER`     | generated by Render; keep it secret and never change it (every chain code and device would stop working) |
   | `SYNC_TOKEN`      | only for data synced before sync chains: the old token, to claim that library once; new services leave it out |
   | `YOUTUBE_API_KEY` | optional, see "Importing YouTube playlists" below         |
   | `ALLOWED_ORIGIN`  | optional, `<yt-playlist-manager-web-uri>` (your Netlify site's address) |

3. Wait for the deploy, then open `<yt-playlist-manager-api-uri>/api/health`, where `<yt-playlist-manager-api-uri>` is the service's address shown in Render. It should answer `{"ok":true,"syncConfigured":true}`.

### 3. Deploy the web app on Netlify

1. In Netlify: **Add new site → Import an existing project** and pick the repo. The build settings come from `netlify.toml`.
2. In **Site configuration → Environment variables**, add `API_ORIGIN` = `<yt-playlist-manager-api-uri>`, the API's address from Render (`https://` and no trailing slash). The build turns it into a proxy rule, so the app calls `/api` on its own domain.
3. **Deploys → Trigger deploy**.

### 4. Connect your devices

Open the site, open the sync settings at the bottom of the sidebar, and choose **Create a sync chain**. Save the 24-word code it shows (download it, copy it into a password manager, or keep the QR code), and type back the three words it asks for. To add another device, open the sync settings on the first one and choose **Show a pairing code**; on the new device choose **Enter a pairing code** (or scan its QR code), then **Allow** it on the first device. You can also join with the 24-word code: **Enter the chain code**, and type, paste or scan it.

**Upgrading a deployment that used `SYNC_TOKEN`:** add `SYNC_PEPPER` on Render before deploying this version (any random 32+ characters, e.g. from **Generate** in Render's environment settings); without it, sync is off. Keep `SYNC_TOKEN` until a device has claimed the old library: on a device that synced before, the sync settings offer **Turn it into a sync chain**. After that, join the other devices with the new code and remove `SYNC_TOKEN`.

### Automatic deploys: only what changed

Pushes to `master` deploy each service only when its own files change:

| Push changes | Netlify (web app) | Render (API) |
| --- | --- | --- |
| `web-react/`, `packages/`, `package.json`, `package-lock.json`, `netlify.toml` or `api/VERSION` | builds and deploys | skipped |
| `api/` (except `api/tests/` and `*.md`) or `render.yaml` | skipped | builds and deploys |
| both | both | both |
| only docs, `.github/` or API tests | skipped | skipped |

* **Netlify** reads the `ignore` command in `netlify.toml`: it compares the commit with the last deployed one and cancels the build when nothing under `web-react/`, `packages/`, the root `package.json` and `package-lock.json`, `netlify.toml` or `api/VERSION` changed. `api/VERSION` holds the app's version for both sides, so a release that bumps it redeploys both. The first deploy, **Clear cache and deploy**, and **Trigger deploy** always build.
* **Render** reads the `buildFilter` in `render.yaml` when the service is managed by the Blueprint (**Blueprints → Sync**). A service created by hand needs the same filters in **Settings → Build & Deploy → Build Filters**: included paths `api/**` and `render.yaml`, ignored paths `api/**/*.md` and `api/tests/**`. Auto-deploy also needs the service linked to the GitHub repository (**Settings → Build & Deploy → Repository**), so Render hears about pushes. **Manual Deploy** and deploy hooks ignore the filters.

## Versions and releases

The whole app has one [SemVer](https://semver.org) version, in `api/VERSION`. The API reads it at build time and returns it from `/api/health`, and the web app shows it at the bottom of the sidebar. Netlify and Render deploy separately, so the two can show which build each side runs.

**Releasing.** Work lands in `develop` through PRs; a release is a PR from `develop` into `master`:

1. In the release PR, raise `api/VERSION`: **patch** (`0.1.1`) for fixes, **minor** (`0.2.0`) for features, **major** (`1.0.0`) for breaking changes. CI's **Version bump** check fails a PR into `master` that doesn't raise it.
2. Write the PR description as the release notes: a table of the PRs it brings, with `Closes #…` for each issue it finishes. Issues close only when the PR merges into `master`, the default branch, so a release PR closes everything fixed in `develop` since the last one.
3. Merge it. The **Release** workflow tags `v<version>` and publishes a GitHub Release whose notes are the release PR's description. Netlify and Render deploy what changed.
4. Fast-forward `develop` to `master` before merging anything else into `develop`: `git push origin origin/master:refs/heads/develop`. A PR from `master` back into `develop` would add a merge commit and leave `develop` behind again.

**Hotfixes:** a branch from `master`, a PR into `master` that raises the **patch** version, then the same fast-forward (or, if `develop` has moved on, a PR from `master` into `develop`).

**API compatibility.** Devices update at different times, and a tab left open keeps running the version it loaded, so the API stays compatible with older apps:

* **Only add.** New request and response fields are optional, and the server keeps a stored value when an older app leaves a field out (as with `artist`, `artists` and `unavailable`). Never rename or remove a field or a route, and never change what an existing field means.
* **Breaking changes get a new route.** When one can't be avoided, it goes under `/api/v2/…` while `/api/…` keeps working for older apps.
* **Old tabs reload.** The app sends its version in an `X-App-Version` header. When a change does need a newer app, raise `MinimumAppVersion` in `api/src/YtPlaylist.Api/AppVersionGate.cs` (or set `MIN_APP_VERSION` on Render): the API then answers sync, chain and report requests from older apps with `426 Upgrade Required`, and those tabs stop syncing and ask to reload instead. `/api/health` returns both `version` and `minAppVersion`.
* **Data formats are versioned on their own:** the local database by its migrations (`PRAGMA user_version`), the server database by EF Core migrations, and reports by their `Format:` line or JSON `version`.

## Importing YouTube playlists

Paste a YouTube playlist link (`youtube.com/playlist?list=…`, or a watch link with `&list=…`):

* in **New playlist** (or the first-run screen) to create a playlist with the same title and videos, or
* in the **add videos** box to add the playlist's videos to the playlist you have open.

The API reads the playlist (`GET /api/playlist?id=…`):

* **With `YOUTUBE_API_KEY` set on Render**, it uses the YouTube Data API and imports the whole playlist (up to 1,000 videos). Create a key in Google Cloud Console: enable **YouTube Data API v3**, then **Credentials → Create credentials → API key**. Each 50 videos costs 1 unit of the free 10,000-unit daily quota.
* **Without a key**, it uses YouTube's public playlist feed, which only lists the latest 15 videos. The app says so when an import may be incomplete.

Only public and unlisted playlists can be imported; private playlists, Watch Later and auto-generated mixes can't.

**Deleted and private videos.** YouTube still lists videos that were deleted or made private, as "Deleted video" or "Private video". Tick **Import with deleted videos** (shown when you paste a playlist link) to bring them in as Missing items in their place, so you can paste another link for each later; otherwise they're left out and counted. Only the Data API lists them, so this needs `YOUTUBE_API_KEY`.

### Syncing a playlist from YouTube

An imported playlist remembers which YouTube playlist it came from. The **YouTube** button in the playlist header shows that link (with **Change** and **Unlink**), lets you link a playlist that wasn't imported, and syncs from it:

1. Nothing is read from YouTube until you click **Compare with YouTube**. The dialog warns first that syncing makes the playlist follow YouTube.
2. The comparison lists what's **new on YouTube** (added in YouTube's order), what was **deleted or made private** there (kept and marked as Missing, with the title it had here), what's **back on YouTube**, and what was **removed from the YouTube playlist**.
![Sync from YouTube after comparing: 2 new videos, 1 deleted on YouTube and 1 removed from the YouTube playlist, with options to import deleted videos, remove the removed one, and save a report first](docs/screenshots/youtube-sync.png)

3. Nothing changes until you **Apply**. Removed videos stay unless you tick **Remove … from this playlist too**, and then **Apply** asks once more before removing them, since their notes go with them. **Save a report before applying** (on by default) downloads the playlist's report first.

Without `YOUTUBE_API_KEY`, YouTube only returns the latest videos, so the dialog can still add new ones but can't tell which were removed.

## Reports and Compare

**Report** in the playlist header downloads the playlist as `<playlist>-report-YYYY-MM-DD__HH-mm-ss`, in one of two formats.

**JSON (can be restored)** keeps everything needed to bring a video back:

```json
{
  "format": "yuzu-tapes-report",
  "version": 1,
  "createdAt": "2026-11-06T09:30:00.000Z",
  "playlist": { "name": "City Pop" },
  "videos": [
    {
      "youtubeId": "dQw4w9WgXcQ",
      "title": "Plastic Love",
      "artist": "Mariya Takeuchi",
      "author": "Some Channel",
      "notes": "",
      "unavailable": false
    }
  ]
}
```

**Text (easy to read)** has Windows line endings, so it opens cleanly in Notepad:

```
Total videos: 3
Format: number: title | artist
1: Plastic Love | Mariya Takeuchi
2: Anri - Windy Summer | Anri
3: Untitled live recording |
```

The artist follows the last ` | ` and is empty when unknown. Several artists are joined, as in `Ryo Tanabe & Aoi Kanda feat. Sora Minami`. Reports saved before artists existed have no `Format:` line and only `number: title`.

**Compare** loads a report (a file, or pasted text) and finds which of its videos the playlist no longer has, so you can add them back in their old place. It reads every format and says which one it found:

* **JSON:** matches by YouTube ID; restored videos come back with their link, channel, notes and each of their artists. Older reports also have a `watched` field, which is ignored. A broken file, or one from a newer version of the app, is refused and changes nothing.
* **Text with artists:** matches by title, using the artist to tell apart two videos with the same title; restored items keep the report's artists, split again on `&`, `feat.` and the like (names your library already knows stay whole), and wait for their link as Missing items.
* **Older text reports:** match by title (ignoring case, spacing, punctuation and full-width characters), and also when the report's title is the video's "artist - title"; restored items get a guessed artist.

**Backups** are made by themselves when a playlist with videos is added, and whenever you download a report. In a sync chain they're kept on the server, where any device can find them; without a chain, or while offline, they stay on the device. **Compare** lists a playlist's backups, to compare with one or download it. Each playlist keeps its first backup and its last 10, and the backups of a deleted playlist are removed after 30 days. Sync doesn't change them, so a bad edit can't reach a backup.

## Notes and limits

* **YouTube only.** Spotify and other music services aren't supported, because their API rules and limits don't fit an app like this. To bring in a playlist from one, use a transfer service to copy it to YouTube, then import that.
* **One library per sync chain.** Several people can use the same deployment, each with their own chain; one chain can't read or change another's playlists. Anyone with a chain's code can join it, so keep the code private.
* **Local data lives in this browser.** Clearing site data removes it; with sync on, it comes back from the cloud on the next sync. The sync dialog can also export the database as a `.sqlite` file.
* **Video titles** come from YouTube's public oEmbed endpoint through `/api/oembed` (falling back to noembed.com). No YouTube API key or Google sign-in is needed, and the app can't read or change your playlists on youtube.com.
* **The embedded player** loads in each viewer's browser straight from `youtube-nocookie.com`; it doesn't go through the API or use `YOUTUBE_API_KEY`. The key is only used to read playlists (imports and syncing from YouTube).
* **Artists are guesses** unless you edit them: YouTube has no artist field, and fan uploads are named freely. A guess never replaces an artist you typed.
* **Render's free plan sleeps** after about 15 minutes without requests, and waking up can take close to a minute. Netlify gives up on a proxied request after 26 seconds, so the first sync after a quiet period may fail; the app retries on its own and the next attempt goes through. A paid Render plan stays awake.
* **Hosting the API elsewhere** works: point `API_ORIGIN` at it.

## License

Copyright (C) 2026 Juan Carlos Estrada Alvarez.

Yuzu Tapes Playlist Manager is free software, licensed under the **GNU Affero General Public License v3.0 only** (`AGPL-3.0-only`); see [LICENSE](LICENSE). You may use, study, change and share it, including commercially. If you distribute it, or let people use a modified version over a network (for example as a website or a hosted API), you must offer them the complete source code of your version under the same license.

The app links to its source code from the sidebar. If you host a modified version, point that link (`SOURCE_URL` in `web-react/src/domains/ui/components/layout/Sidebar.tsx`) at your own source code.

Code published before November 2, 2026, when the app was called YouTube Playlist Manager, was released under the MIT License, and copies of it obtained under MIT keep those terms. Third-party libraries keep their own licenses.

## Trademark

"Yuzu Tapes"™ is the name of this app. The AGPL covers the code, not the name: forks are welcome, but must use a different name and logo, so they aren't mistaken for the official app. YouTube is a trademark of Google LLC; this app isn't affiliated with or endorsed by YouTube or Google.
