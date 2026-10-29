package youtube

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFetch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("url") == "https://www.youtube.com/watch?v=aaaaaaaaaaa" {
			http.Error(w, "Not Found", http.StatusNotFound)
			return
		}
		_, _ = w.Write([]byte(`{"title":"Never Gonna","author_name":"Rick","thumbnail_url":"https://i.ytimg.com/x.jpg"}`))
	}))
	defer srv.Close()
	o := &OEmbed{Endpoint: srv.URL, HTTP: srv.Client()}

	meta, err := o.Fetch(context.Background(), "dQw4w9WgXcQ")
	if err != nil || meta.Title != "Never Gonna" || meta.Author != "Rick" {
		t.Fatalf("got %+v, %v", meta, err)
	}
	if _, err := o.Fetch(context.Background(), "aaaaaaaaaaa"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
	if _, err := o.Fetch(context.Background(), "../../etc"); err == nil {
		t.Fatal("expected validation error")
	}
}
