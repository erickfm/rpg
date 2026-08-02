// Does anything hang in mid-air?
//
// The auditor found a 0.44 m price card floating 0.325 m above its shelf in
// the thrift store — visible standing right at it. Same class as the litter
// that clipped: an object placed at a y somebody typed, rather than at the top
// of whatever it sits on. A number that was right when it was written and
// wrong the moment the shelf under it moved.
//
// So this does not check that card. For every small prop in every interior it
// finds the nearest surface DIRECTLY BENEATH — the top of any collider or any
// horizontal plane under its footprint — and reports the gap. Anything more
// than a few centimetres off is either floating or sunk.
//
// It cannot know intent: a hanging sign is SUPPOSED to have air under it. So
// it reports rather than fails, sorted worst first, and the reading is yours.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto } from './lib/reachable.mjs';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
await goto(p, aim('http://localhost:4185/'));
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, aim('http://localhost:4185/'));   // GOTCHAS 26: prove it, do not just name it

// SCOPE. The default stays interiors-only (x >= 400) so the reading above is
// unchanged, but the check is not interior-specific — an exterior prop sits on
// ground that other builders move, which is if anything the likelier way a
// typed y goes stale.
//
//     node scripts/floaters-walk.mjs                  # every interior
//     node scripts/floaters-walk.mjs diner            # one room, by name
//     node scripts/floaters-walk.mjs 6 32 -12 16      # a box: x0 x1 z0 z1
//
// IT USED TO TAKE A ROOM NAME AND IGNORE IT. `floaters-walk.mjs diner` mapped
// to [NaN], failed the `length === 4` test, fell through to the interiors-wide
// default and printed the HOTEL's rows. Every number it gave was true of the
// world and none of it was true of the diner, so the only way to catch it was
// to already know what the diner contains. F found it that way.
//
// An argument a script accepts and ignores is worse than one it rejects: a
// rejected argument costs you one message, an ignored one silently widens the
// run and you believe you scoped it. So an unusable argument now exits 2 and
// prints the rooms that do exist, and a room NAME — the thing anyone would
// reach for first — actually works.
const RAW = process.argv.slice(2);
const NUM = RAW.map(Number);
let BOX = null, SCOPE = 'every interior (x >= 400)';
if (RAW.length === 4 && NUM.every(Number.isFinite)) {
  BOX = NUM;
  SCOPE = `box x ${BOX[0]}..${BOX[1]}, z ${BOX[2]}..${BOX[3]}`;
} else if (RAW.length === 1 && !Number.isFinite(NUM[0])) {
  const want = RAW[0].toLowerCase();
  const rooms = await p.evaluate(() => window.__ct.roomDims());
  const hit = rooms.find((r) => r.id.toLowerCase() === want)
           ?? rooms.find((r) => r.id.toLowerCase().includes(want));
  if (!hit) {
    console.error(`\n  NO SUCH ROOM: "${RAW[0]}". Nothing was measured.`);
    console.error(`  rooms: ${rooms.map((r) => r.id).sort().join(', ')}\n`);
    await b.close();
    process.exit(2);
  }
  const m = 0.5;                                   // a little past the walls
  BOX = [hit.cx - hit.w / 2 - m, hit.cx + hit.w / 2 + m,
         hit.cz - hit.d / 2 - m, hit.cz + hit.d / 2 + m];
  SCOPE = `room "${hit.id}" — ${hit.w} x ${hit.d} m centred (${hit.cx}, ${hit.cz})`;
} else if (RAW.length) {
  console.error(`\n  CANNOT USE THESE ARGUMENTS: ${RAW.join(' ')}. Nothing was measured.`);
  console.error('  give nothing (every interior), one room name, or four numbers x0 x1 z0 z1\n');
  await b.close();
  process.exit(2);
}
console.log(`scope: ${SCOPE}`);
const found = await p.evaluate(([BOX]) => {
  const V = window.__ct.scene().position.constructor;
  const B = window.__ct.scene().constructor;
  const props = [];
  const surfaces = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry?.parameters) return;
    const w = new V(); o.getWorldPosition(w);
    if (BOX) { if (w.x < BOX[0] || w.x > BOX[1] || w.z < BOX[2] || w.z > BOX[3]) return; }
    else if (w.x < 400) return;                             // default: interiors only
    const g = o.geometry.parameters;
    const isBox = o.geometry.type === 'BoxGeometry';
    const isPlane = o.geometry.type === 'PlaneGeometry';
    const isCyl = o.geometry.type === 'CylinderGeometry';
    if (!isBox && !isPlane && !isCyl) return;
    // A CYLINDER IS A SURFACE. It is a leg, a pedestal, a barrel, a bin — and
    // leaving it out made this report a stool as a floating prop: the tax
    // office's seat pads sit on 0.4 m cylindrical pedestals, and with only
    // boxes and planes counted the nearest thing beneath them was the FLOOR,
    // 0.383 m down. Two clean false positives at knee height, which is exactly
    // the band this script exists to police (the thrift price card was 0.325 m).
    //
    // Not a subtle omission — a round table would have done the same. The
    // reason it survived is that this script REPORTS rather than fails, so a
    // wrong line costs nothing and nobody has to reconcile it.
    if (isCyl) {
      const rt = Math.max(g.radiusTop ?? 0, g.radiusBottom ?? 0);
      surfaces.push({ x: w.x, z: w.z, hw: rt, hd: rt, top: w.y + (g.height ?? 0) / 2 });
      return;                       // a cylinder is never the small PROP here
    }
    const wx = (g.width ?? 0), wy = (g.height ?? 0), wd = (g.depth ?? 0);
    // a SURFACE is anything with a horizontal top: a box, or a plane laid flat
    if (isBox) surfaces.push({ x: w.x, z: w.z, hw: wx / 2, hd: wd / 2, top: w.y + wy / 2 });
    else if (Math.abs(Math.abs(o.rotation.x) - Math.PI / 2) < 0.01)
      surfaces.push({ x: w.x, z: w.z, hw: wx / 2, hd: (g.height ?? 0) / 2, top: w.y });
    // a small PROP is a little thing that ought to be resting on something
    const big = Math.max(wx, wy, wd);
    if (big > 0.9 || big < 0.05) return;
    if (isPlane && Math.abs(o.rotation.x) > 0.01) return;    // upright signage: excluded below anyway
    props.push({ x: w.x, y: w.y, z: w.z, half: wy / 2 || 0.01, w: wx, d: wd, kind: o.geometry.type });
  });
  const out = [];
  for (const pr of props) {
    // THE FLOOR IS PUBLISHED — ask it, do not hunt for it.
    //
    // Every surface below is found by scanning meshes, which is right for a
    // shelf or a counter and wrong for the floor: the floor is what
    // `__ct.groundAt` exists to answer, and it is the same pick the rig itself
    // uses. Hunting for it instead means depending on which mesh happens to be
    // under the prop — the casino lays a carpet decal 12 mm over the kit floor,
    // so "the lowest plane" and "the floor" are already two different answers
    // in one room (cc2d8bb56 hit exactly this in a floor check).
    //
    // This script has produced two false positives already, both from the
    // surface set being incomplete: a cylinder was not a surface, so a stool
    // read as floating; and a prop sunk 25 mm into its support read as
    // floating too. Seeding with the ground removes the whole class for
    // anything resting on the floor, which is most of what it looks at.
    const g = window.__ct.groundAt(pr.x, pr.z);
    let best = (typeof g === 'number' && g <= pr.y - pr.half + 0.06) ? g : null;
    for (const s of surfaces) {
      if (Math.abs(s.x - pr.x) > s.hw + pr.w / 2) continue;
      if (Math.abs(s.z - pr.z) > s.hd + pr.d / 2 + 0.05) continue;
      const bottom = pr.y - pr.half;
      // 0.06, not 0.02: a prop MODELLED SLIGHTLY SUNK into what it rests on is
      // normal and deliberate — it hides the seam. The tax office's seat pads
      // overlap their pedestals by 0.025 m, which the old tolerance rejected as
      // "this surface is above you", so the nearest thing beneath became the
      // FLOOR and a stool was reported as floating 0.35 m. Tightness here does
      // not buy accuracy; it just moves which wrong answer you get.
      if (s.top > bottom + 0.06) continue;                   // it is above us
      if (!best || s.top > best) best = s.top;
    }
    if (best === null) continue;                             // nothing under it at all
    const gap = (pr.y - pr.half) - best;
    if (gap > 0.06) out.push({ gap: +gap.toFixed(3), at: [+pr.x.toFixed(2), +pr.y.toFixed(2), +pr.z.toFixed(2)], kind: pr.kind });
  }
  // TWO lists, and the second is why. The report is capped at 15 so it stays
  // readable, sorted by gap — which means the entries most worth seeing are the
  // ones most likely to be cut. Wall signs legitimately hang 2 m up, so fifteen
  // of them outrank a prop floating 0.2 m at knee height and it never appears.
  // A cap that silently drops the interesting half is the same defect as a
  // check that reports nothing: caught when a deliberately floated bin did not
  // show up in the list I was testing against.
  const sorted = out.sort((a, b) => b.gap - a.gap);
  return { top: sorted.slice(0, 15), low: sorted.filter((f) => f.at[1] < 1.4) };
}, [BOX]);

console.log(found.top.length ? 'props with air under them, worst first:' : 'nothing floating');
for (const f of found.top) console.log(`  ${f.gap.toFixed(3)} m  ${f.kind} @ ${f.at.join(', ')}`);
console.log('\nA hanging sign is SUPPOSED to have air under it, so this reports and does not');
console.log('fail. What it is for is the prop that was meant to be RESTING on something.');
console.log('KNOWN LIMITATION: the list is dominated by upright wall planes — signs, cards,');
console.log('photos — which hang by design. Read from the BOTTOM up: furniture-height');
console.log('entries are the ones worth looking at.');
// COMPUTED, not asserted. This line used to read "Nothing under 1.4 m is
// floating today" and was printed unconditionally — true when written, and it
// would have gone on saying so with a prop hanging at knee height underneath
// it. A sentence a script prints about the world is a claim like any other and
// has to be measured; this file's whole subject is props at the wrong height.
const low = found.low;
console.log(low.length
  ? `${low.length} of these sit BELOW 1.4 m, which is furniture height, not signage —`
    + ' those are the ones to look at:\n' + low.map((f) => `  ${f.gap.toFixed(3)} m  ${f.kind} @ ${f.at.join(', ')}`).join('\n')
  : 'Nothing below 1.4 m has air under it — measured, not assumed.');
if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
await b.close();

// A VERDICT ON THE HALF THAT HAS ONE.
//
// This printed its findings and exited 0 — always. `548a8807d` counts 25
// scripts in that state; a script that asserts without an exit code cannot be
// registered, so the runner never sees it and nothing it finds goes red.
//
// The cost was real and mine: five props in my own thrift sat floating for days
// — a card hung over a free-standing bin, a dressed form hovering over its
// plinth, two donation boxes — and I only found them because I happened to
// uncap the list while testing something else. With an exit code they would
// have gone red the run they landed.
//
// The report/verdict split is still right for the TOP list: a hanging sign is
// supposed to have air under it and no script can tell intent from geometry.
// But "a prop below 1.4 m with a gap under it" is not ambiguous — that is
// furniture height, nothing hangs there on purpose, and it is exactly the class
// the auditor ranked second on player visibility. So the low list is the
// verdict and the rest stays a report.
process.exit(low.length || errs.length ? 1 : 0);
