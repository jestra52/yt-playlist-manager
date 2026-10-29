# Architecture

Two views of Queue: how the code is split into components, and where each part runs once deployed. GitHub renders both diagrams from the Mermaid source below.

## Components

### Web app

The web app runs entirely in the browser. Each domain has the same layers, and calls only go downwards: **components → service → repository or client → core**.

```mermaid
flowchart TB
    subgraph playlists["playlists"]
        direction TB
        pComp["components<br/>PlaylistSidebar<br/>PlaylistHeader<br/>FirstPlaylist"]
        pSvc["playlists.service<br/>list, selection, create,<br/>import from YouTube"]
        pRepo["playlists.repository"]
        pComp --> pSvc --> pRepo
    end

    subgraph videos["videos"]
        direction TB
        vComp["components<br/>AddVideoForm · VideoToolbar<br/>VideoQueue · VideoRow<br/>PlayerPanel · ProgressStrip"]
        vSvc["videos.service<br/>add, reorder, watched,<br/>notes, filter, player"]
        vRepo["videos.repository"]
        vClients["metadata.client<br/>playlist.client"]
        vRules["youtube.js<br/>link parsing"]
        vComp --> vSvc
        vSvc --> vRepo
        vSvc --> vClients
        vSvc --> vRules
    end

    subgraph sync["sync"]
        direction TB
        sComp["components<br/>SyncStatus<br/>SyncSettingsDialog"]
        sSvc["sync.service<br/>two-way sync,<br/>auto-sync"]
        sRepo["sync.repository<br/>settings, cursor,<br/>dirty rows"]
        sClient["sync.client"]
        sComp --> sSvc
        sSvc --> sRepo
        sSvc --> sClient
    end

    subgraph ui["ui"]
        direction TB
        uComp["components<br/>Notices · ThemeSwitch<br/>Dialog · Icon"]
        uSvc["ui.service<br/>drawer, dialog,<br/>theme, notices"]
        uComp --> uSvc
    end

    subgraph core["core"]
        direction LR
        db["db<br/>SQLite wrapper,<br/>migrations"]
        storage[("sql.js + IndexedDB")]
        events["events<br/>data-changed signal"]
        config["config<br/>API address"]
        db --> storage
    end

    api[".NET API<br/>/api/sync · /api/oembed · /api/playlist"]

    pSvc -- "imports videos" --> vSvc
    pRepo & vRepo & sRepo --> db
    pSvc & vSvc -- "dataChanged()" --> events
    events -- "schedules sync" --> sSvc
    vClients & sClient --> api
```

`App.svelte` lays out the shell (playlist drawer and main column) and renders the domain components. Services also call `ui.notify()` to show messages, and `sync.service` reloads the playlists and videos services after pulling changes; those links are left out of the diagram to keep it readable.

### .NET API

One project per layer. Calls go from the API project inwards; Infrastructure implements the interfaces (ports) that Application defines, so the use cases don't depend on EF Core or HTTP.

```mermaid
flowchart LR
    subgraph apiProject["YtPlaylist.Api (ASP.NET Core)"]
        direction TB
        program["Program.cs<br/>DI · CORS · migrations on start"]
        syncEp["SyncEndpoints<br/>POST /api/sync · bearer token"]
        ytEp["YouTubeEndpoints<br/>GET /api/oembed · /api/playlist"]
        healthEp["HealthEndpoints<br/>GET /api/health"]
    end

    subgraph application["YtPlaylist.Application"]
        direction TB
        syncSvc["SyncService<br/>validate · apply · pull"]
        validator["ChangeSetValidator"]
        ports["Ports<br/>ISyncStore · IVideoMetadataSource<br/>IYouTubePlaylistSource"]
    end

    subgraph domain["YtPlaylist.Domain"]
        direction TB
        entities["Playlist · Video · SyncCounter"]
        rules["YouTubeIds · SyncLimits"]
    end

    subgraph infrastructure["YtPlaylist.Infrastructure"]
        direction TB
        store["EfSyncStore"]
        dbContext["AppDbContext<br/>configurations · migrations"]
        clients["OEmbedClient<br/>YouTubePlaylistClient"]
        store --> dbContext
    end

    syncEp --> syncSvc
    syncSvc --> validator & ports
    ytEp --> ports
    healthEp --> syncSvc
    store -. "implements" .-> ports
    clients -.-> ports
    validator --> rules
    dbContext --> entities

    subgraph external["External services"]
        direction TB
        postgres[("PostgreSQL<br/>Neon")]
        yt["YouTube<br/>oEmbed · Data API v3 · feed"]
    end

    dbContext -- "EF Core + Npgsql" --> postgres
    clients --> yt
```

| Layer | Where | Responsibility |
| --- | --- | --- |
| Presentation | `web/src/domains/*/components`, `web/src/shared/components` | Svelte views styled with daisyUI; read service state, call service methods |
| Application | `web/src/domains/*/*.service.svelte.js` | Reactive state (`$state`, `$derived`) and use cases such as `videos.addFromText` or `sync.syncNow` |
| Data access | `*.repository.js`, `*.client.js` | SQL against the local database; HTTP calls to the API |
| Core | `web/src/core` | SQLite wrapper and persistence, the data-changed signal, the API address |
| API | `api/src/YtPlaylist.*` | Endpoints and auth (Api), use cases and ports (Application), entities and rules (Domain), EF Core and YouTube clients (Infrastructure) |

## Deployment

Netlify serves the static web app and forwards `/api` to the .NET API, which runs as a Docker container on Render. Data lives in two places: each browser's local SQLite database, and the PostgreSQL database on Neon that keeps devices in sync.

```mermaid
flowchart LR
    subgraph device["User device: web browser"]
        direction TB
        spa["Queue web app<br/>HTML · JS · CSS"]
        wasm["sql.js<br/>SQLite in WebAssembly"]
        idb[("IndexedDB<br/>main.sqlite")]
        spa --> wasm <--> idb
    end

    subgraph netlify["Netlify"]
        direction TB
        cdn["CDN<br/>web/dist + _headers (CSP)"]
        redirect{{"/api/* proxy<br/>(from API_ORIGIN)"}}
    end

    subgraph render["Render"]
        container["Docker container: ASP.NET Core API<br/>env: DATABASE_URL · SYNC_TOKEN<br/>YOUTUBE_API_KEY · ALLOWED_ORIGIN"]
    end

    subgraph neon["Neon"]
        postgres[("PostgreSQL<br/>playlists · videos<br/>sync_counter")]
    end

    subgraph youtube["YouTube"]
        direction TB
        dataApi["Data API v3<br/>(with API key)"]
        ytPublic["oEmbed · playlist feed"]
        media["Embedded player · thumbnails"]
    end

    spa -- "page and assets" --> cdn
    spa -- "/api/sync · /api/oembed · /api/playlist" --> redirect
    redirect -- "HTTPS" --> container
    container -- "EF Core (Npgsql), TLS" --> postgres
    container --> dataApi & ytPublic
    spa --> media

    github[("GitHub repo")]
    github -. "build: npm ci · vite build" .-> netlify
    github -. "build: api/Dockerfile" .-> render
```

Not shown: the browser also loads Google Fonts, and falls back to noembed.com for video titles when the API can't be reached.

| Node | What runs there | Notes |
| --- | --- | --- |
| User device | The web app, SQLite (sql.js) and IndexedDB | Works offline; every browser keeps its own copy of the data |
| Netlify CDN | `web/dist` with the headers from `web/public/_headers` | Content-Security-Policy limits connections to the app's own API and noembed.com |
| Netlify proxy | `/api/*` forwarded to the Render service | Written at build time from `API_ORIGIN`; requests time out after 26 seconds |
| Render | The .NET API in a Docker container (`api/Dockerfile`, `render.yaml`) | Applies EF Core migrations on start; the free plan sleeps when idle |
| Neon | The shared PostgreSQL database | Last-write-wins sync; each row has a `seq` the clients use as a cursor |
| YouTube | oEmbed, Data API v3, playlist feed, thumbnails, embedded player | The Data API is only used when `YOUTUBE_API_KEY` is set |

For local development the same pieces run on one machine: `npm run dev` (Vite, which proxies `/api`), `dotnet run --project src/YtPlaylist.Api` on port 8787, and PostgreSQL from `docker compose up` in `api/`. See the README.
