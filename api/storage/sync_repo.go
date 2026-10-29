package storage

import (
	"context"
	"sort"
	"strings"
	"sync"

	"ytplaylist/api/domain"
)

// schema is applied on cold start. Every row carries `seq`, a monotonically
// increasing server change number that clients use as their pull cursor.
var schema = []string{
	`CREATE TABLE IF NOT EXISTS sync_counter (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		value INTEGER NOT NULL
	)`,
	`INSERT OR IGNORE INTO sync_counter (id, value) VALUES (1, 0)`,
	`CREATE TABLE IF NOT EXISTS playlists (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		position REAL NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL,
		deleted INTEGER NOT NULL DEFAULT 0,
		seq INTEGER NOT NULL
	)`,
	`CREATE INDEX IF NOT EXISTS idx_playlists_seq ON playlists (seq)`,
	`CREATE TABLE IF NOT EXISTS videos (
		id TEXT PRIMARY KEY,
		playlist_id TEXT NOT NULL,
		youtube_id TEXT NOT NULL,
		title TEXT NOT NULL DEFAULT '',
		author TEXT NOT NULL DEFAULT '',
		thumbnail_url TEXT NOT NULL DEFAULT '',
		notes TEXT NOT NULL DEFAULT '',
		watched INTEGER NOT NULL DEFAULT 0,
		position REAL NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL,
		deleted INTEGER NOT NULL DEFAULT 0,
		seq INTEGER NOT NULL
	)`,
	`CREATE INDEX IF NOT EXISTS idx_videos_seq ON videos (seq)`,
}

const bumpCounter = `UPDATE sync_counter SET value = value + 1 WHERE id = 1`

// Last-write-wins upserts: an incoming row only replaces the stored one when
// its updated_at is strictly newer, so replays and stale clients are harmless.
const upsertPlaylist = `INSERT INTO playlists
	(id, name, description, position, created_at, updated_at, deleted, seq)
	VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT value FROM sync_counter WHERE id = 1))
	ON CONFLICT (id) DO UPDATE SET
		name = excluded.name,
		description = excluded.description,
		position = excluded.position,
		updated_at = excluded.updated_at,
		deleted = excluded.deleted,
		seq = excluded.seq
	WHERE excluded.updated_at > playlists.updated_at`

const upsertVideo = `INSERT INTO videos
	(id, playlist_id, youtube_id, title, author, thumbnail_url, notes, watched, position, created_at, updated_at, deleted, seq)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT value FROM sync_counter WHERE id = 1))
	ON CONFLICT (id) DO UPDATE SET
		playlist_id = excluded.playlist_id,
		youtube_id = excluded.youtube_id,
		title = excluded.title,
		author = excluded.author,
		thumbnail_url = excluded.thumbnail_url,
		notes = excluded.notes,
		watched = excluded.watched,
		position = excluded.position,
		updated_at = excluded.updated_at,
		deleted = excluded.deleted,
		seq = excluded.seq
	WHERE excluded.updated_at > videos.updated_at`

// SyncRepo stores sync data in a libSQL/Turso database.
type SyncRepo struct {
	db *Client

	migrateMu sync.Mutex
	migrated  bool
}

// NewSyncRepo wraps a database client.
func NewSyncRepo(db *Client) *SyncRepo { return &SyncRepo{db: db} }

// Migrate creates the schema once per process.
func (r *SyncRepo) Migrate(ctx context.Context) error {
	r.migrateMu.Lock()
	defer r.migrateMu.Unlock()
	if r.migrated {
		return nil
	}
	stmts := make([]Stmt, len(schema))
	for i, s := range schema {
		stmts[i] = Stmt{SQL: s}
	}
	if _, err := r.db.Transaction(ctx, stmts); err != nil {
		return err
	}
	r.migrated = true
	return nil
}

// withSchema runs fn, re-creating the schema and retrying once if the
// database was replaced (e.g. recreated in Turso) while this process was warm.
func (r *SyncRepo) withSchema(ctx context.Context, fn func() error) error {
	err := fn()
	if err == nil || !strings.Contains(err.Error(), "no such table") {
		return err
	}
	r.migrateMu.Lock()
	r.migrated = false
	r.migrateMu.Unlock()
	return fn()
}

// Apply writes the client's changes atomically and reports how many rows won
// the last-write-wins comparison.
func (r *SyncRepo) Apply(ctx context.Context, cs domain.ChangeSet) (int, error) {
	var applied int
	err := r.withSchema(ctx, func() (err error) {
		applied, err = r.apply(ctx, cs)
		return err
	})
	return applied, err
}

func (r *SyncRepo) apply(ctx context.Context, cs domain.ChangeSet) (int, error) {
	if cs.Len() == 0 {
		return 0, nil
	}
	if err := r.Migrate(ctx); err != nil {
		return 0, err
	}
	stmts := make([]Stmt, 0, cs.Len()*2)
	for _, p := range cs.Playlists {
		stmts = append(stmts, Stmt{SQL: bumpCounter}, Stmt{SQL: upsertPlaylist, Args: []Value{
			Text(p.ID), Text(p.Name), Text(p.Description), Float(p.Position),
			Int(p.CreatedAt), Int(p.UpdatedAt), Bool(p.Deleted),
		}})
	}
	for _, v := range cs.Videos {
		stmts = append(stmts, Stmt{SQL: bumpCounter}, Stmt{SQL: upsertVideo, Args: []Value{
			Text(v.ID), Text(v.PlaylistID), Text(v.YouTubeID), Text(v.Title), Text(v.Author),
			Text(v.ThumbnailURL), Text(v.Notes), Bool(v.Watched), Float(v.Position),
			Int(v.CreatedAt), Int(v.UpdatedAt), Bool(v.Deleted),
		}})
	}
	results, err := r.db.Transaction(ctx, stmts)
	if err != nil {
		return 0, err
	}
	applied := 0
	for i := 1; i < len(results); i += 2 {
		if results[i] != nil && results[i].AffectedRowCount > 0 {
			applied++
		}
	}
	return applied, nil
}

// Changes returns rows whose seq is greater than since, oldest first, at most
// limit rows across both tables. The returned cursor is the seq of the last
// row included (or since when there is nothing new).
func (r *SyncRepo) Changes(ctx context.Context, since int64, limit int) (domain.ChangeSet, int64, bool, error) {
	var (
		cs      domain.ChangeSet
		cursor  int64
		hasMore bool
	)
	err := r.withSchema(ctx, func() (err error) {
		cs, cursor, hasMore, err = r.changes(ctx, since, limit)
		return err
	})
	return cs, cursor, hasMore, err
}

func (r *SyncRepo) changes(ctx context.Context, since int64, limit int) (domain.ChangeSet, int64, bool, error) {
	cs := domain.ChangeSet{Playlists: []domain.Playlist{}, Videos: []domain.Video{}}
	if err := r.Migrate(ctx); err != nil {
		return cs, since, false, err
	}
	if limit <= 0 || limit > domain.MaxPullPageSize {
		limit = domain.MaxPullPageSize
	}
	plRes, err := r.db.Execute(ctx, Stmt{
		SQL:  `SELECT id, name, description, position, created_at, updated_at, deleted, seq FROM playlists WHERE seq > ? ORDER BY seq LIMIT ?`,
		Args: []Value{Int(since), Int(int64(limit))},
	})
	if err != nil {
		return cs, since, false, err
	}
	vRes, err := r.db.Execute(ctx, Stmt{
		SQL:  `SELECT id, playlist_id, youtube_id, title, author, thumbnail_url, notes, watched, position, created_at, updated_at, deleted, seq FROM videos WHERE seq > ? ORDER BY seq LIMIT ?`,
		Args: []Value{Int(since), Int(int64(limit))},
	})
	if err != nil {
		return cs, since, false, err
	}

	type item struct {
		seq      int64
		playlist *domain.Playlist
		video    *domain.Video
	}
	items := make([]item, 0, len(plRes.Rows)+len(vRes.Rows))
	for _, row := range plRes.Records() {
		p := domain.Playlist{
			ID:          row.Get("id").String(),
			Name:        row.Get("name").String(),
			Description: row.Get("description").String(),
			Position:    row.Get("position").Float64(),
			CreatedAt:   row.Get("created_at").Int64(),
			UpdatedAt:   row.Get("updated_at").Int64(),
			Deleted:     row.Get("deleted").Int64() != 0,
		}
		items = append(items, item{seq: row.Get("seq").Int64(), playlist: &p})
	}
	for _, row := range vRes.Records() {
		v := domain.Video{
			ID:           row.Get("id").String(),
			PlaylistID:   row.Get("playlist_id").String(),
			YouTubeID:    row.Get("youtube_id").String(),
			Title:        row.Get("title").String(),
			Author:       row.Get("author").String(),
			ThumbnailURL: row.Get("thumbnail_url").String(),
			Notes:        row.Get("notes").String(),
			Watched:      row.Get("watched").Int64() != 0,
			Position:     row.Get("position").Float64(),
			CreatedAt:    row.Get("created_at").Int64(),
			UpdatedAt:    row.Get("updated_at").Int64(),
			Deleted:      row.Get("deleted").Int64() != 0,
		}
		items = append(items, item{seq: row.Get("seq").Int64(), video: &v})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].seq < items[j].seq })

	hasMore := len(plRes.Rows) == limit || len(vRes.Rows) == limit
	if len(items) > limit {
		items = items[:limit]
		hasMore = true
	}
	cursor := since
	for _, it := range items {
		if it.playlist != nil {
			cs.Playlists = append(cs.Playlists, *it.playlist)
		} else {
			cs.Videos = append(cs.Videos, *it.video)
		}
		cursor = it.seq
	}
	return cs, cursor, hasMore, nil
}
