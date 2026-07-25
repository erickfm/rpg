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
PORT="${PINNED_PORT:-4196}"
PIN="$(mktemp -d "${TMPDIR:-/tmp}/ct-pinned-XXXXXX")"
SRV=""

cleanup() {
  [ -n "$SRV" ] && kill "$SRV" 2>/dev/null || true
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
echo "building the pinned tree"
npm run build >/dev/null

echo "serving it on :$PORT"
npx vite preview --port "$PORT" --strictPort >/dev/null 2>&1 &
SRV=$!
for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://localhost:$PORT/" && break
  sleep 0.5
done
curl -sf -o /dev/null "http://localhost:$PORT/" || { echo "server never came up on :$PORT"; exit 1; }

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
