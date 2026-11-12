# Architecture

Three views of Yuzu Tapes Playlist Manager: how the code is split into components, where each part runs once deployed, and the data model of both databases. GitHub renders the diagrams from the Mermaid source below.

## Contents

- [Components](#components)
  - [Web app](#web-app) · [.NET API](#net-api)
- [Deployment](#deployment)
- [Data model](#data-model)
  - [Server database](#server-database-postgresql) · [Local database](#local-database-sqlite-in-the-browser) · [How they map](#how-the-two-map-onto-each-other)
- [Back to the README](../README.md)

## Components

### Web app

The web app (`web-react/`) runs entirely in the browser. Each domain in `web-react/src/domains` has the same layers, and calls only go downwards: **components → thunks → repositories or clients in `packages/core` → the database**. Components read the Redux store through selectors and dispatch thunks; thunks write through `packages/core` and then dispatch what changed to the slices.

```mermaid
flowchart TB
    subgraph playlists["playlists"]
        direction TB
        pComp["components<br/>PlaylistList · PlaylistPage · PlaylistHeader<br/>CompareReportDialog · BackupList<br/>SyncYouTubeDialog"]
        pThunks["playlists.thunks · backups.thunks<br/>create, select, rename, delete,<br/>import and sync from YouTube,<br/>reports and backups"]
        pState["playlists.slice · selectors<br/>list, selection"]
        pComp --> pThunks
        pComp -. reads .-> pState
        pThunks --> pState
    end

    subgraph videos["videos"]
        direction TB
        vComp["components<br/>AddVideosForm · VideoToolbar · VideoList<br/>VideoRow · ArtistEditor · PositionForm<br/>PlayerPanel"]
        vThunks["videos.thunks<br/>add, move, notes, artists,<br/>links, player, shuffle"]
        vState["videos.slice · selectors<br/>videos, filter, search, sort,<br/>visible rows, play queue"]
        vComp --> vThunks
        vComp -. reads .-> vState
        vThunks --> vState
    end

    subgraph sync["sync"]
        direction TB
        sComp["components<br/>SyncStatus · SyncSettingsDialog<br/>StartScreen · ChainCodeStep · DevicesTab<br/>AddDevice · QrScanner"]
        sThunks["sync.thunks · chain.thunks · pairing.thunks<br/>two-way sync, chains, pairing,<br/>recovery, reminders"]
        sState["sync.slice · selectors<br/>settings, status, chain, pairing"]
        autoSync["auto-sync<br/>listener middleware"]
        sComp --> sThunks
        sComp -. reads .-> sState
        sThunks --> sState
        autoSync --> sThunks
    end

    subgraph ui["ui"]
        direction TB
        uComp["components<br/>AppShell · Sidebar · AppDialog<br/>Notices · ThemeSwitch"]
        uState["ui.slice<br/>theme, sidebar, dialogs, notices"]
        uComp -. reads .-> uState
    end

    subgraph core["packages/core"]
        direction TB
        repos["repositories<br/>playlists · videos · backups · sync"]
        rules["rules<br/>youtube · artist · artist-credits<br/>report · report-compare · youtube-sync<br/>chain, recovery and pairing codes"]
        clients["clients<br/>sync.client · metadata.client<br/>playlist.client"]
        db["db<br/>SQLite wrapper, Drizzle<br/>tables, migrations"]
        storage[("sql.js + IndexedDB")]
        repos --> db --> storage
    end

    api[".NET API<br/>/api/sync · /api/chain · /api/oembed · /api/playlist"]

    pThunks & vThunks & sThunks --> repos
    pThunks & vThunks & sThunks --> rules
    pThunks & vThunks & sThunks --> clients
    pState & vState -- "changed actions" --> autoSync
    clients --> api
```

`App.tsx` puts the store around `AppShell`, which lays out the sidebar drawer and the playlist page. Thunks also dispatch `notify()` from the ui slice to show messages, and the sync thunks reload the playlists and videos slices after pulling changes; those links are left out of the diagram to keep it readable. `auto-sync` listens for the slices' "changed" actions, so playlists and videos don't depend on sync.

### .NET API

One project per layer. Calls go from the API project inwards; Infrastructure implements the interfaces (ports) that Application defines, so the use cases don't depend on EF Core or HTTP. `YtPlaylist.Models` holds the entities and every DTO (the API's requests and responses, and the YouTube responses the clients read), and references no other project (a first step towards the N-tier layout in #26).

```mermaid
flowchart LR
    subgraph apiProject["YtPlaylist.Api (ASP.NET Core)"]
        direction TB
        program["Program.cs<br/>DI · CORS · migrations on start"]
        syncEp["SyncEndpoints<br/>POST /api/sync · device credential"]
        chainEp["ChainEndpoints<br/>/api/chains · /api/chain · /api/pairing<br/>rate limited, lockout after wrong codes"]
        ytEp["YouTubeEndpoints<br/>GET /api/oembed · /api/playlist"]
        healthEp["HealthEndpoints<br/>GET /api/health"]
    end

    subgraph application["YtPlaylist.Application"]
        direction TB
        syncSvc["SyncService<br/>validate · apply · pull<br/>(one chain)"]
        chainSvc["ChainService<br/>create · join · claim · recover · pair<br/>devices · audit log<br/>recovery hook: new code, codes"]
        validator["ChangeSetValidator"]
        ports["Ports<br/>ISyncStore · IChainStore · ISecretHasher<br/>IAttemptLockout<br/>IVideoMetadataSource<br/>IYouTubePlaylistSource"]
    end

    subgraph domain["YtPlaylist.Domain"]
        direction TB
        rules["YouTubeIds · SyncLimits"]
    end

    subgraph models["YtPlaylist.Models"]
        direction TB
        entities["Entities<br/>Playlist · Video · SyncCounter<br/>SyncChain · SyncDevice<br/>SyncRecoveryCode · SyncChainEvent<br/>SyncPairing"]
        contracts["Contracts<br/>ChangeSet · SyncRequest · SyncResponse …<br/>VideoMetadata · YouTubePlaylist<br/>ApiError · HealthStatus"]
        youtubeDtos["YouTube responses<br/>DataApi · OEmbed"]
    end

    subgraph infrastructure["YtPlaylist.Infrastructure"]
        direction TB
        store["EfSyncStore · EfChainStore<br/>HmacSecretHasher (SYNC_PEPPER)<br/>InMemoryAttemptLockout"]
        dbContext["AppDbContext<br/>configurations · migrations<br/>retries dropped connections"]
        clients["OEmbedClient<br/>YouTubePlaylistClient"]
        store --> dbContext
    end

    syncEp --> syncSvc
    syncEp & chainEp --> chainSvc
    chainSvc --> ports
    syncSvc --> validator & ports
    ytEp --> ports
    healthEp --> syncSvc
    store -. "implements" .-> ports
    clients -.-> ports
    validator --> rules
    dbContext --> entities
    syncEp & ports --> contracts
    clients --> youtubeDtos

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
| Presentation | `web-react/src/domains/*/components`, `web-react/src/shared/components` | React components styled with daisyUI classes and `*.module.scss`; read the store through selectors and dispatch thunks |
| State | `web-react/src/domains/*/*.slice.ts`, `*.selectors.ts` | Redux Toolkit slices hold what the views show; selectors derive the rest, such as the visible rows or what plays next |
| Application | `web-react/src/domains/*/*.thunks.ts`, `sync/auto-sync.ts` | Use cases such as `addEntries`, `saveArtists` or `syncNow`; the listener middleware that syncs after edits |
| Domain rules | `packages/core/src` (TypeScript): `videos/youtube.ts`, `videos/artist.ts`, `playlists/report.ts`, `playlists/report-compare.ts`, `playlists/youtube-sync.ts` | Plain functions with no state or I/O: parsing links, guessing artists, writing and reading reports, comparing a playlist with YouTube. Also `videos/artist-credits.ts` |
| Data access | `packages/core/src/*/*.repository.ts`, `*.client.ts` | Drizzle ORM queries against the local database; HTTP calls to the API |
| Core | `packages/core/src/db` | SQLite wrapper (sql.js + Drizzle), table definitions and migrations, and IndexedDB persistence behind a `Persistence` interface |
| API | `api/src/YtPlaylist.*` | Endpoints and auth (Api), use cases and ports (Application), entities and DTOs (Models), ID rules and limits (Domain), EF Core and YouTube clients (Infrastructure) |

**The recovery hook.** Every way of replacing a chain's code goes through one step, `ChainService.RunRecoveryHookAsync`: recovering with a recovery code, **Generate a new code**, and later the cleanup of abandoned chains. It makes a new secret and new recovery codes, and `IChainStore.ResetAccessAsync` writes everything in one transaction:

1. Locks `sync_counter`, like every sync write, so the hook waits for a sync in progress.
2. Uses the recovery code, if there is one. Two recoveries with the same code can't both win.
3. Sets the new secret hash.
4. Removes every device except the caller, or adds the device that recovered, and cancels every pairing code, so a request approved before can't add a device after.
5. Replaces the recovery codes and writes the audit entry.

A sync checks its device again after taking the same lock, so a device removed by the hook can't write afterwards, even if its request was authenticated just before. #53 will extend the hook: it will delete the connected accounts' tokens in the transaction, and revoke their grants at Google after it's committed.

**Adding a device with a pairing code.** A device in the chain creates a short code; the new device enters it (or scans its QR code); the first device approves; only then does the new device get a credential. `ChainService.Pairing.cs` has the use cases, and `sync_pairings` one row per open code:

```mermaid
sequenceDiagram
    participant A as Device in the chain
    participant API
    participant B as New device
    A->>API: POST /api/chain/pairing
    API-->>A: code 7K3Q-D9X2 (10 min)
    B->>API: POST /api/chains/pair {code, deviceName}
    API-->>B: requestToken (5 min to approve)
    loop every 2 s
        A->>API: GET /api/chain/pairing
        B->>API: POST /api/pairing/status (Bearer requestToken)
    end
    API-->>A: requested by "Chrome on Android"
    A->>API: POST /api/chain/pairing/approve
    API-->>B: approved: chainId, deviceId, deviceCredential (once)
```

* The code is 8 characters of Crockford base32 (40 bits), single use and short-lived, and it only adds a device after a person approves it. Like every secret here, the code and the request token are stored only as HMACs; the new device's credential is created when it collects it, so it's never stored at all.
* Entering a code is one conditional `UPDATE … WHERE status = 'waiting' AND expires_at > now`, so of two devices entering the same code only one gets it. Collecting the credential is the same kind of update, in one transaction with adding the device.
* Only the device that created the code can approve or deny it. A device has one code at a time, and closing the sync settings cancels it. Removing that device, or replacing the chain's code, deletes its pairings.

**Rate limits and lockouts.**

* **Per IP:** ASP.NET rate limiting on every endpoint without a device credential (`chain-secrets` 10/min, `chain-recovery` 5 per 15 min, `chain-pairing` 10 per 15 min, `chain-pairing-status` 60/min), plus a cap for everyone on `/api/chains`. On top of that, `IAttemptLockout` counts wrong codes of any kind (chain code, pairing code, recovery code, request token): 5 within 15 minutes lock the IP out of joining, pairing and recovering for 15 minutes (429 with `Retry-After`).
* **Per chain:** a wrong code can't be tied to a chain, but a refused attempt can: a denied request, or a used code entered again. Three of them within an hour pause pairing for the chain for an hour: its open codes are cancelled, new ones are refused (423), the audit log gets `pairing_locked`, and `GET /api/chain` returns `pairingLockedUntil`, which every device shows as a notice (they reload the chain after a sync at most every 10 minutes). The strikes are counted from the audit log, in the same transaction as the strike.

**Redis or PostgreSQL.** Decision: PostgreSQL, without Redis. The issue (#15) listed three uses for Redis; none needs it with one API instance:

| Use | With PostgreSQL | Why it's enough |
| --- | --- | --- |
| Short-lived pairing codes | `sync_pairings` with an `expires_at` column, checked in every query; expired rows are deleted when a new code is created | Single use comes from a conditional update, which Redis would need a script for; the rows also back the approval step and the audit log |
| Rate limiting and lockouts | ASP.NET rate limiting and `InMemoryAttemptLockout`, in the API's memory; the per-chain pause in `sync_chains.pairing_locked_until` | One instance sees every request. The per-chain pause has to survive restarts and reach every device, so it belongs in the database anyway. Restarting clears the per-IP counters, which is acceptable on top of codes that can't be guessed |
| Locks around replacing a code and syncing | The `sync_counter` row lock (`SyncCounterLock`) in the same transaction as the writes | The database is the final check either way (a lock in Redis can expire during a pause); one lock for every chain is fine at this size |

If the API ever runs on more than one instance, the per-IP counters move behind `IAttemptLockout` to a shared store (e.g. Render's Key Value, which is Redis-compatible), and the global `sync_counter` lock can become a per-chain row lock or advisory lock in PostgreSQL. Redis stays optional: the API runs, locally and in tests, without it.

## Deployment

Netlify serves the static web app and forwards `/api` to the .NET API, which runs as a Docker container on Render. Data lives in two places: each browser's local SQLite database, and the PostgreSQL database on Neon that keeps devices in sync.

```mermaid
flowchart LR
    subgraph device["User device: web browser"]
        direction TB
        spa["Yuzu Tapes Playlist Manager<br/>web app · HTML · JS · CSS"]
        wasm["sql.js<br/>SQLite in WebAssembly"]
        idb[("IndexedDB<br/>main.sqlite")]
        spa --> wasm <--> idb
    end

    subgraph netlify["Netlify"]
        direction TB
        cdn["CDN<br/>web-react/dist + _headers (CSP)"]
        redirect{{"/api/* proxy<br/>(from API_ORIGIN)"}}
    end

    subgraph render["Render"]
        container["Docker container: ASP.NET Core API<br/>env: DATABASE_URL · SYNC_PEPPER<br/>YOUTUBE_API_KEY · ALLOWED_ORIGIN<br/>(SYNC_TOKEN only to claim old data)"]
    end

    subgraph neon["Neon"]
        postgres[("PostgreSQL<br/>sync_chains · sync_devices<br/>sync_recovery_codes · sync_chain_events<br/>sync_pairings · playlists · videos<br/>sync_counter")]
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
| Netlify CDN | `web-react/dist` with the headers from `web-react/public/_headers` | Content-Security-Policy limits connections to the app's own API and noembed.com |
| Netlify proxy | `/api/*` forwarded to the Render service | Written at build time from `API_ORIGIN`; requests time out after 26 seconds |
| Render | The .NET API in a Docker container (`api/Dockerfile`, `render.yaml`) | Applies EF Core migrations on start; the free plan sleeps when idle |
| Neon | The shared PostgreSQL database | One library per sync chain: playlists and videos are keyed by `chain_id` and ID, so each chain keeps its own copy of a row even when another chain has the same ID, and a device only reads and writes its own chain's rows. Chain codes, recovery codes, pairing codes and device credentials are stored only as HMACs keyed with `SYNC_PEPPER`; each chain has an audit log without secrets. Last-write-wins sync; each row has a `seq` the clients use as a cursor. It pauses when idle and closes its connections, and the API retries on a new one |
| YouTube | oEmbed, Data API v3, playlist feed, thumbnails, embedded player | The Data API is only used when `YOUTUBE_API_KEY` is set; it reads whole playlists, including their deleted and private videos. The embedded player loads in the browser and doesn't use the key |

For local development the same pieces run on one machine: `npm run dev` (Vite, which proxies `/api`), `dotnet run --project src/YtPlaylist.Api` on port 8787, and PostgreSQL from `docker compose up` in `api/`. See the README.

## Data model

Two databases hold the same library: the **server database** (PostgreSQL on Neon), from the EF Core model in `api/src/YtPlaylist.Infrastructure/Persistence`, and the **local database** (SQLite in each browser), from `packages/core/src/db/tables.ts`. A PR that adds a migration on either side updates its diagram here.

### Server database (PostgreSQL)

Every table except `sync_counter` belongs to a sync chain, and deleting a chain deletes its rows (cascade). Playlists and videos are keyed by `(chain_id, id)`, so two chains can hold rows with the same ID. `videos.playlist_id` isn't a foreign key: the server stores what devices send, and a video can arrive before its playlist.

```mermaid
erDiagram
    sync_chains ||--o{ sync_devices : "has"
    sync_chains ||--o{ playlists : "owns"
    sync_chains ||--o{ videos : "owns"
    sync_chains ||--o{ reports : "keeps"
    sync_chains ||--o{ sync_recovery_codes : "has"
    sync_chains ||--o{ sync_pairings : "has"
    sync_chains ||--o{ sync_chain_events : "logs"
    sync_devices ||--o{ sync_pairings : "creates"
    playlists ||..o{ videos : "playlist_id, not enforced"

    sync_chains {
        varchar64 id PK "seeded row: legacy"
        varchar43 secret_hash UK "HMAC of the chain code, null for legacy"
        bigint created_at
        bigint pairing_locked_until "pairing paused until"
    }
    sync_devices {
        varchar64 id PK
        varchar64 chain_id FK "indexed"
        varchar100 name
        varchar43 credential_hash UK "HMAC of the device credential"
        bigint created_at
        bigint last_seen_at
    }
    sync_recovery_codes {
        varchar64 id PK
        varchar64 chain_id FK "indexed"
        varchar43 code_hash UK "HMAC"
        bigint created_at
    }
    sync_pairings {
        varchar64 id PK
        varchar64 chain_id FK "indexed"
        varchar64 created_by_device_id FK "indexed"
        varchar43 code_hash UK "HMAC of the pairing code"
        varchar43 request_token_hash UK "HMAC, null until the code is entered"
        varchar100 requester_name
        varchar16 status
        bigint created_at
        bigint expires_at "indexed"
    }
    sync_chain_events {
        bigint id PK "identity"
        varchar64 chain_id FK "indexed with at"
        bigint at
        varchar32 kind
        varchar100 device_name
        varchar5000 detail "no secrets"
    }
    playlists {
        varchar64 chain_id PK, FK "default legacy"
        varchar64 id PK
        varchar200 name
        varchar5000 description
        varchar32 source "empty or youtube"
        varchar64 source_id
        float8 position
        bigint created_at
        bigint updated_at "last write wins"
        bool deleted "tombstone"
        bigint seq "indexed with chain_id"
    }
    videos {
        varchar64 chain_id PK, FK "default legacy"
        varchar64 id PK
        varchar64 playlist_id "indexed with chain_id"
        varchar11 youtube_id "empty for a placeholder"
        varchar400 title
        varchar200 author "the uploading channel"
        varchar200 artist "joined display name"
        varchar32 artist_source "empty, guess or user"
        text artists "JSON list of name and role, empty for one artist"
        varchar2048 thumbnail_url
        varchar5000 notes
        bool watched "kept for older apps"
        bool unavailable "deleted on YouTube"
        varchar11 replaced_youtube_id
        float8 position
        bigint created_at
        bigint updated_at "last write wins"
        bool deleted "tombstone"
        bigint seq "indexed with chain_id"
    }
    reports {
        varchar64 chain_id PK, FK
        varchar64 id PK
        varchar64 playlist_id "indexed with chain_id and created_at"
        varchar200 playlist_name
        varchar32 reason
        int video_count
        text content "the JSON report"
        bigint created_at
    }
    sync_counter {
        int id PK "single row"
        bigint value "last seq handed out"
    }
```

* **Secrets** are never stored, only HMAC-SHA256 hashes keyed with `SYNC_PEPPER`: `secret_hash`, `credential_hash`, `code_hash` and `request_token_hash`.
* **Seeded rows:** the `legacy` chain, which holds the rows synced with `SYNC_TOKEN` before chains existed (it has no secret hash, so no one can join it), and the single `sync_counter` row.
* **`seq`:** each write to a playlist or video takes the next value of `sync_counter`, under that row's lock, and devices pull what changed after their cursor through the `(chain_id, seq)` index.

### Local database (SQLite in the browser)

The whole file is saved as one blob in IndexedDB, and `PRAGMA user_version` counts the migrations in `packages/core/src/db/migrations`. Rows arrive from sync in any order, so the relationships aren't foreign keys here either.

```mermaid
erDiagram
    playlists ||..o{ videos : "playlist_id"
    playlists ||..o{ reports : "playlist_id"

    meta {
        text key PK
        text value
    }
    playlists {
        text id PK
        text name
        text description
        text source "empty or youtube"
        text source_id
        real position
        integer created_at
        integer updated_at "last write wins"
        integer deleted "tombstone"
        integer dirty "indexed, not pushed yet"
    }
    videos {
        text id PK
        text playlist_id "indexed with position"
        text youtube_id "empty for a placeholder"
        text title
        text author
        text artist "joined display name"
        text artist_source
        text artists "JSON list, empty for one artist"
        text thumbnail_url
        text notes
        integer watched "kept for older apps"
        integer unavailable
        text replaced_youtube_id
        real position
        integer created_at
        integer updated_at
        integer deleted
        integer dirty "indexed"
    }
    reports {
        text id PK
        text playlist_id "indexed with created_at"
        text playlist_name
        text reason
        integer video_count
        text content
        integer created_at
    }
```

* **`meta`** keeps settings and sync bookkeeping, one key per row: `sync.apiUrl`, `sync.chainId`, `sync.deviceId`, `sync.deviceCredential`, `sync.cursor` (the last `seq` pulled), `sync.lastSyncedAt`, `sync.auto` and `sync.codeCheckedAt`, plus `sync.token` from before chains.
* **`reports`** are backups waiting to reach the server, or kept here on a device without a chain. They aren't synced rows: once uploaded, they leave this table.

### How the two map onto each other

| Column | Local | Server | Synced |
| --- | --- | --- | --- |
| Playlist and video fields (`name`, `title`, `artist`, `artists`, `notes`, `position`…) | ✓ | ✓ | Both ways; the newer `updated_at` wins |
| `created_at`, `updated_at`, `deleted` | ✓ | ✓ | Both ways; a deletion syncs as a tombstone |
| `dirty` | ✓ | – | Stays on the device: set by an edit, cleared once pushed |
| `chain_id` | – | ✓ | Set by the server from the device's credential |
| `seq` | – | ✓ | Set by the server; the device keeps the last one as `sync.cursor` |
| `reports` | Until uploaded | ✓ | Pushed once, then removed here |
| `meta` | ✓ | – | Device only |
