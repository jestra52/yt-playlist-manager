package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"ytplaylist/api/domain"
	"ytplaylist/api/youtube"
)

type fakeStore struct {
	applied []domain.ChangeSet
	since   int64
	err     error
}

func (f *fakeStore) Apply(_ context.Context, cs domain.ChangeSet) (int, error) {
	f.applied = append(f.applied, cs)
	return cs.Len(), f.err
}

func (f *fakeStore) Changes(_ context.Context, since int64, _ int) (domain.ChangeSet, int64, bool, error) {
	f.since = since
	return domain.ChangeSet{Playlists: []domain.Playlist{{ID: "p1", Name: "Remote", CreatedAt: 1, UpdatedAt: 2}}}, 42, false, nil
}

type fakeMeta struct{}

func (fakeMeta) Fetch(_ context.Context, id string) (youtube.Meta, error) {
	if !domain.IsValidYouTubeID(id) {
		return youtube.Meta{}, domain.ErrValidation
	}
	if id == "aaaaaaaaaaa" {
		return youtube.Meta{}, youtube.ErrNotFound
	}
	return youtube.Meta{YouTubeID: id, Title: "Title " + id}, nil
}

func newTestHandler(store SyncStore) http.Handler {
	return New(Config{Store: store, Metadata: fakeMeta{}, SyncToken: "secret", Logger: log.New(io.Discard, "", 0)})
}

func do(t *testing.T, h http.Handler, method, path, body, token string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestRoutePathStripsPrefixes(t *testing.T) {
	cases := map[string]string{
		"/api/sync":                      "/sync",
		"/.netlify/functions/api/sync":   "/sync",
		"/.netlify/functions/api":        "/",
		"/sync/":                         "/sync",
		"/api":                           "/",
		"/health":                        "/health",
		"/.netlify/functions/api/oembed": "/oembed",
	}
	for in, want := range cases {
		if got := routePath(in); got != want {
			t.Errorf("routePath(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestSyncRequiresToken(t *testing.T) {
	h := newTestHandler(&fakeStore{})
	if rec := do(t, h, http.MethodPost, "/api/sync", `{}`, ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("no token: got %d", rec.Code)
	}
	if rec := do(t, h, http.MethodPost, "/api/sync", `{}`, "wrong"); rec.Code != http.StatusUnauthorized {
		t.Fatalf("wrong token: got %d", rec.Code)
	}
}

func TestSyncNotConfigured(t *testing.T) {
	h := New(Config{Logger: log.New(io.Discard, "", 0)})
	if rec := do(t, h, http.MethodPost, "/api/sync", `{}`, "x"); rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("got %d", rec.Code)
	}
}

func TestSyncAppliesAndReturnsChanges(t *testing.T) {
	store := &fakeStore{}
	h := newTestHandler(store)
	body := `{"since":7,"changes":{"playlists":[{"id":"p2","name":"Mine","createdAt":1,"updatedAt":5}],
		"videos":[{"id":"v1","playlistId":"p2","youtubeId":"dQw4w9WgXcQ","createdAt":1,"updatedAt":5}]}}`
	rec := do(t, h, http.MethodPost, "/.netlify/functions/api/sync", body, "secret")
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d: %s", rec.Code, rec.Body)
	}
	var resp domain.SyncResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.Cursor != 42 || resp.Applied != 2 || len(resp.Changes.Playlists) != 1 {
		t.Fatalf("unexpected response %+v", resp)
	}
	if store.since != 7 || len(store.applied) != 1 || store.applied[0].Videos[0].YouTubeID != "dQw4w9WgXcQ" {
		t.Fatalf("store not called as expected: %+v", store)
	}
}

func TestSyncRejectsInvalidRows(t *testing.T) {
	h := newTestHandler(&fakeStore{})
	body := `{"since":0,"changes":{"videos":[{"id":"v1","playlistId":"p","youtubeId":"nope","createdAt":1,"updatedAt":1}]}}`
	if rec := do(t, h, http.MethodPost, "/api/sync", body, "secret"); rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d", rec.Code)
	}
}

func TestSyncStoreFailure(t *testing.T) {
	h := newTestHandler(&fakeStore{err: errors.New("boom")})
	body := `{"since":0,"changes":{"playlists":[{"id":"p","name":"x","createdAt":1,"updatedAt":1}]}}`
	if rec := do(t, h, http.MethodPost, "/api/sync", body, "secret"); rec.Code != http.StatusBadGateway {
		t.Fatalf("got %d", rec.Code)
	}
}

func TestOEmbed(t *testing.T) {
	h := newTestHandler(nil)
	rec := do(t, h, http.MethodGet, "/api/oembed?id=dQw4w9WgXcQ", "", "")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "Title dQw4w9WgXcQ") {
		t.Fatalf("got %d %s", rec.Code, rec.Body)
	}
	if rec := do(t, h, http.MethodGet, "/api/oembed?id=bad", "", ""); rec.Code != http.StatusBadRequest {
		t.Fatalf("invalid id: got %d", rec.Code)
	}
	if rec := do(t, h, http.MethodGet, "/api/oembed?id=aaaaaaaaaaa", "", ""); rec.Code != http.StatusNotFound {
		t.Fatalf("missing video: got %d", rec.Code)
	}
}

func TestCORSPreflight(t *testing.T) {
	h := newTestHandler(nil)
	rec := do(t, h, http.MethodOptions, "/api/sync", "", "")
	if rec.Code != http.StatusNoContent || rec.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Fatalf("got %d %v", rec.Code, rec.Header())
	}
}

type fakePlaylists struct{}

func (fakePlaylists) FetchPlaylist(_ context.Context, id string) (youtube.Playlist, error) {
	switch id {
	case "PLprivateprivate":
		return youtube.Playlist{}, youtube.ErrPlaylistNotFound
	case "PLbrokenbroken":
		return youtube.Playlist{}, errors.New("upstream down")
	case "bad":
		return youtube.Playlist{}, domain.ErrValidation
	}
	return youtube.Playlist{ID: id, Title: "Road trip", Videos: []youtube.Meta{{YouTubeID: "dQw4w9WgXcQ"}}, Source: "feed"}, nil
}

func TestPlaylistEndpoint(t *testing.T) {
	h := New(Config{Playlists: fakePlaylists{}, Logger: log.New(io.Discard, "", 0)})
	cases := map[string]int{
		"/api/playlist?id=PLabcdefghijklmnop": http.StatusOK,
		"/api/playlist?id=PLprivateprivate":   http.StatusNotFound,
		"/api/playlist?id=PLbrokenbroken":     http.StatusBadGateway,
		"/api/playlist?id=bad":                http.StatusBadRequest,
	}
	for path, want := range cases {
		if rec := do(t, h, http.MethodGet, path, "", ""); rec.Code != want {
			t.Errorf("%s: got %d, want %d (%s)", path, rec.Code, want, rec.Body)
		}
	}
	rec := do(t, h, http.MethodGet, "/.netlify/functions/api/playlist?id=PLabcdefghijklmnop", "", "")
	if !strings.Contains(rec.Body.String(), `"title":"Road trip"`) {
		t.Fatalf("unexpected body %s", rec.Body)
	}
	if rec := do(t, New(Config{Logger: log.New(io.Discard, "", 0)}), http.MethodGet, "/api/playlist?id=x", "", ""); rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("disabled: got %d", rec.Code)
	}
}
