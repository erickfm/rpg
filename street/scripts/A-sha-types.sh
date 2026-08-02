#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/.."
while read -r h; do
  t=$(git cat-file -t "$h" 2>/dev/null)
  echo "$h $t"
done < /tmp/not_ancestor.txt
