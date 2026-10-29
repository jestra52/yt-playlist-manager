import { now, newId } from '../../core/db/index.js';
import { thumbnailFor } from './youtube.js';

export function toVideo(row) {
    return {
        id: row.id,
        playlistId: row.playlist_id,
        youtubeId: row.youtube_id,
        title: row.title,
        author: row.author,
        thumbnailUrl: row.thumbnail_url || thumbnailFor(row.youtube_id),
        notes: row.notes,
        watched: row.watched === 1,
        position: row.position,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export function listVideos(db) {
    return db.all('SELECT * FROM videos WHERE deleted = 0 ORDER BY playlist_id, position').map(toVideo);
}

export function getVideo(db, id) {
    const row = db.get('SELECT * FROM videos WHERE id = ? AND deleted = 0', [id]);
    return row ? toVideo(row) : null;
}

function nextPosition(db, playlistId) {
    return db.get('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM videos WHERE playlist_id = ? AND deleted = 0', [
        playlistId,
    ]).next;
}

/**
 * Appends videos to a playlist, skipping YouTube IDs already in it. Each entry
 * is a YouTube ID or an object with `youtubeId` and optional `title`, `author`
 * and `thumbnailUrl` (e.g. from a playlist import).
 * Returns { added, skipped } where skipped lists the duplicate YouTube IDs.
 */
export function addVideos(db, playlistId, entries) {
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
                    thumbnailUrl || thumbnailFor(youtubeId),
                    position++,
                    t,
                    t,
                ],
            );
            existing.add(youtubeId);
            added.push(getVideo(db, id));
        }
        return { added, skipped };
    });
}

const COLUMNS = {
    title: 'title',
    author: 'author',
    thumbnailUrl: 'thumbnail_url',
    notes: 'notes',
    watched: 'watched',
    position: 'position',
    playlistId: 'playlist_id',
};

/** Updates the given fields and marks the row for sync. */
export function updateVideo(db, id, patch) {
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
}

/**
 * Moves a video to `toIndex` within its playlist by giving it a position
 * between its new neighbours, so only one row changes (and syncs).
 */
export function reorderVideo(db, id, toIndex) {
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
}

export function moveVideoToPlaylist(db, id, playlistId) {
    const video = getVideo(db, id);
    if (!video || video.playlistId === playlistId) return { video, duplicate: false };
    const dup = db.get('SELECT 1 AS x FROM videos WHERE playlist_id = ? AND youtube_id = ? AND deleted = 0', [
        playlistId,
        video.youtubeId,
    ]);
    if (dup) return { video, duplicate: true };
    return { video: updateVideo(db, id, { playlistId, position: nextPosition(db, playlistId) }), duplicate: false };
}

export function deleteVideo(db, id) {
    db.run('UPDATE videos SET deleted = 1, updated_at = ?, dirty = 1 WHERE id = ?', [now(), id]);
}

export function restoreVideo(db, id) {
    db.run('UPDATE videos SET deleted = 0, updated_at = ?, dirty = 1 WHERE id = ?', [now(), id]);
    return getVideo(db, id);
}
