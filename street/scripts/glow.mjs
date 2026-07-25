// feat/glow — is the lamp glow ON the lamp, or beside it?
//
// The complaint was never about the drawing, it was about position: the halo
// sat inside the opaque head box, which ate its core and left a smudge to one
// side. So this script does two things — it takes the two framings the user
// shot from (close low look at a head, and the wide street pool), and it
// measures the overlap between the halo's bright core and the lamp head in
// SCREEN space, which is the thing that was actually wrong.
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/glow.mjs [shots|probe|all]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const mode = process.argv[2] ?? 'all';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 880, height: 750 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, process.env.SHOT_URL ?? 'http://localhost:4177/');   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(500);
await page.evaluate(() => window.__ct.clock(2, 30));      // deep night
await page.waitForTimeout(1200);

const shot = async (n, x, z, tx, tz, gy = 0, p = 0) => {
  await page.evaluate(([x, z, tx, tz, gy, p]) =>
    window.__ct.warp(x, z, Math.atan2(tx - x, -(tz - z)), gy, p), [x, z, tx, tz, gy, p]);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `shots/gl-${n}.png` });
};

if (mode === 'probe' || mode === 'all') {
  // where is the halo relative to the head it belongs to?
  const r = await page.evaluate(() => {
    const sc = window.__ct.scene();
    // FOUND BY STAMP, not by box dimensions.
    //
    // This matched heads and lenses by exact size, and it broke twice for the
    // same reason. First it knew only the main street's shape and silently
    // checked 8 of 11 lamps. Then, once the world grew, a sheet belonging to
    // another module happened to sit within 0.5 m of a head-and-lens pair and
    // got adopted as a 22nd lamp — and mis-measured, because it was never one.
    // There are 50 halo-shaped additive sheets in this world now and only 21
    // are lamps; size cannot tell them apart and was never going to.
    const halos = [], heads = [], lenses = [];
    sc.traverse((o) => {
      const k = o.userData?.lampPart;
      if (k === 'halo') halos.push(o);
      else if (k === 'head') heads.push(o);
      else if (k === 'lens') lenses.push(o);
    });
    const near = (a, list) => list
      .filter((c) => Math.hypot(c.position.x - a.position.x, c.position.z - a.position.z) < 0.5)
      .sort((p, q) => Math.abs(p.position.y - a.position.y) - Math.abs(q.position.y - a.position.y))[0];
    return halos.map((h) => {
      const hd = near(h, heads), ln = near(h, lenses);
      if (!hd || !ln) return null;
      const g = hd.geometry.parameters;
      return {
        haloY: +h.position.y.toFixed(3),
        dx: +(h.position.x - hd.position.x).toFixed(3),
        dz: +(h.position.z - hd.position.z).toFixed(3),
        insideHead: h.position.y > hd.position.y - g.height / 2 &&
                    h.position.y < hd.position.y + g.height / 2,
        offLens: +(h.position.y - ln.position.y).toFixed(3),
      };
    }).filter(Boolean);
  });
  const halosSeen = await page.evaluate(() => {
    let n = 0; window.__ct.scene().traverse((o) => { if (o.userData?.lampPart === 'halo') n++; });
    return n;
  });
  console.log(`\n${r.length} lamps paired of ${halosSeen} stamped halos (street heads and park lanterns)`);
  const bad = r.filter((h) => h.insideHead || Math.abs(h.dx) > 0.01 || Math.abs(h.dz) > 0.01);
  // Every stamped halo must pair. The count is reported rather than asserted:
  // how many lamps this world has is a design decision that changes, and a
  // check that fails when someone adds a lamp is a check that gets ignored.
  // What must hold is that every lamp I build is anchored — which is what the
  // stamp makes answerable.
  if (r.length !== halosSeen) {
    console.error(`\n  FAIL ${halosSeen - r.length} stamped halo(s) could not be paired with a head and lens`);
    process.exitCode = 1;
  }
  const offLens = [...new Set(r.map((h) => h.offLens))];
  console.log(`  halo is directly over its head in x/z: ${r.every((h) => !h.dx && !h.dz) ? 'yes' : 'NO'}`);
  console.log(`  halo centre buried inside the opaque head box: ${r.some((h) => h.insideHead) ? 'YES — it will be eaten' : 'no'}`);
  console.log(`  halo centre vs the lens it comes out of: ${offLens.join(', ')} m`);
  console.log(`\n  ${bad.length === 0 ? 'OK  ' : 'FAIL'} every halo is anchored on its lamp, core unoccluded`);

  // DOES THE POOL ACTUALLY LIGHT ANYTHING? The user asked for "light around the
  // light posts to show up on the objects and entities under the lights", and
  // this script only ever checked that the halo SHEET hangs in the right place.
  // A halo is a decal; the thing the request is about is POOL_GAIN reaching the
  // materials underneath it, and nothing asserted that.
  //
  // nightgrade.mjs does not cover it either — it treats poolLit as an EXEMPTION
  // from the must-dim rule, which is the opposite question. Exempt and lit look
  // identical to a check that only asks whether things got darker.
  const pool = await page.evaluate(() => {
    const S = window.__ct.scene(); S.updateMatrixWorld(true);
    const lamps = [];
    S.traverse((o) => {
      if (o.isMesh && (o.userData.lampPart === 'lens' || o.userData.parkLantern)) {
        const e = o.matrixWorld.elements; lamps.push([e[12], e[14]]);
      }
    });
    const REG = { main: { near: [], far: [] }, side: { near: [], far: [] } };
    S.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      // ONE MESH CAN CARRY SEVERAL MATERIALS, and this walked o.material.map as
      // though it never did — so every multi-material mesh was invisible to it.
      // a7f2241d found the same blind spot in nightgrade; 528 of this world's
      // meshes are multi-material, and my own 24-hour probe had it too.
      //
      // Measured before fixing: the far population on the main street goes 48
      // -> 152 and on the side street 8 -> 50, while the medians move 0.6184 ->
      // 0.6103 and 0.045 -> 0.045. The verdict never changed; the sample was a
      // third of what it claimed. A side-street 'far' of 8 was also uncomfortably
      // close to this script's own floor of 4.
      for (const mat of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!mat.map) continue;
      if (!o.userData.graded && !mat.userData?.graded) continue;
      const e = o.matrixWorld.elements, x = e[12], z = e[14];
      // MAIN STREET **AND SIDE STREET**. The side street was excluded for no
      // reason I can find and it pools hardest of the three: 1.0 against 0.0529
      // mid-block, 18.9x. Eight of the twenty-one lamps live there.
      const main = Math.abs(x) <= 9 && z <= 2 && z >= -96;
      const side = x > 9 && z < -94;
      if (!main && !side) return;
      // THE PARK IS DELIBERATELY OUT, and the reason is structural rather than
      // a defect — worth writing down so nobody "fixes" it by widening this and
      // gets a false failure. Measured at 23:00: park near-lamp 0.0938 against
      // 0.045 mid-block, only 2.08x, which would fail the 3x bar below.
      //
      // It is not that park lamps are missing from the light. They push onto the
      // same lampHeads registry (ct/props.ts:921) and lay their own 4.4 m pool
      // decal. It is that this tint is PER MATERIAL, so a mesh takes one pool
      // value from its own origin — and the park floor is a single 32 x 30
      // plane at (-23, 0.1, -83), while the street's walk is cut into slabs.
      // One mesh cannot show a pool under one of its lamps. The park's light
      // arrives as the additive decal, which is park.mjs's business, and it
      // asserts the lanterns are emitting there.
      const c = mat.color, L = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
      const d = Math.min(...lamps.map(([lx, lz]) => Math.hypot(x - lx, z - lz)));
      const R = REG[main ? 'main' : 'side'];
      if (d < 3.0) R.near.push(L); else if (d > 9) R.far.push(L);
      }
    });
    const med = (a) => (a.length ? a.slice().sort((p, q) => p - q)[Math.floor(a.length / 2)] : null);
    const out = { lamps: lamps.length };
    for (const [k, v] of Object.entries(REG))
      out[k] = { n: v.near.length, f: v.far.length, nearMed: med(v.near), farMed: med(v.far) };
    return out;
  });
  // PER REGION, NOT POOLED. Widening the window to take in the side street and
  // then taking ONE median across both would have added samples and no
  // coverage: the main street has far more materials, so its median carries the
  // verdict and every side-street lamp could go dark behind it. A median over a
  // mixed population answers a question nobody asked. Same error as wetness
  // judging nine pools by whichever it reached first, one level up.
  console.log('');
  for (const key of ['main', 'side']) {
    const q = pool[key];
    if (q.nearMed === null || q.farMed === null || q.n < 4 || q.f < 4) {
      console.log(`  FAIL ${key}: cannot answer — ${q.n} lit / ${q.f} unlit samples`);
      process.exitCode = 1;
      continue;
    }
    // Measured at 23:00: main 0.6184/0.0450 = 13.7x, side 1.0/0.0529 = 18.9x.
    // The bar is 3x — far under what the world does, far over a flat grade.
    const ratio = q.nearMed / Math.max(q.farMed, 1e-4);
    const ok = ratio > 3;
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${key} street: under a lamp ${q.nearMed.toFixed(4)} vs ` +
      `mid-block ${q.farMed.toFixed(4)} — ${ratio.toFixed(1)}x (${q.n}/${q.f} samples)`);
    if (!ok) process.exitCode = 1;
  }
  console.log(`       ${pool.lamps} lamps carry a lens or lantern stamp`);
  if (bad.length) process.exit(1);
}

if (mode === 'shots' || mode === 'all') {
  // 1. the user's close look up at a head — the framing that showed it beside
  await shot('head-close', 4.0, -20.5, 3.4, -23.5, 1.55, 0.42);
  await shot('head-side', 0.5, -23.0, 3.6, -23.0, 1.6, 0.34);
  // 2. the user's wide street shot — head glow + ground pool together
  await shot('street', 1.2, -6.0, -1.0, -30.0, 1.65, -0.06);
  await shot('pool', -2.0, -33.0, -3.6, -38.5, 1.65, -0.22);
  console.log('shots -> shots/gl-*.png');
}

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nno page errors');
