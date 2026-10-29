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
    return db.get('SELECT value FROM meta WHERE key = ?', [key])?.value ?? null;
};

const setMeta = (db, key, value) => {
    db.run('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [
        key,
        value == null ? null : String(value),
    ]);
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
            db.run('UPDATE playlists SET dirty = 1');
            db.run('UPDATE videos SET dirty = 1');
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

export const countPending = (db) => {
    return (
        db.get('SELECT COUNT(*) AS n FROM playlists WHERE dirty = 1').n +
        db.get('SELECT COUNT(*) AS n FROM videos WHERE dirty = 1').n
    );
};

/** Local rows that changed since the last successful push (incl. deletions). */
export const collectChanges = (db, limit = 2000) => {
    const playlists = db
        .all('SELECT * FROM playlists WHERE dirty = 1 ORDER BY updated_at LIMIT ?', [limit])
        .map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            position: r.position,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            deleted: r.deleted === 1,
        }));
    const videos = db
        .all('SELECT * FROM videos WHERE dirty = 1 ORDER BY updated_at LIMIT ?', [limit - playlists.length])
        .map((r) => ({
            id: r.id,
            playlistId: r.playlist_id,
            youtubeId: r.youtube_id,
            title: r.title,
            author: r.author,
            thumbnailUrl: r.thumbnail_url,
            notes: r.notes,
            watched: r.watched === 1,
            position: r.position,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            deleted: r.deleted === 1,
        }));
    return { playlists, videos };
};

/**
 * Clears the dirty flag of pushed rows, unless they were edited again while
 * the request was in flight (their updated_at moved on).
 */
export const markPushed = (db, changes) => {
    for (const p of changes.playlists) {
        db.run('UPDATE playlists SET dirty = 0 WHERE id = ? AND updated_at = ?', [p.id, p.updatedAt]);
    }
    for (const v of changes.videos) {
        db.run('UPDATE videos SET dirty = 0 WHERE id = ? AND updated_at = ?', [v.id, v.updatedAt]);
    }
};

/** Applies server rows with last-write-wins; returns how many rows changed. */
export const applyRemote = (db, changes) => {
    let applied = 0;
    for (const p of changes.playlists ?? []) {
        applied += db.run(
            `INSERT INTO playlists (id, name, description, position, created_at, updated_at, deleted, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT (id) DO UPDATE SET
         name = excluded.name, description = excluded.description, position = excluded.position,
         updated_at = excluded.updated_at, deleted = excluded.deleted, dirty = 0
       WHERE excluded.updated_at > playlists.updated_at`,
            [p.id, p.name, p.description ?? '', p.position ?? 0, p.createdAt, p.updatedAt, p.deleted ? 1 : 0],
        );
    }
    for (const v of changes.videos ?? []) {
        applied += db.run(
            `INSERT INTO videos (id, playlist_id, youtube_id, title, author, thumbnail_url, notes, watched,
                           position, created_at, updated_at, deleted, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT (id) DO UPDATE SET
         playlist_id = excluded.playlist_id, youtube_id = excluded.youtube_id, title = excluded.title,
         author = excluded.author, thumbnail_url = excluded.thumbnail_url, notes = excluded.notes,
         watched = excluded.watched, position = excluded.position, updated_at = excluded.updated_at,
         deleted = excluded.deleted, dirty = 0
       WHERE excluded.updated_at > videos.updated_at`,
            [
                v.id,
                v.playlistId,
                v.youtubeId,
                v.title ?? '',
                v.author ?? '',
                v.thumbnailUrl ?? '',
                v.notes ?? '',
                v.watched ? 1 : 0,
                v.position ?? 0,
                v.createdAt,
                v.updatedAt,
                v.deleted ? 1 : 0,
            ],
        );
    }
    return applied;
};
