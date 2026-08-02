// ARE THE WEEDS CLUSTERED, OR ARE THEY A DOTTED LINE?
//
// The user's three words were the spec — *"VARIATION, RANDOM PLACING,
// CLUSTERING"* — and their complaint was that the tufts were "EVENLY SPACED
// and all the same size, so they read as a dotted line rather than as plants".
// Both halves of that are distributions, so both can be measured instead of
// squinted at, and that matters here because I have twice reported this fixed
// on the strength of the code containing a `clump()` call. Code presence is
// not the test.
//
// THERE ARE TWO WAYS TO LOOK UNIFORM, and only one of them is a dotted line.
// A tuft every 80 cm is one. An unbroken dense fringe down both edges of every
// path is the other, and it is the one this park actually had — 92% of tufts
// in a clump, mean neighbour 0.16 m, and not a single tuft standing more than
// 1.2 m from another. From three metres away, which is where the player is,
// that reads as a green stripe.
//
// So the measurement that matters is not spacing between TUFTS, it is the
// empty ground between CLUMPS. The user's sentence contains both halves and
// the empty one is doing the work: *"A metre of nothing followed by a dense
// patch of five looks natural; one every 80 cm never will."* Hence: single-
// link the tufts into clumps, then check that a good share of those clumps
// have a clear metre beside them, that the clumps vary in size, and that the
// tufts vary in scale.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

const data = await page.evaluate(() => {
  const V3 = Object.getPrototypeOf(window.__ct.scene().position).constructor;
  const tufts = [];
  window.__ct.scene().traverse((o) => {
    // a tuft is the two crossed quads of `weeds.ts` — 0.30 x 0.35 at scale 1,
    // so match on the shape rather than on a name nobody sets
    if (!o.isMesh || o.geometry?.type !== 'PlaneGeometry') return;
    const p = o.geometry.parameters;
    if (!p || Math.abs(p.width / p.height - 0.30 / 0.35) > 0.02) return;
    if (p.height > 0.7 || p.height < 0.15) return;
    o.updateWorldMatrix(true, false);
    const c = new V3().setFromMatrixPosition(o.matrixWorld);
    if (c.x < -39 || c.x > -7 || c.z < -99 || c.z > -67) return;
    tufts.push({ x: +c.x.toFixed(3), z: +c.z.toFixed(3), s: +(p.height / 0.35).toFixed(3) });
  });
  // two quads per tuft at one position — collapse them
  const seen = new Map();
  for (const t of tufts) seen.set(`${t.x},${t.z}`, t);
  return [...seen.values()];
});

if (data.length < 12) {
  console.log(`only ${data.length} tufts found in the park — cannot judge a distribution`);
  console.log('EXIT 3: this measured nothing. Check the tuft geometry match, not the park.');
  await b.close();
  process.exit(3);                       // "cannot answer", not "world is wrong"
}

// SIZE VARIATION — "all the same size" is a spread of zero.
const sc = data.map((t) => t.s);
const sMean = sc.reduce((a, c) => a + c, 0) / sc.length;
const sSd = Math.sqrt(sc.reduce((a, c) => a + (c - sMean) ** 2, 0) / sc.length);
const sMin = Math.min(...sc), sMax = Math.max(...sc);

// THE GAP THAT MATTERS IS BETWEEN CLUMPS, NOT INSIDE THEM.
//
// The first version of this measured nearest-neighbour distance over every
// tuft and called 0.16 m "clustered". It is — but with 92% of tufts inside a
// clump and NOT ONE standing more than 1.2 m from a neighbour, what that
// actually describes is an unbroken dense fringe down every path edge. That
// is a different failure from the dotted line and it looks just as uniform
// from three metres away, which is the only place the player ever sees it.
// The user's sentence is explicit about the empty half: *"A metre of nothing
// followed by a dense patch of five."* So single-link the tufts into clumps
// and measure the NOTHING between them.
const clumps = [];
{
  const left = data.slice();
  while (left.length) {
    const seed = left.pop(), grp = [seed];
    for (let i = 0; i < grp.length; i++) {
      for (let j = left.length - 1; j >= 0; j--) {
        if (Math.hypot(left[j].x - grp[i].x, left[j].z - grp[i].z) <= 0.45) grp.push(left.splice(j, 1)[0]);
      }
    }
    let cx = 0, cz = 0;
    for (const t of grp) { cx += t.x; cz += t.z; }
    clumps.push({ x: cx / grp.length, z: cz / grp.length, n: grp.length });
  }
}
const cGaps = clumps.map((c) => {
  let best = Infinity;
  for (const d of clumps) {
    if (d === c) continue;
    const m = Math.hypot(d.x - c.x, d.z - c.z);
    if (m < best) best = m;
  }
  return best;
});
const cMean = cGaps.reduce((a, c) => a + c, 0) / (cGaps.length || 1);
const cSd = Math.sqrt(cGaps.reduce((a, c) => a + (c - cMean) ** 2, 0) / (cGaps.length || 1));
const sizes = clumps.map((c) => c.n);
const openings = cGaps.filter((g) => g >= 1.0).length;

// CLUSTERING — nearest-neighbour gap for every tuft, then the spread of those.
const gaps = data.map((t) => {
  let best = Infinity;
  for (const u of data) {
    if (u === t) continue;
    const d = Math.hypot(u.x - t.x, u.z - t.z);
    if (d < best) best = d;
  }
  return best;
});
const gMean = gaps.reduce((a, c) => a + c, 0) / gaps.length;
const gSd = Math.sqrt(gaps.reduce((a, c) => a + (c - gMean) ** 2, 0) / gaps.length);
const cv = gSd / gMean;

// and the shape of it: how much of the park's weed population sits in a tight
// knot, versus strung out. A tuft with a neighbour inside 0.35 m is IN a clump.
const inClump = gaps.filter((g) => g <= 0.35).length;
const lonely = gaps.filter((g) => g >= 1.2).length;

console.log(`${data.length} tufts in the park`);
console.log(`  size      mean ${sMean.toFixed(2)}  sd ${sSd.toFixed(2)}  range ${sMin.toFixed(2)}-${sMax.toFixed(2)}`);
console.log(`  gaps      mean ${gMean.toFixed(2)} m  sd ${gSd.toFixed(2)}  CV ${cv.toFixed(2)}`);
console.log(`  clumped   ${inClump}/${data.length} have a neighbour within 0.35 m`);
console.log(`  isolated  ${lonely}/${data.length} stand more than 1.2 m from anything`);

console.log(`  clumps    ${clumps.length}, of ${Math.min(...sizes)}-${Math.max(...sizes)} tufts`);
console.log(`  between   mean ${cMean.toFixed(2)} m  sd ${cSd.toFixed(2)}`);
console.log(`  openings  ${openings}/${clumps.length} clumps have a metre or more of clear ground beside them`);

const fails = [];
if (sSd < 0.08) fails.push(`SIZE: sd ${sSd.toFixed(2)} — they are all the same size, which is the user's words exactly`);
if (inClump / data.length < 0.35) fails.push(`CLUMPING: only ${(100 * inClump / data.length).toFixed(0)}% sit in a tight group`);
// the two ways of being uniform, and the user has photographed one of them
if (cMean < 0.8) fails.push(`FRINGE: clumps average ${cMean.toFixed(2)} m apart — they merge into a continuous band, which reads as uniform just as a dotted line does`);
if (openings / clumps.length < 0.30) fails.push(`NO GAPS: only ${(100 * openings / clumps.length).toFixed(0)}% of clumps have a clear metre beside them — the user asked for "a metre of nothing followed by a dense patch"`);
if (Math.max(...sizes) - Math.min(...sizes) < 3) fails.push(`CLUMP SIZE: every clump is ${Math.min(...sizes)}-${Math.max(...sizes)} tufts — same patch repeated`);

for (const f of fails) console.log('FAIL ', f);
if (!fails.length) console.log(`PASS  ${clumps.length} clumps of ${Math.min(...sizes)}-${Math.max(...sizes)}, ${cMean.toFixed(2)} m apart, varied in size`);
await b.close();
process.exit(fails.length ? 1 : 0);
