#!/usr/bin/env bash
# ── ARE YOU EDITING FILES THE QUEUE HAS GIVEN YOU? ────────────────────────
#
#   scripts/ownership.sh <your-queue-name>     # e.g. onehundrednineteen
#   scripts/ownership.sh --selftest            # prove it can go red
#
# WHAT THIS USED TO DO, AND WHY IT WAS WRONG (queue item 244).
#
# It checked your diff against `notes/OWNERSHIP.md` — a table of single letters,
# `C`, `F`, `J`, one per module. **CLAUDE.md marks that file DEMOTED, history
# only:** *"It names which agent LAST HELD a file … and NONE OF THEM IS RUNNING.
# It is not a permission list … the queue grants files now."* So this script was
# telling builders that `ct/atm.ts` "is owned by K, not you" when K had not
# existed for weeks, and the project record is emphatic about the cost — reading
# that table as authority *"cost the first worker on the self-serve queue its
# entire wave: three items released un-actioned in eleven minutes."* A guard that
# re-creates the exact failure the documentation was rewritten to prevent is
# worse than no guard. Worker eightynine hit it and correctly ignored it; the
# next builder might not.
#
# WHAT IT DOES NOW. Your legitimate files are **the ones your claimed row
# names** (BUILDER-BRIEF §9: "The item names a file → it is yours"). So this
# reads the SHARED QUEUE, finds the rows you are holding, and resolves their
# file column.
#
# THREE ANSWERS, AND ONLY TWO OF THEM ARE FAULTS — because §9 is a REPORTING
# obligation, not a prohibition:
#
#   ✗ CONFLICT  you changed a file another builder's live DOING row names.
#               That is the one case §9 forbids outright ("Another builder holds
#               an item naming the same file → skip it"), and it is what broke
#               the live world and corrupted a third worktree.      → exit 1
#   ✗ NO CLAIM  you changed world code (`src/proto/**`) holding no row at all.
#               Nothing grants you those files.                     → exit 1
#   · REPORT    you changed world code your own row does not name, and nobody
#               else holds it. That is legitimate and NORMAL — say it in your
#               `done.sh` line. §9 calls reporting it "a success".  → exit 0
#
# SCOPE IS `src/proto/**`, deliberately, and unchanged from the old script.
# Instruments (`scripts/`), notes and shots are a builder's own by the brief —
# every item produces a probe and a handoff note, so flagging them would make
# this fire every single run, and a warning that always fires is one nobody
# reads. World code is where the cost has actually been paid.
#
# IT NEVER READS `notes/OWNERSHIP.md`. Not to soften it, not to cross-check it.
# The file stays on disk as history; this script stops treating it as law.
set -u

cd "$(dirname "$0")/.." || exit 1
CLAIM=scripts/claim.sh

# ── WHERE THE SHARED QUEUE IS ─────────────────────────────────────────────
#
# A COPY, CITED, NOT A SECOND GUESS: this is `scripts/claim.sh:41-52` verbatim
# in effect — `git rev-parse --git-common-dir` points at the ONE `.git` that all
# worktrees share, so `<repo>/street/notes/QUEUE.md` is the same file every
# builder claims from. The queue must NOT be read out of your own worktree: it
# is untracked there on purpose, and a per-worktree copy is exactly the bug
# claim.sh's header describes (two builders claiming one item).
#
# BUILDER-BRIEF §8 says derive rather than retype, and I could not: claim.sh
# publishes no "where is the queue" mode, and `scripts/claim.sh` is not a file
# item 244 names. **Follow-up queued in the handoff note: give claim.sh a
# `--where` mode and have this call it.** Until then the citation is the thing
# that keeps the two honest.
#
# `OWNERSHIP_QUEUE` is a TEST HOOK and nothing else — the same shape and the
# same reason as claim.sh's `CLAIM_QUEUE`. `--selftest` points it at a scratch
# queue so the red paths can be watched without touching the live one.
COMMON=$(git rev-parse --git-common-dir 2>/dev/null) || COMMON=.git
case "$COMMON" in /*) ;; *) COMMON="$PWD/$COMMON";; esac
Q="${OWNERSHIP_QUEUE:-$(dirname "$COMMON")/street/notes/QUEUE.md}"

BASE=add-stick-and-city98

# ── the file column of a row, resolved to real paths ──────────────────────
#
# THE COLUMN IS PROSE, NOT A PATH LIST — `ct/cars.ts + crosstown.ts (read-only)`,
# `crosstown.ts:1125 (canSee)`, or a whole sentence with two filenames in it.
# `claim.sh --check-paths` already owns that parser: parentheticals dropped,
# `+`/`,` as separators, a trailing `:1125` stripped, short names resolved by
# suffix against the real tree. It takes no lock and rewrites nothing.
#
# So this SHELLS OUT to it rather than growing a second parser that would drift.
# Its `ok` lines are the contract being read:
#     "  ok        ownership.sh  ->  scripts/ownership.sh"
#     "  ok        src/proto/ct/atm.ts"
# Paths come back relative to `street/`, except repo-root files, which come back
# as `../CLAUDE.md`. Both are normalised to repo-root-relative here, which is
# what `git diff --name-only` speaks.
resolve_column() {
  sh "$CLAIM" --check-paths "$1" 2>/dev/null \
    | sed -n 's/^  *ok  *//p' \
    | sed 's/.*->  *//' \
    | sed 's/[[:space:]]*$//' \
    | awk '{ if ($0 ~ /^\.\.\//) { sub(/^\.\.\//, ""); print } else print "street/" $0 }' \
    | sort -u
}

# Rows a given name is holding. `| <id> | DOING <name> HH:MM | <files> | …` is
# the shape claim.sh writes; the file column is the fourth pipe-delimited field
# (the first is empty, before the leading `|`).
rows_for() {
  grep -E "^\| *[0-9]+ *\| *DOING +$1( |\|)" "$Q" 2>/dev/null | awk -F'|' '{print $4}'
}
# Everyone else's live rows, as "name<TAB>column".
rows_for_others() {
  grep -E "^\| *[0-9]+ *\| *DOING +" "$Q" 2>/dev/null \
    | awk -F'|' -v me="$1" '{ n = $3; gsub(/^ *DOING +/, "", n); sub(/ .*$/, "", n);
                              if (n != me) print n "\t" $4 }'
}

check() {
  ME=$1
  [ -f "$Q" ] && : || { echo "  no queue at $Q — nothing grants any file. Is this a worktree of the repo?"; return 2; }

  held_rows=$(rows_for "$ME")
  mine=''
  if [ -n "$held_rows" ]; then
    while IFS= read -r col; do
      [ -z "$col" ] && continue
      mine="$mine
$(resolve_column "$col")"
    done <<EOF
$held_rows
EOF
  fi
  mine=$(printf '%s\n' "$mine" | grep -v '^[[:space:]]*$' | sort -u)

  # CHANGED: your branch against the base, plus anything not yet committed and
  # anything not yet added. Unchanged from the old script — it was the one part
  # of it that was right.
  if [ -n "${OWNERSHIP_CHANGED:-}" ]; then
    changed=$OWNERSHIP_CHANGED
  else
    changed=$( { git diff --name-only "$BASE"...HEAD 2>/dev/null
                 git diff --name-only 2>/dev/null
                 git ls-files -o --exclude-standard 2>/dev/null; } | sort -u )
  fi
  changed=$(printf '%s\n' "$changed" | grep '^street/src/proto/' | sort -u)

  if [ -z "$held_rows" ]; then
    if [ -z "$changed" ]; then
      echo "  · you hold no queue item, and you have changed no world code. Nothing to check."
      return 0
    fi
    echo "  ✗ YOU HOLD NO QUEUE ITEM, and world code is changed:"
    printf '%s\n' "$changed" | sed 's/^/      /'
    echo
    # THE COMMONEST WAY TO LAND HERE IS THE OLD CALLING CONVENTION. This script
    # took a LETTER for months (`ownership.sh B`), and every note in the archive
    # that quotes it uses one. A letter is nobody's queue name, so it looks
    # exactly like an unclaimed builder — and telling someone "claim a row" when
    # they already hold one would be the same species of wrong answer this item
    # exists to delete.
    case "$ME" in
      [A-Za-z] | [A-Z][A-Z] | [A-Z][A-Z][A-Z] | DESK | desk)
        echo "  …but '$ME' is a LETTER, and letters are the retired notes/OWNERSHIP.md"
        echo "  scheme — none of those agents is running. Pass the name you give"
        echo "  claim.sh/done.sh instead (e.g. onehundrednineteen).";;
      *)
        echo "  The queue grants files now (BUILDER-BRIEF §9). Claim the row that"
        echo "  names them:  ./scripts/claim.sh <your-name>";;
    esac
    return 1
  fi

  echo "  your live row(s) name:"
  if [ -z "$mine" ]; then
    # MEASURED, NOT HYPOTHETICAL: of the 5 rows DOING on 2026-08-03 at 15:00,
    # TWO carried no resolvable filename at all — 289's column is the SYMPTOM
    # ("the loan officer is 7 cm outside seated reach") and 291's is the user's
    # quote. That is the desk's row being thin, not the builder being out of
    # bounds, so it must not read as a fault: everything below will land as
    # OUTSIDE, which is a §9 reporting obligation and nothing worse.
    echo "      (nothing — this row's file column names no file that exists.)"
    echo "      That is the ROW being thin, not you. Everything below is reported,"
    echo "      not refused; name what you touched in your done.sh line."
  else printf '%s\n' "$mine" | sed 's/^/      /'; fi
  echo

  if [ -z "$changed" ]; then echo "  ✓ no world code changed."; return 0; fi

  others=$(rows_for_others "$ME")
  conflicts=0; outside=0
  for f in $changed; do
    if printf '%s\n' "$mine" | grep -qxF "$f"; then continue; fi
    who=''
    if [ -n "$others" ]; then
      while IFS="$(printf '\t')" read -r n col; do
        [ -z "${col:-}" ] && continue
        if resolve_column "$col" | grep -qxF "$f"; then who=$n; break; fi
      done <<EOF
$others
EOF
    fi
    if [ -n "$who" ]; then
      echo "  ✗ CONFLICT  $f"
      echo "              is named by a row $who is holding RIGHT NOW. §9: skip it,"
      echo "              take the next. A cross-builder conflict costs ten minutes"
      echo "              plus a broken world; a queued one-liner costs one."
      conflicts=$((conflicts + 1))
    else
      echo "  · OUTSIDE YOUR ROW  $f"
      outside=$((outside + 1))
    fi
  done

  if [ "$outside" -gt 0 ]; then
    echo
    echo "  $outside file(s) your row does not name and NOBODY else holds. That is"
    echo "  legitimate — §9 makes it a REPORTING obligation, not a prohibition."
    echo "  Name them in your ./scripts/done.sh line. Reporting it is a success."
  fi
  if [ "$conflicts" -gt 0 ]; then
    echo
    echo "  $conflicts file(s) belong to a LIVE claim that is not yours. Stop."
    return 1
  fi
  if [ "$outside" -eq 0 ]; then echo "  ✓ every changed source file is named by a row you hold."; fi
  return 0
}

# ── --selftest: watch it go red, in both signs ────────────────────────────
#
# A guard nobody has watched fail is indistinguishable from one that works
# (`scripts/checks-can-fail.mjs` exists for exactly that), and this script's
# whole history is a guard that was confidently wrong for weeks. So it drives a
# SCRATCH queue — never the live one, which five builders are claiming from —
# and asserts the exit code of every answer, red AND green.
#
# The rows are real rows in the real format and the file column is real prose
# with a real filename inside it, so the `claim.sh --check-paths` hand-off is
# exercised rather than stubbed.
if [ "${1:-}" = "--selftest" ]; then
  T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
  cat > "$T/QUEUE.md" <<'ROWS'
| id | status | file(s) | what |
|---|---|---|---|
| 900 | DOING alice 10:00 | ct/atm.ts — the machine | do a thing |
| 901 | DOING bob 10:01 | ct/hud.ts — the panel | do another thing |
| 902 | TODO | ct/slots.ts | unclaimed |
ROWS
  pass=0; fail=0
  t() { # t <expect-exit> <label> <who> <changed>
    OWNERSHIP_QUEUE="$T/QUEUE.md" OWNERSHIP_CHANGED="$4" sh "$0" "$3" >"$T/out" 2>&1
    got=$?
    if [ "$got" = "$1" ]; then echo "  ok    $2 (exit $got)"; pass=$((pass+1))
    else echo "  FAIL  $2 — expected exit $1, got $got"; sed 's/^/          /' "$T/out"; fail=$((fail+1)); fi
  }
  echo "ownership.sh --selftest, against a scratch queue:"
  t 0 'GREEN: a file your own row names'                    alice 'street/src/proto/ct/atm.ts'
  t 1 'RED:   a file ANOTHER live row names'                alice 'street/src/proto/ct/hud.ts'
  t 0 'AMBER: world code nobody holds — reported, not refused' alice 'street/src/proto/ct/slots.ts'
  t 1 'RED:   world code changed while holding NO row'      carol 'street/src/proto/ct/atm.ts'
  t 0 'GREEN: no row, and no world code touched'            carol 'street/scripts/probe.mjs'
  echo
  if [ "$fail" -gt 0 ]; then echo "$fail FAILED"; exit 1; fi
  echo "all $pass pass — it goes red on the two faults and stays green on the three that are not"
  exit 0
fi

ME=${1:-}
[ -z "$ME" ] && {
  echo "usage: ownership.sh <your-queue-name>     e.g. ownership.sh onehundrednineteen"
  echo "       ownership.sh --selftest"
  echo
  echo "  The name is the one you pass to claim.sh/done.sh — NOT a letter."
  echo "  Single letters (C, F, J) were the old notes/OWNERSHIP.md table, and"
  echo "  none of those agents is running; the queue grants files now."
  exit 2
}
check "$ME"
