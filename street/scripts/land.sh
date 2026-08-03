#!/usr/bin/env bash
# The merge train: land every builder that is green, in one pass.
#
# Rebases each builder branch onto mainline, fast-forwards it in, and typechecks
# after EACH one so a break is attributed to the builder that caused it rather
# than discovered at the end. A builder that conflicts or breaks the build is
# skipped and reported — the train does not stop for it.
#
# Usage:  scripts/land.sh          land everything green
#         scripts/land.sh --dry    report what would land, change nothing
set -u
ROOT=/home/erick/projects
MAIN=$ROOT/rpg
BASE=add-stick-and-city98
DRY=${1:-}

cd "$MAIN" || exit 1
tsc_ok() { ( cd "$MAIN/street" && npx --no-install tsc --noEmit >/dev/null 2>&1 ); }

if ! tsc_ok; then
  echo "REFUSING TO LAND: mainline is already broken. Fix it first."
  exit 1
fi

landed=(); skipped=(); nothing=()

# TWO worktree conventions exist and the train must see BOTH.
#
# `$ROOT/rpg-*` is the original one: sibling checkouts, created by hand. It was
# the only one when this script was written, so the loop below globbed it and
# stopped there.
#
# `.claude/worktrees/agent-*` is where every agent launched with worktree
# isolation actually lands, and the train was BLIND TO ALL OF THEM. That is not
# a cosmetic gap: a finished worker's ten commits sat unlanded and invisible
# while `land.sh --dry` cheerfully reported "NOTHING TO LAND", because the only
# two directories it could see genuinely had nothing. The desk trusted the
# report. Discover both, or the train silently strands the fleet's actual work.
wts=()
for wt in "$ROOT"/rpg-* "$MAIN"/.claude/worktrees/agent-*; do
  [ -d "$wt" ] && wts+=("$wt")
done

for wt in "${wts[@]}"; do
  [ -d "$wt" ] || continue
  case "$(basename "$wt")" in rpg-live) continue;; esac
  b=$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null) || continue
  [ "$b" = "$BASE" ] && continue

  dirty=$(git -C "$wt" status --porcelain | grep -vc node_modules)
  ahead=$(git -C "$wt" log --oneline "$BASE..$b" 2>/dev/null | wc -l)
  if [ "$ahead" -eq 0 ]; then nothing+=("$(basename "$wt")"); continue; fi
  if [ "$dirty" -gt 0 ]; then
    skipped+=("$(basename "$wt") [uncommitted work — ask it to commit]"); continue
  fi

  if [ "$DRY" = "--dry" ]; then landed+=("$(basename "$wt") ($ahead commits)"); continue; fi

  before=$(git rev-parse HEAD)
  if ! git -C "$wt" rebase "$BASE" >/dev/null 2>&1; then
    git -C "$wt" rebase --abort >/dev/null 2>&1
    skipped+=("$(basename "$wt") [CONFLICTS with mainline — its owner must resolve]")
    continue
  fi
  if ! git merge --ff-only "$b" >/dev/null 2>&1; then
    git merge --no-edit "$b" >/dev/null 2>&1 || { git merge --abort >/dev/null 2>&1; \
      skipped+=("$(basename "$wt") [merge failed]"); continue; }
  fi
  if tsc_ok; then
    landed+=("$(basename "$wt") ($ahead commits)")
  else
    git reset -q --hard "$before"
    skipped+=("$(basename "$wt") [merged but BROKE THE BUILD — reverted]")
  fi
done

echo
[ ${#landed[@]}   -gt 0 ] && printf 'LANDED:\n'  && printf '  ✓ %s\n' "${landed[@]}"
[ ${#skipped[@]}  -gt 0 ] && printf 'SKIPPED:\n' && printf '  ✗ %s\n' "${skipped[@]}"
[ ${#nothing[@]}  -gt 0 ] && printf 'NOTHING TO LAND: %s\n' "${nothing[*]}"
if [ "$DRY" != "--dry" ]; then
  ( cd "$MAIN/street" && npm run build 2>&1 | grep -E '✓ built|error' )
fi

# ARE THE GUARDS AWAKE? The merge train typechecks and nothing more, so a check
# that has stopped detecting the thing it guards lands green and stays green.
# Five were reported asleep at once and NOBODY WOULD HAVE LEARNED IT FROM A
# BOARD — checks.mjs does not run canfail and this script did not read it.
#
# canfail is far too slow to gate a land (a build and a browser per case), so
# this REPORTS rather than blocks: how stale the last full run is, what it
# said, and loudly if it has never run here. A number you can see is the
# difference between a guard that sleeps for an hour and one that sleeps for a
# week.
echo
if [ -f "$MAIN/street/.canfail-last.json" ]; then
  node -e '
    const j = require("'"$MAIN"'/street/.canfail-last.json");
    const age = (Date.now() - Date.parse(j.when)) / 36e5;
    const stale = age > 24;
    console.log(`GUARDS: ${j.caught}/${j.total} caught their mutation` +
      `  (${age < 1 ? Math.round(age * 60) + " min" : age.toFixed(0) + " h"} ago, build ${j.build})`);
    if (j.asleep?.length)     console.log(`  ASLEEP: ${j.asleep.join(", ")} — these guard nothing right now`);
    if (j.unprovable?.length) console.log(`  UNSCORED: ${j.unprovable.join(", ")}`);
    if (stale)                console.log(`  STALE — older than a day. cd street && ./scripts/guards.sh`);
  ' 2>/dev/null || echo "GUARDS: .canfail-last.json unreadable"
else
  echo "GUARDS: canfail has NEVER run here — no idea whether any guard still detects."
  echo "        cd street && ./scripts/guards.sh     # builds, serves, aims, tears down"
fi
echo
