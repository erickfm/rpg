#!/usr/bin/env bash
# Are you editing files you own? Run before committing.
#   scripts/ownership.sh B      # check as builder B
set -u
cd "$(dirname "$0")/.." || exit 1
ME=${1:-}
[ -z "$ME" ] && { echo "usage: ownership.sh <B|C|D|DESK>"; exit 2; }
MAN=notes/OWNERSHIP.md
BASE=add-stick-and-city98

changed=$(git diff --name-only "$BASE"...HEAD 2>/dev/null; git diff --name-only; git ls-files -o --exclude-standard)
bad=0
for f in $(echo "$changed" | sed 's|^street/||' | sort -u); do
  case "$f" in src/proto/*) ;; *) continue;; esac
  owner=$(grep -E "^\s*${f//\//\\/}\s*=" "$MAN" 2>/dev/null | head -1 | sed 's/.*=\s*//' | awk '{print $1}')
  [ -z "$owner" ] && continue
  if [ "$owner" != "$ME" ]; then
    echo "  ✗ $f  is owned by $owner, not $ME"
    bad=$((bad+1))
  fi
done
if [ "$bad" -eq 0 ]; then echo "  ✓ every changed source file is yours"; else
  echo
  echo "  $bad file(s) out of bounds. If a shared module needs a signature change,"
  echo "  STOP and tell the desk — it must be changed with all callers in one commit."
  exit 1
fi
