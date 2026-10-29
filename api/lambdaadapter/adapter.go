// Package lambdaadapter runs a standard http.Handler inside a Netlify
// Function (an AWS Lambda behind an API Gateway-style event).
package lambdaadapter

import (
	"bytes"
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"unicode/utf8"

	"github.com/aws/aws-lambda-go/events"
)

// Handler converts h into a Lambda handler function.
func Handler(h http.Handler) func(context.Context, events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	return func(ctx context.Context, ev events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
		req, err := toRequest(ctx, ev)
		if err != nil {
			return events.APIGatewayProxyResponse{StatusCode: http.StatusBadRequest, Body: `{"error":"bad request"}`}, nil
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return toResponse(rec), nil
	}
}

func toRequest(ctx context.Context, ev events.APIGatewayProxyRequest) (*http.Request, error) {
	body := []byte(ev.Body)
	if ev.IsBase64Encoded {
		decoded, err := base64.StdEncoding.DecodeString(ev.Body)
		if err != nil {
			return nil, err
		}
		body = decoded
	}

	q := url.Values{}
	for k, vs := range ev.MultiValueQueryStringParameters {
		for _, v := range vs {
			q.Add(k, v)
		}
	}
	for k, v := range ev.QueryStringParameters {
		if _, ok := q[k]; !ok {
			q.Set(k, v)
		}
	}

	path := ev.Path
	if path == "" {
		path = "/"
	}
	u := &url.URL{Path: path, RawQuery: q.Encode()}
	method := ev.HTTPMethod
	if method == "" {
		method = http.MethodGet
	}
	req, err := http.NewRequestWithContext(ctx, method, u.String(), bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	for k, vs := range ev.MultiValueHeaders {
		for _, v := range vs {
			req.Header.Add(k, v)
		}
	}
	for k, v := range ev.Headers {
		if req.Header.Get(k) == "" {
			req.Header.Set(k, v)
		}
	}
	req.ContentLength = int64(len(body))
	req.RemoteAddr = ev.RequestContext.Identity.SourceIP
	if host := req.Header.Get("Host"); host != "" {
		req.Host = host
	}
	return req, nil
}

func toResponse(rec *httptest.ResponseRecorder) events.APIGatewayProxyResponse {
	res := rec.Result()
	headers := make(map[string][]string, len(res.Header))
	for k, vs := range res.Header {
		headers[k] = vs
	}
	body := rec.Body.Bytes()
	out := events.APIGatewayProxyResponse{
		StatusCode:        res.StatusCode,
		MultiValueHeaders: headers,
	}
	ct := strings.ToLower(res.Header.Get("Content-Type"))
	textual := strings.HasPrefix(ct, "text/") || strings.Contains(ct, "json") || ct == ""
	if textual && utf8.Valid(body) {
		out.Body = string(body)
	} else {
		out.Body = base64.StdEncoding.EncodeToString(body)
		out.IsBase64Encoded = true
	}
	return out
}
