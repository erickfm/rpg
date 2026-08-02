// Is every person drawn from the 8-angle atlas?
//
// The user: "the people inside these places are always flat and not like the
// people on the street." Every interior figure traced back to the diner's
// waitress — she was the reference room's, so each new room copied her, and
// she was one hand-painted front view on a plane. This asserts the whole class
// is gone rather than checking the four I happened to remember.
//
// An atlas figure is recognisable without naming it: its texture is tiled 5x2
// (five views, walk and idle rows), so repeat.x is +/-0.2. A hand-drawn cutout
// is a person-shaped alphaTest plane with an untiled map.
//
// IT USED TO BE INDOORS-ONLY — `if (w.x < 400) return`. That was right for the
// complaint it was written from, which was about interiors, but the rule in
// GOTCHAS §21 is not indoor-only and neither is the failure: a figure standing
// outside is exactly as flat, and there was nothing asserting it. Same gap
// `floaters-walk` had. It now sweeps the WHOLE world by default and takes an
// optional box to narrow it:
//
//     node scripts/people-walk.mjs            # everywhere
//     node scripts/people-walk.mjs 6 32 -12 16   # just the car lot
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto } from './lib/reachable.mjs';
import { installMats, blindSpot } from './lib/materials.mjs';
// THE SAME FAULT floaters-walk.mjs HAD, found by sweeping for its shape rather
// than by waiting for someone to hit it. `people-walk.mjs diner` mapped to
// [NaN], failed `length === 4`, fell through to null and walked the WHOLE
// WORLD while the caller believed they had scoped it to one room.
//
// An argument a script accepts and ignores is worse than one it rejects: the
// rejection costs one message, the silent widening costs you a result you
// believe. So a room name works, and anything unusable exits 2.
//
//     node scripts/people-walk.mjs                # everywhere
//     node scripts/people-walk.mjs diner          # one room, by name
//     node scripts/people-walk.mjs 6 32 -12 16    # a box: x0 x1 z0 z1
const RAW = process.argv.slice(2);
const NUM = RAW.map(Number);
const b = await chromium.launch();
const p = await b.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
await goto(p, aim('http://localhost:4185/'));
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, aim('http://localhost:4185/'));   // GOTCHAS 26: prove it, do not just name it
await installMats(p);
await blindSpot(p);

// Resolved here rather than at the top because a room name needs the world.
let BOX = null;
if (RAW.length === 4 && NUM.every(Number.isFinite)) {
  BOX = NUM;
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
  const m = 0.5;
  BOX = [hit.cx - hit.w / 2 - m, hit.cx + hit.w / 2 + m,
         hit.cz - hit.d / 2 - m, hit.cz + hit.d / 2 + m];
  console.log(`scope: room "${hit.id}" — ${hit.w} x ${hit.d} m centred (${hit.cx}, ${hit.cz})`);
} else if (RAW.length) {
  console.error(`\n  CANNOT USE THESE ARGUMENTS: ${RAW.join(' ')}. Nothing was measured.`);
  console.error('  give nothing (everywhere), one room name, or four numbers x0 x1 z0 z1\n');
  await b.close();
  process.exit(2);
}

const r = await p.evaluate(([BOX]) => {
  const V = window.__ct.scene().position.constructor;
  const atlas = [], suspects = [];
  window.__ct.scene().traverse((o) => {
    // `__mats` is the shared walk from scripts/lib/materials.mjs (4008d7c3).
    // I had my own copy of it here after b39e97c6, which is one of the four
    // hand-retyped copies that lib exists to replace — the traversal runs
    // inside page.evaluate, so there was never anything to import until
    // someone installed one. Converging rather than keeping a fifth.
    if (!o.isMesh || !o.geometry?.parameters) return;
    const mats = window.__mats(o).filter((mm) => mm?.map);
    if (!mats.length) return;
    const w = new V(); o.getWorldPosition(w);
    if (BOX && (w.x < BOX[0] || w.x > BOX[1] || w.z < BOX[2] || w.z > BOX[3])) return;
    if (mats.some((mm) => Math.abs(Math.abs(mm.map.repeat.x) - 0.2) < 0.001)) {
      atlas.push(+w.x.toFixed(0)); return;
    }
    const m = mats[0];
    // PERSON-shaped, which is narrower than prop-shaped. A standing figure is
    // about 1:1.8 — the waitress was 1.20 x 1.90 and the casino dealer 1.00 x
    // 1.80. Interiors are also full of standing PROPS on alphaTest planes: the
    // hotel palm is 1.15 x 1.60 and the tax office pot plant 0.95 x 1.42, both
    // squatter. The ratio is what separates them, and it is a heuristic — a
    // genuinely stout person or a very tall plant would need a human eye.
    const { width: pw, height: ph } = o.geometry.parameters;
    // ANY cutout, not `alphaTest === 0.5`.
    //
    // 0.5 is the convention every figure in the world happens to use, and
    // matching it exactly meant this check could only see hand-drawn people
    // who had followed the convention — which is the one thing a hand-drawn
    // person has no obligation to do. Mutation-tested both ways: the same
    // 1.00 x 1.80 cutout dropped into the lot came back
    //
    //   alphaTest 0.5   1 person-shaped hand-drawn cutouts remain   exit 1
    //   alphaTest 0.3   no hand-drawn people anywhere               exit 0
    //
    // and 0.3 is not a strange thing to type. The check was guarding the
    // convention rather than the rule.
    //
    // Widening costs nothing here: the shape filters below — PlaneGeometry,
    // upright, 0.8-1.4 wide, 1.5-2.1 tall, ratio >= 1.55 — are what actually
    // separate a person from a palm, and the clean world still reports zero
    // suspects with this open to every cutout.
    if (o.geometry.type !== 'PlaneGeometry' || !mats.some((mm) => mm.alphaTest > 0)) return;
    // AND IT MUST NOT BE TILED. Widening the alphaTest test immediately
    // produced a false positive that had been hidden behind it: a 1.10 x 1.95
    // cutout in the walk-up, person-shaped to the centimetre, whose texture
    // repeats 3.67 x 6.5 — a grille, not a man. Dimensions alone cannot tell
    // those apart and were never going to.
    //
    // Tiling is what separates them, and it is the same fact the atlas test
    // above already leans on: a FIGURE wears its texture once, whether that is
    // one drawing or one cell of an atlas sheet. Anything repeating across
    // itself is a surface.
    if (mats.some((mm) => Math.abs(mm.map.repeat.x) > 1.01 || Math.abs(mm.map.repeat.y) > 1.01)) return;
    if (Math.abs(o.rotation.x) > 0.01) return;
    if (pw >= 0.8 && pw <= 1.4 && ph >= 1.5 && ph <= 2.1 && ph / pw >= 1.55)
      suspects.push(`${pw.toFixed(2)}x${ph.toFixed(2)} (ratio ${(ph / pw).toFixed(2)}) @ x=${w.x.toFixed(0)}`);
  });
  return { atlas: atlas.length, suspects };
}, [BOX]);
console.log(`${r.atlas} atlas figures`);
// AN EMPTY WORLD MUST NOT PASS. Pointed at empty space this printed
// "0 atlas figures / no hand-drawn people anywhere" and exited 0 — a world with
// no people at all satisfying "is every figure drawn from the atlas", because
// the verdict was computed from the suspects alone and nothing asserted that
// the population existed. 32d9d6521 found five of its own doing this from a
// mistyped flag; mine needed no typo, only an empty result.
//
// With an explicit BOX an empty result is a legitimate answer — the caller
// chose the region. Without one this is the whole world, which is how
// checks.mjs runs it, and the world has sixteen.
if (!BOX && r.atlas === 0) {
  console.error('\nNO ATLAS FIGURES ANYWHERE — this check saw nothing and cannot');
  console.error('  vouch for anything. Either the world failed to build its people or');
  console.error('  the traversal stopped finding them. Not a pass.');
//
// EXIT 3, not 1. GOTCHAS 32 — which I wrote — reserves 3 for "the check never
// ran, and nothing follows about the world". An empty subject set is exactly
// that: this cannot tell a world that failed to build the thing from a read
// that stopped finding it, so it must not claim the guarded thing is broken.
// 4d549f501 reached the same convention independently while enumerating the
// class; I had used 1 in all four, against my own entry.
  await b.close();
  process.exit(3);
}
console.log(r.suspects.length
  ? `${r.suspects.length} person-shaped hand-drawn cutouts remain:\n  ` + r.suspects.join('\n  ')
  : 'no hand-drawn people anywhere');
if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
await b.close();
process.exit(r.suspects.length || errs.length ? 1 : 0);
