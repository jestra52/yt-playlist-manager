package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// Client is a minimal, dependency-free client for the Hrana-over-HTTP
// protocol spoken by Turso and `turso dev` (libSQL server). It sends each call
// as a single pipeline that opens and closes its own stream, which suits
// short-lived serverless invocations.
type Client struct {
	baseURL string
	token   string
	http    *http.Client
}

// NewClient builds a client. dbURL accepts libsql://, https:// or http://
// URLs; token may be empty for a local `turso dev` server.
func NewClient(dbURL, token string) (*Client, error) {
	u, err := normalizeURL(dbURL)
	if err != nil {
		return nil, err
	}
	return &Client{
		baseURL: u,
		token:   token,
		http:    &http.Client{Timeout: 15 * time.Second},
	}, nil
}

func normalizeURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	switch {
	case raw == "":
		return "", fmt.Errorf("database url is empty")
	case strings.HasPrefix(raw, "libsql://"):
		raw = "https://" + strings.TrimPrefix(raw, "libsql://")
	case strings.HasPrefix(raw, "wss://"):
		raw = "https://" + strings.TrimPrefix(raw, "wss://")
	case strings.HasPrefix(raw, "ws://"):
		raw = "http://" + strings.TrimPrefix(raw, "ws://")
	case strings.HasPrefix(raw, "https://"), strings.HasPrefix(raw, "http://"):
	default:
		return "", fmt.Errorf("unsupported database url scheme: %q", raw)
	}
	return strings.TrimRight(raw, "/"), nil
}

// Value is a SQLite value in Hrana's JSON encoding.
type Value struct {
	Type   string          `json:"type"`
	Value  json.RawMessage `json:"value,omitempty"`
	Base64 string          `json:"base64,omitempty"`
}

// Text, Int, Float and Null build statement arguments.
func Text(s string) Value { b, _ := json.Marshal(s); return Value{Type: "text", Value: b} }
func Int(i int64) Value {
	b, _ := json.Marshal(strconv.FormatInt(i, 10))
	return Value{Type: "integer", Value: b}
}
func Float(f float64) Value {
	b, _ := json.Marshal(f)
	return Value{Type: "float", Value: b}
}
func Bool(v bool) Value {
	if v {
		return Int(1)
	}
	return Int(0)
}
func Null() Value { return Value{Type: "null"} }

// String returns the value as text (empty for NULL).
func (v Value) String() string {
	switch v.Type {
	case "text":
		var s string
		_ = json.Unmarshal(v.Value, &s)
		return s
	case "integer":
		var s string
		_ = json.Unmarshal(v.Value, &s)
		return s
	case "float":
		return string(v.Value)
	default:
		return ""
	}
}

// Int64 returns the value as an integer (0 for NULL or non-numeric).
func (v Value) Int64() int64 {
	switch v.Type {
	case "integer":
		n, _ := strconv.ParseInt(v.String(), 10, 64)
		return n
	case "float":
		return int64(v.Float64())
	case "text":
		n, _ := strconv.ParseInt(v.String(), 10, 64)
		return n
	}
	return 0
}

// Float64 returns the value as a float (0 for NULL).
func (v Value) Float64() float64 {
	switch v.Type {
	case "float":
		var f float64
		_ = json.Unmarshal(v.Value, &f)
		return f
	case "integer", "text":
		f, _ := strconv.ParseFloat(v.String(), 64)
		return f
	}
	return 0
}

// Stmt is a single SQL statement with positional arguments.
type Stmt struct {
	SQL      string  `json:"sql"`
	Args     []Value `json:"args,omitempty"`
	WantRows *bool   `json:"want_rows,omitempty"`
}

// Col describes a result column.
type Col struct {
	Name string `json:"name"`
}

// Result is the outcome of one statement.
type Result struct {
	Cols             []Col     `json:"cols"`
	Rows             [][]Value `json:"rows"`
	AffectedRowCount int64     `json:"affected_row_count"`
}

// Row is a result row with column lookup by name.
type Row struct {
	cols  map[string]int
	value []Value
}

// Get returns the value of the named column.
func (r Row) Get(name string) Value {
	if i, ok := r.cols[name]; ok && i < len(r.value) {
		return r.value[i]
	}
	return Value{Type: "null"}
}

// Records returns rows addressable by column name.
func (r *Result) Records() []Row {
	idx := make(map[string]int, len(r.Cols))
	for i, c := range r.Cols {
		idx[c.Name] = i
	}
	out := make([]Row, len(r.Rows))
	for i, values := range r.Rows {
		out[i] = Row{cols: idx, value: values}
	}
	return out
}

// Error is a server-side SQL error.
type Error struct {
	Message string `json:"message"`
	Code    string `json:"code,omitempty"`
}

func (e *Error) Error() string {
	if e.Code != "" {
		return fmt.Sprintf("libsql: %s (%s)", e.Message, e.Code)
	}
	return "libsql: " + e.Message
}

type batchCond struct {
	Type  string      `json:"type"`
	Step  *int        `json:"step,omitempty"`
	Cond  *batchCond  `json:"cond,omitempty"`
	Conds []batchCond `json:"conds,omitempty"`
}

type batchStep struct {
	Condition *batchCond `json:"condition,omitempty"`
	Stmt      Stmt       `json:"stmt"`
}

type streamRequest struct {
	Type  string `json:"type"`
	Stmt  *Stmt  `json:"stmt,omitempty"`
	Batch *struct {
		Steps []batchStep `json:"steps"`
	} `json:"batch,omitempty"`
}

type pipelineRequest struct {
	Baton    *string         `json:"baton"`
	Requests []streamRequest `json:"requests"`
}

type streamResult struct {
	Type     string `json:"type"`
	Error    *Error `json:"error"`
	Response *struct {
		Type   string          `json:"type"`
		Result json.RawMessage `json:"result"`
	} `json:"response"`
}

type pipelineResponse struct {
	Results []streamResult `json:"results"`
}

type batchResult struct {
	StepResults []*Result `json:"step_results"`
	StepErrors  []*Error  `json:"step_errors"`
}

func (c *Client) pipeline(ctx context.Context, reqs []streamRequest) ([]streamResult, error) {
	reqs = append(reqs, streamRequest{Type: "close"})
	body, err := json.Marshal(pipelineRequest{Requests: reqs})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/v2/pipeline", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("libsql request failed: %w", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("libsql http %d: %s", resp.StatusCode, truncate(string(raw), 300))
	}
	var out pipelineResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("libsql: decoding response: %w", err)
	}
	if len(out.Results) != len(reqs) {
		return nil, fmt.Errorf("libsql: expected %d results, got %d", len(reqs), len(out.Results))
	}
	return out.Results, nil
}

// Execute runs one statement.
func (c *Client) Execute(ctx context.Context, stmt Stmt) (*Result, error) {
	results, err := c.pipeline(ctx, []streamRequest{{Type: "execute", Stmt: &stmt}})
	if err != nil {
		return nil, err
	}
	first := results[0]
	if first.Type == "error" {
		return nil, first.Error
	}
	var res Result
	if err := json.Unmarshal(first.Response.Result, &res); err != nil {
		return nil, fmt.Errorf("libsql: decoding result: %w", err)
	}
	return &res, nil
}

// Transaction runs the statements atomically: BEGIN IMMEDIATE, each statement
// only if the previous one succeeded, COMMIT, and ROLLBACK if anything failed.
// It returns one result per input statement.
func (c *Client) Transaction(ctx context.Context, stmts []Stmt) ([]*Result, error) {
	steps := make([]batchStep, 0, len(stmts)+3)
	steps = append(steps, batchStep{Stmt: Stmt{SQL: "BEGIN IMMEDIATE"}})
	for i := range stmts {
		prev := len(steps) - 1
		steps = append(steps, batchStep{Condition: &batchCond{Type: "ok", Step: &prev}, Stmt: stmts[i]})
	}
	last := len(steps) - 1
	steps = append(steps, batchStep{Condition: &batchCond{Type: "ok", Step: &last}, Stmt: Stmt{SQL: "COMMIT"}})
	commit := len(steps) - 1
	steps = append(steps, batchStep{
		Condition: &batchCond{Type: "not", Cond: &batchCond{Type: "ok", Step: &commit}},
		Stmt:      Stmt{SQL: "ROLLBACK"},
	})

	req := streamRequest{Type: "batch"}
	req.Batch = &struct {
		Steps []batchStep `json:"steps"`
	}{Steps: steps}

	results, err := c.pipeline(ctx, []streamRequest{req})
	if err != nil {
		return nil, err
	}
	first := results[0]
	if first.Type == "error" {
		return nil, first.Error
	}
	var br batchResult
	if err := json.Unmarshal(first.Response.Result, &br); err != nil {
		return nil, fmt.Errorf("libsql: decoding batch result: %w", err)
	}
	for _, e := range br.StepErrors {
		if e != nil {
			return nil, e
		}
	}
	if commit >= len(br.StepResults) || br.StepResults[commit] == nil {
		return nil, fmt.Errorf("libsql: transaction was not committed")
	}
	return br.StepResults[1 : len(stmts)+1], nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
