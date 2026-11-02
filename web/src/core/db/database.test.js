import { describe, it, expect, beforeAll } from 'vitest';
import initSqlJs from 'sql.js';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { Database } from './database.js';
import { migrations } from './schema.js';
import * as tables from './tables.js';
import * as playlists from '../../domains/playlists/playlists.repository.js';
import * as videos from '../../domains/videos/videos.repository.js';
import * as sync from '../../domains/sync/sync.repository.js';

let SQL;
beforeAll(async () => {
    SQL = await initSqlJs();
});

/** Rows of a read-only statement on a raw sql.js database, as objects. */
const rows = (sqlDb, statement) => {
    const [result] = sqlDb.exec(statement);
    return result
        ? result.values.map((values) => Object.fromEntries(result.columns.map((c, i) => [c, values[i]])))
        : [];
};

const userVersion = (sqlDb) => rows(sqlDb, 'PRAGMA user_version')[0].user_version;

/** The schema every database had before Drizzle (user_version 1). */
const HAND_WRITTEN_V1 = `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE playlists (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    position REAL NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0, dirty INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE videos (
    id TEXT PRIMARY KEY, playlist_id TEXT NOT NULL, youtube_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '', author TEXT NOT NULL DEFAULT '', thumbnail_url TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '', watched INTEGER NOT NULL DEFAULT 0, position REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0, dirty INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX idx_videos_playlist ON videos (playlist_id, position);
  CREATE INDEX idx_playlists_dirty ON playlists (dirty);
  CREATE INDEX idx_videos_dirty ON videos (dirty);
  PRAGMA user_version = 1;
`;

describe('schema and migrations', () => {
    it('creates every table, column and index defined in tables.js', () => {
        const sqlDb = new SQL.Database();
        new Database(sqlDb);
        expect(userVersion(sqlDb)).toBe(migrations.length);

        for (const table of Object.values(tables)) {
            const config = getTableConfig(table);
            const columns = rows(sqlDb, `PRAGMA table_info(${config.name})`);
            expect(columns.map((c) => c.name).sort(), config.name).toEqual(config.columns.map((c) => c.name).sort());
            for (const column of config.columns) {
                const actual = columns.find((c) => c.name === column.name);
                expect(actual.pk > 0, `${config.name}.${column.name} primary key`).toBe(column.primary);
                expect(actual.notnull === 1 || actual.pk > 0, `${config.name}.${column.name} not null`).toBe(
                    column.notNull,
                );
            }
            const indexes = rows(sqlDb, `PRAGMA index_list(${config.name})`).map((i) => i.name);
            for (const index of config.indexes) expect(indexes).toContain(index.config.name);
        }
    });

    it('keeps working on a database created by the hand-written schema', () => {
        const sqlDb = new SQL.Database();
        sqlDb.exec(HAND_WRITTEN_V1);
        sqlDb.exec(`
          INSERT INTO playlists (id, name, position, created_at, updated_at, deleted, dirty)
          VALUES ('p1', 'Old', 1, 1, 1, 0, 0);
          INSERT INTO videos (id, playlist_id, youtube_id, title, watched, position, created_at, updated_at, dirty)
          VALUES ('v1', 'p1', 'dQw4w9WgXcQ', 'Old video', 1, 1, 1, 1, 0);
        `);
        const db = new Database(sqlDb);
        // 0000_initial matches the hand-written schema, so only the later migrations run.
        expect(userVersion(sqlDb)).toBe(migrations.length);

        expect(playlists.listPlaylists(db).map((p) => p.name)).toEqual(['Old']);
        expect(videos.getVideo(db, 'v1')).toMatchObject({
            title: 'Old video',
            watched: true,
            missing: false,
            artist: '',
            artistSource: '',
        });
        expect(sync.countPending(db)).toBe(0);

        videos.addVideos(db, 'p1', ['9bZkp7q19f0']);
        videos.updateVideo(db, 'v1', { watched: false });
        expect(sync.collectChanges(db).videos.map((v) => [v.youtubeId, v.watched, v.deleted])).toEqual([
            ['9bZkp7q19f0', false, false],
            ['dQw4w9WgXcQ', false, false],
        ]);
    });
});

describe('values are never part of the SQL text', () => {
    const attack = "x'); DROP TABLE videos;--";

    it('stores quotes and SQL in titles, names, notes and settings as plain text', () => {
        const sqlDb = new SQL.Database();
        const db = new Database(sqlDb);
        const p = playlists.createPlaylist(db, { name: attack, description: attack });
        const [v] = videos.addVideos(db, p.id, [{ youtubeId: 'dQw4w9WgXcQ', title: attack, author: attack }]).added;
        videos.updateVideo(db, v.id, { notes: attack, artist: attack });
        videos.insertVideosAfter(db, p.id, [{ title: attack, youtubeId: '', afterId: v.id }]);
        sync.saveSettings(db, { apiUrl: attack, token: attack, autoSync: true });

        expect(playlists.getPlaylist(db, p.id)).toMatchObject({ name: attack, description: attack });
        expect(videos.getVideo(db, v.id)).toMatchObject({
            title: attack,
            author: attack,
            notes: attack,
            artist: attack,
        });
        expect(videos.listVideos(db).map((video) => video.title)).toEqual([attack, attack]);
        expect(sync.getSettings(db)).toMatchObject({ apiUrl: attack, token: attack });
        expect(
            rows(sqlDb, "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").map((t) => t.name),
        ).toEqual(['meta', 'playlists', 'videos']);
    });

    it('treats an ID made of SQL as an ID that matches nothing', () => {
        const db = new Database(new SQL.Database());
        const p = playlists.createPlaylist(db, { name: 'Keep' });
        videos.addVideos(db, p.id, ['dQw4w9WgXcQ']);
        const sneaky = "' OR '1'='1";

        expect(playlists.getPlaylist(db, sneaky)).toBeNull();
        expect(videos.getVideo(db, sneaky)).toBeNull();
        playlists.deletePlaylist(db, sneaky);
        videos.deleteVideo(db, sneaky);
        expect(playlists.listPlaylists(db)).toHaveLength(1);
        expect(videos.listVideos(db)).toHaveLength(1);
    });

    it('applies remote rows with SQL in their values as plain text', () => {
        const db = new Database(new SQL.Database());
        const changes = {
            playlists: [{ id: attack, name: attack, description: '', position: 1, createdAt: 1, updatedAt: 2 }],
            videos: [
                { id: 'v1', playlistId: attack, youtubeId: 'dQw4w9WgXcQ', title: attack, createdAt: 1, updatedAt: 2 },
            ],
        };
        expect(sync.applyRemote(db, changes)).toBe(2);
        expect(playlists.getPlaylist(db, attack)).toMatchObject({ name: attack });
        expect(videos.getVideo(db, 'v1')).toMatchObject({ playlistId: attack, title: attack });
    });
});
