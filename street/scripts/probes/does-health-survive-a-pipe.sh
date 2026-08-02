#!/bin/sh
# Does health.mjs's verdict survive being piped, and does the STATUS survive it?
#
# `process.exit()` can truncate a pending stdout write when stdout is a pipe, and
# `$?` after a pipeline is the LAST command's status — both are documented traps
# in this repo (BUILDER-BRIEF §7, "beware the instrument"). health.mjs sets
# `process.exitCode` rather than calling `process.exit` for the first reason, so
# this exists to show the second one is not hiding the first.
#
# Usage:  SHOT_URL=http://localhost:<dead page>/ sh scripts/probes/does-health-survive-a-pipe.sh
set -u
cd "$(dirname "$0")/../.." || exit 1

out=$(node scripts/health.mjs | tail -5)
st=${PIPESTATUS:-}
# POSIX sh has no PIPESTATUS; take the status the honest way instead.
node scripts/health.mjs > /tmp/w31-piped.out 2>/dev/null
direct=$?

echo "piped stdout (tail -5):"
echo "$out" | sed 's/^/    /'
echo
echo "verdict line present in a REDIRECTED run:"
grep -c 'WORLD ' /tmp/w31-piped.out | sed 's/^/    matches: /'
echo "exit status of the redirected run: $direct"
