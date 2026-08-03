// ITEM 163 — LOOK AT THE TWO CIVIC MEMBERS WHOSE MATERIALS I RESIZED.
//
// The adoption changes no geometry and no colour: `stoneFace` now derives its
// repeat from a declared 32 px/m instead of hand-computing `metres / ST_TILE`,
// and the library flight's step sides and the church buttress set-offs are
// sized per FACE instead of from one nominal member. So the claim under test is
// "the stone grain is the same size it always looked, and now says so" — which
// is a claim about pixels, and CLAUDE.md is explicit that screenshots are for
// LOOKING. This produces the frames; `texdensity.mjs` produces the verdict.
//
// `npm run sweep`'s three civic stations are all INDOORS (I checked: church-far
// and library-entry are both interiors), so nothing in the standing sweep sees
// either of these. That is why this exists rather than a diff of sweep output.
//
// Usage: SHOT_URL=http://localhost:4191/ node scripts/probes/w101-civic-stone-look.mjs <tag>
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4191/');
const TAG = process.argv[2] ?? 'now';
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.warp, null, { timeout: 60000 });
await waitPainted(p, { quiet: true });

// The two members, at the coordinates `texdensity --all` prints for their worst
// faces — so the camera is aimed by the audit's own output rather than by me
// guessing where the library is.
//   library flight step sides   the gross cluster at (-10.2, 0.2, -13)
//   church buttress set-offs    the 399 px/m cluster at (9.4, 1.6, -73..-85)
const VIEWS = [
  ['library-steps', -4.5, -13.0, -Math.PI / 2, -0.10],
  // Stand BACK and look UP. My first vantage was 4 m from the wall at eye level
  // and photographed a lamp post and a passing citizen — the set-offs are the
  // sloped weatherings that step the buttress back at 1.50, 6.40, 11.40 and
  // 15.40 m, so nothing below 6 m of them is even in a level frame.
  ['church-buttress', 2.0, -79.0, Math.PI / 2, 0.52],
];

// A GAME DAY IS 24 REAL MINUTES, so an unpinned pair of runs is two different
// times of day and the stone changes colour between them for reasons that have
// nothing to do with this change.
for (const [name, x, z, yaw, pitch] of VIEWS) {
  await p.evaluate(([x, z, y, pi]) => { window.__ct.clock(13, 0); window.__ct.warp(x, z, y, undefined, pi); },
    [x, z, yaw, pitch]);
  await waitPainted(p, { quiet: true });
  const path = `shots/w101-civic-${name}-${TAG}.png`;
  const buf = await p.screenshot({ path });
  const black = await blackFraction(p, buf);
  console.log(`${path}  black ${black}${black > 0.98 ? '   <-- YOU PHOTOGRAPHED THE VOID' : ''}`);
}
await b.close();
