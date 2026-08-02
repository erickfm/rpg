#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/.."
while read -r h rest; do
  subj=$(git log -1 --format='%s' "$h" 2>/dev/null)
  # escape for grep -F
  match=$(git log add-stick-and-city98 --format='%H %s' --fixed-strings --grep="$subj" 2>/dev/null | head -1)
  echo "DEAD $h :: $subj"
  echo "  MATCH: $match"
done < /tmp/dead_unmapped.txt
