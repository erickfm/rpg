// DO THE PILLARS BLOCK THE WINDOWS?
//
// The user, routed to me at FEATURE-REQUESTS.md:1085: *"pillars of the church
// seem not fully thought out. they block the windows i think?"* The diagnosis in
// `ct/civic.ts` is that the buttresses are REAL BOXES placed in metres and the
// lancets are PAINTED in texel space, and until the bay set-out landed nothing
// reconciled the two — so nothing made them miss, and they didn't, by 0.82 m of
// a 2 m window each side.
//
// The fix is in the source and reads convincingly. That is not the test. The
// desk's own words to me: *"code presence is NOT the test."* And there is no
// ledger row for this request at all, so nothing has ever been asked of the
// built world.
//
// WHAT THIS MEASURES, and why it is not just the source arithmetic again: the
// buttresses are read OUT OF THE SCENE as world boxes, and compared against the
// bay divisions the front is set out on. If a buttress has drifted off its bay
// — the exact failure the fix exists to prevent — these disagree. Re-deriving
// `BUT_X` from the same constants the builder used would prove nothing.
//
// It also SHOOTS the front, because the complaint is a visual one and the
// numbers cannot tell you whether it looks thought-out.
//
//   SHOT_URL=http://localhost:4182/ node scripts/E-church-front.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
const OUT = 'shots/E-church-front';
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 700 } });
page.on('pageerror', (e) => console.error('PAGEERR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 20));

let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };

// ── the church front, read out of the scene ──────────────────────────────
//
// Everything narrow and tall standing in front of the nave face. Reported in
// full rather than filtered down to four, so that if the shape of the front
// changes this prints something a reader can argue with instead of quietly
// matching nothing (GOTCHAS 34).
// POSITIVE CONTROL: `E_NUDGE=1` slides one pier 0.6 m into its bay, which is
// the user's fault re-created — a pillar crossing a window. Every clearance
// claim below MUST go red. This is the mutation, not a rig of the arithmetic:
// the box really moves in the scene, so what is tested is the measurement and
// not my opinion of it. GOTCHAS 27 — a check nobody has watched fail is one
// you will argue with, and this one exists to close a USER complaint.
if (process.env.E_NUDGE) {
  const moved = await page.evaluate(() => {
    const s = window.__ct.scene();
    s.updateMatrixWorld(true);
    // ALL THREE STAGES of the pier at z -82.9, not one of them. Moving a single
    // stage leaves the pier in pieces and trips the "four piers" assertion
    // first, so the CLEARANCE predicate - the one that answers the user - never
    // runs and never gets tested. Move the whole pier and the front still has
    // four of them; what changes is the width of the bay beside it.
    const stages = [];
    s.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const e = o.matrixWorld.elements;
      if (Math.abs(e[12] - 9.5) > 0.4 || Math.abs(e[14] + 82.9) > 0.4) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const h = o.geometry.boundingBox.max.y - o.geometry.boundingBox.min.y;
      if (h > 4) stages.push(o);
    });
    if (!stages.length) return null;
    const best = stages[0];
    const before = best.matrixWorld.elements[14];
    // MOVE IT IN WORLD TERMS. `position` is LOCAL, and this pier hangs off a
    // GROUP rotated so that local z is not the facade axis at all - the first
    // cut just did `position.z -= 0.6`, the mesh did not move a millimetre in
    // world space, and every clearance claim came back green off an unmutated
    // world. The control caught itself, which is the entire reason to make a
    // control announce whether it took.
    //
    // So: name the world position I want, then convert it back through the
    // parent's inverse. Works whatever the group is doing.
    const V = best.position.constructor;
    for (const o of stages) {
      const target = new V().setFromMatrixPosition(o.matrixWorld);
      target.z -= 0.6;
      o.parent.updateMatrixWorld(true);
      o.position.copy(target.applyMatrix4(o.parent.matrixWorld.clone().invert()));
      o.updateMatrixWorld(true);
    }
    const after = best.matrixWorld.elements[14];
    return { stages: stages.length, before: +before.toFixed(3), after: +after.toFixed(3),
             moved: Math.abs(after - before) > 0.3,
             parent: best.parent ? best.parent.type : 'none' };
  });
  if (!moved) { console.log('CONTROL: could not find the pier to move — the control did not run'); await b.close(); process.exit(3); }
  console.log(`CONTROL: pier world z ${moved.before} -> ${moved.after} (parent ${moved.parent}, ${moved.stages} stages moved)`);
  if (!moved.moved) {
    console.log('CONTROL DID NOT TAKE: the mesh did not move in world space, so a green below proves nothing.');
    await b.close(); process.exit(3);
  }
  console.log('CONTROL: the pier really moved 0.6 m into its bay — every clearance claim MUST go red');
}

const front = await page.evaluate(() => {
  const s = window.__ct.scene();
  s.updateMatrixWorld(true);
  const boxes = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const e = o.matrixWorld.elements;
    const cx = e[12], cy = e[13], cz = e[14];
    if (cx < 5 || cx > 22 || cz < -95 || cz > -68) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox; if (!bb) return;
    // WORLD extents, from the eight corners through matrixWorld — NOT the
    // geometry box scaled, which is what I did first. That reads LOCAL axes and
    // is simply wrong for anything rotated: it reported these piers as 0.10 m
    // wide slivers. It is the bounding-box trap from my own notes, where a box
    // that turns with something hides what it really spans.
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const px of [bb.min.x, bb.max.x]) {
      for (const py of [bb.min.y, bb.max.y]) {
        for (const pz of [bb.min.z, bb.max.z]) {
          const m = o.matrixWorld.elements;
          const wx = m[0] * px + m[4] * py + m[8] * pz + m[12];
          const wy = m[1] * px + m[5] * py + m[9] * pz + m[13];
          const wz = m[2] * px + m[6] * py + m[10] * pz + m[14];
          if (wx < x0) x0 = wx; if (wx > x1) x1 = wx;
          if (wy < y0) y0 = wy; if (wy > y1) y1 = wy;
          if (wz < z0) z0 = wz; if (wz > z1) z1 = wz;
        }
      }
    }
    boxes.push({
      cx: +cx.toFixed(2), cy: +cy.toFixed(2), cz: +cz.toFixed(2),
      w: +(x1 - x0).toFixed(2), h: +(y1 - y0).toFixed(2), d: +(z1 - z0).toFixed(2),
      x1: +x1.toFixed(2),
      z0: +z0.toFixed(2), z1: +z1.toFixed(2),
    });
  });
  return boxes;
});

// A buttress on this front is TALL, NARROW ALONG THE FACADE, and SHALLOW —
// it is a pier standing proud of a wall. The nave and tower are the same
// height but many metres deep; the copings are wide and flat.
// THE FILTER IS PRINTED BEFORE IT IS TRUSTED. My first cut guessed the shape
// (4-16 m tall, 0.5-1.6 m along the facade, under 1.6 m proud) and matched
// NOTHING, then reported "the front has no piers" as though that were a fact
// about the church. It was a fact about my guess. So dump the tall meshes and
// let the numbers pick the filter.
const tall = front.filter((x) => x.h >= 3).sort((a, b) => b.h - a.h).slice(0, 14);
console.log('tall meshes on the church block (h, then footprint):');
for (const x of tall) {
  console.log(`   h ${x.h.toFixed(1).padStart(5)}  x-depth ${x.w.toFixed(2)}  z-width ${x.d.toFixed(2)}  at (${x.cx}, ${x.cz})`);
}
const buttresses = front
  .filter((x) => x.h >= 4 && x.h <= 16 && x.d >= 0.5 && x.d <= 1.6 && x.w <= 1.6)
  .sort((a, b) => a.cz - b.cz);
console.log(`meshes on the church block: ${front.length}; buttress stages: ${buttresses.length}`);

// A BUTTRESS IS NOT ONE BOX, IT IS THREE. Measured: each pier is stacked
// stages - 0.92 m wide x 6.4 m tall, then 0.76 x 11.4, then 0.60 x 15.4 - which
// is what "buttresses stepping down the front" means. My first predicate
// counted stages and asked for four, and got twelve.
//
// AND THE STEPPING IS THE WHOLE POINT HERE. The lancets sit 9.2-13.4 m up,
// where the base stage has already ended. Testing the 0.92 m base against a
// window four metres above it measures a clearance that does not exist in
// either direction - it is the wrong slice of the building.
const LANCET_LO = 9.2, LANCET_HI = 13.4;
const piers = new Map();
for (const b of buttresses) {
  const k = b.cz.toFixed(1);
  if (!piers.has(k)) piers.set(k, []);
  piers.get(k).push(b);
}
const cols = [...piers.entries()]
  .map(([k, stages]) => {
    // the stages that actually reach the window band, widest first
    const reach = stages.filter((s) => s.h >= LANCET_LO).sort((a, b) => b.d - a.d);
    const at = reach[0] ?? stages.sort((a, b) => b.d - a.d)[0];
    return { cz: +k, atBand: at, base: stages.sort((a, b) => b.d - a.d)[0] };
  })
  .sort((a, b) => a.cz - b.cz);
console.log(`piers: ${cols.length}, each of ${[...piers.values()][0]?.length ?? 0} stages`);
for (const c of cols) {
  console.log(`   pier z ${c.cz.toFixed(2)}  base ${c.base.d.toFixed(2)} m wide  ->  ${c.atBand.d.toFixed(2)} m at lancet height (z ${c.atBand.z0}…${c.atBand.z1})`);
}

const LANCET_W = 1.30;
report('the front has four piers, so it has three bays',
  cols.length === 4, `${cols.length} piers found`);

if (cols.length === 4) {
  const bay = (i) => +(cols[i + 1].atBand.z0 - cols[i].atBand.z1).toFixed(2);
  const bays = [bay(0), bay(1), bay(2)];
  console.log(`bays at lancet height: ${bays.map((b) => b.toFixed(2) + ' m').join(', ')}`);
  const side = [bays[0], bays[2]];
  const worst = Math.min(...side.map((b) => (b - LANCET_W) / 2));
  report('a 1.30 m lancet centred in each side bay clears the piers',
    worst > 0.05,
    `tightest side bay leaves ${worst.toFixed(2)} m each side, measured where the window is`);
  report('…and the two side bays match, so the front is symmetric',
    Math.abs(side[0] - side[1]) < 0.02,
    `${side[0].toFixed(2)} m vs ${side[1].toFixed(2)} m`);
  report('the centre bay is the widest, so the doorway is in the middle one',
    bays[1] > bays[0] && bays[1] > bays[2],
    `centre ${bays[1].toFixed(2)} m against sides ${side.map((b) => b.toFixed(2)).join(' / ')} m`);
}

// ── and LOOK at it, from the pavement, which is where the user was ───────
const shoot = async (k, x, z, yaw, pitch, what) => {
  await page.evaluate(([x, z, yaw, p]) => window.__ct.warp(x, z, yaw, 0.14, p), [x, z, yaw, pitch]);
  await page.waitForTimeout(800);
  const png = await page.screenshot();
  const tones = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const g = document.createElement('canvas'); g.width = 120; g.height = 76;
    const c = g.getContext('2d');
    c.drawImage(img, 0, 0, img.width, Math.floor(img.height * 0.82), 0, 0, 120, 76);
    const d = c.getImageData(0, 0, 120, 76).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4) seen.add(`${d[i] >> 3},${d[i + 1] >> 3},${d[i + 2] >> 3}`);
    return seen.size;
  }, png.toString('base64'));
  // a dead capture and a real frame are told apart before either is graded
  if (tones < 6) { console.log(`  ${k}: DEAD CAPTURE (${tones} tones) — not written`); return false; }
  writeFileSync(`${OUT}/${k}.png`, png);
  console.log(`  ${OUT}/${k}.png  (${tones} tones)  ${what}`);
  return true;
};

console.log('\nthe west front from the pavement:');
// FROM THE FAR PAVEMENT. The first stations stood at x 5.4, which is 3.5 m
// from a wall whose windows start 9.2 m up — you cannot see a lancet from
// there, and the frames showed a doorway and two blurred piers. The lancets
// are 9.2-13.4 m up, so the station has to be back across the street.
await shoot('front-far', -5.4, -79.5, Math.PI / 2, 0.42, 'the whole west front from the far pavement — piers and lancets together');
await shoot('front-lancet-n', -5.4, -76.0, Math.PI / 2, 0.45, 'the north side bay and its lancet');
await shoot('front-lancet-s', -5.4, -83.0, Math.PI / 2, 0.45, 'the south side bay and its lancet');
await shoot('front-near', 5.4, -79.5, Math.PI / 2, 0.30, 'and the doorway close up, where a player actually stands');

console.log(fails ? `\n${fails} FAILED` : '\nthe piers stand on the bay divisions and the lancets clear them');
await b.close();
process.exit(fails ? 1 : 0);
