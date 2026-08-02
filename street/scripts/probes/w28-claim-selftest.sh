#!/bin/sh
# THE CLAIM: claiming an item whose named file is absent prints a clear warning
# naming the missing path — item 52's DONE WHEN — and claiming one whose files
# are all present does not.
#
# It runs a REAL claim, lock and all, against a scratch queue built here rather
# than against the live one three other builders are claiming from. That is what
# `CLAIM_QUEUE` exists for; there is no other way to exercise the end-to-end path
# without vandalising shared state.
#
#   sh scripts/probes/w28-claim-selftest.sh
#
# Exit codes are the house convention: 0 fine, 1 wrong.
set -u
cd "$(dirname "$0")/../.." || exit 1

T=$(mktemp -d) || exit 1
trap 'rm -rf "$T"' EXIT INT TERM
Q="$T/QUEUE.md"

mk() {   # mk <id> <files column>
  printf '| %s | TODO | %s | a scratch row, never landed |\n' "$1" "$2" >> "$Q"
}
printf '# scratch queue\n\n| # | state | file(s) | what |\n|---|---|---|---|\n' > "$Q"
mk 90 'scripts/claim.sh + ct/cars.ts'                 # both real, one short-named
mk 91 'scripts/L-games-in-artifact.mjs'               # real file, STALE PATH
mk 92 'ct/bodega.ts'                                  # no such NAME, neighbours exist
mk 93 'ct/utterly-invented-by-the-desk.ts'            # nothing like it anywhere

bad=0
say() { [ "$1" = 0 ] && printf 'OK    %s\n' "$2" || { printf 'FAIL  %s\n' "$2"; bad=$((bad + 1)); }; }
has() { printf '%s' "$1" | grep -q "$2"; }

out=$(CLAIM_QUEUE="$Q" ./scripts/claim.sh w28-selftest 2>&1)
has "$out" 'claimed item 90' && r=0 || r=1; say $r 'it still claims the top item'
has "$out" 'NAMES A FILE THAT IS NOT THERE' && r=1 || r=0
say $r 'an item whose files ALL exist raises no warning — the check is quiet when it should be'
has "$out" 'ok        ct/cars.ts  ->  src/proto/ct/cars.ts' && r=0 || r=1
say $r 'and it resolves the queue short names (ct/cars.ts -> src/proto/ct/cars.ts)'

out=$(CLAIM_QUEUE="$Q" ./scripts/claim.sh w28-selftest 2>&1)
has "$out" 'NAMES A FILE THAT IS NOT THERE' && r=0 || r=1
say $r 'A DELIBERATELY-BROKEN ROW TRIGGERS THE WARNING (item 52 DONE WHEN)'
has "$out" 'MISSING   scripts/L-games-in-artifact.mjs' && r=0 || r=1
say $r 'and the warning NAMES THE MISSING PATH'
# The two lines TOGETHER, not the path alone. On its own this passed under a
# mutation that made the resolver match on basename — the path then appeared in
# an `ok  … ->  …` line, so the assertion was satisfied by the check SLEEPING.
printf '%s' "$out" | grep -A2 'PATH is stale' | grep -q 'scripts/probes/L-games-in-artifact.mjs' && r=0 || r=1
say $r 'and says where the file actually is — a stale PATH, not a missing file'

out=$(CLAIM_QUEUE="$Q" ./scripts/claim.sh w28-selftest 2>&1)
has "$out" 'Did the item mean one of' && r=0 || r=1
say $r 'a name with no exact match suggests its neighbours (ct/bodega.ts)'
has "$out" 'bodega-corner.ts' && r=0 || r=1
say $r 'and names them'

out=$(CLAIM_QUEUE="$Q" ./scripts/claim.sh w28-selftest 2>&1)
has "$out" 'No file of that name anywhere in this tree' && r=0 || r=1
say $r 'and an invented filename says exactly that, with no misleading suggestion'

# The warning must never take the item away from the builder: it is advisory,
# and a non-zero exit here would strand a DOING row (see claim.sh's own note).
CLAIM_QUEUE="$Q" ./scripts/claim.sh w28-selftest >/dev/null 2>&1
[ $? -ne 2 ] && r=0 || r=1
say $r 'the warning is ADVISORY — a bad path does not fail the claim'

# And the live queue was never touched.
grep -q 'w28-selftest' "$(git rev-parse --git-common-dir | sed 's|/\?\.git$||')/street/notes/QUEUE.md" \
  && r=1 || r=0
say $r 'the LIVE queue was not touched by any of the above'

printf '\n%s\n' "$([ $bad = 0 ] && echo '  all checks pass.' || echo "  $bad FAILED.")"
exit $([ $bad = 0 ] && echo 0 || echo 1)
