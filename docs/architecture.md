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

    api["Go API<br/>/api/sync · /api/oembed · /api/playlist"]

    pSvc -- "imports videos" --> vSvc
    pRepo & vRepo & sRepo --> db
    pSvc & vSvc -- "dataChanged()" --> events
    events -- "schedules sync" --> sSvc
    vClients & sClient --> api
```

`App.svelte` lays out the shell (playlist drawer and main column) and renders the domain components. Services also call `ui.notify()` to show messages, and `sync.service` reloads the playlists and videos services after pulling changes; those links are left out of the diagram to keep it readable.

### Go API

```mermaid
flowchart LR
    lambda["netlify/functions/api<br/>Lambda entry point"] --> adapter["lambdaadapter<br/>Lambda event ⇄ net/http"]
    server["api/cmd/server<br/>local dev server"] --> wiring
    lambda --> wiring["app<br/>config from env vars"]
    adapter --> router
    wiring --> router["httpapi<br/>routes · auth · CORS"]

    router -- "/sync" --> storage["storage<br/>SyncRepo · Hrana client"]
    router -- "/oembed · /playlist" --> youtube["youtube<br/>OEmbed · PlaylistFetcher"]
    router --> domain["domain<br/>models · validation"]
    storage --> domain

    storage --> turso[("Turso<br/>libSQL")]
    youtube --> yt["YouTube<br/>oEmbed · Data API v3 · feed"]
```

| Layer | Where | Responsibility |
| --- | --- | --- |
| Presentation | `web/src/domains/*/components`, `web/src/shared/components` | Svelte views styled with daisyUI; read service state, call service methods |
| Application | `web/src/domains/*/*.service.svelte.js` | Reactive state (`$state`, `$derived`) and use cases such as `videos.addFromText` or `sync.syncNow` |
| Data access | `*.repository.js`, `*.client.js` | SQL against the local database; HTTP calls to the Go API |
| Core | `web/src/core` | SQLite wrapper and persistence, the data-changed signal, the API address |
| Go API | `api/*`, `netlify/functions/api` | Routes and auth, the Turso sync store, YouTube lookups, the shared data model |

## Deployment

One Netlify site serves the static web app and runs the Go API as a function. Data lives in two places: each browser's local SQLite database, and the Turso database that keeps devices in sync.

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
        redirect{{"/api/* rewrite"}}
        fn["Function: api<br/>Go on AWS Lambda"]
        env[/"Env vars<br/>TURSO_DATABASE_URL<br/>TURSO_AUTH_TOKEN<br/>SYNC_TOKEN<br/>YOUTUBE_API_KEY (optional)"/]
        redirect --> fn
        env -.- fn
    end

    subgraph cloud["Data and YouTube"]
        direction TB
        tursoDb[("Turso<br/>libSQL database")]
        dataApi["YouTube Data API v3"]
        ytPublic["youtube.com<br/>oEmbed · playlist feed"]
    end

    subgraph web["Loaded by the browser"]
        direction TB
        player["youtube-nocookie.com<br/>embedded player"]
        thumbs["i.ytimg.com<br/>thumbnails"]
        extra["noembed.com · Google Fonts"]
    end

    github[("GitHub repo")] -- "git push → build:<br/>npm ci · vite build · go build" --> netlify

    spa -- "page and assets" --> cdn
    spa -- "/api/sync · /api/oembed<br/>/api/playlist" --> redirect
    spa --> player & thumbs & extra
    fn -- "HTTPS (Hrana)" --> tursoDb
    fn -- "with API key" --> dataApi
    fn -- "titles; playlists<br/>without a key" --> ytPublic
```

| Node | What runs there | Notes |
| --- | --- | --- |
| User device | The web app, SQLite (sql.js) and IndexedDB | Works offline; every browser keeps its own copy of the data |
| Netlify CDN | `web/dist` with the headers from `web/public/_headers` | Content-Security-Policy limits connections to the app's own API and noembed.com |
| Netlify Function | The Go API (`netlify/functions/api`) | Built from source on each deploy; configured by environment variables |
| Turso | The shared libSQL database | Last-write-wins sync; each row has a `seq` the clients use as a cursor |
| YouTube | oEmbed, Data API v3, playlist feed, thumbnails, embedded player | The Data API is only used when `YOUTUBE_API_KEY` is set |

For local development the same pieces run on one machine: `npm run dev` (Vite, which proxies `/api`), `go run ./api/cmd/server` on port 8787, and `turso dev` as the database. See the README.
