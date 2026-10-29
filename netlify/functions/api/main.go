// Netlify Function entry point. Netlify builds this directory from source and
// serves it at /.netlify/functions/api; netlify.toml rewrites /api/* here.
package main

import (
	"github.com/aws/aws-lambda-go/lambda"

	"ytplaylist/api/app"
	"ytplaylist/api/lambdaadapter"
)

func main() {
	lambda.Start(lambdaadapter.Handler(app.Handler(app.FromEnv(), nil)))
}
