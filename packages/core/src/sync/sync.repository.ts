import { and, asc, count, eq, gt, sql } from 'drizzle-orm';
import type { Database } from '../db/database';
import { meta, playlists, videos } from '../db/tables';
import type { ChainAccess } from './sync.client';

/**
 * Sync bookkeeping in the local SQLite database: settings, this device's sync
 * chain credential and the cursor in the `meta` table, and the `dirty` flags on
 * synced rows. The chain code itself is never stored, only this device's own
 * credential.
 */

export interface SyncSettings {
    apiUrl: string;
    credential: string;
    chainId: string;
    deviceId: string;
    legacyToken: string;
    autoSync: boolean;
}

interface SyncedRow {
    id: string;
    position?: number;
    createdAt: number;
    updatedAt: number;
    deleted?: boolean;
}

export interface RemotePlaylist extends SyncedRow {
    name: string;
    description?: string;
    source?: string;
    sourceId?: string;
}

export interface RemoteVideo extends SyncedRow {
    playlistId: string;
    youtubeId: string;
    title?: string;
    author?: string;
    artist?: string;
    artistSource?: string;
    thumbnailUrl?: string;
    notes?: string;
    watched?: boolean;
    unavailable?: boolean;
}

export interface RemoteChanges {
    playlists?: RemotePlaylist[];
    videos?: RemoteVideo[];
}

export type LocalChanges = ReturnType<typeof collectChanges>;

const KEYS = {
    apiUrl: 'sync.apiUrl',
    // The shared token from before sync chains, kept only to claim that library once.
    legacyToken: 'sync.token',
    credential: 'sync.deviceCredential',
    chainId: 'sync.chainId',
    deviceId: 'sync.deviceId',
    autoSync: 'sync.auto',
    cursor: 'sync.cursor',
    lastSyncedAt: 'sync.lastSyncedAt',
    // When the person last said they still have the chain code and recovery codes (this device only).
    codeCheckedAt: 'sync.codeCheckedAt',
};

const getMeta = (db: Database, key: string): string | null => {
    return db.orm.select({ value: meta.value }).from(meta).where(eq(meta.key, key)).get()?.value ?? null;
};

const setMeta = (db: Database, key: string, value: string | number | null): void => {
    const text = value == null ? null : String(value);
    db.write(
        db.orm
            .insert(meta)
            .values({ key, value: text })
            .onConflictDoUpdate({ target: meta.key, set: { value: text } }),
    );
};

export const getSettings = (db: Database): SyncSettings => {
    return {
        apiUrl: getMeta(db, KEYS.apiUrl) ?? '/api',
        credential: getMeta(db, KEYS.credential) ?? '',
        chainId: getMeta(db, KEYS.chainId) ?? '',
        deviceId: getMeta(db, KEYS.deviceId) ?? '',
        legacyToken: getMeta(db, KEYS.legacyToken) ?? '',
        autoSync: (getMeta(db, KEYS.autoSync) ?? '1') === '1',
    };
};

/** Pull everything again and push every local row: the next sync starts from scratch. */
const startOver = (db: Database): void => {
    setMeta(db, KEYS.cursor, 0);
    db.write(db.orm.update(playlists).set({ dirty: true }));
    db.write(db.orm.update(videos).set({ dirty: true }));
};

export const saveSettings = (
    db: Database,
    { apiUrl, autoSync }: Pick<SyncSettings, 'apiUrl' | 'autoSync'>,
): SyncSettings => {
    const previous = getSettings(db);
    const nextApiUrl = apiUrl.trim() || '/api';
    db.transaction(() => {
        setMeta(db, KEYS.apiUrl, nextApiUrl);
        setMeta(db, KEYS.autoSync, autoSync ? '1' : '0');
        // A different server has different chains: this device's credential means nothing there.
        if (previous.apiUrl !== nextApiUrl) {
            clearChainAccess(db);
            startOver(db);
        }
    });
    return getSettings(db);
};

/**
 * Saves this device's place in a sync chain. A new or joined chain has its own
 * change history, so the next sync starts over and merges this device's library
 * into the chain; claiming the library this device already synced keeps the cursor.
 */
export const setChainAccess = (
    db: Database,
    { chainId, deviceId, deviceCredential }: ChainAccess,
    { claimed = false } = {},
): SyncSettings => {
    db.transaction(() => {
        setMeta(db, KEYS.chainId, chainId);
        setMeta(db, KEYS.deviceId, deviceId);
        setMeta(db, KEYS.credential, deviceCredential);
        // The old shared token isn't needed anymore once this device is in a chain.
        setMeta(db, KEYS.legacyToken, null);
        // Whoever just created, joined or recovered the chain has its code (or codes) at hand.
        setMeta(db, KEYS.codeCheckedAt, Date.now());
        if (!claimed) startOver(db);
    });
    return getSettings(db);
};

/** Forgets this device's chain (left, removed, or the chain was deleted). Local data stays. */
export const clearChainAccess = (db: Database): SyncSettings => {
    db.transaction(() => {
        setMeta(db, KEYS.chainId, null);
        setMeta(db, KEYS.deviceId, null);
        setMeta(db, KEYS.credential, null);
        setMeta(db, KEYS.codeCheckedAt, null);
    });
    return getSettings(db);
};

/** When the person last confirmed they still have the chain code and recovery codes, or null. */
export const getCodeCheckedAt = (db: Database): number | null => {
    const v = getMeta(db, KEYS.codeCheckedAt);
    return v ? Number(v) : null;
};

export const setCodeCheckedAt = (db: Database, t: number): void => {
    setMeta(db, KEYS.codeCheckedAt, t);
};

export const getCursor = (db: Database): number => {
    return Number(getMeta(db, KEYS.cursor) ?? 0);
};

export const setCursor = (db: Database, cursor: number): void => {
    setMeta(db, KEYS.cursor, cursor);
};

export const getLastSyncedAt = (db: Database): number | null => {
    const v = getMeta(db, KEYS.lastSyncedAt);
    return v ? Number(v) : null;
};

export const setLastSyncedAt = (db: Database, t: number): void => {
    setMeta(db, KEYS.lastSyncedAt, t);
};

const countDirty = (db: Database, table: typeof playlists | typeof videos): number => {
    return db.orm.select({ n: count() }).from(table).where(eq(table.dirty, true)).get()?.n ?? 0;
};

export const countPending = (db: Database): number => {
    return countDirty(db, playlists) + countDirty(db, videos);
};

/** Local rows that changed since the last successful push (incl. deletions). */
export const collectChanges = (db: Database, limit = 2000) => {
    const changedPlaylists = db.orm
        .select({
            id: playlists.id,
            name: playlists.name,
            description: playlists.description,
            source: playlists.source,
            sourceId: playlists.sourceId,
            position: playlists.position,
            createdAt: playlists.createdAt,
            updatedAt: playlists.updatedAt,
            deleted: playlists.deleted,
        })
        .from(playlists)
        .where(eq(playlists.dirty, true))
        .orderBy(asc(playlists.updatedAt))
        .limit(limit)
        .all();
    const changedVideos = db.orm
        .select({
            id: videos.id,
            playlistId: videos.playlistId,
            youtubeId: videos.youtubeId,
            title: videos.title,
            author: videos.author,
            artist: videos.artist,
            artistSource: videos.artistSource,
            thumbnailUrl: videos.thumbnailUrl,
            notes: videos.notes,
            watched: videos.watched,
            unavailable: videos.unavailable,
            position: videos.position,
            createdAt: videos.createdAt,
            updatedAt: videos.updatedAt,
            deleted: videos.deleted,
        })
        .from(videos)
        .where(eq(videos.dirty, true))
        .orderBy(asc(videos.updatedAt))
        .limit(limit - changedPlaylists.length)
        .all();
    return { playlists: changedPlaylists, videos: changedVideos };
};

/**
 * Clears the dirty flag of pushed rows, unless they were edited again while
 * the request was in flight (their updated_at moved on).
 */
export const markPushed = (db: Database, changes: LocalChanges): void => {
    for (const p of changes.playlists) {
        db.write(
            db.orm
                .update(playlists)
                .set({ dirty: false })
                .where(and(eq(playlists.id, p.id), eq(playlists.updatedAt, p.updatedAt))),
        );
    }
    for (const v of changes.videos) {
        db.write(
            db.orm
                .update(videos)
                .set({ dirty: false })
                .where(and(eq(videos.id, v.id), eq(videos.updatedAt, v.updatedAt))),
        );
    }
};

/** The value an upsert tried to insert into `column` (SQLite's `excluded` row). */
const excluded = (column: { name: string }) => sql`excluded.${sql.identifier(column.name)}`;

/** Applies server rows with last-write-wins; returns how many rows changed. */
export const applyRemote = (db: Database, changes: RemoteChanges): number => {
    let applied = 0;
    for (const p of changes.playlists ?? []) {
        // A server from before imports were remembered leaves the source out: keep the local one.
        const hasSource = p.source !== undefined;
        applied += db.write(
            db.orm
                .insert(playlists)
                .values({
                    id: p.id,
                    name: p.name,
                    description: p.description ?? '',
                    source: p.source ?? '',
                    sourceId: p.sourceId ?? '',
                    position: p.position ?? 0,
                    createdAt: p.createdAt,
                    updatedAt: p.updatedAt,
                    deleted: Boolean(p.deleted),
                    dirty: false,
                })
                .onConflictDoUpdate({
                    target: playlists.id,
                    set: {
                        name: excluded(playlists.name),
                        description: excluded(playlists.description),
                        ...(hasSource && {
                            source: excluded(playlists.source),
                            sourceId: excluded(playlists.sourceId),
                        }),
                        position: excluded(playlists.position),
                        updatedAt: excluded(playlists.updatedAt),
                        deleted: excluded(playlists.deleted),
                        dirty: false,
                    },
                    setWhere: gt(excluded(playlists.updatedAt), playlists.updatedAt),
                }),
        );
    }
    for (const v of changes.videos ?? []) {
        // A server from before artists (or the unavailable flag) existed leaves them out:
        // keep the local values.
        const hasArtist = v.artist !== undefined;
        const hasUnavailable = v.unavailable !== undefined;
        applied += db.write(
            db.orm
                .insert(videos)
                .values({
                    id: v.id,
                    playlistId: v.playlistId,
                    youtubeId: v.youtubeId,
                    title: v.title ?? '',
                    author: v.author ?? '',
                    artist: v.artist ?? '',
                    artistSource: v.artistSource ?? '',
                    thumbnailUrl: v.thumbnailUrl ?? '',
                    notes: v.notes ?? '',
                    watched: Boolean(v.watched),
                    unavailable: Boolean(v.unavailable),
                    position: v.position ?? 0,
                    createdAt: v.createdAt,
                    updatedAt: v.updatedAt,
                    deleted: Boolean(v.deleted),
                    dirty: false,
                })
                .onConflictDoUpdate({
                    target: videos.id,
                    set: {
                        playlistId: excluded(videos.playlistId),
                        youtubeId: excluded(videos.youtubeId),
                        title: excluded(videos.title),
                        author: excluded(videos.author),
                        ...(hasArtist && {
                            artist: excluded(videos.artist),
                            artistSource: excluded(videos.artistSource),
                        }),
                        thumbnailUrl: excluded(videos.thumbnailUrl),
                        notes: excluded(videos.notes),
                        watched: excluded(videos.watched),
                        ...(hasUnavailable && { unavailable: excluded(videos.unavailable) }),
                        position: excluded(videos.position),
                        updatedAt: excluded(videos.updatedAt),
                        deleted: excluded(videos.deleted),
                        dirty: false,
                    },
                    setWhere: gt(excluded(videos.updatedAt), videos.updatedAt),
                }),
        );
    }
    return applied;
};
