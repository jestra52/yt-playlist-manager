#!/usr/bin/env bash
# Runs a command and, if it fails, reports the matching output lines as one
# GitHub Actions error annotation (shown on the run and the pull request).
#   run-annotated.sh "<title>" "<grep -E pattern>" <command> [args...]
set -uo pipefail

title=$1
pattern=$2
shift 2

log=$(mktemp)
"$@" 2>&1 | tee "$log"
status=${PIPESTATUS[0]}

if [ "$status" -ne 0 ]; then
    message=$(grep -E "$pattern" "$log" | sed 's/\r$//' | awk '!seen[$0]++' | head -80)
    if [ -z "$message" ]; then
        message=$(tail -40 "$log")
    fi
    # Annotations are one line: encode %, CR and LF.
    message=${message//'%'/'%25'}
    message=${message//$'\r'/'%0D'}
    message=${message//$'\n'/'%0A'}
    echo "::error title=${title}::${message}"
fi
rm -f "$log"
exit "$status"
