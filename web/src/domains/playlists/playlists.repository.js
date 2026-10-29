import { now, newId } from '../../core/db/index.js';

/** Maps a SQLite row to the playlist shape used by stores and views. */
export function toPlaylist(row) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        position: row.position,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export function listPlaylists(db) {
    return db.all('SELECT * FROM playlists WHERE deleted = 0 ORDER BY position, created_at').map(toPlaylist);
}

export function getPlaylist(db, id) {
    const row = db.get('SELECT * FROM playlists WHERE id = ? AND deleted = 0', [id]);
    return row ? toPlaylist(row) : null;
}

export function createPlaylist(db, { name, description = '' }) {
    const clean = name.trim();
    if (!clean) throw new Error('Give the playlist a name');
    const t = now();
    const { next } = db.get('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM playlists WHERE deleted = 0');
    const id = newId();
    db.run(
        `INSERT INTO playlists (id, name, description, position, created_at, updated_at, deleted, dirty)
     VALUES (?, ?, ?, ?, ?, ?, 0, 1)`,
        [id, clean.slice(0, 200), description.trim(), next, t, t],
    );
    return getPlaylist(db, id);
}

export function updatePlaylist(db, id, { name, description }) {
    const current = getPlaylist(db, id);
    if (!current) throw new Error('That playlist no longer exists');
    const nextName = name === undefined ? current.name : name.trim().slice(0, 200);
    if (!nextName) throw new Error('Give the playlist a name');
    const nextDescription = description === undefined ? current.description : description.trim();
    db.run('UPDATE playlists SET name = ?, description = ?, updated_at = ?, dirty = 1 WHERE id = ?', [
        nextName,
        nextDescription,
        now(),
        id,
    ]);
    return getPlaylist(db, id);
}

/** Soft-deletes the playlist and its videos so the deletion syncs. */
export function deletePlaylist(db, id) {
    db.transaction(() => {
        const t = now();
        db.run('UPDATE playlists SET deleted = 1, updated_at = ?, dirty = 1 WHERE id = ?', [t, id]);
        db.run('UPDATE videos SET deleted = 1, updated_at = ?, dirty = 1 WHERE playlist_id = ? AND deleted = 0', [
            t,
            id,
        ]);
    });
}
