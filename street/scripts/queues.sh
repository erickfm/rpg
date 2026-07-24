#!/usr/bin/env bash
# What is every agent doing, and what is behind it?
set -u
cd "$(dirname "$0")/.." || exit 1
Q=notes/queues
printf '\n%-14s %-40s %s\n' "AGENT" "NOW" "BEHIND IT"
printf '%s\n' "------------------------------------------------------------------------------"
for f in "$Q"/*.md; do
  [ "$(basename "$f")" = "README.md" ] && continue
  a=$(basename "$f" .md)
  now=$(awk '/^## Now/{f=1;next} /^## /{f=0} f && /^- \[ \]/{sub(/^- \[ \] /,""); gsub(/\*\*/,""); print; exit}' "$f")
  n=$(awk '/^## Next/{f=1;next} /^## /{f=0} f && /^- \[ \]/{c++} END{print c+0}' "$f")
  done_n=$(grep -c "^- \[x\]" "$f" || true); done_n=${done_n:-0}
  printf '%-14s %-40s %2s queued  %2s done\n' "$a" "${now:0:40}" "$n" "$done_n"
done
printf '\n'
# who is actually alive, and is their work reaching the live world?
for wt in ../rpg-ground ../rpg-entrance ../rpg-alley ../rpg-audit; do
  [ -d "$wt" ] || continue
  b=$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null)
  dirty=$(git -C "$wt" status --porcelain 2>/dev/null | grep -vc node_modules)
  ahead=$(git -C "$wt" log --oneline add-stick-and-city98.."$b" 2>/dev/null | wc -l)
  behind=$(git -C "$wt" log --oneline "$b"..add-stick-and-city98 2>/dev/null | wc -l)
  printf '%-16s %-18s %s uncommitted, %s unmerged, %s behind\n' "$(basename "$wt")" "$b" "$dirty" "$ahead" "$behind"
done
