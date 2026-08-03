#!/usr/bin/env bash
# Run the slow tier against a checkout that CANNOT move under it.
#
# notes/BLOCKED-H.md, item 3, after four lost attempts:
#
#   "It is not a discipline problem. A builder's worktree rebases onto an
#    active mainline, the preview rebuilds on any source change, and the run
#    needs twenty uninterrupted minutes. Those three facts cannot all hold at
#    once. The fix is a pinned checkout, not more willpower."
#
# That is right, and the tier is mine — I added `--slow` to scripts/checks.mjs,
# so the hole it opened is mine to close. I lost two `interiors-walk` runs the
# same way in one session: edited a file mid-run, Vite hot-reloaded the page,
# `window.__ct` went undefined and the walk died at room four. Both times I
# re-ran and blamed myself for touching the tree. It is not willpower.
#
# So: a detached git worktree at the current HEAD, its own build, its own Vite
# on its own port, and the checks run with that worktree as the working
# directory. Nothing rebases it because nothing points at it — `git worktree
# add --detach` leaves no branch to move. Rebase your real worktree all you
# like while this runs.
#
# Everything happens INSIDE the pinned tree on purpose. scripts/lib/which-world
# compares the served build stamp against `dist/` on the disk it is running
# from, so a run split across two directories would trip its own guard.
#
#   ./scripts/slow-pinned.sh                 # the whole slow tier
#   ./scripts/slow-pinned.sh steps-walk      # one script, for checking this works
#
# Leaves nothing behind: the worktree is removed and the server killed on any
# exit, including Ctrl-C.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
# `street/` is a subdirectory of the repo, so a worktree's root is NOT this
# directory — package.json lives at <worktree>/street. Ask git for the prefix
# rather than hard-coding the name.
PREFIX="$(git rev-parse --show-prefix)"
SHA="$(git rev-parse --short HEAD)"
# Ask the server which port it got; do not guess one.
#
# Hard-setting a port broke on the second run (the first still held it). Then
# stepping through ports with curl broke too, because a stale server can hold a
# port without answering, so curl calls it free when it is not.
# A HIGH RANDOM PORT, not 0. `--port 0` is not "pick anything" to vite dev —
# it falls back to the 5173 default, and a previous pinned run still holding
# 5173 then kills this one with "Port 5173 is already in use". Starting high
# and letting vite step up from there keeps concurrent runs clear of each
# other, which matters when a run is twenty minutes long.
PORT="${PINNED_PORT:-$(( 21000 + (RANDOM % 9000) ))}"
PIN="$(mktemp -d "${TMPDIR:-/tmp}/ct-pinned-XXXXXX")"
SRV=""

cleanup() {
  # Kill the CHILD first, then the wrapper: `npx` forks, so killing npx alone
  # leaves the server holding its port for the next run — which is how the
  # second invocation of this script died.
  #
  # NOT a process-group kill (`kill -- -$SRV`). That looks right and is a trap:
  # `setsid` does not always fork, so `$!` can still be in THIS shell's group,
  # and the negative-PID form then kills the script issuing it.
  if [ -n "$SRV" ]; then
    pkill -P "$SRV" 2>/dev/null || true
    kill "$SRV" 2>/dev/null || true
  fi
  cd "$ROOT"
  git worktree remove --force "$PIN" 2>/dev/null || rm -rf "$PIN"
}
trap cleanup EXIT INT TERM

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "WARNING: uncommitted changes are NOT in the pinned tree — it is HEAD ($SHA)."
  echo "         Commit first if you meant to measure them."
fi

echo "pinning $SHA into $PIN"
git worktree add --detach --quiet "$PIN" HEAD
# node_modules is big and identical; share it rather than reinstalling.
ln -s "$ROOT/node_modules" "$PIN/$PREFIX/node_modules"

cd "$PIN/$PREFIX"
# MODE. Default `dev`.
#
# ⚠ THE REASON THIS DEFAULT WAS CHOSEN IS GONE — corrected item 257, and the
# DEFAULT ITSELF IS NOT. This comment used to say four harnesses (interiors-walk,
# mirror-walk and two of G's) do `await import('/src/proto/ct/doors.ts')`, a
# source path only a dev server serves, so they were DEV-ONLY and could not
# measure the bundle at all. **All four now read `__ct` and none does a runtime
# source import** — G's two and mirror-walk were converted earlier, and
# interiors-walk by item 251. Counted rather than assumed:
# `grep -n "import('/src/" scripts/{interiors-walk,mirror-walk,G-rooms-walk,G-vice-walk}.mjs`
# returns 7 hits and **every one is a comment**. Measured rather than assumed
# too: `interiors-walk church` against `vite preview` scores **29/29, exit 0**.
#
# So `dev` is now a default with no stated justification behind it. Flipping it
# is a COVERAGE decision — it changes what the standard slow run measures for
# every builder — so item 257 corrected the claim and deliberately did NOT move
# the default. That is the desk's call, and it is queued as such.
#
# `PINNED_MODE=preview` serves the built bundle instead, which is the only way
# to see bundle-specific behaviour — and it matters: circular imports resolve
# differently there, which is how SEVENS's door was lost in the artefact
# while dev showed all eight. scripts/doors-declared.mjs is the check that
# cares; run that one with preview.
#
# Either way the tree is DETACHED and frozen, so nothing rebases under the run,
# which is the whole point.
MODE="${PINNED_MODE:-dev}"
echo "building the pinned tree"
# Gitignored output directories do not exist in a fresh worktree, and several
# checks WRITE before they exit. seampairs did its whole analysis, found nothing
# wrong — "brick vs brick, a real seam question: 0" — and then died on ENOENT
# opening shots/seampairs.json. A green result reported as a red one is the
# worst way for a suite to be wrong, and it is the only red in the full tier.
mkdir -p shots
npm run build >/dev/null

echo "serving it on :$PORT"
# Keep the server's output. The first version sent it to /dev/null and the
# failure read "server never came up on :4196" with no cause — a runner that
# cannot say why it failed is the same defect as a check that cannot fail.
SRVLOG="$PIN/server.log"
if [ "$MODE" = "preview" ]; then
  npx vite preview --port "$PORT" >"$SRVLOG" 2>&1 &
else
  npx vite --port "$PORT" >"$SRVLOG" 2>&1 &
fi
SRV=$!
for _ in $(seq 1 60); do
  PORT="$(sed -nE 's#.*Local:.*http://[^:]+:([0-9]+)/.*#\1#p' "$SRVLOG" | head -1)"
  [ -n "$PORT" ] && break
  sleep 0.5
done
if [ -z "$PORT" ]; then
  echo "the server never reported a port — its output was:"
  sed 's/^/    /' "$SRVLOG"
  exit 1
fi
echo "  it took :$PORT"
for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://localhost:$PORT/" && break
  sleep 0.5
done
if ! curl -sf -o /dev/null "http://localhost:$PORT/"; then
  echo "server never came up on :$PORT — its output was:"
  sed 's/^/    /' "$SRVLOG" 2>/dev/null || echo "    (no output captured)"
  exit 1
fi

export SHOT_URL="http://localhost:$PORT/"
echo "running against a tree nothing can rebase"
echo

if [ $# -gt 0 ]; then
  # one named script, so you can prove this harness works without paying
  # twenty minutes for the answer
  node "scripts/$1.mjs" "${@:2}"
else
  npm run checks -- --slow
fi
