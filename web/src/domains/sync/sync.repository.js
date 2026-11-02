import { and, asc, count, eq, gt, sql } from 'drizzle-orm';
import { meta, playlists, videos } from '../../core/db/tables.js';

/**
 * Sync bookkeeping in the local SQLite database: settings and cursor in the
 * `meta` table, and the `dirty` flags on synced rows.
 */

const KEYS = {
    apiUrl: 'sync.apiUrl',
    token: 'sync.token',
    autoSync: 'sync.auto',
    cursor: 'sync.cursor',
    lastSyncedAt: 'sync.lastSyncedAt',
};

const getMeta = (db, key) => {
    return db.orm.select({ value: meta.value }).from(meta).where(eq(meta.key, key)).get()?.value ?? null;
};

const setMeta = (db, key, value) => {
    const text = value == null ? null : String(value);
    db.write(
        db.orm
            .insert(meta)
            .values({ key, value: text })
            .onConflictDoUpdate({ target: meta.key, set: { value: text } }),
    );
};

export const getSettings = (db) => {
    return {
        apiUrl: getMeta(db, KEYS.apiUrl) ?? '/api',
        token: getMeta(db, KEYS.token) ?? '',
        autoSync: (getMeta(db, KEYS.autoSync) ?? '1') === '1',
    };
};

export const saveSettings = (db, { apiUrl, token, autoSync }) => {
    const previous = getSettings(db);
    db.transaction(() => {
        setMeta(db, KEYS.apiUrl, apiUrl.trim() || '/api');
        setMeta(db, KEYS.token, token.trim());
        setMeta(db, KEYS.autoSync, autoSync ? '1' : '0');
        // A different server means a different change history: pull from scratch.
        if (previous.apiUrl !== (apiUrl.trim() || '/api')) {
            setMeta(db, KEYS.cursor, 0);
            db.write(db.orm.update(playlists).set({ dirty: true }));
            db.write(db.orm.update(videos).set({ dirty: true }));
        }
    });
    return getSettings(db);
};

export const getCursor = (db) => {
    return Number(getMeta(db, KEYS.cursor) ?? 0);
};

export const setCursor = (db, cursor) => {
    setMeta(db, KEYS.cursor, cursor);
};

export const getLastSyncedAt = (db) => {
    const v = getMeta(db, KEYS.lastSyncedAt);
    return v ? Number(v) : null;
};

export const setLastSyncedAt = (db, t) => {
    setMeta(db, KEYS.lastSyncedAt, t);
};

const countDirty = (db, table) => {
    return db.orm.select({ n: count() }).from(table).where(eq(table.dirty, true)).get().n;
};

export const countPending = (db) => {
    return countDirty(db, playlists) + countDirty(db, videos);
};

/** Local rows that changed since the last successful push (incl. deletions). */
export const collectChanges = (db, limit = 2000) => {
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
export const markPushed = (db, changes) => {
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
const excluded = (column) => sql`excluded.${sql.identifier(column.name)}`;

/** Applies server rows with last-write-wins; returns how many rows changed. */
export const applyRemote = (db, changes) => {
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
