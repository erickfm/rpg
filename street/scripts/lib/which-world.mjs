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
//
//   SHOT_WORLD=integration SHOT_URL=http://localhost:5177/ node scripts/foo.mjs
//     opts in to the live integration world, whose stamp can never equal any
//     one checkout. Prints a loud banner instead of throwing. Default unchanged.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const localHead = () => {
  try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); }
  catch { return null; }
};

/** What SHA is baked into the dist ON THIS DISK? vite's build stamp ends up as
 *  a string literal in the bundle, so this is the build `npm run build` last
 *  produced here.
 *
 *  This is the exact test for "is that server serving MY build", and it took
 *  two wrong ones to get to. "Is the SHA a commit in this repository" fails
 *  because worktrees share one object store — another builder's preview is
 *  perfectly well known here. "Is it an ancestor of HEAD" fails because a
 *  REBASE rewrites commits, so the build you made ten minutes ago is orphaned
 *  rather than behind you, which is the normal state of a worktree on a merge
 *  train. Comparing against the artefact removes the guessing entirely. */
const distSha = () => {
  try {
    for (const f of readdirSync('dist/assets')) {
      if (!f.endsWith('.js')) continue;
      const m = readFileSync(`dist/assets/${f}`, 'utf8').match(/["`]([0-9a-f]{7,12})["`]/);
      if (m) return m[1];
    }
  } catch { /* no dist yet */ }
  return null;
};

/**
 * Is this page error the integration world's own noise, rather than the world's?
 *
 * ONLY in integration mode, and ONLY the one message. The live world at :5177 is
 * a DEV server that `live-integrate.sh` rebuilds every 15 s, which drops Vite's
 * HMR WebSocket and raises `WebSocket closed without opened`. Measured: four of
 * my checks run there, four reds, all this one string.
 *
 * I first warned about it in the banner and left each check's error list alone,
 * on the grounds that a filter which swallows one known message is how the next
 * real one gets swallowed. That reasoning is right and the outcome was still
 * wrong: a mode that reports a red EVERY time teaches you to skip the red, which
 * loses more errors than the filter would have.
 *
 * So it reclassifies rather than swallows. Any other page error still fails, and
 * this is deliberately a string match on one known message rather than a pattern
 * over WebSocket errors in general — if the HMR text ever changes, this stops
 * matching and the red comes back, which is the safe way for it to break.
 */
export function integrationNoise(msg) {
  return process.env.SHOT_WORLD === 'integration'
    && /WebSocket closed without opened/.test(String(msg));
}

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
  // BLOCKED-H 4: "no builder can measure the world the user actually plays."
  // The live integration world on :5177 is mainline plus every builder's
  // in-flight work, so its stamp is never equal to ANY one checkout and this
  // guard refuses it forever. That is right by default — but "does my landed
  // work hold up in the integrated world" is a different and legitimate
  // question, and there was no way to ask it.
  //
  // So it is an explicit opt-in, and it does not weaken the default: you have
  // to name the world you meant. The banner is deliberately loud, because the
  // whole hazard this file exists for is a number quietly belonging to a tree
  // you are not editing.
  if (process.env.SHOT_WORLD === 'integration') {
    console.log(`measuring ${url}  build ${tag}  [INTEGRATION WORLD, opted in]`);
    console.log(`  this checkout is at ${head ?? '(unknown)'} — the numbers below describe the`);
    console.log(`  INTEGRATED build (mainline plus every builder in flight), not your tree.`);
    // Warned about rather than filtered. That world runs a DEV server, and
    // live-integrate.sh rebuilds it every 15 s, which drops Vite's HMR socket
    // and raises a pageerror in any check that collects them. It is noise here
    // and a real failure anywhere else, so this says so and leaves the check's
    // own error list alone — a filter that swallows one message is how the next
    // real one gets swallowed too.
    console.log(`  Expect one page error: Vite's HMR socket, dropped when live-integrate.sh rebuilds.`);
    return served;
  }
  if (head && !served.sha.startsWith(head) && !head.startsWith(served.sha)) {
    // Two different faults wear the same mismatch and want different actions.
    // A worktree under continuous rebase hits the first one often — HEAD moves
    // between `npm run build` and the check after it — and being told to
    // "start your own preview" when the preview is already yours sends you
    // looking in the wrong place.
    const dist = distSha();
    const mine = dist !== null && served.sha.startsWith(dist);
    console.error(`\nMEASURING THE WRONG WORLD.`);
    console.error(`  ${url} is serving build ${tag}`);
    console.error(`  this checkout is at      ${head}`);
    if (mine) {
      console.error(`\n  that is the SHA baked into dist/ on this disk, so the server IS`);
      console.error(`  yours — it is serving a stale build. HEAD moved after you made it.`);
      console.error(`  Fix: npm run build, restart the preview, re-run.\n`);
    } else {
      console.error(`\n  dist/ on this disk was built from ${dist ?? '(no dist)'}, which does not`);
      console.error(`  match — so that server is not yours. Numbers from another`);
      console.error(`  builder's tree are not evidence about yours.`);
      console.error(`  Fix: start your own preview, or set SHOT_URL to it.\n`);
    }
    throw new Error(`wrong world: served ${tag}, local ${head}`);
  }
  console.log(`measuring ${url}  build ${tag}${served.dirty ? ' (uncommitted changes, as expected)' : ''}`);
  return served;
}
