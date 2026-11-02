import { and, asc, eq, max, ne } from 'drizzle-orm';
import { now, newId } from '../../core/db/index.js';
import { videos } from '../../core/db/tables.js';
import { thumbnailFor } from './youtube.js';

const fields = {
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
};

/** Adds what views need on top of the stored row. */
const toVideo = (row) => {
    return {
        ...row,
        // Waits for a link: a placeholder from an old report (known by its title), or a
        // video deleted or made private on YouTube (it keeps its old ID).
        missing: row.youtubeId === '' || row.unavailable,
        thumbnailUrl: row.thumbnailUrl || (row.youtubeId ? thumbnailFor(row.youtubeId) : ''),
    };
};

const live = eq(videos.deleted, false);

export const listVideos = (db) => {
    return db.orm
        .select(fields)
        .from(videos)
        .where(live)
        .orderBy(asc(videos.playlistId), asc(videos.position))
        .all()
        .map(toVideo);
};

export const getVideo = (db, id) => {
    const row = db.orm
        .select(fields)
        .from(videos)
        .where(and(eq(videos.id, id), live))
        .get();
    return row ? toVideo(row) : null;
};

const nextPosition = (db, playlistId) => {
    const { top } = db.orm
        .select({ top: max(videos.position) })
        .from(videos)
        .where(and(eq(videos.playlistId, playlistId), live))
        .get();
    return (top ?? 0) + 1;
};

const insertVideo = (
    db,
    playlistId,
    { youtubeId, title = '', author = '', artist = '', artistSource = '', thumbnailUrl, unavailable = false },
    position,
) => {
    const t = now();
    const id = newId();
    db.write(
        db.orm.insert(videos).values({
            id,
            playlistId,
            youtubeId,
            title: title.slice(0, 400),
            author: author.slice(0, 200),
            artist: artist.slice(0, 200),
            artistSource: artist ? artistSource : '',
            thumbnailUrl: thumbnailUrl || (youtubeId ? thumbnailFor(youtubeId) : ''),
            notes: '',
            watched: false,
            unavailable: Boolean(unavailable && youtubeId),
            position,
            createdAt: t,
            updatedAt: t,
            deleted: false,
            dirty: true,
        }),
    );
    return getVideo(db, id);
};

/** The videos still in a playlist, in order. */
const playlistRows = (db, playlistId) => {
    return db.orm
        .select({ id: videos.id, youtubeId: videos.youtubeId, position: videos.position })
        .from(videos)
        .where(and(eq(videos.playlistId, playlistId), live))
        .orderBy(asc(videos.position))
        .all();
};

/**
 * Appends videos to a playlist, skipping YouTube IDs already in it. Each entry
 * is a YouTube ID or an object with `youtubeId` and optional `title`, `author`,
 * `artist`, `artistSource`, `thumbnailUrl` and `unavailable` (e.g. from a playlist import).
 * Returns { added, skipped } where skipped lists the duplicate YouTube IDs.
 */
export const addVideos = (db, playlistId, entries) => {
    return db.transaction(() => {
        const existing = new Set(playlistRows(db, playlistId).map((r) => r.youtubeId));
        let position = nextPosition(db, playlistId);
        const added = [];
        const skipped = [];
        for (const entry of entries) {
            const fields = typeof entry === 'string' ? { youtubeId: entry } : entry;
            if (existing.has(fields.youtubeId)) {
                skipped.push(fields.youtubeId);
                continue;
            }
            existing.add(fields.youtubeId);
            added.push(insertVideo(db, playlistId, fields, position++));
        }
        return { added, skipped };
    });
};

/**
 * Inserts `{ title, youtubeId, afterId }` entries (optionally with `author`,
 * `artist`, `artistSource`, `thumbnailUrl` and `unavailable`) into a playlist.
 * Entries that share an `afterId` go right after that video (at the start when
 * it is null, at the end when the video is gone), in their given order. An
 * empty `youtubeId` makes a placeholder. Returns the inserted videos.
 */
export const insertVideosAfter = (db, playlistId, entries) => {
    return db.transaction(() => {
        const rows = playlistRows(db, playlistId);
        const existing = new Set(rows.map((r) => r.youtubeId).filter(Boolean));
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
                        {
                            youtubeId: entry.youtubeId ?? '',
                            title: entry.title ?? '',
                            author: entry.author ?? '',
                            artist: entry.artist ?? '',
                            artistSource: entry.artistSource ?? '',
                            thumbnailUrl: entry.thumbnailUrl,
                            unavailable: entry.unavailable ?? false,
                        },
                        position,
                    ),
                );
            });
        }
        return added;
    });
};

/** Fields a caller may change with updateVideo. */
const EDITABLE = [
    'youtubeId',
    'title',
    'author',
    'artist',
    'artistSource',
    'thumbnailUrl',
    'notes',
    'watched',
    'unavailable',
    'position',
    'playlistId',
];

const FLAGS = new Set(['watched', 'unavailable']);

/** Updates the given fields and marks the row for sync. */
export const updateVideo = (db, id, patch) => {
    const changes = {};
    for (const key of EDITABLE) {
        if (patch[key] !== undefined) changes[key] = FLAGS.has(key) ? Boolean(patch[key]) : patch[key];
    }
    if (!Object.keys(changes).length) return getVideo(db, id);
    db.write(
        db.orm
            .update(videos)
            .set({ ...changes, updatedAt: now(), dirty: true })
            .where(and(eq(videos.id, id), live)),
    );
    return getVideo(db, id);
};

/**
 * Moves a video to `toIndex` within its playlist by giving it a position
 * between its new neighbours, so only one row changes (and syncs).
 */
export const reorderVideo = (db, id, toIndex) => {
    const video = getVideo(db, id);
    if (!video) return null;
    const others = db.orm
        .select({ position: videos.position })
        .from(videos)
        .where(and(eq(videos.playlistId, video.playlistId), live, ne(videos.id, id)))
        .orderBy(asc(videos.position))
        .all()
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
        db.orm
            .select({ id: videos.id })
            .from(videos)
            .where(and(eq(videos.playlistId, playlistId), eq(videos.youtubeId, video.youtubeId), live))
            .get();
    if (dup) return { video, duplicate: true };
    return { video: updateVideo(db, id, { playlistId, position: nextPosition(db, playlistId) }), duplicate: false };
};

export const deleteVideo = (db, id) => {
    db.write(db.orm.update(videos).set({ deleted: true, updatedAt: now(), dirty: true }).where(eq(videos.id, id)));
};

export const restoreVideo = (db, id) => {
    db.write(db.orm.update(videos).set({ deleted: false, updatedAt: now(), dirty: true }).where(eq(videos.id, id)));
    return getVideo(db, id);
};
