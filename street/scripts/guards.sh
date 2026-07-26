#!/usr/bin/env bash
# ARE THE GUARDS AWAKE? One line, and it aims itself.
#
#     ./scripts/guards.sh              # every case
#     ./scripts/guards.sh density      # one case
#
# canfail breaks a guarded thing in source, rebuilds, and checks that the guard
# goes red. That only means anything if the world it measures was built from the
# tree it just mutated — and until now it defaulted to :4177, which on a machine
# with nine builders is whoever started a preview first. Measuring somebody
# else's world reports every guard as asleep. That cost two rounds: an earlier
# author saw 0/3 SLEPT that was really 3/3, and five guards were reported as
# having STOPPED GUARDING when all five plus crowd-lane caught once aimed.
#
# canfail now REFUSES to run unaimed. This script is the aiming: it builds this
# tree, serves that build on a private port nobody else is using, points canfail
# at it, and takes the preview down again. The desk should not have to remember
# a port, and the number should not live in anybody's memory.
set -euo pipefail
cd "$(dirname "$0")/.."

# A PRIVATE PORT, not the shared one. Builders run 4178 up and previews sit on
# 4177 and 4184; this walks up from 4290 to find one nobody has claimed, so two
# desks can run it at once without measuring each other.
PORT=""
for p in $(seq 4290 4299); do
  if ! (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null; then PORT=$p; break; fi
done
if [ -z "$PORT" ]; then
  echo "  no free port in 4290-4299 — is a previous guards.sh still running?" >&2
  exit 3                                   # GOTCHAS 32: nothing was measured
fi

echo "  building this tree…"
npm run build 2>&1 | grep -E '✓ built|error' || true

echo "  serving it on :$PORT"
# setsid, so the preview is its own PROCESS GROUP and can be killed whole.
# `npx` spawns vite as a child, so killing the npx wrapper leaves the actual
# server listening — my first version did exactly that and left a preview on
# 4290 after it claimed to have torn it down. A stray server serving a stale
# build is the precise hazard this script exists to remove, so leaving one
# behind would have made things worse rather than better.
setsid npx vite preview --port "$PORT" --strictPort >/tmp/guards-preview.$$.log 2>&1 &
PREVIEW=$!
cleanup() {
  kill -- "-$PREVIEW" 2>/dev/null || kill "$PREVIEW" 2>/dev/null || true
  # and verify, because "I sent a signal" is not "it is gone"
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null || return 0
    sleep 0.2
  done
  echo "  WARNING: something is still listening on :$PORT — kill it before the next run" >&2
}
trap cleanup EXIT

for _ in $(seq 1 40); do
  (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null && break
  sleep 0.25
done
if ! (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then
  echo "  preview never came up on :$PORT — nothing was measured" >&2
  cat "/tmp/guards-preview.$$.log" >&2 || true
  exit 3
fi

echo "  running canfail against :$PORT (a build and a browser per case — this is slow)"
set +e
SHOT_URL="http://localhost:$PORT/" node scripts/canfail.mjs "$@"
RC=$?
set -e
rm -f "/tmp/guards-preview.$$.log"
# canfail's own exit code is the answer: 0 every guard caught, 1 one slept,
# 2 not aimed, 3 nothing measured. Passed straight through rather than
# reinterpreted — a wrapper that swallows an exit code is how a red goes quiet.
exit $RC
