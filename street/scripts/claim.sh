#!/bin/sh
# claim.sh <worker-name> — take the top TODO row of notes/QUEUE.md and mark it DOING.
# Usage: ./scripts/claim.sh <name> | --touch <name> | --release <name>
# Locks notes/.queue.lock (mkdir, atomic) so two builders cannot take the same row.
# DO NOT read this file to use it — run it. The rationale lives in git history.

set -u
cd "$(dirname "$0")/.." || exit 1
COMMON=$(git rev-parse --git-common-dir 2>/dev/null) || COMMON=.git
case "$COMMON" in /*) ;; *) COMMON="$PWD/$COMMON";; esac
SHARED=$(dirname "$COMMON")/street/notes
MAIN_STREET=$(dirname "$SHARED")
Q="${CLAIM_QUEUE:-$SHARED/QUEUE.md}"
LOCK="$(dirname "$Q")/.queue.lock"
QB="$PWD/scripts/queue-backup.sh"
[ -f "$Q" ] || { echo "no queue at $Q"; exit 1; }

mode=${1:-}
[ -z "$mode" ] && { echo "usage: claim.sh <your-name>  |  claim.sh --stale [minutes]  |  claim.sh --release <item-id> [your-name]"; exit 2; }

claim_tree_files() {
  ( cd "$1" 2>/dev/null && git ls-files --cached --others --exclude-standard 2>/dev/null )
}

claim_resolve() {
  _tok=$1; _list=$2
  [ -e "$PWD/$_tok" ] && { printf '%s\n' "$_tok"; return 0; }
  _hit=$(printf '%s\n' "$_list" | grep -E "(^|/)$(printf '%s' "$_tok" | sed 's/[.[\*^$]/\\&/g')\$" | head -2)
  [ -n "$_hit" ] && { printf '%s\n' "$_hit" | head -1; return 0; }
  return 1
}

claim_check_paths() {
  _col=$1
  _toks=$(printf '%s' "$_col" | sed 's/([^)]*)//g; s/[+,]/ /g')
  _mine=$(claim_tree_files "$PWD"
    claim_tree_files "$PWD/.." | grep -v '^street/' | sed 's|^|../|')
  _main=''
  _bad=0; _out=''
  for _t in $_toks; do
    _t=${_t%%:*}                       # `fp.ts:446` -> `fp.ts`
    _t=$(printf '%s' "$_t" | sed 's/[.,;:`*]*$//; s/^[`*]*//')
    case "$_t" in
      *.ts|*.tsx|*.js|*.mjs|*.cjs|*.sh|*.md|*.json|*.html|*.css|*.tsv|*.patch|*.yml|*.yaml|*.txt|*.png) ;;
      *) continue;;
    esac
    printf '%s' "$_t" | grep -qE '^[A-Za-z0-9_][A-Za-z0-9_./-]*$' || continue
    if _r=$(claim_resolve "$_t" "$_mine"); then
      [ "$_r" = "$_t" ] && _out="$_out
  ok        $_t" || _out="$_out
  ok        $_t  ->  $_r"
      continue
    fi
    _bad=$((_bad + 1))
    [ -z "$_main" ] && _main=$(claim_tree_files "$MAIN_STREET")
    if [ "$MAIN_STREET" != "$PWD" ] && printf '%s\n' "$_main" \
      | grep -qE "(^|/)$(printf '%s' "$_t" | sed 's/[.[\*^$]/\\&/g')\$"; then
      _out="$_out
  MISSING   $_t
            It IS in the main tree but not in yours — your worktree is BEHIND.
            Fix: git reset --hard add-stick-and-city98 && (cd street && npm install)"
      continue
    fi
    _base=${_t##*/}
    _near=$(printf '%s\n' "$_mine" | grep -E "(^|/)$(printf '%s' "$_base" | sed 's/[.[\*^$]/\\&/g')\$" | head -3)
    if [ -n "$_near" ]; then
      _out="$_out
  MISSING   $_t
            The item's PATH is stale. A file of that name is at:"
      for _n in $_near; do _out="$_out
              $_n"; done
      continue
    fi
    _stem=${_base%.*}; _ext=${_base##*.}
    _near=$(printf '%s\n' "$_mine" | grep -E "(^|/)[A-Za-z0-9_.-]*$(printf '%s' "$_stem" | sed 's/[.[\*^$]/\\&/g')[A-Za-z0-9_.-]*\.$_ext\$" | head -4)
    if [ -n "$_near" ]; then
      _out="$_out
  MISSING   $_t
            No file of that NAME exists. Did the item mean one of:"
      for _n in $_near; do _out="$_out
              $_n"; done
    else
      _out="$_out
  MISSING   $_t
            No file of that name anywhere in this tree."
    fi
  done
  [ -z "$_out" ] && return 0
  if [ "$_bad" -eq 0 ]; then
    printf '  files named by this item — all present:%s\n\n' "$_out"
    return 0
  fi
  printf '\n  ┌─ THIS ITEM NAMES A FILE THAT IS NOT THERE ─────────────────────\n'
  printf '%s\n' "$_out" | sed 's/^/  │/'
  printf '  └─ MEASURE FIRST. The desk guesses filenames and is wrong often\n'
  printf '     enough that BUILDER-BRIEF §6a exists. If the item cannot begin,\n'
  printf '     say so in done.sh and hand it back — that is a success, not a\n'
  printf '     failure. Do NOT invent a file to make the row true.\n\n'
  return 1
}

if [ "$mode" = "--check-paths" ]; then
  claim_check_paths "${2:-}"
  exit 0
fi

tries=0
until mkdir "$LOCK" 2>/dev/null; do
  tries=$((tries + 1))
  if [ "$tries" -gt 60 ]; then
    echo "queue locked for 60s — assuming a dead holder and taking it"
    rm -rf "$LOCK"; mkdir "$LOCK" 2>/dev/null || exit 1
    break
  fi
  sleep 1
done
trap 'sh "$QB" snapshot "$Q" >/dev/null 2>&1; rm -rf "$LOCK"' EXIT INT TERM

if [ "$mode" = "--stale" ]; then
  threshold=${2:-90}
  now_hh=$(date '+%H'); now_mm=$(date '+%M')
  now_hh=${now_hh#0}; now_mm=${now_mm#0}
  now_min=$((now_hh * 60 + now_mm))
  rows=$(grep -n '^| *[0-9]*[a-z]* *| *DOING' "$Q")
  if [ -z "$rows" ]; then echo "no DOING rows — nothing held."; exit 0; fi
  echo "$rows" | while IFS= read -r r; do
    who_stamp=$(printf '%s' "$r" | sed 's/^[0-9]*:| *[0-9a-z]* *| *DOING \([^ ]*\) \([0-9][0-9]\):\([0-9][0-9]\).*/\1 \2 \3/')
    holder=$(printf '%s' "$who_stamp" | cut -d' ' -f1)
    hh=$(printf '%s' "$who_stamp" | cut -d' ' -f2)
    mm=$(printf '%s' "$who_stamp" | cut -d' ' -f3)
    item=$(printf '%s' "$r" | sed 's/^[0-9]*:| *\([0-9a-z]*\) *|.*/\1/')
    if [ -z "$holder" ] || [ -z "$hh" ] || [ -z "$mm" ]; then
      echo "item $item — DOING row did not match the stamp format, cannot age it: $r"
      continue
    fi
    hh=${hh#0}; mm=${mm#0}
    claim_min=$((hh * 60 + mm))
    age=$((now_min - claim_min))
    [ "$age" -lt 0 ] && age=$((age + 1440))   # rolled past midnight
    flag=""
    if [ "$age" -ge "$threshold" ]; then flag=" — STALE (>= ${threshold}m)"; fi
    printf 'item %-4s held by %-8s for %4dm%s\n' "$item" "$holder" "$age" "$flag"
  done
  exit 0
fi

if [ "$mode" = "--release" ]; then
  item=${2:-}
  releaser=${3:-desk}
  [ -z "$item" ] && { echo "usage: claim.sh --release <item-id> [your-name]"; exit 2; }
  row=$(grep -n "^| *$item *| *DOING" "$Q" | head -1)
  if [ -z "$row" ]; then
    echo "item $item is not DOING — nothing to release (check ./scripts/claim.sh --stale for what IS held)"
    exit 1
  fi
  ln=${row%%:*}
  old=$(printf '%s' "$row" | sed 's/^[0-9]*:| *[0-9a-z]* *| *\(DOING [^|]*\) *|.*/\1/')
  sed -i "${ln}s/| *DOING [^|]* *|/| TODO |/" "$Q" || exit 1
  echo "item $item released by $releaser — was \"$old\", now TODO again"
  exit 0
fi

if [ "$mode" = "--touch" ]; then
  who=${2:-}
  [ -z "$who" ] && { echo "usage: claim.sh --touch <your-name>"; exit 2; }
  row=$(grep -n "^| *[0-9]*[a-z]* *| *DOING $who " "$Q" | head -1)
  [ -z "$row" ] && { echo "you ($who) do not hold anything — nothing to touch"; exit 3; }
  ln=${row%%:*}
  item=$(printf '%s' "$row" | sed 's/^[0-9]*:| *\([0-9a-z]*\) *|.*/\1/')
  sed -i "${ln}s/| *DOING $who [^|]*|/| DOING $who $(date '+%H:%M') |/" "$Q" || exit 1
  echo "item $item — claim refreshed for $who, the reaper will leave it alone"
  exit 0
fi

case "$mode" in
  -*)
    echo "unknown option: $mode"
    echo
    echo "usage:  claim.sh <your-name>                    claim the top unclaimed item"
    echo "        claim.sh --stale [minutes]              report DOING rows by age"
    echo "        claim.sh --release <item-id> [name]     force an item back to TODO"
    echo "        claim.sh --touch <your-name>            re-stamp your claim"
    exit 2;;
esac
who=$mode

REAP_MIN=${CLAIM_REAP_MINUTES:-150}
now_hh=$(date '+%H'); now_mm=$(date '+%M')
now_hh=${now_hh#0}; now_mm=${now_mm#0}
now_min=$((now_hh * 60 + now_mm))
grep -n '^| *[0-9]*[a-z]* *| *DOING' "$Q" | while IFS= read -r r; do
  ln=${r%%:*}
  item=$(printf '%s' "$r" | sed 's/^[0-9]*:| *\([0-9a-z]*\) *|.*/\1/')
  ws=$(printf '%s' "$r" | sed 's/^[0-9]*:| *[0-9a-z]* *| *DOING \([^ ]*\) \([0-9][0-9]\):\([0-9][0-9]\).*/\1 \2 \3/')
  holder=$(printf '%s' "$ws" | cut -d' ' -f1)
  hh=$(printf '%s' "$ws" | cut -d' ' -f2); mm=$(printf '%s' "$ws" | cut -d' ' -f3)
  case "$hh$mm" in *[!0-9]*|'') continue;; esac
  hh=${hh#0}; mm=${mm#0}
  age=$((now_min - (hh * 60 + mm)))
  [ "$age" -lt 0 ] && age=$((age + 1440))
  if [ "$age" -ge "$REAP_MIN" ]; then
    sed -i "${ln}s/| *DOING [^|]* *|/| TODO |/" "$Q"
    echo "reaped item $item — $holder held it ${age}m with no --touch; back to TODO"
  fi
done

SKIP=''
if [ "${2:-}" = "--skip" ]; then SKIP=$(printf '%s' "${3:-}" | tr ',' ' '); fi

row=''
for _cand in $(grep -n '^| *[0-9]*[a-z]* *| *TODO *|' "$Q" | cut -d: -f1); do
  _id=$(sed -n "${_cand}p" "$Q" | sed 's/^| *\([0-9a-z]*\) *|.*/\1/')
  _skip=0
  for _s in $SKIP; do [ "$_id" = "$_s" ] && _skip=1; done
  [ "$_skip" = 1 ] && { echo "skipping item $_id, as asked"; continue; }
  row=$(sed -n "${_cand}p" "$Q" | sed "s/^/$_cand:/")
  break
done
if [ -z "$row" ]; then
  held=$(grep -c '^| *[0-9]*[a-z]* *| *DOING' "$Q" 2>/dev/null); held=${held:-0}
  echo "QUEUE EMPTY — nothing unclaimed."
  [ "$held" -gt 0 ] && echo "($held item(s) still held by other builders.)"
  echo "Say so and stop. Do not invent work."
  exit 3
fi

ln=${row%%:*}
num=$(printf '%s' "$row" | sed 's/^[0-9]*:| *\([0-9a-z]*\) *|.*/\1/')

stamp="DOING $who $(date '+%H:%M')"
sed -i "${ln}s/| *TODO *|/| $stamp |/" "$Q" || exit 1

echo "=== claimed item $num ==="
sed -n "${ln}p" "$Q" | sed 's/^| *[0-9a-z]* *| *[^|]* *|/  file(s):/' | sed 's/ *| */\n  /'
echo
claim_check_paths "$(sed -n "${ln}p" "$Q" | awk -F'|' '{print $4}')" || true
echo "  Rules for HOW: notes/BUILDER-BRIEF.md (read it once)"
echo "  Your port:     pick a free one in 4180-4199, and always pass SHOT_URL"
echo "  When finished: ./scripts/done.sh $who \"<one line on what you did>\""
echo "  Then claim again. Commit as you go — killed agents keep only commits."
