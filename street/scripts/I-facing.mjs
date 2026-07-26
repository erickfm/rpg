// DOES ANYTHING IN THE LOT FACE A WALL?
//
// The user, on the chairs: *"the blue and orange chairs are turned so a person
// sitting in them would face the BUILDING. Chairs outside an office face OUT."*
// That was fixed. My queue asks the follow-up, which is the part that stops it
// happening a third time: *"check every other seat, sign and board in the lot
// the same way, by standing where a person would use it."*
//
// GOTCHAS 23's real lesson here is that ANYTHING WITH A FRONT ends up backwards
// eventually, and the lot is full of fronts — two chairs, a tyre stack you can
// sit on, price cards, sandwich boards, banners, the pole sign, the office sign.
// Nothing has ever asked them all the same question at once.
//
// Two tests, and neither is a screenshot:
//
//  1. SEATS — sit in it for real (walk to the approach, press E) and read the
//     camera's own yaw back. Then march forward from the seated eye and find
//     what you are looking at. A seat facing a wall 0.6 m away is the fault the
//     user reported; a seat facing 20 m of open lot is the fix.
//
//  2. SIGNS — take each readable sheet's own outward normal out of its world
//     matrix and march along it. If it runs into something solid within a
//     metre, that sheet is talking to a wall. Faces are checked BOTH ways for
//     double-sided sheets, because "readable from one side only" is a different
//     defect and this one should not report it.
//
// Usage: SHOT_URL=http://127.0.0.1:4191/ node scripts/I-facing.mjs
//        --selftest   turn the chairs back around, require this to go red
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';

const ARGS = flags(['--selftest']);
const URL = process.env.SHOT_URL ?? 'http://127.0.0.1:4191/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(700);

const FAIL = [];
const press = async () => { await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e'); await p.waitForTimeout(260); };

// The lot's own extent, asked rather than remembered.
const site = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  s.traverse((o) => {
    if (!o.isMesh) return;
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    if (mod !== 'lot') return;
    const e = o.matrixWorld.elements;
    x0 = Math.min(x0, e[12]); x1 = Math.max(x1, e[12]); z0 = Math.min(z0, e[14]); z1 = Math.max(z1, e[14]);
  });
  return { x0, x1, z0, z1 };
});

if (ARGS.selftest) {
  // TWO mutations, because this check has two halves that fail independently
  // and one mutation would leave the other half unproven.
  const r = await p.evaluate(() => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    const out = { wall: 0, sign: 0 };

    // half 1 is done inside the seat loop, where the SEATED position is known.
    // Placing it from the spot instead put the wall 1.75 m from the eye — the
    // spot is the approach, a stride in front of the chair, not the chair —
    // and that is far enough away to be a view rather than a wall, so the
    // check correctly said nothing and the mutation proved nothing.

    // half 2 — a sign is turned to read INTO the office wall. Found by its
    // geometry, not by a coordinate: the office is the one 3.0 x 2.7 x 4.6 box.
    let cab = null;
    s.traverse((o) => {
      const g = o.isMesh && o.geometry?.parameters;
      if (g && Math.abs(g.width - 3.0) < 0.01 && Math.abs(g.height - 2.7) < 0.01
            && Math.abs(g.depth - 4.6) < 0.01) cab = o;
    });
    if (cab) {
      cab.geometry.computeBoundingBox();
      const bb = cab.geometry.boundingBox.clone().applyMatrix4(cab.matrixWorld);
      let sheet = null, best = 0;
      s.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
        if (mod !== 'lot') return;
        for (let q = o; q; q = q.parent) if (q.userData?.notSignage) return;
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!m || !m.map || o.geometry.type !== 'PlaneGeometry') return;
        const a = o.geometry.parameters.width * o.geometry.parameters.height;
        if (a > best) { best = a; sheet = o; }
      });
      if (sheet) {
        if (sheet.parent !== s) s.attach(sheet);
        sheet.position.set(bb.min.x - 0.25, 1.5, (bb.min.z + bb.max.z) / 2);
        sheet.rotation.set(0, Math.PI / 2, 0);       // local +z -> +x, into the cabin
        out.sign = 1;
      }
    }
    s.updateMatrixWorld(true);
    return out;
  });
  console.log(`  SELFTEST: put a wall in front of ${r.wall} chair, turned ${r.sign} sign into the office wall`);
  console.log(`  both must be caught\n`);
}

// ── 1. THE SEATS ────────────────────────────────────────────────────────────
const seats = await p.evaluate((site) => window.__ct.spots()
  .filter((s) => /sit/i.test(s.label ?? '') || /chair|tyre|tire/i.test(s.label ?? ''))
  .filter((s) => s.x > site.x0 - 2 && s.x < site.x1 + 2 && s.z > site.z0 - 2 && s.z < site.z1 + 2), site);

console.log(`\n  ${seats.length} places to sit in the lot\n`);
for (const s of seats) {
  // Stand ON the registered spot, not near it. My first version warped to
  // (x-0.6, z) and only ONE of the three seats actually took — the other two
  // reported "yaw 0", which is not a seat facing north, it is the default yaw
  // of a player who never sat down. A probe that cannot tell those apart would
  // have reported two seats as correct without ever sitting in them.
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0.14, 0), [s.x, s.z]);
  await p.waitForTimeout(220);
  const eyeBefore = await p.evaluate(() => window.__ct.camY?.() ?? window.__ct.pos()[1]);
  await press();
  const [yaw, pos, eyeAfter] = await p.evaluate(() => [window.__ct.yaw(), window.__ct.pos(), window.__ct.camY?.() ?? window.__ct.pos()[1]]);
  // SITTING IS PROVED, NOT ASSUMED: the eye has to drop, or you are standing
  // next to a chair reading your own starting yaw back.
  const seated = eyeBefore - eyeAfter > 0.25;
  if (!seated) {
    FAIL.push(`seat "${s.label}" at (${s.x.toFixed(2)}, ${s.z.toFixed(2)}) did not seat me `
      + `— eye moved ${(eyeBefore - eyeAfter).toFixed(3)} m, so its facing is UNTESTED`);
    console.log(`   "${s.label}"  at (${s.x.toFixed(2)}, ${s.z.toFixed(2)})  DID NOT SEAT — eye drop ${(eyeBefore - eyeAfter).toFixed(3)} m`);
    continue;
  }
  // what is in front of the seated eye? march the view direction and ask the
  // collider registry, which is the same thing that stops the player walking.
  // WHAT YOU SIT ON IS NOT WHAT YOU FACE. Colliders here are 2D footprints —
  // minX/maxX/minZ/maxZ, no height — so they are effectively infinitely tall,
  // and marching out of a seat that stands on one hits it immediately. The
  // tyre stack reported "solid 0.25 m ahead" and that solid was the stack
  // being sat on. Any collider containing the seated point is excluded; the
  // chairs carry no collider at all, deliberately, so they lose nothing.
  // SELFTEST half 1: now that the seated position is known, drop a wall 0.5 m
  // into the view and require the march below to find it.
  if (ARGS.selftest) {
    await p.evaluate(([yaw, x, z]) => {
      const dx = Math.sin(yaw), dz = -Math.cos(yaw);
      const wx = x + dx * 0.5, wz = z + dz * 0.5;
      window.__ct.colliders().push({ minX: wx - 0.3, maxX: wx + 0.3, minZ: wz - 0.3, maxZ: wz + 0.3 });
    }, [yaw, pos[0], pos[2]]);
  }
  const ahead = await p.evaluate(([yaw, x, z]) => {
    const dx = Math.sin(yaw), dz = -Math.cos(yaw);
    const cols = window.__ct.colliders()
      .filter((c) => c && isFinite(c.minX) && Math.abs(c.minX) < 500)
      .filter((c) => !(x > c.minX - 0.05 && x < c.maxX + 0.05 && z > c.minZ - 0.05 && z < c.maxZ + 0.05));
    for (let d = 0.25; d <= 25; d += 0.25) {
      const px = x + dx * d, pz = z + dz * d;
      for (const c of cols)
        if (px > c.minX && px < c.maxX && pz > c.minZ && pz < c.maxZ) return +d.toFixed(2);
    }
    return 99;
  }, [yaw, pos[0], pos[2]]);
  const deg = ((yaw * 180 / Math.PI) % 360 + 360) % 360;
  const view = ahead >= 99 ? 'open lot as far as the colliders go' : `something solid ${ahead} m ahead`;
  console.log(`   "${s.label}"  at (${s.x.toFixed(2)}, ${s.z.toFixed(2)})  seated yaw ${deg.toFixed(0)}deg  ->  ${view}`);
  // A chair against the office wall that faces the wall has it within arm's
  // reach. 1.5 m is generous: the office is 3 m deep and the chairs stand 0.55 m
  // off it, so facing INTO it reads as ~0.5 m and facing out reads as tens.
  if (ahead < 1.5) FAIL.push(`seat "${s.label}" faces something solid ${ahead} m away — that is a wall, not a view`);
  // GET OUT OF THE CHAIR. Warping away does not stand you up — the rig stays
  // seated, so the NEXT seat's "eye before" is already the seated height and
  // its press toggles you upright instead of down. That read as two seats
  // refusing to seat me when the fault was entirely in this loop.
  await press();
  await p.evaluate(() => window.__ct.warp(16, 2.6, Math.PI / 2, 0.14, 0));
  await p.waitForTimeout(220);
  const up = await p.evaluate(() => window.__ct.camY());
  if (up - eyeAfter < 0.25)
    FAIL.push(`could not stand up out of "${s.label}" — every seat measured after this one is suspect`);
}

// ── 2. THE SIGNS ────────────────────────────────────────────────────────────
const sheets = await p.evaluate((site) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = [];
  // THE THING A SIGN IS MOUNTED ON IS NOT A WALL IT FACES. My first run
  // reported 58 of 145 sheets "blocked at 0.12 m" and every one was a price
  // card reading its own windshield, a sticker reading its own door, a banner
  // reading its own fence. That is not the defect the user reported; it is
  // what mounting a sign means. So each solid remembers the outermost group it
  // belongs to, and a sheet never tests against its own.
  const rootOf = (o) => { let r = o; for (let q = o; q; q = q.parent) if (q.isGroup) r = q; return r; };
  const solid = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingBox) return;
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y, d = bb.max.z - bb.min.z;
    const thin = Math.min(w, d) < 0.09;
    if (!thin && h > 0.3 && w < 25 && d < 25)
      solid.push({ x0: bb.min.x, y0: bb.min.y, z0: bb.min.z, x1: bb.max.x, y1: bb.max.y, z1: bb.max.z,
        root: rootOf(o).id, par: o.parent?.id ?? -1 });
  });
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    for (let q = o; q; q = q.parent) if (q.visible === false) return;
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    if (mod !== 'lot') return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || !m.map) return;                          // only sheets that SAY something
    // A weed is an upright textured plane and so is a price card. lot.ts
    // declares which of its sheets are not signage rather than leaving this to
    // guess at a size — the two the first run flagged were both weed tufts
    // growing against the office step, which is where a weed belongs.
    let decor = false; for (let q = o; q; q = q.parent) if (q.userData?.notSignage) { decor = true; break; }
    if (decor) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb0 = g.boundingBox;
    const w = bb0.max.x - bb0.min.x, h = bb0.max.y - bb0.min.y, d = bb0.max.z - bb0.min.z;
    if (Math.min(w, h, d) > 0.06) return;              // a box, not a sheet
    if (Math.max(w, h, d) < 0.10) return;              // too small to read anyway
    const e = o.matrixWorld.elements;
    const cx = e[12], cy = e[13], cz = e[14];
    if (cy < 0.25) return;                             // deck decals face up, not at anyone
    // a PlaneGeometry's own normal is local +z
    const nx = e[8], ny = e[9], nz = e[10];
    const L = Math.hypot(nx, ny, nz) || 1;
    const dbl = m.side === 2;
    // SAME ROOT GROUP ONLY. My first exclusion also skipped anything sharing
    // this sheet's PARENT, which sounds equivalent and is not: almost every
    // object in this lot is added straight to the scene, so "same parent"
    // meant "same scene" and the sign half of this check silently excluded the
    // entire world. It passed 59 of 59 while testing nothing, and the selftest
    // below is the only reason I found out — it turned a sign to face the
    // office wall and this reported it clear.
    const mine = rootOf(o).id;
    const march = (sx) => {
      const ux = sx * nx / L, uy = sx * ny / L, uz = sx * nz / L;
      for (let t = 0.12; t <= 1.6; t += 0.06) {
        const px = cx + ux * t, py = cy + uy * t, pz = cz + uz * t;
        for (const c of solid) {
          if (c.root === mine) continue;            // the car it is stuck to
          if (px > c.x0 && px < c.x1 && py > c.y0 && py < c.y1 && pz > c.z0 && pz < c.z1) return +t.toFixed(2);
        }
      }
      return 99;
    };
    out.push({ x: +cx.toFixed(2), y: +cy.toFixed(2), z: +cz.toFixed(2),
      w: +Math.max(w, h, d).toFixed(2), dbl,
      front: march(1), back: march(-1),
      nx: +(nx / L).toFixed(2), nz: +(nz / L).toFixed(2) });
  });
  return out;
}, site);

console.log(`\n  ${sheets.length} readable sheets in the lot\n`);
// A SHEET FLUSH AGAINST SOMETHING IS MOUNTED ON IT, NOT WALLED OFF BY IT.
// Below this it is a fixing — a panel on its own cabinet, a sticker on glass —
// and no viewing distance exists at which it would have read differently. The
// band that means what the user meant is a sign with real air in front of it
// and then a wall: far enough not to be bolted on, close enough to be unusable.
// Stated rather than silently folded in, because it is the one judgement call
// in this script and it decides what it can see.
const MOUNT = 0.15;
const reach = (s) => (s.dbl ? Math.max(s.front, s.back) : s.front);
const mounted = sheets.filter((s) => reach(s) <= MOUNT);
const buried = sheets.filter((s) => reach(s) > MOUNT && reach(s) < 1.0);
const clear = sheets.length - buried.length - mounted.length;
console.log(`   ${clear} have clear air in front of the face you read them from`);
if (mounted.length) console.log(`   ${mounted.length} sit flush on what they are fixed to (<= ${MOUNT} m) — a mounting, not judged`);
if (buried.length) {
  console.log(`   ${buried.length} do NOT:`);
  for (const s of buried.slice(0, 12)) {
    console.log(`      ${s.w} m sheet at (${s.x}, ${s.y}, ${s.z})  normal (${s.nx}, ${s.nz})  `
      + `front blocked at ${s.front} m` + (s.dbl ? `, back at ${s.back} m (double-sided)` : ''));
    FAIL.push(`a readable sheet at (${s.x}, ${s.y}, ${s.z}) has something solid ${Math.min(s.front, s.back)} m in front of it`);
  }
}

if (FAIL.length) { console.log('\nFAIL'); for (const f of FAIL.slice(0, 16)) console.log('  · ' + f); }
else console.log('\nevery seat looks out at the lot, and every sign has air in front of it.');

await b.close();
process.exit(FAIL.length ? 1 : 0);
