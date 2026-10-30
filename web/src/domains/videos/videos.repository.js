import { now, newId } from '../../core/db/index.js';
import { thumbnailFor } from './youtube.js';

export const toVideo = (row) => {
    return {
        id: row.id,
        playlistId: row.playlist_id,
        youtubeId: row.youtube_id,
        // A placeholder from an old report: known by its title until its link is pasted.
        missing: row.youtube_id === '',
        title: row.title,
        author: row.author,
        thumbnailUrl: row.thumbnail_url || (row.youtube_id ? thumbnailFor(row.youtube_id) : ''),
        notes: row.notes,
        watched: row.watched === 1,
        position: row.position,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

export const listVideos = (db) => {
    return db.all('SELECT * FROM videos WHERE deleted = 0 ORDER BY playlist_id, position').map(toVideo);
};

export const getVideo = (db, id) => {
    const row = db.get('SELECT * FROM videos WHERE id = ? AND deleted = 0', [id]);
    return row ? toVideo(row) : null;
};

const nextPosition = (db, playlistId) => {
    return db.get('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM videos WHERE playlist_id = ? AND deleted = 0', [
        playlistId,
    ]).next;
};

const insertVideo = (db, playlistId, { youtubeId, title = '', author = '', thumbnailUrl }, position) => {
    const t = now();
    const id = newId();
    db.run(
        `INSERT INTO videos (id, playlist_id, youtube_id, title, author, thumbnail_url, notes, watched,
                             position, created_at, updated_at, deleted, dirty)
         VALUES (?, ?, ?, ?, ?, ?, '', 0, ?, ?, ?, 0, 1)`,
        [
            id,
            playlistId,
            youtubeId,
            title.slice(0, 400),
            author.slice(0, 200),
            thumbnailUrl || (youtubeId ? thumbnailFor(youtubeId) : ''),
            position,
            t,
            t,
        ],
    );
    return getVideo(db, id);
};

/**
 * Appends videos to a playlist, skipping YouTube IDs already in it. Each entry
 * is a YouTube ID or an object with `youtubeId` and optional `title`, `author`
 * and `thumbnailUrl` (e.g. from a playlist import).
 * Returns { added, skipped } where skipped lists the duplicate YouTube IDs.
 */
export const addVideos = (db, playlistId, entries) => {
    return db.transaction(() => {
        const existing = new Set(
            db
                .all('SELECT youtube_id FROM videos WHERE playlist_id = ? AND deleted = 0', [playlistId])
                .map((r) => r.youtube_id),
        );
        let position = nextPosition(db, playlistId);
        const added = [];
        const skipped = [];
        for (const entry of entries) {
            const {
                youtubeId,
                title = '',
                author = '',
                thumbnailUrl,
            } = typeof entry === 'string' ? { youtubeId: entry } : entry;
            if (existing.has(youtubeId)) {
                skipped.push(youtubeId);
                continue;
            }
            existing.add(youtubeId);
            added.push(insertVideo(db, playlistId, { youtubeId, title, author, thumbnailUrl }, position++));
        }
        return { added, skipped };
    });
};

/**
 * Inserts `{ title, youtubeId, afterId }` entries into a playlist. Entries that
 * share an `afterId` go right after that video (at the start when it is null,
 * at the end when the video is gone), in their given order. An empty
 * `youtubeId` makes a placeholder. Returns the inserted videos.
 */
export const insertVideosAfter = (db, playlistId, entries) => {
    return db.transaction(() => {
        const rows = db.all(
            'SELECT id, youtube_id, position FROM videos WHERE playlist_id = ? AND deleted = 0 ORDER BY position',
            [playlistId],
        );
        const existing = new Set(rows.map((r) => r.youtube_id).filter(Boolean));
        const groups = new Map();
        for (const entry of entries) {
            if (entry.youtubeId && existing.has(entry.youtubeId)) continue;
            if (entry.youtubeId) existing.add(entry.youtubeId);
            const key = entry.afterId ?? null;
            groups.set(key, [...(groups.get(key) ?? []), entry]);
        }

        const added = [];
        for (const [afterId, group] of groups) {
            // Spread the group evenly between its anchor and the next video.
            const span = group.length + 1;
            const index = afterId === null ? -1 : rows.findIndex((r) => r.id === afterId);
            let low;
            let high;
            if (afterId === null) {
                high = rows[0]?.position ?? span;
                low = high - span;
            } else if (index === -1) {
                low = rows.at(-1)?.position ?? 0;
                high = low + span;
            } else {
                low = rows[index].position;
                high = rows[index + 1]?.position ?? low + span;
            }
            group.forEach((entry, i) => {
                const position = low + ((high - low) * (i + 1)) / span;
                added.push(
                    insertVideo(
                        db,
                        playlistId,
                        { youtubeId: entry.youtubeId ?? '', title: entry.title ?? '' },
                        position,
                    ),
                );
            });
        }
        return added;
    });
};

const COLUMNS = {
    youtubeId: 'youtube_id',
    title: 'title',
    author: 'author',
    thumbnailUrl: 'thumbnail_url',
    notes: 'notes',
    watched: 'watched',
    position: 'position',
    playlistId: 'playlist_id',
};

/** Updates the given fields and marks the row for sync. */
export const updateVideo = (db, id, patch) => {
    const sets = [];
    const params = [];
    for (const [key, column] of Object.entries(COLUMNS)) {
        if (patch[key] === undefined) continue;
        sets.push(`${column} = ?`);
        params.push(key === 'watched' ? (patch[key] ? 1 : 0) : patch[key]);
    }
    if (!sets.length) return getVideo(db, id);
    db.run(`UPDATE videos SET ${sets.join(', ')}, updated_at = ?, dirty = 1 WHERE id = ? AND deleted = 0`, [
        ...params,
        now(),
        id,
    ]);
    return getVideo(db, id);
};

/**
 * Moves a video to `toIndex` within its playlist by giving it a position
 * between its new neighbours, so only one row changes (and syncs).
 */
export const reorderVideo = (db, id, toIndex) => {
    const video = getVideo(db, id);
    if (!video) return null;
    const others = db
        .all('SELECT position FROM videos WHERE playlist_id = ? AND deleted = 0 AND id != ? ORDER BY position', [
            video.playlistId,
            id,
        ])
        .map((r) => r.position);
    const index = Math.max(0, Math.min(toIndex, others.length));
    const before = others[index - 1];
    const after = others[index];
    let position;
    if (before === undefined && after === undefined) position = 1;
    else if (before === undefined) position = after - 1;
    else if (after === undefined) position = before + 1;
    else position = (before + after) / 2;
    return updateVideo(db, id, { position });
};

export const moveVideoToPlaylist = (db, id, playlistId) => {
    const video = getVideo(db, id);
    if (!video || video.playlistId === playlistId) return { video, duplicate: false };
    const dup =
        video.youtubeId &&
        db.get('SELECT 1 AS x FROM videos WHERE playlist_id = ? AND youtube_id = ? AND deleted = 0', [
            playlistId,
            video.youtubeId,
        ]);
    if (dup) return { video, duplicate: true };
    return { video: updateVideo(db, id, { playlistId, position: nextPosition(db, playlistId) }), duplicate: false };
};

export const deleteVideo = (db, id) => {
    db.run('UPDATE videos SET deleted = 1, updated_at = ?, dirty = 1 WHERE id = ?', [now(), id]);
};

export const restoreVideo = (db, id) => {
    db.run('UPDATE videos SET deleted = 0, updated_at = ?, dirty = 1 WHERE id = ?', [now(), id]);
    return getVideo(db, id);
};
