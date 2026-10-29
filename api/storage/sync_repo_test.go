package storage

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"ytplaylist/api/domain"
)

// Integration test against a real libSQL server. Start one with
//
//	turso dev --db-file /tmp/test.db
//
// and run: LIBSQL_TEST_URL=http://127.0.0.1:8080 go test ./api/storage/
func newTestRepo(t *testing.T) *SyncRepo {
	t.Helper()
	url := os.Getenv("LIBSQL_TEST_URL")
	if url == "" {
		t.Skip("LIBSQL_TEST_URL not set; skipping libSQL integration test")
	}
	client, err := NewClient(url, os.Getenv("LIBSQL_TEST_TOKEN"))
	if err != nil {
		t.Fatal(err)
	}
	return NewSyncRepo(client)
}

func TestSyncRepoLastWriteWinsAndPaging(t *testing.T) {
	ctx := context.Background()
	repo := newTestRepo(t)
	if err := repo.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	// Find the current head so the test works on a non-empty database.
	head := int64(0)
	for {
		_, cur, more, err := repo.Changes(ctx, head, 1000)
		if err != nil {
			t.Fatal(err)
		}
		head = cur
		if !more {
			break
		}
	}

	run := fmt.Sprintf("t%d", time.Now().UnixNano())
	pl := domain.Playlist{ID: run + "-p", Name: "Original", CreatedAt: 100, UpdatedAt: 100}
	v := domain.Video{ID: run + "-v", PlaylistID: pl.ID, YouTubeID: "dQw4w9WgXcQ", Title: "It's \"quoted\" ✓", CreatedAt: 100, UpdatedAt: 100, Position: 1.5}

	applied, err := repo.Apply(ctx, domain.ChangeSet{Playlists: []domain.Playlist{pl}, Videos: []domain.Video{v}})
	if err != nil || applied != 2 {
		t.Fatalf("first apply: %d, %v", applied, err)
	}

	stale := pl
	stale.Name = "Stale"
	stale.UpdatedAt = 50
	newer := v
	newer.Watched = true
	newer.UpdatedAt = 200
	applied, err = repo.Apply(ctx, domain.ChangeSet{Playlists: []domain.Playlist{stale}, Videos: []domain.Video{newer}})
	if err != nil || applied != 1 {
		t.Fatalf("second apply: %d, %v", applied, err)
	}

	cs, cursor, more, err := repo.Changes(ctx, head, 1000)
	if err != nil {
		t.Fatal(err)
	}
	if more || cursor <= head {
		t.Fatalf("cursor %d (head %d) more=%v", cursor, head, more)
	}
	if len(cs.Playlists) != 1 || cs.Playlists[0].Name != "Original" {
		t.Fatalf("stale write won: %+v", cs.Playlists)
	}
	if len(cs.Videos) != 1 || !cs.Videos[0].Watched || cs.Videos[0].Title != v.Title || cs.Videos[0].Position != 1.5 {
		t.Fatalf("newer write lost: %+v", cs.Videos)
	}
	// Video was updated after the playlist, so paging by 1 returns the playlist first.
	page, c1, more, err := repo.Changes(ctx, head, 1)
	if err != nil || !more || len(page.Playlists) != 1 || len(page.Videos) != 0 {
		t.Fatalf("page 1: %+v more=%v err=%v", page, more, err)
	}
	page, c2, _, err := repo.Changes(ctx, c1, 1)
	if err != nil || len(page.Videos) != 1 || c2 != cursor {
		t.Fatalf("page 2: %+v cursor=%d err=%v", page, c2, err)
	}

	// Nothing new after the cursor.
	cs, c3, _, err := repo.Changes(ctx, cursor, 1000)
	if err != nil || cs.Len() != 0 || c3 != cursor {
		t.Fatalf("expected no changes, got %+v cursor %d", cs, c3)
	}
}
