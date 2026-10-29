// Command server runs the sync API locally. Pair it with `turso dev` for a
// local libSQL database, and with `npm run dev` in web/ (Vite proxies /api).
package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"ytplaylist/api/app"
)

func main() {
	env := app.FromEnv()
	if env.DatabaseURL == "" {
		env.DatabaseURL = "http://127.0.0.1:8080" // default `turso dev` address
	}
	if env.SyncToken == "" {
		env.SyncToken = "dev-token"
		log.Printf("SYNC_TOKEN not set, using %q for local development", env.SyncToken)
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8787"
	}

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           app.Handler(env, nil),
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("sync API listening on http://localhost:%s (database: %s)", port, env.DatabaseURL)
	log.Fatal(srv.ListenAndServe())
}
