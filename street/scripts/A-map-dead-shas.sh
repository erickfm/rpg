#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/.."
: > /tmp/dead_to_landed.txt
: > /tmp/dead_unmapped.txt
while read -r h; do
  pid=$(git show "$h" 2>/dev/null | git patch-id --stable 2>/dev/null | awk '{print $1}')
  if [ -z "$pid" ]; then
    echo "$h NO_PATCHID" >> /tmp/dead_unmapped.txt
    continue
  fi
  landed=$(grep "^$pid " /tmp/patchids_landed.txt | awk '{print $2}' | head -1)
  if [ -n "$landed" ]; then
    echo "$h $landed" >> /tmp/dead_to_landed.txt
  else
    echo "$h $pid NOMATCH" >> /tmp/dead_unmapped.txt
  fi
done < /tmp/not_ancestor.txt
echo "mapped: $(wc -l < /tmp/dead_to_landed.txt)"
echo "unmapped: $(wc -l < /tmp/dead_unmapped.txt)"
