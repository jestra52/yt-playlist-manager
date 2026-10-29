/**
 * Local SQLite schema. Each entry upgrades the database by one version
 * (tracked with PRAGMA user_version), so add new migrations at the end.
 *
 * Synced tables carry:
 *   updated_at  last local or remote edit (ms), used for last-write-wins
 *   deleted     tombstone flag, so deletions sync too
 *   dirty       1 while the row has local changes not yet pushed
 */
export const migrations = [
  `
  CREATE TABLE meta (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE playlists (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    position    REAL NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    deleted     INTEGER NOT NULL DEFAULT 0,
    dirty       INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE videos (
    id            TEXT PRIMARY KEY,
    playlist_id   TEXT NOT NULL,
    youtube_id    TEXT NOT NULL,
    title         TEXT NOT NULL DEFAULT '',
    author        TEXT NOT NULL DEFAULT '',
    thumbnail_url TEXT NOT NULL DEFAULT '',
    notes         TEXT NOT NULL DEFAULT '',
    watched       INTEGER NOT NULL DEFAULT 0,
    position      REAL NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    deleted       INTEGER NOT NULL DEFAULT 0,
    dirty         INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX idx_videos_playlist ON videos (playlist_id, position);
  CREATE INDEX idx_playlists_dirty ON playlists (dirty);
  CREATE INDEX idx_videos_dirty ON videos (dirty);
  `,
];
