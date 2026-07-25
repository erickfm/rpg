// Which checkout did this script just measure?
//
// `24163f69` found 55 of 60 scripts running a bare `p.goto('…:4184/')` — the
// AUDITOR's worktree, a different commit and a different bundle. Anyone
// running one of those reads somebody else's build as their own work.
//
// Honouring SHOT_URL is only half a fix. A default port is still a live server
// belonging to whoever started it, and the failure is silent either way: the
// world loads, the numbers look plausible, and nothing says they came from a
// tree you are not editing.
//
// So don't infer it — ASK. ct/hud.ts paints the build stamp into the corner
// from `virtual:build-stamp`: the short SHA plus `+` if the tree is dirty.
// Read that back and compare it to local HEAD.
//
//   import { reportWorld } from './lib/which-world.mjs';
//   await reportWorld(page, URL);     // prints a line; throws on mismatch
import { execSync } from 'node:child_process';

const localHead = () => {
  try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); }
  catch { return null; }
};

/** Is this SHA an ANCESTOR of my HEAD — i.e. is the served build simply behind
 *  where I am now?
 *
 *  "Is it a commit in this repository" does NOT work and is worth saying so:
 *  worktrees share one object store, so another builder's preview serves a SHA
 *  that is perfectly well known here. Ancestry is the question that actually
 *  separates the two: my own stale dist is behind me, a sibling worktree is
 *  off to one side. */
const isBehindMe = (sha) => {
  try { execSync(`git merge-base --is-ancestor ${sha} HEAD`, { stdio: 'ignore' }); return true; }
  catch { return false; }
};

/** Read the served build's stamp out of the HUD. */
export async function servedBuild(page) {
  return page.evaluate(() => {
    for (const el of document.querySelectorAll('div')) {
      if (el.children.length) continue;
      const m = (el.textContent || '').match(/^([0-9a-f]{7,40})(\+?)\s+\d\d:\d\d$/);
      if (m) return { sha: m[1], dirty: m[2] === '+' };
    }
    return null;
  });
}

/**
 * Print which world was measured, and refuse to continue if it is a DIFFERENT
 * COMMIT from the one checked out here. A dirty tree is fine and expected —
 * that is what you are testing — but a different SHA means the numbers belong
 * to someone else's work.
 */
export async function reportWorld(page, url) {
  const served = await servedBuild(page);
  const head = localHead();
  if (!served) { console.log(`measuring ${url}  (no build stamp found — cannot verify)`); return null; }
  const tag = `${served.sha}${served.dirty ? '+' : ''}`;
  if (head && !served.sha.startsWith(head) && !head.startsWith(served.sha)) {
    // Two different faults wear the same mismatch and want different actions.
    // A worktree under continuous rebase hits the first one often — HEAD moves
    // between `npm run build` and the check after it — and being told to
    // "start your own preview" when the preview is already yours sends you
    // looking in the wrong place.
    const mine = isBehindMe(served.sha);
    console.error(`\nMEASURING THE WRONG WORLD.`);
    console.error(`  ${url} is serving build ${tag}`);
    console.error(`  this checkout is at      ${head}`);
    if (mine) {
      console.error(`\n  ${served.sha} is an ANCESTOR of HEAD, so this is your own preview`);
      console.error(`  serving a stale dist — HEAD moved after you built it.`);
      console.error(`  Fix: npm run build, restart the preview, re-run.\n`);
    } else {
      console.error(`\n  ${served.sha} is NOT an ancestor of HEAD — it is off to one side,`);
      console.error(`  so that server is another worktree. Numbers from somebody`);
      console.error(`  else's tree are not evidence about yours.`);
      console.error(`  Fix: start your own preview, or set SHOT_URL to it.\n`);
    }
    throw new Error(`wrong world: served ${tag}, local ${head}`);
  }
  console.log(`measuring ${url}  build ${tag}${served.dirty ? ' (uncommitted changes, as expected)' : ''}`);
  return served;
}
