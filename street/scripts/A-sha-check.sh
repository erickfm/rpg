#!/usr/bin/env bash
# AUDIT scratch: check every 9-hex-char citation in LEDGER.md against
# add-stick-and-city98. Not for merge into the checked set of "assertion"
# scripts per GOTCHAS 24 -- this is a one-off audit tool.
set -u
cd "$(dirname "$0")/.."
: > /tmp/sha_status.txt
total=0
resolves=0
ancestor=0
while read -r h; do
  total=$((total+1))
  if git cat-file -e "$h" 2>/dev/null; then
    resolves=$((resolves+1))
    if git merge-base --is-ancestor "$h" add-stick-and-city98 2>/dev/null; then
      ancestor=$((ancestor+1))
      echo "$h ANCESTOR" >> /tmp/sha_status.txt
    else
      echo "$h RESOLVES_NOT_ANCESTOR" >> /tmp/sha_status.txt
    fi
  else
    echo "$h MISSING" >> /tmp/sha_status.txt
  fi
done < /tmp/sha9.txt
echo "total=$total resolves=$resolves ancestor=$ancestor"
