# Queue: a YouTube playlist manager

Save YouTube videos into your own playlists, put them in order, mark what you've watched, keep notes, and play them in place. Everything is stored in a **SQLite database inside your browser**, so the app works offline. A small **Go API** syncs that database with a cloud SQLite database (**Turso**) so your phone and laptop stay in step. The whole thing deploys to **Netlify** as one site.

```
┌──────────── Browser ────────────┐        ┌──────── Netlify ────────┐      ┌─ Turso ─┐
│ Svelte components (daisyUI)     │        │ /api/* → Go function    │      │ libSQL  │
│   ↓ call                        │  HTTPS │   POST /api/sync        │ HTTP │ (cloud  │
│ Domain services ($state) ───────┼───────►│   GET  /api/oembed      ├─────►│ SQLite) │
│   ↓ read / write                │        │   GET  /api/health      │      └─────────┘
│ Repositories ↔ SQLite (sql.js)  │        └─────────────────────────┘
│   ↕ saved to IndexedDB          │
└─────────────────────────────────┘
```

## Project layout

```
netlify.toml                 build + /api redirect
go.mod                       Go module (root, so Netlify can build the function)
netlify/functions/api/       Netlify Function entry point (Go)
api/
  domain/                    sync data model + validation
  storage/                   Hrana-over-HTTP client for Turso/libSQL, sync repository
  httpapi/                   routes, auth, CORS (plain net/http)
  youtube/                   oEmbed lookup (titles, channels)
  lambdaadapter/             runs the http.Handler inside a Lambda/Netlify Function
  app/                       wiring from environment variables
  cmd/server/                local development server
web/
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
        sync.client.js               HTTP client for the Go API
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

### Styles

Tailwind v4 and daisyUI are loaded from plain CSS (`styles/tailwind.css`), because Tailwind v4 reads its own directives and isn't designed to run through Sass. Everything hand-written is Sass: the global layer in `styles/*.scss` and the component `<style lang="scss">` blocks, which can `@use 'tokens' as *;` and `@use 'mixins' as *;` from anywhere. The app ships two daisyUI themes, `queue` (light) and `queue-night` (dark); the switch at the bottom of the sidebar follows the system or pins one.

### How sync works

* Every synced row has `updated_at` (ms), `deleted` (tombstone) and, locally, `dirty`.
* `POST /api/sync` sends `{ since, changes }`: every dirty row plus the last server cursor the device has seen.
* The server applies rows in one transaction with **last-write-wins** (`updated_at` must be newer), stamps each with an increasing `seq`, and answers with every row whose `seq > since` and a new cursor (paged with `hasMore`).
* The client clears `dirty` only for rows that weren't edited again during the request, then applies the server rows with the same last-write-wins rule.

Sync runs after edits (2.5 s debounce), every minute while the tab is visible, when the network comes back, and from the sync button.

## Run it locally

Requirements: Node 22+, Go 1.24+, and the [Turso CLI](https://docs.turso.tech/cli/installation) for a local libSQL server.

```bash
# 1. local cloud database (keeps running)
turso dev --db-file local.db            # serves http://127.0.0.1:8080

# 2. Go API (keeps running) — uses SYNC_TOKEN=dev-token by default
go run ./api/cmd/server                 # http://localhost:8787

# 3. web app — Vite proxies /api to :8787
cd web && npm install && npm run dev    # http://localhost:5173
```

In the app, open the sync status at the bottom of the sidebar, enter `dev-token`, and choose **Save and sync**. The app works without steps 1 and 2; it just stays on one device.

Tests:

```bash
go test ./...                                         # API (storage test skips without a server)
LIBSQL_TEST_URL=http://127.0.0.1:8080 go test ./api/storage/   # against `turso dev`
cd web && npm test                                    # services, URL parsing, SQLite repositories, sync rules
```

Linting and formatting (in `web/`):

```bash
npm run lint          # ESLint: errors for likely bugs, warnings for clean-up
npm run lint:fix      # fix what ESLint can fix automatically
npm run format        # Prettier, using .editorconfig (4-space indent, 120 columns, single quotes)
npm run format:check
```

Rules live in `web/eslint.config.js`. In VS Code (or VSCodium), install the recommended extensions from `.vscode/extensions.json` to see ESLint errors and warnings underlined as you type.

## Deploy to Netlify

### 1. Create the cloud database

```bash
turso auth login
turso db create yt-playlists
turso db show yt-playlists --url        # → libsql://yt-playlists-<you>.turso.io
turso db tokens create yt-playlists     # → a long token
```

The API creates its tables on first use.

### 2. Pick a sync token

This is the password your devices use to sync. Generate a long random one:

```bash
openssl rand -hex 32
```

### 3. Create the Netlify site

**Option A: from Git (recommended, deploys on every push)**

1. Push this folder to a GitHub, GitLab or Bitbucket repository.
2. In Netlify: **Add new site → Import an existing project** and pick the repo. The build settings come from `netlify.toml`; leave them as they are.
3. In **Site configuration → Environment variables**, add:

   | Variable             | Value                                   |
   | -------------------- | --------------------------------------- |
   | `TURSO_DATABASE_URL` | the `libsql://…` URL from step 1        |
   | `TURSO_AUTH_TOKEN`   | the token from step 1                   |
   | `SYNC_TOKEN`         | the token from step 2                   |
   | `YOUTUBE_API_KEY`    | optional, see "Importing YouTube playlists" below |

4. **Deploys → Trigger deploy**.

**Option B: from your computer with the Netlify CLI** (needs Node and Go installed locally)

```bash
npm install -g netlify-cli
netlify login
netlify init                                   # create/link a site
netlify env:set TURSO_DATABASE_URL "libsql://…"
netlify env:set TURSO_AUTH_TOKEN "…"
netlify env:set SYNC_TOKEN "…"
netlify deploy --build --prod
```

### 4. Connect your devices

Open the site, click the sync status at the bottom of the sidebar, keep the API address as `/api`, paste your `SYNC_TOKEN`, choose **Test connection**, then **Save and sync**. Do the same on every device.

Check the API directly at `https://<your-site>.netlify.app/api/health`; it should answer `{"ok":true,"syncConfigured":true}`.

## Importing YouTube playlists

Paste a YouTube playlist link (`youtube.com/playlist?list=…`, or a watch link with `&list=…`):

* in **New playlist** (or the first-run screen) to create a playlist with the same title and videos, or
* in the **add videos** box to add the playlist's videos to the playlist you have open.

The Go API reads the playlist (`GET /api/playlist?id=…`):

* **With `YOUTUBE_API_KEY` set**, it uses the YouTube Data API and imports the whole playlist (up to 1,000 videos). Create a key in Google Cloud Console: enable **YouTube Data API v3**, then **Credentials → Create credentials → API key**. Each 50 videos costs 1 unit of the free 10,000-unit daily quota.
* **Without a key**, it uses YouTube's public playlist feed, which only lists the latest 15 videos. The app says so when an import may be incomplete.

Only public and unlisted playlists can be imported; private playlists, Watch Later and auto-generated mixes can't.

## Notes and limits

* **One library per deployment.** Everyone with the sync token shares the same playlists. For several people, deploy one site each or extend `SYNC_TOKEN` into per-user tokens.
* **Local data lives in this browser.** Clearing site data removes it; with sync on, it comes back from the cloud on the next sync. The sync dialog can also export the database as a `.sqlite` file.
* **Video titles** come from YouTube's public oEmbed endpoint through `/api/oembed` (falling back to noembed.com). No YouTube API key or Google sign-in is needed, and the app can't read or change your playlists on youtube.com.
* **Hosting the API elsewhere** works (set the API address in the sync dialog and `ALLOWED_ORIGIN` on the API), but add that origin to `connect-src` in `web/public/_headers`.
