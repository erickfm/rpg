#!/bin/sh
# Item 56's acceptance test: run door301.mjs N times in a row under a CPU
# throttle and report how many passed. A flake is a rate, not an event, so the
# only honest verdict is a consecutive run count.
#
#   SHOT_URL=http://localhost:<port>/ sh scripts/probes/w28-door301-soak.sh [N] [rate]
#
# Screenshots are off for the soak (DOOR301_NOSHOTS): no verdict in door301.mjs
# is a screenshot, and at high throttle the headless software rasteriser dies
# capturing a 1280x720 WebGL frame and takes the browser with it — which would
# measure Chromium's GPU emulation rather than the door.
set -u
cd "$(dirname "$0")/../.." || exit 1
N=${1:-10}
RATE=${2:-4}
: "${SHOT_URL:?set SHOT_URL to your own server}"

pass=0; fail=0; i=1
while [ "$i" -le "$N" ]; do
  out=$(DOOR301_NOSHOTS=1 DOOR301_CPU="$RATE" node scripts/door301.mjs 2>&1)
  code=$?
  frames=$(printf '%s' "$out" | grep -c 'moved=true')
  if [ "$code" -eq 3 ]; then
    # Nothing was measured — GOTCHAS §32. Counting this as a red is how a soak
    # reports a flake that is really a dead server, which is the mistake this
    # whole item is about. It does not count either way; the run is retaken.
    printf 'run %2d  ABORTED (nothing serving) — not counted, retaking\n' "$i"
    continue
  fi
  if [ "$code" -eq 0 ]; then
    pass=$((pass + 1)); printf 'run %2d  PASS  (%s presses saw the leaf move)\n' "$i" "$frames"
  else
    fail=$((fail + 1)); printf 'run %2d  FAIL  exit=%s\n' "$i" "$code"
    printf '%s\n' "$out" | grep -E '^  FAIL|Error' | head -5 | sed 's/^/         /'
  fi
  i=$((i + 1))
done
printf '\n  %d/%d passed at CPU x%s.\n' "$pass" "$N" "$RATE"
[ "$fail" -eq 0 ] || exit 1
