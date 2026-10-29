package youtube

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"ytplaylist/api/domain"
)

// Playlist is a public YouTube playlist with the videos the app imports.
type Playlist struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Author  string `json:"author"`
	Videos  []Meta `json:"videos"`
	Skipped int    `json:"skipped"` // deleted or private videos left out
	Partial bool   `json:"partial"` // true when only part of the playlist could be read
	Source  string `json:"source"`  // "api" (YouTube Data API) or "feed" (public feed)
}

var (
	// ErrPlaylistNotFound covers unknown, deleted and private playlists.
	ErrPlaylistNotFound = errors.New("playlist not found, or it is private")
	// ErrPlaylistUnsupported is returned for auto-generated mixes and personal lists.
	ErrPlaylistUnsupported = errors.New("mixes and personal lists such as Watch Later can't be imported")

	playlistIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{10,64}$`)
)

// MaxPlaylistVideos caps how many videos one import reads.
const MaxPlaylistVideos = 1000

// IsValidPlaylistID reports whether id looks like a YouTube playlist ID.
func IsValidPlaylistID(id string) bool { return playlistIDPattern.MatchString(id) }

// PlaylistFetcher reads public playlists. With an API key it uses the
// YouTube Data API and reads the whole playlist; without one it falls back to
// YouTube's public playlist feed, which only lists the most recent videos.
type PlaylistFetcher struct {
	APIKey    string
	APIBase   string // https://www.googleapis.com/youtube/v3
	FeedBase  string // https://www.youtube.com/feeds/videos.xml
	MaxVideos int
	HTTP      *http.Client
}

// NewPlaylistFetcher returns a fetcher for the public YouTube endpoints.
func NewPlaylistFetcher(apiKey string) *PlaylistFetcher {
	return &PlaylistFetcher{
		APIKey:    apiKey,
		APIBase:   "https://www.googleapis.com/youtube/v3",
		FeedBase:  "https://www.youtube.com/feeds/videos.xml",
		MaxVideos: MaxPlaylistVideos,
		HTTP:      &http.Client{Timeout: 10 * time.Second},
	}
}

// FetchPlaylist reads a playlist's title and videos.
func (f *PlaylistFetcher) FetchPlaylist(ctx context.Context, id string) (Playlist, error) {
	if !IsValidPlaylistID(id) {
		return Playlist{}, fmt.Errorf("%w: invalid playlist id", domain.ErrValidation)
	}
	// RD… lists are auto-generated mixes; they can't be read without signing in.
	if strings.HasPrefix(id, "RD") {
		return Playlist{}, ErrPlaylistUnsupported
	}
	if f.APIKey != "" {
		return f.fromAPI(ctx, id)
	}
	return f.fromFeed(ctx, id)
}

// ---- YouTube Data API --------------------------------------------------

type apiError struct {
	Error struct {
		Code   int `json:"code"`
		Errors []struct {
			Reason string `json:"reason"`
		} `json:"errors"`
		Message string `json:"message"`
	} `json:"error"`
}

func (f *PlaylistFetcher) apiGet(ctx context.Context, path string, q url.Values, out any) error {
	q.Set("key", f.APIKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, f.APIBase+path+"?"+q.Encode(), nil)
	if err != nil {
		return err
	}
	resp, err := f.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode/100 != 2 {
		var e apiError
		_ = json.Unmarshal(body, &e)
		reason := ""
		if len(e.Error.Errors) > 0 {
			reason = e.Error.Errors[0].Reason
		}
		switch {
		case resp.StatusCode == http.StatusNotFound,
			reason == "playlistItemsNotAccessible",
			reason == "playlistNotFound":
			return ErrPlaylistNotFound
		default:
			return fmt.Errorf("youtube api http %d %s: %s", resp.StatusCode, reason, e.Error.Message)
		}
	}
	return json.Unmarshal(body, out)
}

func (f *PlaylistFetcher) fromAPI(ctx context.Context, id string) (Playlist, error) {
	var info struct {
		Items []struct {
			Snippet struct {
				Title        string `json:"title"`
				ChannelTitle string `json:"channelTitle"`
			} `json:"snippet"`
		} `json:"items"`
	}
	if err := f.apiGet(ctx, "/playlists", url.Values{"part": {"snippet"}, "id": {id}}, &info); err != nil {
		return Playlist{}, err
	}
	if len(info.Items) == 0 {
		return Playlist{}, ErrPlaylistNotFound
	}
	pl := Playlist{
		ID:     id,
		Title:  info.Items[0].Snippet.Title,
		Author: info.Items[0].Snippet.ChannelTitle,
		Videos: []Meta{},
		Source: "api",
	}

	limit := f.MaxVideos
	if limit <= 0 {
		limit = MaxPlaylistVideos
	}
	pageToken := ""
	for {
		q := url.Values{"part": {"snippet"}, "playlistId": {id}, "maxResults": {"50"}}
		if pageToken != "" {
			q.Set("pageToken", pageToken)
		}
		var page struct {
			NextPageToken string `json:"nextPageToken"`
			Items         []struct {
				Snippet struct {
					Title                  string `json:"title"`
					VideoOwnerChannelTitle string `json:"videoOwnerChannelTitle"`
					ResourceID             struct {
						VideoID string `json:"videoId"`
					} `json:"resourceId"`
					Thumbnails map[string]struct {
						URL string `json:"url"`
					} `json:"thumbnails"`
				} `json:"snippet"`
			} `json:"items"`
		}
		if err := f.apiGet(ctx, "/playlistItems", q, &page); err != nil {
			return Playlist{}, err
		}
		for _, item := range page.Items {
			s := item.Snippet
			// Deleted and private videos have no owner channel.
			if s.VideoOwnerChannelTitle == "" || !domain.IsValidYouTubeID(s.ResourceID.VideoID) {
				pl.Skipped++
				continue
			}
			if len(pl.Videos) == limit {
				pl.Partial = true
				return pl, nil
			}
			pl.Videos = append(pl.Videos, Meta{
				YouTubeID:    s.ResourceID.VideoID,
				Title:        s.Title,
				Author:       s.VideoOwnerChannelTitle,
				ThumbnailURL: thumbnail(s.ResourceID.VideoID, s.Thumbnails["medium"].URL),
			})
		}
		if page.NextPageToken == "" {
			return pl, nil
		}
		pageToken = page.NextPageToken
	}
}

// ---- Public feed (no API key) ------------------------------------------

// feedPageSize is how many entries YouTube's public feed returns at most.
const feedPageSize = 15

type atomFeed struct {
	Title  string `xml:"http://www.w3.org/2005/Atom title"`
	Author struct {
		Name string `xml:"http://www.w3.org/2005/Atom name"`
	} `xml:"http://www.w3.org/2005/Atom author"`
	Entries []struct {
		VideoID string `xml:"http://www.youtube.com/xml/schemas/2015 videoId"`
		Title   string `xml:"http://www.w3.org/2005/Atom title"`
		Author  struct {
			Name string `xml:"http://www.w3.org/2005/Atom name"`
		} `xml:"http://www.w3.org/2005/Atom author"`
	} `xml:"http://www.w3.org/2005/Atom entry"`
}

func (f *PlaylistFetcher) fromFeed(ctx context.Context, id string) (Playlist, error) {
	q := url.Values{"playlist_id": {id}}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, f.FeedBase+"?"+q.Encode(), nil)
	if err != nil {
		return Playlist{}, err
	}
	resp, err := f.HTTP.Do(req)
	if err != nil {
		return Playlist{}, err
	}
	defer resp.Body.Close()
	switch {
	case resp.StatusCode == http.StatusNotFound, resp.StatusCode == http.StatusBadRequest:
		return Playlist{}, ErrPlaylistNotFound
	case resp.StatusCode/100 != 2:
		return Playlist{}, fmt.Errorf("youtube feed http %d", resp.StatusCode)
	}
	var feed atomFeed
	if err := xml.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&feed); err != nil {
		return Playlist{}, fmt.Errorf("youtube feed: %w", err)
	}
	pl := Playlist{
		ID:     id,
		Title:  feed.Title,
		Author: feed.Author.Name,
		Videos: []Meta{},
		Source: "feed",
	}
	for _, e := range feed.Entries {
		if !domain.IsValidYouTubeID(e.VideoID) {
			pl.Skipped++
			continue
		}
		pl.Videos = append(pl.Videos, Meta{
			YouTubeID:    e.VideoID,
			Title:        e.Title,
			Author:       e.Author.Name,
			ThumbnailURL: thumbnail(e.VideoID, ""),
		})
	}
	// The feed stops at its page size, so a full page means there may be more.
	pl.Partial = len(feed.Entries) >= feedPageSize
	return pl, nil
}

func thumbnail(videoID, fromAPI string) string {
	if fromAPI != "" {
		return fromAPI
	}
	return fmt.Sprintf("https://i.ytimg.com/vi/%s/mqdefault.jpg", videoID)
}
