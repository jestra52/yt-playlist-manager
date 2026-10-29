// Package httpapi exposes the sync API over plain net/http so the same
// handler runs as a local server and inside a Netlify Function.
package httpapi

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"ytplaylist/api/domain"
	"ytplaylist/api/youtube"
)

// SyncStore is the storage the sync endpoint needs.
type SyncStore interface {
	Apply(ctx context.Context, cs domain.ChangeSet) (int, error)
	Changes(ctx context.Context, since int64, limit int) (domain.ChangeSet, int64, bool, error)
}

// MetadataFetcher resolves YouTube video metadata.
type MetadataFetcher interface {
	Fetch(ctx context.Context, id string) (youtube.Meta, error)
}

// Config wires the handler's dependencies.
type Config struct {
	Store         SyncStore       // nil disables /sync with a 503
	Metadata      MetadataFetcher // nil disables /oembed with a 503
	SyncToken     string          // required bearer token for /sync
	AllowedOrigin string          // CORS origin; "*" when empty
	Logger        *log.Logger
}

const maxBodyBytes = 4 << 20

// prefixes the router strips so routes work behind /api, behind the
// Netlify Functions path, or at the root of a local server.
var prefixes = []string{"/.netlify/functions/api", "/api"}

// New returns the API handler.
func New(cfg Config) http.Handler {
	if cfg.Logger == nil {
		cfg.Logger = log.Default()
	}
	if cfg.AllowedOrigin == "" {
		cfg.AllowedOrigin = "*"
	}
	h := &handler{cfg: cfg}
	return http.HandlerFunc(h.serve)
}

type handler struct{ cfg Config }

func routePath(p string) string {
	for _, prefix := range prefixes {
		if p == prefix {
			return "/"
		}
		if strings.HasPrefix(p, prefix+"/") {
			p = strings.TrimPrefix(p, prefix)
			break
		}
	}
	if len(p) > 1 {
		p = strings.TrimRight(p, "/")
	}
	if p == "" {
		p = "/"
	}
	return p
}

func (h *handler) serve(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", h.cfg.AllowedOrigin)
	w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Max-Age", "86400")
	w.Header().Set("Vary", "Origin")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	switch path := routePath(r.URL.Path); path {
	case "/", "/health":
		h.health(w, r)
	case "/sync":
		h.sync(w, r)
	case "/oembed":
		h.oembed(w, r)
	default:
		writeError(w, http.StatusNotFound, "not found: "+path)
	}
}

func (h *handler) health(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "use GET")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":             true,
		"syncConfigured": h.cfg.Store != nil && h.cfg.SyncToken != "",
	})
}

func (h *handler) authorized(r *http.Request) bool {
	auth := r.Header.Get("Authorization")
	const scheme = "Bearer "
	if len(auth) <= len(scheme) || !strings.EqualFold(auth[:len(scheme)], scheme) {
		return false
	}
	got := []byte(strings.TrimSpace(auth[len(scheme):]))
	return subtle.ConstantTimeCompare(got, []byte(h.cfg.SyncToken)) == 1
}

func (h *handler) sync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "use POST")
		return
	}
	if h.cfg.Store == nil || h.cfg.SyncToken == "" {
		writeError(w, http.StatusServiceUnavailable, "sync is not configured on the server (set TURSO_DATABASE_URL and SYNC_TOKEN)")
		return
	}
	if !h.authorized(r) {
		writeError(w, http.StatusUnauthorized, "invalid or missing sync token")
		return
	}

	var req domain.SyncRequest
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	if err := dec.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}
	if req.Since < 0 {
		writeError(w, http.StatusBadRequest, "since must be >= 0")
		return
	}
	if err := req.Changes.Validate(); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	applied, err := h.cfg.Store.Apply(r.Context(), req.Changes)
	if err != nil {
		h.cfg.Logger.Printf("sync apply: %v", err)
		writeError(w, http.StatusBadGateway, "could not save changes to the cloud database")
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	changes, cursor, hasMore, err := h.cfg.Store.Changes(r.Context(), req.Since, limit)
	if err != nil {
		h.cfg.Logger.Printf("sync changes: %v", err)
		writeError(w, http.StatusBadGateway, "could not read changes from the cloud database")
		return
	}
	writeJSON(w, http.StatusOK, domain.SyncResponse{
		Cursor:  cursor,
		HasMore: hasMore,
		Applied: applied,
		Changes: changes,
	})
}

func (h *handler) oembed(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "use GET")
		return
	}
	if h.cfg.Metadata == nil {
		writeError(w, http.StatusServiceUnavailable, "metadata lookup is disabled")
		return
	}
	id := r.URL.Query().Get("id")
	meta, err := h.cfg.Metadata.Fetch(r.Context(), id)
	switch {
	case errors.Is(err, domain.ErrValidation):
		writeError(w, http.StatusBadRequest, err.Error())
		return
	case errors.Is(err, youtube.ErrNotFound):
		writeError(w, http.StatusNotFound, err.Error())
		return
	case err != nil:
		h.cfg.Logger.Printf("oembed %s: %v", id, err)
		writeError(w, http.StatusBadGateway, "could not reach YouTube")
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=86400")
	writeJSON(w, http.StatusOK, meta)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
