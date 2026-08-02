#!/bin/sh
# Claim the top unclaimed item in notes/QUEUE.md, atomically.
#
# The user: *"as a builder finishes one task they pick up another."* This is the
# whole mechanism. A builder runs it, gets one item, does it, runs done.sh, runs
# this again. Nobody waits to be told.
#
# WHY A LOCK. Builders run concurrently. Read-modify-write on a shared file
# without one gives two builders the same item, and this project has already
# paid for two agents in one file: a corrupted worktree and a broken live world
# (PARALLEL-WORKFLOW §11). `mkdir` is the atomic primitive available in sh —
# it succeeds for exactly one caller.
#
# Usage:  ./scripts/claim.sh <your-name>
#         ./scripts/claim.sh --stale [threshold-minutes]     report DOING rows by age
#         ./scripts/claim.sh --release <item-id> [your-name] force a stuck item back to TODO
#         ./scripts/claim.sh --touch <your-name>             re-stamp your claim, you are alive
#
# A STALE CLAIM IS INDISTINGUISHABLE FROM ACTIVE WORK, AND THAT IS ITEM 9d.
# Item 9 sat `DOING w1` after the desk stopped w1 — nothing could take it and
# nothing SAID so, because claim.sh only ever reported the queue empty, never
# WHY. Same class of bug as the lettered-rank fix above: the dispatcher could
# not see its own state. Two commands, not one, because they answer different
# questions — `--stale` is read-only (is anything stuck?), `--release` acts
# (un-stick it) — and conflating them would mean a report accidentally
# mutates the very state it is reporting on.
set -u
cd "$(dirname "$0")/.." || exit 1
# THE QUEUE IS SHARED, AND IT MUST NOT LIVE IN GIT.
#
# First cut kept it at notes/QUEUE.md. That is tracked, so every worktree gets
# its OWN copy — a builder claimed item 1 in its worktree, the main tree still
# read TODO, and a second builder would have claimed the same item. The mkdir
# lock was guarding a file nobody else could see. Caught within ten minutes of
# shipping it, by watching a real worker.
#
# So both scripts resolve to ONE path outside every worktree. `git rev-parse
# --git-common-dir` points at the shared .git for the whole repo, worktrees
# included, which is exactly the scope the queue needs.
COMMON=$(git rev-parse --git-common-dir 2>/dev/null) || COMMON=.git
case "$COMMON" in /*) ;; *) COMMON="$PWD/$COMMON";; esac
SHARED=$(dirname "$COMMON")/street/notes
# `$SHARED` is the MAIN tree's notes/, deliberately — see above. `$PWD` is this
# builder's OWN street/ (line 28 cd's there), and the two being different trees
# is the whole subject of the file-existence check further down.
MAIN_STREET=$(dirname "$SHARED")
# CLAIM_QUEUE is a TEST HOOK and nothing else: it lets the path check below be
# exercised end to end against a scratch queue with a deliberately-broken row,
# instead of vandalising the live one that three other builders are claiming
# from. The lock moves with it, so a test run cannot take the real queue's lock
# and stall the fleet.
Q="${CLAIM_QUEUE:-$SHARED/QUEUE.md}"
LOCK="$(dirname "$Q")/.queue.lock"
[ -f "$Q" ] || { echo "no queue at $Q"; exit 1; }

mode=${1:-}
[ -z "$mode" ] && { echo "usage: claim.sh <your-name>  |  claim.sh --stale [minutes]  |  claim.sh --release <item-id> [your-name]"; exit 2; }

# ── DOES THE ITEM'S NAMED FILE EXIST IN THE TREE YOU ARE STANDING IN? ──────
#
# Three items in one session named a file the builder could not find, and each
# cost a whole claim to discover. Two were the desk ranking against mainline
# while the builder held an older snapshot; one was a genuinely wrong filename
# (item 51 said `scripts/L-games-in-artifact.mjs`; the file is at
# `scripts/probes/L-games-in-artifact.mjs`, and `scripts/checks.mjs:857` has
# been printing that same wrong path for days).
#
# THIS DOES NOT REPLACE MEASURING. An item can name a file that exists and still
# be wrong about it — that happened on the very next claim, where item 47 named
# `ct/cars.ts` and every line of the work was actually in `crosstown.ts`. This
# only catches the case where the work cannot even begin, and it is a WARNING,
# never a failure: the item is already claimed by the time it runs, and exiting
# non-zero here would strand a DOING row with nobody told to pick it up.
#
# THE FILE COLUMN IS PROSE, NOT A PATH LIST. Real rows look like
#   `crosstown.ts:1125 (canSee) + groundPick`
#   `ct/cars.ts + crosstown.ts + fp.ts (read-only)`
#   `scripts/claim.sh (or a new ranking check)`
# so parentheticals are dropped, `+` and `,` are separators, a trailing `:1125`
# is stripped, and anything left without a file extension is prose and ignored.
#
# AND THE COLUMN USES SHORT NAMES. `ct/cars.ts` is really `src/proto/ct/cars.ts`
# and `crosstown.ts` is `src/proto/crosstown.ts`. A check that demanded exact
# paths would warn on nearly every row, and a warning that fires every time is
# one nobody reads. So a token resolves if any file's path ENDS with it, which
# accepts every short name in the queue today and still rejects
# `scripts/L-games-in-artifact.mjs` — no path ends with that.

# Every file in a tree, one per line, relative to it. `git ls-files` misses
# untracked work and `find` walks node_modules, so: tracked files plus
# untracked-but-not-ignored, which is exactly "files that are really there".
claim_tree_files() {
  ( cd "$1" 2>/dev/null && git ls-files --cached --others --exclude-standard 2>/dev/null )
}

# Resolve ONE token against a file list on stdin-substitute $2. Prints the
# resolved path, or nothing.
claim_resolve() {
  _tok=$1; _list=$2
  [ -e "$PWD/$_tok" ] && { printf '%s\n' "$_tok"; return 0; }
  # ends-with, anchored at a path separator so `cars.ts` cannot match
  # `supercars.ts`
  _hit=$(printf '%s\n' "$_list" | grep -E "(^|/)$(printf '%s' "$_tok" | sed 's/[.[\*^$]/\\&/g')\$" | head -2)
  [ -n "$_hit" ] && { printf '%s\n' "$_hit" | head -1; return 0; }
  return 1
}

claim_check_paths() {
  _col=$1
  # parentheticals out, separators to spaces
  _toks=$(printf '%s' "$_col" | sed 's/([^)]*)//g; s/[+,]/ /g')
  # street/, plus the repo root above it as `../…` — the queue does name
  # `CLAUDE.md`, which lives a level up. `street/` is dropped from the second
  # listing or every hit is reported twice, once by each spelling.
  _mine=$(claim_tree_files "$PWD"
    claim_tree_files "$PWD/.." | grep -v '^street/' | sed 's|^|../|')
  _main=''
  _bad=0; _out=''
  for _t in $_toks; do
    _t=${_t%%:*}                       # `fp.ts:446` -> `fp.ts`
    _t=$(printf '%s' "$_t" | sed 's/[.,;:`*]*$//; s/^[`*]*//')
    # A KNOWN EXTENSION, not merely "has a dot". `process.exit` and `r.status`
    # are prose about code and both matched a bare `\.[A-Za-z0-9]+$`; they were
    # two of the three warnings on the first sweep of the whole queue, and a
    # check that cries wolf twice in twenty-one rows is one nobody reads.
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
    # Not here. Is it in the MAIN tree? That is the "desk ranked against
    # mainline, builder holds a snapshot" case, and it has a different fix.
    [ -z "$_main" ] && _main=$(claim_tree_files "$MAIN_STREET")
    if [ "$MAIN_STREET" != "$PWD" ] && printf '%s\n' "$_main" \
      | grep -qE "(^|/)$(printf '%s' "$_t" | sed 's/[.[\*^$]/\\&/g')\$"; then
      _out="$_out
  MISSING   $_t
            It IS in the main tree but not in yours — your worktree is BEHIND.
            Fix: git reset --hard add-stick-and-city98 && (cd street && npm install)"
      continue
    fi
    # Same basename somewhere else? Then the item has a stale PATH, which is the
    # single most useful thing this check can say (item 51 was exactly this).
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
    # No exact basename. A NAME near it? `ct/bodega.ts` does not exist and
    # `ct/bodega-corner.ts` and `ct/int-bodega.ts` both do — that was a live
    # DOING row when this check was written, and naming the neighbours is what
    # turns "missing" into something the builder can act on.
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

# --check-paths: run just the resolver over a file(s) column, for testing it
# without claiming anything. Takes no lock and touches no queue.
if [ "$mode" = "--check-paths" ]; then
  claim_check_paths "${2:-}"
  exit 0
fi

# ── take the lock, and never leave it behind ──────────────────────────────
# All three modes below read or rewrite the shared file, so all three need it.
tries=0
until mkdir "$LOCK" 2>/dev/null; do
  tries=$((tries + 1))
  if [ "$tries" -gt 60 ]; then
    # A dead builder's lock must not stop the queue forever.
    echo "queue locked for 60s — assuming a dead holder and taking it"
    rm -rf "$LOCK"; mkdir "$LOCK" 2>/dev/null || exit 1
    break
  fi
  sleep 1
done
trap 'rm -rf "$LOCK"' EXIT INT TERM

# ── --stale: report every DOING row and its age, flag anything over the ────
# threshold (default 90 minutes — BUILDER-BRIEF's own items run smaller than
# that; GOTCHAS 18 flags a single TURN past 25 minutes with nothing
# committed, and a whole ITEM is coarser than a turn). Read-only: never
# rewrites the queue, so running it cannot itself create a stale claim.
#
# THE STAMP IS HH:MM, NO DATE (`date '+%H:%M'` at claim time) — a pre-existing
# format this does not change, only read. Minutes-since-midnight plus a
# same-day assumption is exactly right for how this fleet actually runs
# (items finish in minutes to a few hours, not days), and is wrong the moment
# a claim is genuinely more than 24h old — at which point it is obviously
# stale regardless, so the failure mode is "under-reports the age", never
# "reports fresh as stale".
if [ "$mode" = "--stale" ]; then
  threshold=${2:-90}
  # SAME CLOCK AS THE STAMP, on purpose — `date '+%s'` is UTC-based epoch
  # seconds and mixing it with the stamp's LOCAL `date '+%H:%M'` produced an
  # hours-wide phantom age on the very first sandbox run of this (a "5
  # minutes ago" claim read as 425 minutes stale). Reading now the same way
  # the stamp was written removes the timezone entirely instead of getting it
  # right once and hoping nobody moves the clock.
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
    # strip a leading zero — POSIX arithmetic reads a leading 0 as octal, and
    # "08"/"09" are not valid octal digits, so $((08)) is a hard error in
    # dash. ${v#0} is plain POSIX parameter expansion, portable everywhere.
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

# ── --release: force a specific item back to TODO, whoever holds it ────────
# The direct fix for item 9d's own repro: the desk stopped w1 mid-item, item
# 9 stayed DOING w1 forever, and nothing else could take it or say why.
# Unlike done.sh (which only releases the item ITS OWN caller holds, by
# design — a builder cannot confirm its own work OR release someone else's
# by accident) this is explicitly for the case the holder cannot release it
# itself, so it takes an item id, not a name-matched row.
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

# ── --touch: "I am still alive on this item" ───────────────────────────────
# The counterpart to the auto-reap below, and the thing that makes it safe. A
# genuinely long item — the collider work is scoped in four committed stages —
# would otherwise be indistinguishable from a dead holder at the 150m mark.
# Call it after each commit and your claim can never be reaped out from under
# you. Costs one line in a builder's loop; removes the only way auto-reap can
# hurt.
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

who=$mode

# ── REAP DEAD CLAIMS BEFORE PICKING, NOT ON A DESK TICK ────────────────────
#
# THIS HAS NOW COST THE PROJECT 221 MINUTES OF QUEUE TIME IN ONE DAY. Item 9
# sat DOING w1 for 85 minutes after the desk stopped w1, and then DOING w9 for
# 136 more after w9 died holding it. `--stale` and `--release` (item 9d) were
# built to fix exactly this and they work — but they are things the DESK has to
# remember to run, and the desk did not remember, twice. A recovery mechanism
# that depends on somebody noticing is not a recovery mechanism.
#
# So the reap happens here, in the path every builder already runs, every time.
# No tick, no desk, no noticing.
#
# WHY 150 MINUTES AND NOT THE 90 `--stale` REPORTS AT. They answer different
# questions. `--stale` is a human asking "is anything worth a look?" and 90m is
# right for that. This one ACTS, and acting wrongly means handing a live item to
# a second builder — two agents in one file is what corrupted a worktree and
# broke the live world (PARALLEL-WORKFLOW §11). So the acting threshold is
# deliberately well past the reporting one, and `--touch` above lets any builder
# on a genuinely long item opt out entirely.
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
  # An unparseable stamp is left ALONE, never reaped — the failure mode of a
  # reaper that guesses is worse than the one it is fixing.
  case "$hh$mm" in *[!0-9]*|'') continue;; esac
  hh=${hh#0}; mm=${mm#0}
  age=$((now_min - (hh * 60 + mm)))
  [ "$age" -lt 0 ] && age=$((age + 1440))
  if [ "$age" -ge "$REAP_MIN" ]; then
    sed -i "${ln}s/| *DOING [^|]* *|/| TODO |/" "$Q"
    echo "reaped item $item — $holder held it ${age}m with no --touch; back to TODO"
  fi
done

# ── the top TODO row, if any ──────────────────────────────────────────────
# `[0-9]*` MISSED EVERY LETTERED RANK. The desk inserts urgent items as 0a, 5b,
# 6b … so a new item can jump the queue without renumbering rows other builders
# are holding. That is a good scheme and this pattern could not see any of them:
# eleven TODO items, all lettered, and claim.sh reported the queue EMPTY. Four
# builders were spawned onto nothing. Match a digit-run with an optional letter.
row=$(grep -n '^| *[0-9]*[a-z]* *| *TODO *|' "$Q" | head -1)
if [ -z "$row" ]; then
  held=$(grep -c '^| *[0-9]*[a-z]* *| *DOING' "$Q" 2>/dev/null); held=${held:-0}
  echo "QUEUE EMPTY — nothing unclaimed."
  [ "$held" -gt 0 ] && echo "($held item(s) still held by other builders.)"
  echo "Say so and stop. Do not invent work."
  exit 3
fi

ln=${row%%:*}
num=$(printf '%s' "$row" | sed 's/^[0-9]*:| *\([0-9a-z]*\) *|.*/\1/')

# mark it DOING, stamped with who and when — one sed, inside the lock
stamp="DOING $who $(date '+%H:%M')"
sed -i "${ln}s/| *TODO *|/| $stamp |/" "$Q" || exit 1

echo "=== claimed item $num ==="
sed -n "${ln}p" "$Q" | sed 's/^| *[0-9a-z]* *| *[^|]* *|/  file(s):/' | sed 's/ *| */\n  /'
echo
# Does what it names actually exist here? A warning, never a failure — the row
# is already DOING by now.
claim_check_paths "$(sed -n "${ln}p" "$Q" | awk -F'|' '{print $4}')" || true
echo "  Rules for HOW: notes/BUILDER-BRIEF.md (read it once)"
echo "  Your port:     pick a free one in 4180-4199, and always pass SHOT_URL"
echo "  When finished: ./scripts/done.sh $who \"<one line on what you did>\""
echo "  Then claim again. Commit as you go — killed agents keep only commits."
