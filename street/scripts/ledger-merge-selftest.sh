#!/usr/bin/env bash
# The resolver has failed SILENTLY twice - once losing one row's evidence, once
# losing four passes at a stroke - and both times the file still read plausibly
# afterwards. A resolver whose failure mode is "looks fine" needs a test.
set -u
cd "$(dirname "$0")/.."
T=$(mktemp)
cat > "$T" <<'FIX'
| CONFIRMED | A | some untouched row | fine |
<<<<<<< HEAD
| CONFIRMED | B | a row mainline confirmed earlier | builder text v2 — **AUDITOR CONFIRMED old segment.** |
| LANDED | C | a row only mainline has | builder text |
| CONFIRMED | E | a row a NON-auditor verified | builder text |
=======
| CONFIRMED | B | a row mainline confirmed earlier | builder text v1 — **AUDITOR CONFIRMED old segment.** — **AUDITOR CONFIRMED my NEW segment.** |
| CONFIRMED | D | a row only I have | — **AUDITOR CONFIRMED mine alone.** |
| CONFIRMED | E | a row a NON-auditor verified | builder text — **2nd VERIFIER (A) CONFIRMED: the verifier segment.** |
>>>>>>> abc1234 (my commit)
FIX
python3 scripts/ledger-merge.py "$T" > /dev/null
fail=0
chk(){ if eval "$2"; then echo "  ok   $1"; else echo "  FAIL $1"; fail=1; fi; }
chk "mainline's newer builder text kept"  "grep -q 'builder text v2' '$T'"
chk "my new evidence appended"            "grep -q 'my NEW segment' '$T'"
chk "shared segment not duplicated"       "[ \$(grep -o 'old segment' '$T' | wc -l) -eq 1 ]"
chk "the row appears exactly once"        "[ \$(grep -c 'a row mainline confirmed earlier' '$T') -eq 1 ]"
chk "a row only I have is kept"           "grep -q 'mine alone' '$T'"
chk "a row only mainline has is kept"     "grep -q 'a row only mainline has' '$T'"
# THE BUG THIS FILE WAS WRITTEN AFTER, ONE LAYER DOWN: segments were matched
# on the literal " — **AUDITOR", so an append by any OTHER verifier returned no
# segments at all and was dropped whole. Three of A's verifier accounts went
# that way in one session. A ledger with one recognised author is not a ledger.
chk "a NON-auditor verifier segment survives" "grep -q '2nd VERIFIER (A) CONFIRMED: the verifier segment' '$T'"
chk "no markers left"                     "! grep -q '^<<<<<<<' '$T'"
rm -f "$T"
[ $fail -eq 0 ] && echo "PASS" || echo "FAIL"
exit $fail
