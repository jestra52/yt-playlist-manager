import { and, asc, eq, max } from 'drizzle-orm';
import { now, newId } from '../../core/db/index.js';
import { playlists, videos } from '../../core/db/tables.js';

/** The playlist shape used by stores and views. */
const fields = {
    id: playlists.id,
    name: playlists.name,
    description: playlists.description,
    position: playlists.position,
    createdAt: playlists.createdAt,
    updatedAt: playlists.updatedAt,
};

const live = eq(playlists.deleted, false);

export const listPlaylists = (db) => {
    return db.orm
        .select(fields)
        .from(playlists)
        .where(live)
        .orderBy(asc(playlists.position), asc(playlists.createdAt))
        .all();
};

export const getPlaylist = (db, id) => {
    return (
        db.orm
            .select(fields)
            .from(playlists)
            .where(and(eq(playlists.id, id), live))
            .get() ?? null
    );
};

export const createPlaylist = (db, { name, description = '' }) => {
    const clean = name.trim();
    if (!clean) throw new Error('Give the playlist a name');
    const t = now();
    const { top } = db.orm
        .select({ top: max(playlists.position) })
        .from(playlists)
        .where(live)
        .get();
    const id = newId();
    db.write(
        db.orm.insert(playlists).values({
            id,
            name: clean.slice(0, 200),
            description: description.trim(),
            position: (top ?? 0) + 1,
            createdAt: t,
            updatedAt: t,
            deleted: false,
            dirty: true,
        }),
    );
    return getPlaylist(db, id);
};

export const updatePlaylist = (db, id, { name, description }) => {
    const current = getPlaylist(db, id);
    if (!current) throw new Error('That playlist no longer exists');
    const nextName = name === undefined ? current.name : name.trim().slice(0, 200);
    if (!nextName) throw new Error('Give the playlist a name');
    const nextDescription = description === undefined ? current.description : description.trim();
    db.write(
        db.orm
            .update(playlists)
            .set({ name: nextName, description: nextDescription, updatedAt: now(), dirty: true })
            .where(eq(playlists.id, id)),
    );
    return getPlaylist(db, id);
};

/** Soft-deletes the playlist and its videos so the deletion syncs. */
export const deletePlaylist = (db, id) => {
    db.transaction(() => {
        const t = now();
        db.write(
            db.orm.update(playlists).set({ deleted: true, updatedAt: t, dirty: true }).where(eq(playlists.id, id)),
        );
        db.write(
            db.orm
                .update(videos)
                .set({ deleted: true, updatedAt: t, dirty: true })
                .where(and(eq(videos.playlistId, id), eq(videos.deleted, false))),
        );
    });
};
