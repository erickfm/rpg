#!/bin/sh
# Prove scripts/supersede.sh before it is pointed at the real queue.
#
# FIVE CASES, and the last three are the ones that matter — a writer that
# cannot refuse is worse than no writer. Uses CLAIM_QUEUE, the same test hook
# claim.sh, done.sh and add.sh honour, so nothing here can reach QUEUE.md.
#
#   sh scripts/probes/w77-supersede-selftest.sh
set -u
cd "$(dirname "$0")/../.." || exit 1
SQ=$(mktemp -d)/QUEUE.md
fails=0
say() { if [ "$1" = 0 ]; then printf '  OK   %s\n' "$2"; else fails=$((fails + 1)); printf '  FAIL %s\n' "$2"; fi; }

fresh() {
  cat > "$SQ" <<'EOF'
# scratch queue — w77-supersede-selftest
| id | status | files | what |
|---|---|---|---|
| 300 | TODO | ct/a.ts | a row with a | pipe | inside it |
| 301 | DOING somebody 12:00 | ct/b.ts | a live builder holds this |
| 302 | TODO | ct/c.ts | the replacement |
| 303 | DONE somebody — did it | ct/d.ts | finished |
EOF
}
row() { grep -E "^\| *$1 *\|" "$SQ"; }
status() { row "$1" | awk -F'|' '{print $3}' | sed 's/^ *//; s/ *$//'; }

# 1. the happy path
fresh
CLAIM_QUEUE="$SQ" sh scripts/supersede.sh 300 302 >/dev/null 2>&1
[ "$(status 300)" = "SUPERSEDED by 302" ]; say $? "a TODO row becomes 'SUPERSEDED by 302' (got '$(status 300)')"

# 2. THE REST OF THE ROW SURVIVES, pipes and all — the first version of the
#    awk left the old status in the tail and this is what caught it.
echo "$(row 300)" | grep -q 'a row with a | pipe | inside it' \
  && ! echo "$(row 300)" | grep -q 'TODO'
say $? "the files and what cells are untouched, embedded pipes included, and TODO is gone"

# 3. every other row is byte-identical
fresh; before=$(md5sum < "$SQ")
CLAIM_QUEUE="$SQ" sh scripts/supersede.sh 300 302 >/dev/null 2>&1
after=$(grep -vE '^\| *300 *\|' "$SQ" | md5sum)
fresh; expect=$(grep -vE '^\| *300 *\|' "$SQ" | md5sum)
[ "$after" = "$expect" ]; say $? "no other row changed"

# ── the refusals ─────────────────────────────────────────────────────────
# 4. a DOING row belongs to a live builder
fresh
CLAIM_QUEUE="$SQ" sh scripts/supersede.sh 301 302 >/dev/null 2>&1
[ $? -ne 0 ] && [ "$(status 301)" = "DOING somebody 12:00" ]
say $? "REFUSES a DOING row and leaves it alone"

# 5. and a DONE row, and an unknown id, and a target that does not exist yet
CLAIM_QUEUE="$SQ" sh scripts/supersede.sh 303 302 >/dev/null 2>&1; a=$?
CLAIM_QUEUE="$SQ" sh scripts/supersede.sh 999 302 >/dev/null 2>&1; b=$?
CLAIM_QUEUE="$SQ" sh scripts/supersede.sh 300 998 >/dev/null 2>&1; c=$?
CLAIM_QUEUE="$SQ" sh scripts/supersede.sh 300 300 >/dev/null 2>&1; d=$?
[ "$a" -ne 0 ] && [ "$b" -ne 0 ] && [ "$c" -ne 0 ] && [ "$d" -ne 0 ]
say $? "REFUSES a DONE row ($a), an unknown id ($b), a target not in the queue ($c), and itself ($d)"

# 6. and after all that refusing, the scratch queue still has its 4 rows
n=$(grep -cE '^\| *[0-9]+[a-z]? *\|' "$SQ")
[ "$n" = 4 ]; say $? "the queue still has all 4 rows after 4 refusals (got $n)"

rm -rf "$(dirname "$SQ")"
[ "$fails" = 0 ] && echo "PASS" || echo "FAIL — $fails"
exit "$fails"
