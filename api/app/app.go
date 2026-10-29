// Package app builds the API handler from environment variables, shared by
// the local server and the Netlify Function entry point.
package app

import (
	"log"
	"net/http"
	"os"

	"ytplaylist/api/httpapi"
	"ytplaylist/api/storage"
	"ytplaylist/api/youtube"
)

// Env holds the configuration read from the environment.
type Env struct {
	DatabaseURL   string // TURSO_DATABASE_URL (libsql://… or http://127.0.0.1:8080 for `turso dev`)
	DatabaseToken string // TURSO_AUTH_TOKEN
	SyncToken     string // SYNC_TOKEN: shared secret the web app sends as a bearer token
	AllowedOrigin string // ALLOWED_ORIGIN: CORS origin, "*" by default
}

// FromEnv reads the configuration.
func FromEnv() Env {
	return Env{
		DatabaseURL:   os.Getenv("TURSO_DATABASE_URL"),
		DatabaseToken: os.Getenv("TURSO_AUTH_TOKEN"),
		SyncToken:     os.Getenv("SYNC_TOKEN"),
		AllowedOrigin: os.Getenv("ALLOWED_ORIGIN"),
	}
}

// Handler builds the HTTP handler. A missing database keeps the API up
// (health and oEmbed work) and makes /sync answer 503 with an explanation.
func Handler(env Env, logger *log.Logger) http.Handler {
	if logger == nil {
		logger = log.Default()
	}
	cfg := httpapi.Config{
		Metadata:      youtube.NewOEmbed(),
		SyncToken:     env.SyncToken,
		AllowedOrigin: env.AllowedOrigin,
		Logger:        logger,
	}
	if env.DatabaseURL != "" {
		client, err := storage.NewClient(env.DatabaseURL, env.DatabaseToken)
		if err != nil {
			logger.Printf("database disabled: %v", err)
		} else {
			cfg.Store = storage.NewSyncRepo(client)
		}
	}
	if env.SyncToken == "" {
		logger.Printf("SYNC_TOKEN is not set: /sync will answer 503")
	}
	return httpapi.New(cfg)
}
