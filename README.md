# YouTube Playlist Manager

Save YouTube videos into your own playlists, put them in order, mark what you've watched, keep notes, and play them in place. Each video shows its artist, guessed from YouTube and editable, and a playlist imported from YouTube can be synced with it again later. Everything is stored in a **SQLite database inside your browser**, so the app works offline. An **ASP.NET Core API** with **Entity Framework Core** syncs that database with **PostgreSQL** (Neon) so your phone and laptop stay in step. The web app is hosted on **Netlify**; the API runs as a Docker container on **Render**, and Netlify forwards `/api` to it.

## Screenshots

| Light | Dark |
| --- | --- |
| ![A City Pop playlist in the light theme: sidebar with two playlists, progress strip, and videos with thumbnails, each showing its artist and the channel that uploaded it, three marked as watched](docs/screenshots/playlist-light.png) | ![The same playlist in the dark theme](docs/screenshots/playlist-dark.png) |

**Compare with an old report.** Load a report you saved earlier to see which videos the playlist no longer has, then add them back in their old place:

![Compare dialog with a report that has artists: 12 items in the report, 10 still here, 2 missing, listed by number, title and artist](docs/screenshots/compare-report.png)

**Missing items** wait for their YouTube link; paste it and the video gets its title, channel and thumbnail:

![Missing filter showing a video deleted on YouTube and a placeholder from a report, each with a box to paste a YouTube link](docs/screenshots/missing-items.png)

**Artists.** Under each title the app shows the artist, then the channel that uploaded the video: "Anri · uploaded by …". The artist is guessed from YouTube Music's "Artist - Topic" channels and from titles like "Artist - Song" or "Artist「Song」"; a guess has an ⓘ badge, because it may be wrong. Click the artist to correct it: the field suggests artists already in your library and keeps one spelling for each. Search matches artists too.

**Videos deleted on YouTube** keep their place: they show a "Deleted" thumbnail, count under the **Missing** filter, and wait for another link, like Missing items.

<img src="docs/screenshots/phone.png" alt="The playlist on a phone in the dark theme, with buttons for YouTube, compare, report and delete in the header" width="300" align="right" />

**On a phone** the sidebar folds away behind the menu button, and the header buttons shrink to icons: YouTube, compare, download report, delete.

The screenshots use sample data and placeholder thumbnails.

<br clear="right" />

## How it fits together

```
┌──────────── Browser ────────────┐       ┌── Netlify ──┐       ┌────── Render ───────┐      ┌──── Neon ────┐
│ Svelte components (daisyUI)     │       │ web app     │       │ ASP.NET Core API    │      │ PostgreSQL   │
│ ↓ call                          │ HTTPS │             │ HTTPS │  POST /api/sync     │ EF   │ playlists    │
│ Domain services ($state)        │──────►│ /api/* proxy│──────►│  GET  /api/oembed   │─────►│ videos       │
│ ↓ read / write                  │       └─────────────┘       │  GET  /api/playlist │ Core │ sync_counter │
│ Repositories ↔ SQLite (sql.js)  │                             └─────────────────────┘      └──────────────┘
│ ↕ saved to IndexedDB            │
└─────────────────────────────────┘
```

Components and deployment diagrams: [docs/architecture.md](docs/architecture.md).

## Project layout

```
netlify.toml                 Netlify build for the web app
render.yaml                  Render Blueprint for the API container
.github/workflows/ci.yml     builds and tests the web app and the API on every push
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
web/
  scripts/write-redirects.mjs  writes the Netlify /api proxy rule from API_ORIGIN
  public/_headers            security headers (CSP) for Netlify
  src/
    app/bootstrap.js         opens the database and loads every domain
    core/
      db/                    SQLite wrapper, Drizzle tables (tables.js), generated migrations, IndexedDB persistence
      events.js              "data changed" signal (decouples domains from sync)
      config.js              API base address
    domains/
      playlists/
        components/                  presentation (Svelte + daisyUI)
        playlists.service.svelte.js  application: reactive state + use cases
        playlists.repository.js      data access (Drizzle ORM queries)
        report.js                    writes the .txt report (format with artists)
        report-compare.js            reads reports (both formats) and finds what's missing
        youtube-sync.js              compares a playlist with its YouTube playlist
      videos/
        components/
        videos.service.svelte.js
        videos.repository.js
        metadata.client.js           external HTTP (oEmbed through /api)
        playlist.client.js           external HTTP (YouTube playlists through /api)
        youtube.js                   domain rules: parsing YouTube links
        artist.js                    domain rules: guessing artists, where an artist came from
      sync/
        components/
        sync.service.svelte.js       two-way sync use case + auto-sync
        sync.repository.js           cursor, settings, dirty rows
        sync.client.js               HTTP client for the sync API
      ui/                            app shell: drawer, dialog, theme, notices
    shared/components/       Dialog, Icon
    styles/
      tailwind.css           Tailwind v4 + daisyUI 5 + the two app themes
      _tokens.scss           Sass tokens (mapped to daisyUI CSS variables)
      _mixins.scss           breakpoints, line clamp, display type…
      main.scss              global Sass layer (base + components)
```

### Layers

Each domain is split the same way, and calls only go downwards:

1. **Presentation**: Svelte components styled with daisyUI classes. Custom pieces (the progress strip, the video rows) use `<style lang="scss">` with the shared tokens and mixins.
2. **Application**: one service per domain (`*.service.svelte.js`). It holds the domain's reactive state with Svelte 5 runes (`$state`, `$derived`) and exposes the use cases (`videos.addFromText`, `playlists.remove`, `sync.syncNow`…). Components read the state directly and call these methods.
3. **Data**: repositories query the local database with Drizzle ORM, so values always travel as parameters and never as SQL text; clients talk HTTP.
4. **Core**: the SQLite wrapper, the table definitions and the persistence.

Services signal local writes through `core/events.js`; the sync service listens and schedules a background sync, so the playlists and videos domains don't depend on sync.

The API follows the same idea with one project per layer: **Api** (HTTP) → **Application** (use cases and interfaces) → **Domain** (entities and rules), with **Infrastructure** implementing the Application interfaces with EF Core and `HttpClient`.

### Styles

Tailwind v4 and daisyUI are loaded from plain CSS (`styles/tailwind.css`), because Tailwind v4 reads its own directives and isn't designed to run through Sass. Everything hand-written is Sass: the global layer in `styles/*.scss` and the component `<style lang="scss">` blocks, which can `@use 'tokens' as *;` and `@use 'mixins' as *;` from anywhere. The app ships two daisyUI themes, `queue` (light) and `queue-night` (dark); the switch at the bottom of the sidebar follows the system or pins one.

### How sync works

* Every synced row has `updated_at` (ms), `deleted` (tombstone) and, locally, `dirty`.
* `POST /api/sync` sends `{ since, changes }`: every dirty row plus the last server cursor the device has seen.
* The server applies rows in one transaction with **last-write-wins** (`updated_at` must be newer), stamps each with an increasing `seq`, and answers with every row whose `seq > since` and a new cursor (paged with `hasMore`). Each sync first locks the single `sync_counter` row, so writes are serialized and `seq` values are committed in order; a device never skips a row.
* The client clears `dirty` only for rows that weren't edited again during the request, then applies the server rows with the same last-write-wins rule.
* Newer fields are optional on both sides, so devices and servers of different versions keep working together: when a device's app is older and doesn't send a field (e.g. a video's `artist`, a playlist's `source`), the server keeps the stored value, and the web app keeps its local value when an older server doesn't send it.
* When the database closes a connection (Neon does when it pauses after being idle), the API retries the request on a new connection.

Sync runs after edits (2.5 s debounce), every minute while the tab is visible, when the network comes back, and from the sync button.

## Run it locally

Requirements: Node 22+, the [.NET 10 SDK](https://dotnet.microsoft.com/download), and Docker (for a local PostgreSQL).

```bash
# 1. local PostgreSQL (keeps running)
cd api && docker compose up -d

# 2. local settings: copy the examples (the copies are git-ignored)
cp src/YtPlaylist.Api/appsettings.Local.example.json src/YtPlaylist.Api/appsettings.Local.json
                                           # DATABASE_URL, SYNC_TOKEN=dev-token, YOUTUBE_API_KEY
cp ../web/.env.example ../web/.env         # web/.env: API_URL for the dev proxy

# 3. API on http://localhost:8787. Reads appsettings.Local.json and applies the EF Core migrations on start
dotnet run --project src/YtPlaylist.Api

# 4. web app: Vite proxies /api to API_URL (http://localhost:8787 by default)
cd ../web && npm install && npm run dev    # http://localhost:5173
```

In the app, open the sync status at the bottom of the sidebar, enter `dev-token`, and choose **Save and sync**. The app works without steps 1 to 3; it just stays on one device.

**Using a hosted database locally:** if `DATABASE_URL` in `appsettings.Local.json` points at a hosted database instead of the local one, the API applies its pending migrations there when it starts. To try a branch that changes the database without touching production, point the API at a copy instead: on Neon, create a branch of the database and set `DATABASE_URL` to its connection string for that run (an environment variable wins over the settings file). Delete the branch when you're done.

### Local settings

Settings and secrets for local development live in two git-ignored files, each with a committed example to copy from:

| File | Copy from | Read by | Settings |
| --- | --- | --- | --- |
| `api/src/YtPlaylist.Api/appsettings.Local.json` | `appsettings.Local.example.json` (same folder) | `dotnet run`, only in the Development environment | `DATABASE_URL`, `SYNC_TOKEN`, `YOUTUBE_API_KEY`, `ALLOWED_ORIGIN` |
| `web/.env` | `web/.env.example` | `npm run dev` and `npm run preview` | `API_URL` (where the dev server forwards `/api`) |

Variables set in the shell win over both files, and deployed hosts (Render, Netlify) use their own environment settings with the same names, never these files. `appsettings.Local.json` is a standard .NET JSON settings file (comments allowed) loaded just below the environment variables. `.gitignore` covers it and `.env` files, and the API project never copies it to the build output, so it can't reach the published app or the Docker image (`api/.dockerignore` leaves it out too).

Upgrading from an older checkout that used `api/.env`: copy its values into `appsettings.Local.json` (same names) and delete `api/.env`; it is no longer read.

Tests:

```bash
cd api && dotnet test                     # validation, sync store on SQLite, YouTube clients, endpoints
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ytplaylist dotnet test   # also on PostgreSQL
cd web && npm test                        # services, URL parsing, SQLite repositories, sync rules
```

Database changes: edit the entity configurations in `YtPlaylist.Infrastructure/Persistence/Configurations`, then add a migration from `api/`:

```bash
dotnet tool install --global dotnet-ef
dotnet ef migrations add <Name> --project src/YtPlaylist.Infrastructure --output-dir Persistence/Migrations
```

Without installing the tool, .NET 10 can run it once at the version the project uses: `dotnet tool exec dotnet-ef@<EF Core version> --yes -- migrations add …` (the version is in `api/Directory.Packages.props`). The generated files start with a byte-order mark; remove it so they match the repository's `.editorconfig` (`charset = utf-8`).

A test (`MigrationsMatchTheModel`) fails if the model changes without a migration. The API applies pending migrations when it starts.

The browser database works the same way with Drizzle ORM: edit the tables in `web/src/core/db/tables.js`, then generate a migration from `web/`:

```bash
npm run db:generate   # writes src/core/db/migrations/NNNN_*.sql and its snapshot; commit them
```

The app applies new migrations when it opens the database, and CI fails if `tables.js` changes without a migration.

Linting and formatting (in `web/`):

```bash
npm run lint          # ESLint: errors for likely bugs, warnings for clean-up
npm run lint:fix      # fix what ESLint can fix automatically
npm run format        # Prettier, using .editorconfig (4-space indent, 120 columns, single quotes)
npm run format:check
```

Rules live in `web/eslint.config.js`. In VS Code (or VSCodium), install the recommended extensions from `.vscode/extensions.json` to see ESLint errors and warnings underlined as you type.

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
   | `SYNC_TOKEN`      | generated by Render; copy it from the service's **Environment** page |
   | `YOUTUBE_API_KEY` | optional, see "Importing YouTube playlists" below         |
   | `ALLOWED_ORIGIN`  | optional, `<yt-playlist-manager-web-uri>` (your Netlify site's address) |

3. Wait for the deploy, then open `<yt-playlist-manager-api-uri>/api/health`, where `<yt-playlist-manager-api-uri>` is the service's address shown in Render. It should answer `{"ok":true,"syncConfigured":true}`.

### 3. Deploy the web app on Netlify

1. In Netlify: **Add new site → Import an existing project** and pick the repo. The build settings come from `netlify.toml`.
2. In **Site configuration → Environment variables**, add `API_ORIGIN` = `<yt-playlist-manager-api-uri>`, the API's address from Render (`https://` and no trailing slash). The build turns it into a proxy rule, so the app calls `/api` on its own domain.
3. **Deploys → Trigger deploy**.

### 4. Connect your devices

Open the site, click the sync status at the bottom of the sidebar, keep the API address as `/api`, paste your `SYNC_TOKEN`, choose **Test connection**, then **Save and sync**. Do the same on every device.

### Automatic deploys: only what changed

Pushes to `master` deploy each service only when its own files change:

| Push changes | Netlify (web app) | Render (API) |
| --- | --- | --- |
| `web/` or `netlify.toml` | builds and deploys | skipped |
| `api/` (except `api/tests/` and `*.md`) or `render.yaml` | skipped | builds and deploys |
| both | both | both |
| only docs, `.github/` or API tests | skipped | skipped |

* **Netlify** reads the `ignore` command in `netlify.toml`: it compares the commit with the last deployed one and cancels the build when nothing under `web/` or `netlify.toml` changed. The first deploy, **Clear cache and deploy**, and **Trigger deploy** always build.
* **Render** reads the `buildFilter` in `render.yaml` when the service is managed by the Blueprint (**Blueprints → Sync**). A service created by hand needs the same filters in **Settings → Build & Deploy → Build Filters**: included paths `api/**` and `render.yaml`, ignored paths `api/**/*.md` and `api/tests/**`. Auto-deploy also needs the service linked to the GitHub repository (**Settings → Build & Deploy → Repository**), so Render hears about pushes. **Manual Deploy** and deploy hooks ignore the filters.

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

3. Nothing changes until you **Apply**. Removed videos stay unless you tick **Remove … from this playlist too**, and then **Apply** asks once more before removing them, since their notes and watched marks go with them. **Save a report before applying** (on by default) downloads the playlist's report first.

Without `YOUTUBE_API_KEY`, YouTube only returns the latest videos, so the dialog can still add new ones but can't tell which were removed.

## Reports and Compare

**Report** in the playlist header downloads the playlist as a `.txt` file (`<playlist>-report-YYYY-MM-DD__HH-mm-ss.txt`), with Windows line endings so it opens cleanly in Notepad:

```
Total videos: 3
Format: number: title | artist
1: Plastic Love | Mariya Takeuchi
2: Anri - Windy Summer | Anri
3: Untitled live recording |
```

The artist follows the last ` | ` and is empty when unknown. Reports saved before artists existed have no `Format:` line and only `number: title`.

**Compare** loads a report (a file, or pasted text) and finds which of its videos the playlist no longer has, so you can add them back in their old place as Missing items. It reads both formats and says which one it found:

* **With artists:** matches by title, using the artist to tell apart two videos with the same title; restored items keep the report's artist.
* **Older reports:** match by title (ignoring case, spacing, punctuation and full-width characters), and also when the report's title is the video's "artist - title"; restored items get a guessed artist.

## Notes and limits

* **One library per deployment.** Everyone with the sync token shares the same playlists. For several people, deploy one site each or extend `SYNC_TOKEN` into per-user tokens.
* **Local data lives in this browser.** Clearing site data removes it; with sync on, it comes back from the cloud on the next sync. The sync dialog can also export the database as a `.sqlite` file.
* **Video titles** come from YouTube's public oEmbed endpoint through `/api/oembed` (falling back to noembed.com). No YouTube API key or Google sign-in is needed, and the app can't read or change your playlists on youtube.com.
* **The embedded player** loads in each viewer's browser straight from `youtube-nocookie.com`; it doesn't go through the API or use `YOUTUBE_API_KEY`. The key is only used to read playlists (imports and syncing from YouTube).
* **Artists are guesses** unless you edit them: YouTube has no artist field, and fan uploads are named freely. A guess never replaces an artist you typed.
* **Render's free plan sleeps** after about 15 minutes without requests, and waking up can take close to a minute. Netlify gives up on a proxied request after 26 seconds, so the first sync after a quiet period may fail; the app retries on its own and the next attempt goes through. A paid Render plan stays awake.
* **Hosting the API elsewhere** works: point `API_ORIGIN` at it. To call it directly instead of through Netlify, set the API address in the sync dialog and `ALLOWED_ORIGIN` on the API, and add that origin to `connect-src` in `web/public/_headers`.

## License

Copyright (C) 2026 Juan Carlos Estrada Alvarez.

YouTube Playlist Manager is free software, licensed under the **GNU Affero General Public License v3.0 only** (`AGPL-3.0-only`); see [LICENSE](LICENSE). You may use, study, change and share it, including commercially. If you distribute it, or let people use a modified version over a network (for example as a website or a hosted API), you must offer them the complete source code of your version under the same license.

The app links to its source code from the sidebar. If you host a modified version, point that link (`SOURCE_URL` in `web/src/core/config.js`) at your own source code.

Code published before November 2, 2026 was released under the MIT License, and copies of it obtained under MIT keep those terms. Third-party libraries keep their own licenses.
