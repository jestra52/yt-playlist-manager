# YouTube Playlist Manager

Save YouTube videos into your own playlists, put them in order, mark what you've watched, keep notes, and play them in place. Everything is stored in a **SQLite database inside your browser**, so the app works offline. An **ASP.NET Core API** with **Entity Framework Core** syncs that database with **PostgreSQL** (Neon) so your phone and laptop stay in step. The web app is hosted on **Netlify**; the API runs as a Docker container on **Render**, and Netlify forwards `/api` to it.

## Screenshots

| Light | Dark |
| --- | --- |
| ![A City Pop playlist in the light theme: sidebar with two playlists, progress strip, and videos with thumbnails, three marked as watched](docs/screenshots/playlist-light.png) | ![The same playlist in the dark theme](docs/screenshots/playlist-dark.png) |

**Compare with an old report.** Load a report you saved earlier to see which videos the playlist no longer has, then add them back in their old place:

![Compare dialog: 12 items in the report, 10 still here, 2 missing, listed by number and title](docs/screenshots/compare-report.png)

**Missing items** wait for their YouTube link; paste it and the video gets its title, channel and thumbnail:

![Missing filter showing two placeholder items, each with a box to paste its YouTube link](docs/screenshots/missing-items.png)

<img src="docs/screenshots/phone.png" alt="The playlist on a phone in the dark theme, with buttons for compare, report and delete in the header" width="300" align="right" />

**On a phone** the sidebar folds away behind the menu button, and the header buttons shrink to icons: compare, download report, delete.

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
  src/
    YtPlaylist.Domain/          entities (Playlist, Video, SyncCounter), ID rules, limits
    YtPlaylist.Application/     use cases (SyncService), validation, ports (ISyncStore, YouTube sources)
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
      db/                    SQLite wrapper, schema migrations, IndexedDB persistence
      events.js              "data changed" signal (decouples domains from sync)
      config.js              API base address
    domains/
      playlists/
        components/                  presentation (Svelte + daisyUI)
        playlists.service.svelte.js  application: reactive state + use cases
        playlists.repository.js      data access (SQL)
      videos/
        components/
        videos.service.svelte.js
        videos.repository.js
        metadata.client.js           external HTTP (oEmbed through /api)
        youtube.js                   domain rules: parsing YouTube links
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
3. **Data**: repositories run SQL against the local database; clients talk HTTP.
4. **Core**: the SQLite wrapper and its persistence.

Services signal local writes through `core/events.js`; the sync service listens and schedules a background sync, so the playlists and videos domains don't depend on sync.

The API follows the same idea with one project per layer: **Api** (HTTP) → **Application** (use cases and interfaces) → **Domain** (entities and rules), with **Infrastructure** implementing the Application interfaces with EF Core and `HttpClient`.

### Styles

Tailwind v4 and daisyUI are loaded from plain CSS (`styles/tailwind.css`), because Tailwind v4 reads its own directives and isn't designed to run through Sass. Everything hand-written is Sass: the global layer in `styles/*.scss` and the component `<style lang="scss">` blocks, which can `@use 'tokens' as *;` and `@use 'mixins' as *;` from anywhere. The app ships two daisyUI themes, `queue` (light) and `queue-night` (dark); the switch at the bottom of the sidebar follows the system or pins one.

### How sync works

* Every synced row has `updated_at` (ms), `deleted` (tombstone) and, locally, `dirty`.
* `POST /api/sync` sends `{ since, changes }`: every dirty row plus the last server cursor the device has seen.
* The server applies rows in one transaction with **last-write-wins** (`updated_at` must be newer), stamps each with an increasing `seq`, and answers with every row whose `seq > since` and a new cursor (paged with `hasMore`). Each sync first locks the single `sync_counter` row, so writes are serialized and `seq` values are committed in order; a device never skips a row.
* The client clears `dirty` only for rows that weren't edited again during the request, then applies the server rows with the same last-write-wins rule.

Sync runs after edits (2.5 s debounce), every minute while the tab is visible, when the network comes back, and from the sync button.

## Run it locally

Requirements: Node 22+, the [.NET 10 SDK](https://dotnet.microsoft.com/download), and Docker (for a local PostgreSQL).

```bash
# 1. local PostgreSQL (keeps running)
cd api && docker compose up -d

# 2. local settings: copy the examples (the copies are git-ignored)
cp .env.example .env                       # api/.env: DATABASE_URL, SYNC_TOKEN=dev-token, YOUTUBE_API_KEY
cp ../web/.env.example ../web/.env         # web/.env: API_URL for the dev proxy

# 3. API on http://localhost:8787. Reads api/.env and applies the EF Core migrations on start
dotnet run --project src/YtPlaylist.Api

# 4. web app: Vite proxies /api to API_URL (http://localhost:8787 by default)
cd ../web && npm install && npm run dev    # http://localhost:5173
```

In the app, open the sync status at the bottom of the sidebar, enter `dev-token`, and choose **Save and sync**. The app works without steps 1 to 3; it just stays on one device.

### Local settings

Settings and secrets for local development live in two git-ignored files, each with a committed `.env.example` to copy from:

| File       | Read by                                           | Variables                                                         |
| ---------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| `api/.env` | `dotnet run`, only in the Development environment | `DATABASE_URL`, `SYNC_TOKEN`, `YOUTUBE_API_KEY`, `ALLOWED_ORIGIN` |
| `web/.env` | `npm run dev` and `npm run preview`               | `API_URL` (where the dev server forwards `/api`)                  |

Variables set in the shell win over both files, and deployed hosts (Render, Netlify) use their own environment settings, never these files. `.gitignore` covers `.env` and `.env.*` everywhere except `.env.example`, and `api/.dockerignore` keeps them out of the Docker image.

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

A test (`MigrationsMatchTheModel`) fails if the model changes without a migration. The API applies pending migrations when it starts.

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
   | `ALLOWED_ORIGIN`  | optional, your Netlify URL                                |

3. Wait for the deploy, then open `https://<your-service>.onrender.com/api/health`. It should answer `{"ok":true,"syncConfigured":true}`.

### 3. Deploy the web app on Netlify

1. In Netlify: **Add new site → Import an existing project** and pick the repo. The build settings come from `netlify.toml`.
2. In **Site configuration → Environment variables**, add `API_ORIGIN` = your Render URL, e.g. `https://yt-playlist-manager-api.onrender.com`. The build turns it into a proxy rule, so the app calls `/api` on its own domain.
3. **Deploys → Trigger deploy**.

### 4. Connect your devices

Open the site, click the sync status at the bottom of the sidebar, keep the API address as `/api`, paste your `SYNC_TOKEN`, choose **Test connection**, then **Save and sync**. Do the same on every device.

## Importing YouTube playlists

Paste a YouTube playlist link (`youtube.com/playlist?list=…`, or a watch link with `&list=…`):

* in **New playlist** (or the first-run screen) to create a playlist with the same title and videos, or
* in the **add videos** box to add the playlist's videos to the playlist you have open.

The API reads the playlist (`GET /api/playlist?id=…`):

* **With `YOUTUBE_API_KEY` set on Render**, it uses the YouTube Data API and imports the whole playlist (up to 1,000 videos). Create a key in Google Cloud Console: enable **YouTube Data API v3**, then **Credentials → Create credentials → API key**. Each 50 videos costs 1 unit of the free 10,000-unit daily quota.
* **Without a key**, it uses YouTube's public playlist feed, which only lists the latest 15 videos. The app says so when an import may be incomplete.

Only public and unlisted playlists can be imported; private playlists, Watch Later and auto-generated mixes can't.

## Notes and limits

* **One library per deployment.** Everyone with the sync token shares the same playlists. For several people, deploy one site each or extend `SYNC_TOKEN` into per-user tokens.
* **Local data lives in this browser.** Clearing site data removes it; with sync on, it comes back from the cloud on the next sync. The sync dialog can also export the database as a `.sqlite` file.
* **Video titles** come from YouTube's public oEmbed endpoint through `/api/oembed` (falling back to noembed.com). No YouTube API key or Google sign-in is needed, and the app can't read or change your playlists on youtube.com.
* **Render's free plan sleeps** after about 15 minutes without requests, and waking up can take close to a minute. Netlify gives up on a proxied request after 26 seconds, so the first sync after a quiet period may fail; the app retries on its own and the next attempt goes through. A paid Render plan stays awake.
* **Hosting the API elsewhere** works: point `API_ORIGIN` at it. To call it directly instead of through Netlify, set the API address in the sync dialog and `ALLOWED_ORIGIN` on the API, and add that origin to `connect-src` in `web/public/_headers`.
