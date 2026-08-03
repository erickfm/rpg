// Item 193 — did the kit leaf's angle ACTUALLY move to LEAF_AJAR?
//
// WHY THIS EXISTS RATHER THAN TRUSTING `doormatch12`. That check is red at 4 of
// 12 before AND after this change, which is correct and is not evidence either
// way: it asks whether a room wears the shared kit's GENERIC LEAF TEXTURE, and
// says nothing at all about the angle that leaf is hung at. So it can neither
// confirm nor deny the one line this item changed. Something has to read the
// rotation.
//
// THE KIT LEAF IS IDENTIFIED THE WAY doormatch12 IDENTIFIES IT — by its 32×64
// canvas (`ct/interior.ts`'s `pixTex(32, 64, …)`), not by name and not by
// position. That is the same signature the check already keys on, so the two
// cannot disagree about what "the kit leaf" means.
//
// ⚠ NOTHING FILTERS ON `visible` (GOTCHAS 79/79b). Every interior is hidden
// until you are standing in it, and the player spawns 98 m past the region-cull
// boundary — a census that filtered would find zero leaves and report it green.
// A mesh's rotation is an authoring fact and does not stop being true when the
// mesh is culled.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const WANT = Number(process.env.WANT ?? 0);        // LEAF_AJAR, vice.ts:179

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForFunction(() => (window.__ct.painted?.()?.triangles ?? 0) > 0, { timeout: 20000 });

const leaves = await p.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.material?.map?.image) return;
    const im = o.material.map.image;
    if (im.width !== 32 || im.height !== 64) return;   // the kit leaf's canvas
    o.updateWorldMatrix(true, false);
    out.push({
      ry: +o.rotation.y.toFixed(4),
      x: +o.getWorldPosition(new (o.position.constructor)()).x.toFixed(2),
    });
  });
  return out;
});

const deg = (r) => `${(r * 180 / Math.PI).toFixed(1)}°`;
const angles = [...new Set(leaves.map((l) => l.ry))].sort((a, c) => a - c);
console.log(`\n${leaves.length} kit leaves found (32×64 canvas, the signature doormatch12 keys on)`);
console.log(`distinct rotation.y values: ${angles.map((a) => `${a} (${deg(a)})`).join(', ') || '(none)'}`);

// ── POPULATION FLOOR, BEFORE THE VERDICT ─────────────────────────────────────
// Every assertion here is a filter over `leaves`. With none found — a renamed
// canvas, a cull that this probe started respecting, a world that failed to
// build — "all leaves are at LEAF_AJAR" is true of the empty set and this would
// exit green having measured nothing. The four rooms doormatch12 names as
// wearing the kit leaf are the floor, derived from that check rather than
// predicted here.
const FLOOR = 4;
if (leaves.length < FLOOR) {
  console.error(`\nTHIS CHECK MEASURED (ALMOST) NOTHING: ${leaves.length} kit leaves`
    + ` against a floor of ${FLOOR} (doormatch12 names burger, diner, tax, thrift).`);
  console.error('  "every leaf is at the right angle" is free at zero. Fix the finder.');
  await b.close();
  process.exit(2);
}

// ⚠ THE 32×64 CANVAS IS NOT UNIQUE TO THE ROOM KIT, and my first cut of this
// probe reported "6 leaves still carry their own angle" because of it. Those
// six sit at **exactly ±π/2** at x 199.91 and 202.49 — the walk-up's own door
// leaves, whose MESH is turned a quarter turn because the wall it hangs on runs
// the other way. That is a placement rotation, not a swing, and this item never
// touched it.
//
// So the assertion is written as the question actually being asked, which is
// also the one that cannot be confused by placement:
//
//   · NO leaf may sit at the old `SWING = -0.85`. That value is not axis
//     aligned, so nothing can produce it by placement — only the constant this
//     item deleted could.
//   · every leaf must be AXIS-ALIGNED: 0 or ±90°, which is what a shut door on
//     an axis-aligned wall must be, whatever turned it.
//
// Both together say "the kit's private angle is gone and nothing was left
// half-open", without asserting anything about a mesh's placement.
const OLD_SWING = -0.85;
const AXES = [0, Math.PI / 2, -Math.PI / 2];
const stillSwung = leaves.filter((l) => Math.abs(l.ry - OLD_SWING) < 0.02);
const offAxis = leaves.filter((l) => !AXES.some((a) => Math.abs(l.ry - a) < 1e-3));
const atAjar = leaves.filter((l) => Math.abs(l.ry - WANT) < 1e-6);

console.log(`\n${atAjar.length} of ${leaves.length} sit exactly at LEAF_AJAR = ${WANT} (${deg(WANT)})`);
console.log(`${leaves.length - atAjar.length} are turned a quarter turn by their WALL, not by a swing`
  + ` — ${[...new Set(leaves.filter((l) => !atAjar.includes(l)).map((l) => deg(l.ry)))].join(', ') || '(none)'}`);
for (const w of stillSwung.slice(0, 8)) console.log(`  STILL SWUNG  rotation.y ${w.ry} (${deg(w.ry)}) at x ${w.x}`);
for (const w of offAxis.slice(0, 8)) console.log(`  OFF AXIS     rotation.y ${w.ry} (${deg(w.ry)}) at x ${w.x}`);

const bad = stillSwung.length + offAxis.length;
console.log(bad
  ? `\nFAIL — ${stillSwung.length} leaf/leaves at the old SWING ${OLD_SWING},`
    + ` ${offAxis.length} off axis`
  : `\nall ${leaves.length} leaves are axis-aligned and none carries the old SWING ${OLD_SWING}`);
await b.close();
process.exit(bad ? 1 : 0);
