#!/usr/bin/env bash
# Run the check suite against a checkout that CANNOT move under it.
#
# BLOCKED-H §3: "The slow tier cannot be completed on a rebasing branch — four
# attempts, same cause … It is not a discipline problem. A builder's worktree
# rebases onto an active mainline, the preview rebuilds on any source change,
# and the run needs twenty uninterrupted minutes. Those three facts cannot all
# hold at once." The prescription there is exactly this: a pinned checkout, not
# more willpower.
#
# I have lost runs to the same cause three times myself, twice in one session —
# `npm run build`, commit, and every check after that point reports WRONG WORLD
# because HEAD moved out from under the bundle they were measuring. The guard is
# right every time. The runner is what needs fixing.
#
# HOW IT PINS. `git worktree add --detach` gives a checkout whose HEAD is a SHA
# rather than a branch, so nothing rebases it, nothing rewrites it, and
# `git rev-parse HEAD` returns the same answer in twenty minutes as it does now.
# lib/which-world.mjs reads local HEAD from the CWD, so running the suite with
# its cwd inside that worktree makes the guard compare the pinned SHA against a
# bundle built from the pinned SHA. They agree for as long as the run takes.
#
# Your own worktree is untouched: keep committing, keep rebasing, keep the
# preview you already have. That is the whole point.
#
#   scripts/pinned-suite.sh              # the fast tier, pinned
#   scripts/pinned-suite.sh --slow       # the tier that has never completed
#   scripts/pinned-suite.sh --selftest
#
# Everything after the script name is passed through to `npm run checks --`.
set -euo pipefail

cd "$(dirname "$0")/.."                       # street/
SRC="$PWD"
ROOT="$(git rev-parse --show-toplevel)"
SHA="$(git rev-parse HEAD)"
SHORT="$(git rev-parse --short HEAD)"

if [ -n "$(git status --porcelain -- . 2>/dev/null)" ]; then
  echo "NOTE: this checkout is dirty. A worktree is made from the COMMIT, so"
  echo "      uncommitted changes are NOT included in the pinned run."
  echo "      Commit them first if they are what you meant to test."
  echo
fi

# The path carries the PID, NOT just the SHA. It used to be `ct-pinned-$SHORT`
# and that cost a twenty-minute run: two invocations at the same commit resolve
# to the same directory, and this script's startup used to `worktree remove
# --force` that path before creating it. So a second run silently deleted the
# first run's working directory out from under it, and every remaining check
# died with `ENOENT: process.cwd failed ... the current working directory was
# likely removed`. I did it to myself three invocations deep while the slow tier
# was in flight. A run must not be able to destroy another run's world — that is
# the entire point of this script.
WT="${TMPDIR:-/tmp}/ct-pinned-$SHORT-$$"
PORT="${PINNED_PORT:-4310}"
while lsof -i ":$PORT" >/dev/null 2>&1; do PORT=$((PORT + 1)); done

cleanup() {
  [ -n "${PREVIEW_PID:-}" ] && kill "$PREVIEW_PID" 2>/dev/null || true
  # Only ever the worktree THIS process created — the path has our PID in it,
  # so there is nothing else it can reach.
  git -C "$ROOT" worktree remove --force "$WT" 2>/dev/null || true
}
trap cleanup EXIT

echo "pinning $SHORT into $WT"
git -C "$ROOT" worktree add --detach -q "$WT" "$SHA"

# node_modules is 200 MB of the same bytes; symlink rather than install. The
# pinned tree only ever READS them.
ln -s "$SRC/node_modules" "$WT/street/node_modules"

cd "$WT/street"
echo "building the pinned checkout"
npm run build >/dev/null 2>&1 || { echo "PINNED BUILD FAILED — the commit does not build"; exit 1; }

npx vite preview --port "$PORT" --strictPort >/dev/null 2>&1 &
PREVIEW_PID=$!
for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://localhost:$PORT/" && break
  sleep 0.5
done

echo "serving pinned $SHORT on :$PORT — your own tree is free to move"
echo
SHOT_URL="http://localhost:$PORT/" npm run checks -- "$@"
