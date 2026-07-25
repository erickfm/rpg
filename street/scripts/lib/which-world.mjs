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
    console.error(`\nMEASURING THE WRONG WORLD.`);
    console.error(`  ${url} is serving build ${tag}`);
    console.error(`  this checkout is at      ${head}`);
    console.error(`  Start your own preview, or set SHOT_URL to it. Numbers from`);
    console.error(`  another builder's tree are not evidence about yours.\n`);
    throw new Error(`wrong world: served ${tag}, local ${head}`);
  }
  console.log(`measuring ${url}  build ${tag}${served.dirty ? ' (uncommitted changes, as expected)' : ''}`);
  return served;
}
