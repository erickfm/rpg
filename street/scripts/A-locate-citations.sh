#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/.."
: > /tmp/citation_lines.txt
while read -r h; do
  lines=$(grep -n "$h" notes/LEDGER.md | cut -d: -f1 | tr '\n' ',' )
  echo "$h LINES:$lines"
done < /tmp/not_ancestor.txt
while read -r h; do
  lines=$(grep -n "$h" notes/LEDGER.md | cut -d: -f1 | tr '\n' ',' )
  echo "$h LINES:$lines"
done < /tmp/missing_obj.txt
