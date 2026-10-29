package youtube

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"ytplaylist/api/domain"
)

const listID = "PLabcdefghijklmnop1234"

func TestFetchPlaylistFromAPI(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("key") != "k" {
			t.Errorf("missing api key")
		}
		switch r.URL.Path {
		case "/playlists":
			if r.URL.Query().Get("id") != listID {
				_, _ = w.Write([]byte(`{"items":[]}`))
				return
			}
			_, _ = w.Write([]byte(`{"items":[{"snippet":{"title":"Road trip","channelTitle":"Juan"}}]}`))
		case "/playlistItems":
			if r.URL.Query().Get("pageToken") == "" {
				_, _ = w.Write([]byte(`{"nextPageToken":"p2","items":[
					{"snippet":{"title":"One","videoOwnerChannelTitle":"A","resourceId":{"videoId":"dQw4w9WgXcQ"},
					  "thumbnails":{"medium":{"url":"https://i.ytimg.com/vi/dQw4w9WgXcQ/mq.jpg"}}}},
					{"snippet":{"title":"Deleted video","resourceId":{"videoId":"aaaaaaaaaaa"}}}]}`))
				return
			}
			_, _ = w.Write([]byte(`{"items":[
				{"snippet":{"title":"Two","videoOwnerChannelTitle":"B","resourceId":{"videoId":"9bZkp7q19f0"}}}]}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	f := &PlaylistFetcher{APIKey: "k", APIBase: srv.URL, HTTP: srv.Client(), MaxVideos: 10}

	pl, err := f.FetchPlaylist(context.Background(), listID)
	if err != nil {
		t.Fatal(err)
	}
	if pl.Title != "Road trip" || pl.Author != "Juan" || pl.Source != "api" || pl.Partial {
		t.Fatalf("unexpected playlist %+v", pl)
	}
	if len(pl.Videos) != 2 || pl.Videos[0].YouTubeID != "dQw4w9WgXcQ" || pl.Videos[1].Author != "B" || pl.Skipped != 1 {
		t.Fatalf("unexpected videos %+v (skipped %d)", pl.Videos, pl.Skipped)
	}
	if pl.Videos[1].ThumbnailURL != "https://i.ytimg.com/vi/9bZkp7q19f0/mqdefault.jpg" {
		t.Fatalf("thumbnail fallback not applied: %s", pl.Videos[1].ThumbnailURL)
	}

	f.MaxVideos = 1
	pl, err = f.FetchPlaylist(context.Background(), listID)
	if err != nil || len(pl.Videos) != 1 || !pl.Partial {
		t.Fatalf("limit not applied: %+v %v", pl, err)
	}

	if _, err := f.FetchPlaylist(context.Background(), "PLzzzzzzzzzzzzzzzzzz"); !errors.Is(err, ErrPlaylistNotFound) {
		t.Fatalf("want ErrPlaylistNotFound, got %v", err)
	}
}

func TestFetchPlaylistAPIErrors(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("id") == "PLprivateprivate" {
			w.WriteHeader(http.StatusForbidden)
			_, _ = w.Write([]byte(`{"error":{"code":403,"errors":[{"reason":"playlistItemsNotAccessible"}]}}`))
			return
		}
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"error":{"code":403,"errors":[{"reason":"quotaExceeded"}],"message":"quota"}}`))
	}))
	defer srv.Close()
	f := &PlaylistFetcher{APIKey: "k", APIBase: srv.URL, HTTP: srv.Client()}

	if _, err := f.FetchPlaylist(context.Background(), "PLprivateprivate"); !errors.Is(err, ErrPlaylistNotFound) {
		t.Fatalf("private: got %v", err)
	}
	_, err := f.FetchPlaylist(context.Background(), listID)
	if err == nil || errors.Is(err, ErrPlaylistNotFound) {
		t.Fatalf("quota: got %v", err)
	}
}

func TestFetchPlaylistFromFeed(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("playlist_id") != listID {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/atom+xml")
		_, _ = fmt.Fprint(w, `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
  <title>Road trip</title>
  <author><name>Juan</name></author>
  <entry><yt:videoId>dQw4w9WgXcQ</yt:videoId><title>One &amp; only</title><author><name>A</name></author></entry>
  <entry><yt:videoId>9bZkp7q19f0</yt:videoId><title>Two</title><author><name>B</name></author></entry>
</feed>`)
	}))
	defer srv.Close()
	f := &PlaylistFetcher{FeedBase: srv.URL, HTTP: srv.Client()}

	pl, err := f.FetchPlaylist(context.Background(), listID)
	if err != nil {
		t.Fatal(err)
	}
	if pl.Title != "Road trip" || pl.Source != "feed" || pl.Partial || len(pl.Videos) != 2 || pl.Videos[0].Title != "One & only" {
		t.Fatalf("unexpected playlist %+v", pl)
	}
	if _, err := f.FetchPlaylist(context.Background(), "PLzzzzzzzzzzzzzzzzzz"); !errors.Is(err, ErrPlaylistNotFound) {
		t.Fatalf("want ErrPlaylistNotFound, got %v", err)
	}
}

func TestFetchPlaylistRejectsBadIDs(t *testing.T) {
	f := NewPlaylistFetcher("")
	for _, id := range []string{"", "WL", "LL", "../../etc/passwd", "PL with spaces"} {
		if _, err := f.FetchPlaylist(context.Background(), id); !errors.Is(err, domain.ErrValidation) {
			t.Errorf("%q: want validation error, got %v", id, err)
		}
	}
	if _, err := f.FetchPlaylist(context.Background(), "RDdQw4w9WgXcQ"); !errors.Is(err, ErrPlaylistUnsupported) {
		t.Errorf("mix: want ErrPlaylistUnsupported, got %v", err)
	}
}
