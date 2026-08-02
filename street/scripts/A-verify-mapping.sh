#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/.."
bad=0
while IFS=$'\t' read -r dead landed method; do
  if git merge-base --is-ancestor "$landed" add-stick-and-city98 2>/dev/null; then
    :
  else
    echo "BAD MAPPING: $dead -> $landed ($method) NOT AN ANCESTOR"
    bad=$((bad+1))
  fi
done < /tmp/final_mapping.tsv
echo "bad=$bad"
