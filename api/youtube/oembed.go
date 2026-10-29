// Package youtube fetches public video metadata through YouTube's oEmbed
// endpoint, which needs no API key. The browser can't call it directly
// (no CORS headers), so the API proxies it.
package youtube

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"ytplaylist/api/domain"
)

// Meta is the subset of oEmbed data the app uses.
type Meta struct {
	YouTubeID    string `json:"youtubeId"`
	Title        string `json:"title"`
	Author       string `json:"author"`
	ThumbnailURL string `json:"thumbnailUrl"`
}

// ErrNotFound is returned for private, deleted or unknown videos.
var ErrNotFound = errors.New("video not found or not embeddable")

// OEmbed fetches video metadata.
type OEmbed struct {
	Endpoint string
	HTTP     *http.Client
}

// NewOEmbed returns a client for the public YouTube oEmbed endpoint.
func NewOEmbed() *OEmbed {
	return &OEmbed{
		Endpoint: "https://www.youtube.com/oembed",
		HTTP:     &http.Client{Timeout: 8 * time.Second},
	}
}

// Fetch returns metadata for a YouTube video ID.
func (o *OEmbed) Fetch(ctx context.Context, id string) (Meta, error) {
	if !domain.IsValidYouTubeID(id) {
		return Meta{}, fmt.Errorf("%w: invalid youtube id", domain.ErrValidation)
	}
	q := url.Values{}
	q.Set("url", "https://www.youtube.com/watch?v="+id)
	q.Set("format", "json")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, o.Endpoint+"?"+q.Encode(), nil)
	if err != nil {
		return Meta{}, err
	}
	resp, err := o.HTTP.Do(req)
	if err != nil {
		return Meta{}, err
	}
	defer resp.Body.Close()
	switch {
	case resp.StatusCode == http.StatusNotFound,
		resp.StatusCode == http.StatusUnauthorized,
		resp.StatusCode == http.StatusForbidden,
		resp.StatusCode == http.StatusBadRequest:
		return Meta{}, ErrNotFound
	case resp.StatusCode/100 != 2:
		return Meta{}, fmt.Errorf("oembed http %d", resp.StatusCode)
	}
	var body struct {
		Title        string `json:"title"`
		AuthorName   string `json:"author_name"`
		ThumbnailURL string `json:"thumbnail_url"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&body); err != nil {
		return Meta{}, err
	}
	thumb := body.ThumbnailURL
	if thumb == "" {
		thumb = fmt.Sprintf("https://i.ytimg.com/vi/%s/hqdefault.jpg", id)
	}
	return Meta{YouTubeID: id, Title: body.Title, Author: body.AuthorName, ThumbnailURL: thumb}, nil
}
