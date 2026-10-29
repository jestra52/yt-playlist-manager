package lambdaadapter

import (
	"context"
	"encoding/base64"
	"io"
	"net/http"
	"testing"

	"github.com/aws/aws-lambda-go/events"
)

func TestHandlerRoundTrip(t *testing.T) {
	h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Path", r.URL.Path)
		w.Header().Set("X-Query", r.URL.Query().Get("id"))
		w.Header().Set("X-Auth", r.Header.Get("Authorization"))
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write(body)
	})
	fn := Handler(h)
	resp, err := fn(context.Background(), events.APIGatewayProxyRequest{
		HTTPMethod:            http.MethodPost,
		Path:                  "/api/sync",
		Headers:               map[string]string{"authorization": "Bearer t"},
		QueryStringParameters: map[string]string{"id": "abc"},
		Body:                  base64.StdEncoding.EncodeToString([]byte(`{"ok":true}`)),
		IsBase64Encoded:       true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusCreated || resp.Body != `{"ok":true}` || resp.IsBase64Encoded {
		t.Fatalf("unexpected response: %+v", resp)
	}
	h2 := resp.MultiValueHeaders
	if h2["X-Path"][0] != "/api/sync" || h2["X-Query"][0] != "abc" || h2["X-Auth"][0] != "Bearer t" {
		t.Fatalf("request not mapped: %+v", h2)
	}
}
