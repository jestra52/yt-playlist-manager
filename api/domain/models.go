// Package domain holds the sync data model shared by the HTTP layer and the
// storage layer. It mirrors the tables the Svelte client keeps in its local
// SQLite database.
package domain

import (
	"errors"
	"fmt"
	"regexp"
	"unicode/utf8"
)

// Playlist is a named, ordered collection of videos.
type Playlist struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Position    float64 `json:"position"`
	CreatedAt   int64   `json:"createdAt"`
	UpdatedAt   int64   `json:"updatedAt"`
	Deleted     bool    `json:"deleted"`
}

// Video is a YouTube video saved into a playlist.
type Video struct {
	ID           string  `json:"id"`
	PlaylistID   string  `json:"playlistId"`
	YouTubeID    string  `json:"youtubeId"`
	Title        string  `json:"title"`
	Author       string  `json:"author"`
	ThumbnailURL string  `json:"thumbnailUrl"`
	Notes        string  `json:"notes"`
	Watched      bool    `json:"watched"`
	Position     float64 `json:"position"`
	CreatedAt    int64   `json:"createdAt"`
	UpdatedAt    int64   `json:"updatedAt"`
	Deleted      bool    `json:"deleted"`
}

// ChangeSet is a batch of rows travelling in either direction.
type ChangeSet struct {
	Playlists []Playlist `json:"playlists"`
	Videos    []Video    `json:"videos"`
}

// Len returns the number of rows in the change set.
func (c ChangeSet) Len() int { return len(c.Playlists) + len(c.Videos) }

// SyncRequest is what the client sends: its local changes plus the cursor of
// the last server change it has already seen.
type SyncRequest struct {
	Since   int64     `json:"since"`
	Changes ChangeSet `json:"changes"`
}

// SyncResponse returns server-side changes newer than the client's cursor.
type SyncResponse struct {
	Cursor  int64     `json:"cursor"`
	HasMore bool      `json:"hasMore"`
	Applied int       `json:"applied"`
	Changes ChangeSet `json:"changes"`
}

// Limits protect the API from oversized payloads.
const (
	MaxRowsPerSync  = 2000
	MaxIDLength     = 64
	MaxNameLength   = 200
	MaxTextLength   = 5000
	MaxURLLength    = 2048
	MaxPullPageSize = 1000
)

var (
	youTubeIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)
	rowIDPattern     = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)
)

// ErrValidation wraps every validation failure so the HTTP layer can map it
// to a 400 response.
var ErrValidation = errors.New("validation error")

func invalid(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrValidation, fmt.Sprintf(format, args...))
}

// IsValidYouTubeID reports whether id looks like a YouTube video ID.
func IsValidYouTubeID(id string) bool { return youTubeIDPattern.MatchString(id) }

func validID(field, id string) error {
	if id == "" || len(id) > MaxIDLength || !rowIDPattern.MatchString(id) {
		return invalid("%s %q is not a valid id", field, id)
	}
	return nil
}

func maxLen(field, value string, limit int) error {
	if utf8.RuneCountInString(value) > limit {
		return invalid("%s is longer than %d characters", field, limit)
	}
	return nil
}

// Validate checks a playlist row coming from a client.
func (p Playlist) Validate() error {
	if err := validID("playlist id", p.ID); err != nil {
		return err
	}
	if !p.Deleted && p.Name == "" {
		return invalid("playlist %s has no name", p.ID)
	}
	if err := maxLen("playlist name", p.Name, MaxNameLength); err != nil {
		return err
	}
	if err := maxLen("playlist description", p.Description, MaxTextLength); err != nil {
		return err
	}
	if p.UpdatedAt <= 0 || p.CreatedAt <= 0 {
		return invalid("playlist %s has no timestamps", p.ID)
	}
	return nil
}

// Validate checks a video row coming from a client.
func (v Video) Validate() error {
	if err := validID("video id", v.ID); err != nil {
		return err
	}
	if err := validID("video playlistId", v.PlaylistID); err != nil {
		return err
	}
	if !IsValidYouTubeID(v.YouTubeID) {
		return invalid("video %s has an invalid youtubeId", v.ID)
	}
	if err := maxLen("video title", v.Title, MaxNameLength*2); err != nil {
		return err
	}
	if err := maxLen("video author", v.Author, MaxNameLength); err != nil {
		return err
	}
	if err := maxLen("video thumbnailUrl", v.ThumbnailURL, MaxURLLength); err != nil {
		return err
	}
	if err := maxLen("video notes", v.Notes, MaxTextLength); err != nil {
		return err
	}
	if v.UpdatedAt <= 0 || v.CreatedAt <= 0 {
		return invalid("video %s has no timestamps", v.ID)
	}
	return nil
}

// Validate checks every row in the change set.
func (c ChangeSet) Validate() error {
	if c.Len() > MaxRowsPerSync {
		return invalid("too many rows in one sync (%d > %d)", c.Len(), MaxRowsPerSync)
	}
	for _, p := range c.Playlists {
		if err := p.Validate(); err != nil {
			return err
		}
	}
	for _, v := range c.Videos {
		if err := v.Validate(); err != nil {
			return err
		}
	}
	return nil
}
