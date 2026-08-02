#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/.."
while read -r h rest; do
  subj=$(git log -1 --format='%s' "$h" 2>/dev/null)
  parents=$(git log -1 --format='%P' "$h" 2>/dev/null | wc -w)
  echo "$h [parents=$parents] $subj"
done < /tmp/dead_unmapped.txt
