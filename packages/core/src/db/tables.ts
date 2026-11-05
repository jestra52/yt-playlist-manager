import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * The local SQLite tables, defined once for Drizzle ORM. Queries are built from
 * these definitions, and `npm run db:generate` turns changes to them into a new
 * migration in `migrations/`.
 *
 * Synced tables carry:
 *   updatedAt  last local or remote edit (ms), used for last-write-wins
 *   deleted    tombstone flag, so deletions sync too
 *   dirty      true while the row has local changes not yet pushed
 */

/** Key/value settings and sync bookkeeping. */
export const meta = sqliteTable('meta', {
    key: text('key').primaryKey(),
    value: text('value'),
});

export const playlists = sqliteTable(
    'playlists',
    {
        id: text('id').primaryKey(),
        name: text('name').notNull(),
        description: text('description').notNull().default(''),
        // Where it was imported from: '' (made here) or 'youtube' (later 'spotify'),
        // and its ID there, so it can be synced with it again.
        source: text('source').notNull().default(''),
        sourceId: text('source_id').notNull().default(''),
        position: real('position').notNull().default(0),
        createdAt: integer('created_at').notNull(),
        updatedAt: integer('updated_at').notNull(),
        deleted: integer('deleted', { mode: 'boolean' }).notNull().default(false),
        dirty: integer('dirty', { mode: 'boolean' }).notNull().default(true),
    },
    (t) => [index('idx_playlists_dirty').on(t.dirty)],
);

export const videos = sqliteTable(
    'videos',
    {
        id: text('id').primaryKey(),
        playlistId: text('playlist_id').notNull(),
        // Empty for a placeholder from an old report, until its link is pasted.
        youtubeId: text('youtube_id').notNull(),
        title: text('title').notNull().default(''),
        // The YouTube channel that uploaded the video, which is often not the artist.
        author: text('author').notNull().default(''),
        // Empty when unknown. artistSource says where it came from (see videos/artist.ts),
        // so a better source can replace a guess but never a hand edit.
        artist: text('artist').notNull().default(''),
        artistSource: text('artist_source').notNull().default(''),
        thumbnailUrl: text('thumbnail_url').notNull().default(''),
        notes: text('notes').notNull().default(''),
        watched: integer('watched', { mode: 'boolean' }).notNull().default(false),
        // Deleted or made private on YouTube. The row keeps its YouTube ID, so syncing
        // with the playlist again recognizes it, and waits for another link like a placeholder.
        unavailable: integer('unavailable', { mode: 'boolean' }).notNull().default(false),
        position: real('position').notNull().default(0),
        createdAt: integer('created_at').notNull(),
        updatedAt: integer('updated_at').notNull(),
        deleted: integer('deleted', { mode: 'boolean' }).notNull().default(false),
        dirty: integer('dirty', { mode: 'boolean' }).notNull().default(true),
    },
    (t) => [index('idx_videos_playlist').on(t.playlistId, t.position), index('idx_videos_dirty').on(t.dirty)],
);

export type MetaRow = typeof meta.$inferSelect;
export type PlaylistRow = typeof playlists.$inferSelect;
export type NewPlaylistRow = typeof playlists.$inferInsert;
export type VideoRow = typeof videos.$inferSelect;
export type NewVideoRow = typeof videos.$inferInsert;
