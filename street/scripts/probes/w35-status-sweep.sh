#!/bin/sh
# w35 — ITEM 72. Run each named check and record its EXIT STATUS UNPIPED.
#
# `$?` after a pipeline is the LAST command's status, and that has already
# produced one false bug report in this repo. So nothing here is piped: the
# check's stdout goes to a file by redirection and `$?` is read immediately.
#
#   SHOT_URL=http://localhost:PORT/ OUT=/tmp/x sh scripts/probes/w35-status-sweep.sh <name>...
: "${SHOT_URL:?set SHOT_URL}"
OUT=${OUT:-/tmp/w35-status}
mkdir -p "$OUT"
for n in "$@"; do
  SHOT_URL="$SHOT_URL" node "scripts/$n.mjs" > "$OUT/$n.txt" 2>&1
  st=$?
  printf '%-26s exit=%s\n' "$n" "$st"
done
