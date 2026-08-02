// WHICH WAY DOES EACH ROW FACE, AND HOW MANY CARS ARE THERE REALLY?
//
// The user, twice: *"cars on the left row face backwards"*. Two builders have
// answered it and they do not agree, so this asks the world from scratch.
//
// ── the instrument bug that let both of them be honest ──
//
// `lot-layout.mjs` counts every GROUP under the lot with >= 8 meshes. A car is
// built as a group inside a group — `g0` holds the dressing, `makeCar` returns
// its own group inside it — so a car with enough body meshes is counted TWICE.
// It reports "18 cars, 18 nose-out" on a lot that has 11. The verdict happens
// to survive (a child shares its parent's heading) but the COUNT does not, and
// a check that cannot count the thing it is checking is a check nobody should
// lean on. `lot-clearance.mjs` gets this right — it skips any group nested in
// another — and that is the rule used here.
//
// So this prints BOTH numbers, on purpose. If they ever converge, the double
// count is gone.
//
// ── the heading is read, never recomputed ──
//
// A yaw put through a formula is how this got reported wrong the first time.
// The heading here is the group's own local -z axis pulled out of its world
// matrix, which is the direction the car's nose actually points in the world
// no matter what any convention says.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/I-rows.mjs
//        --selftest   turn the left row around, require this to go red
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';

const ARGS = flags(['--selftest']);       // unknown flags exit 2, not ignored
const URL = aim('http://localhost:4190/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);

// THE MUTATION IS THE POINT. This check went green the first time I ran it, on
// a fault the user has reported twice — so "green" here is a claim that needs
// its own evidence. Turning the south row 180 degrees reproduces exactly the
// bug that was reported, in the live scene, and this must go red on it.
if (ARGS.selftest) {
  const turned = await p.evaluate(() => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    const roots = new Set(); let n = 0;
    const inside = (o) => { for (let q = o.parent; q; q = q.parent) if (roots.has(q)) return true; return false; };
    s.traverse((o) => {
      if (!o.isGroup) return;
      let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
      if (mod !== 'lot' || inside(o)) return;
      let m = 0; o.traverse((c) => { if (c.isMesh) m++; });
      if (m < 8) return;
      roots.add(o);
      if (o.position.z < 2.6) { o.rotation.y += Math.PI; n++; }   // the south row
    });
    s.updateMatrixWorld(true);
    return n;
  });
  console.log(`  SELFTEST: turned ${turned} south-row cars 180 degrees — this must go red\n`);
}

const data = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const roots = new Set(), cars = [];
  let nested = 0;
  const inside = (o) => { for (let q = o.parent; q; q = q.parent) if (roots.has(q)) return true; return false; };
  s.traverse((o) => {
    if (!o.isGroup) return;
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    if (mod !== 'lot') return;
    let n = 0; o.traverse((c) => { if (c.isMesh) n++; });
    if (n < 8) return;
    if (inside(o)) { nested++; return; }          // a car's own child group
    roots.add(o);
    const e = o.matrixWorld.elements;
    // local -z in world = the nose. Column 2 of the basis is local +z.
    const hx = -e[8], hz = -e[10];
    cars.push({
      x: +e[12].toFixed(2), z: +e[14].toFixed(2),
      hx: +hx.toFixed(3), hz: +hz.toFixed(3),
      yaw: +Math.atan2(-e[8], -e[10]).toFixed(3),
      meshes: n,
    });
    // DIMENSIONS ARE DELIBERATELY NOT MEASURED HERE. My first version reported
    // a "4.47 m wide" car: Box3.applyMatrix4 returns the AABB of the transformed
    // box, so every rotated wheel and angled panel inflates the union, and the
    // balloon rod stakes it out another half metre. lot-clearance.mjs measures
    // the real bodies (1.88 x 4.52 and so on) and is the place to ask. A second
    // instrument answering the same question worse is how this area got two
    // contradictory published numbers in the first place.
  });
  return { cars, nested };
});

const { cars, nested } = data;
console.log(`\n  ${cars.length} cars  (and ${nested} nested groups that lot-layout also counts,`);
console.log(`   which is why it reports ${cars.length + nested})\n`);

const zs = cars.map((c) => c.z);
const zMid = (Math.min(...zs) + Math.max(...zs)) / 2;
console.log(`  aisle centreline z = ${zMid.toFixed(2)}\n`);

// LEFT AND RIGHT AS THE USER MEANS THEM. You enter the lot from the street
// driving +x. Facing +x with +y up, right = forward x up = +z, so the LEFT row
// is the one at LOW z (south) and the RIGHT row is the one at HIGH z (north).
// Writing that down because it is the whole question: "the left row" has to be
// resolved to an axis before anything can be said about it.
const rows = [
  ['LEFT  (south, low z) ', cars.filter((c) => c.z < zMid)],
  ['RIGHT (north, high z)', cars.filter((c) => c.z > zMid)],
];

let FAIL = [];
for (const [name, row] of rows) {
  if (!row.length) { FAIL.push(`${name} has no cars at all`); continue; }
  console.log(`  ${name}  ${row.length} cars`);
  for (const c of row.sort((a, b) => a.x - b.x)) {
    // toward the aisle = toward zMid. Positive means the nose points at it.
    const toAisle = (zMid - c.z) > 0 ? c.hz : -c.hz;
    const face = toAisle > 0.2 ? 'NOSE-out' : toAisle < -0.2 ? 'TAIL-out' : 'square';
    // and which way along the aisle it rakes: -x is toward the street/exit
    const rake = c.hx < -0.05 ? 'raked to the STREET' : c.hx > 0.05 ? 'raked to the BACK  ' : 'no rake           ';
    console.log(`     x ${String(c.x).padStart(6)}  z ${String(c.z).padStart(6)}  `
      + `nose (${c.hx.toFixed(2)}, ${c.hz.toFixed(2)})  ${face}  ${rake}`);
    if (face !== 'NOSE-out') FAIL.push(`${name}: car at x ${c.x} z ${c.z} is ${face}`);
  }
  // every car in a row must present the SAME face — the queue's own test
  const noses = row.map((c) => Math.sign(((zMid - c.z) > 0 ? c.hz : -c.hz)));
  if (new Set(noses).size > 1) FAIL.push(`${name}: the row is not consistent — mixed faces within one row`);
  const rakes = new Set(row.map((c) => Math.sign(c.hx)));
  if (rakes.size > 1) FAIL.push(`${name}: the row rakes BOTH ways — some cars angled to the street, some to the back`);
  console.log('');
}

// The two rows must also agree with EACH OTHER about the rake, or the lot reads
// as two different lots. A herringbone is a chevron: both rows rake the same
// way along the aisle, and only the nose direction mirrors.
const lRake = Math.sign(rows[0][1][0]?.hx ?? 0), rRake = Math.sign(rows[1][1][0]?.hx ?? 0);
if (lRake && rRake && lRake !== rRake)
  FAIL.push(`the two rows rake OPPOSITE ways (${lRake} vs ${rRake}) — that is a fishbone, not a herringbone`);

if (FAIL.length) { console.log('\nFAIL'); for (const f of FAIL) console.log('  · ' + f); }
else console.log('both rows nose-out toward the aisle, raked the same way, every car the same face.');

await b.close();
process.exit(FAIL.length ? 1 : 0);
