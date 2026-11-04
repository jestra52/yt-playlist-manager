import { and, asc, eq, max } from 'drizzle-orm';
import { now, newId } from '@ytpm/core/db/index';
import { playlists, videos } from '@ytpm/core/db/tables';

/** The playlist shape used by stores and views. */
const fields = {
    id: playlists.id,
    name: playlists.name,
    description: playlists.description,
    source: playlists.source,
    sourceId: playlists.sourceId,
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

/** `source` and `sourceId` say where an imported playlist came from, e.g. 'youtube' and its playlist ID. */
export const createPlaylist = (db, { name, description = '', source = '', sourceId = '' }) => {
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
            source,
            sourceId: source ? sourceId : '',
            position: (top ?? 0) + 1,
            createdAt: t,
            updatedAt: t,
            deleted: false,
            dirty: true,
        }),
    );
    return getPlaylist(db, id);
};

/** Changes the given fields; `source` and `sourceId` link the playlist to (or unlink it from) its source. */
export const updatePlaylist = (db, id, { name, description, source, sourceId }) => {
    const current = getPlaylist(db, id);
    if (!current) throw new Error('That playlist no longer exists');
    const nextName = name === undefined ? current.name : name.trim().slice(0, 200);
    if (!nextName) throw new Error('Give the playlist a name');
    const nextDescription = description === undefined ? current.description : description.trim();
    const nextSource = source === undefined ? current.source : source;
    const nextSourceId = nextSource ? (sourceId ?? current.sourceId) : '';
    db.write(
        db.orm
            .update(playlists)
            .set({
                name: nextName,
                description: nextDescription,
                source: nextSource,
                sourceId: nextSourceId,
                updatedAt: now(),
                dirty: true,
            })
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
