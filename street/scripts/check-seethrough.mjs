// Can you see the pavement through a shopfront?
//
// This has been asked three times and answered three times by walking to the
// corner and squinting at a grey-on-grey screenshot, which is not an answer —
// GOTCHAS §1 says screenshots are for looking, never for proving, and it is
// just as true here. So: make the ground UNMISTAKABLE and let the pixels say.
//
// Every horizontal surface at ground level is repainted hot magenta. Then the
// camera is put at each shopfront's own door — read out of the frontage
// register, so a shop added tomorrow is covered without touching this file —
// facing the facade square on. Any magenta in the upper part of that frame is
// pavement showing through a building, because at eye level a facade fills the
// frame and the road is behind you.
//
// Why it happens, so the number means something: the sidewalk is ONE plane
// running from the kerb straight on UNDER the buildings, and a shopfront that
// is a cut-out (`alphaTest`) with nothing behind it is a window onto it. The
// bodega bay was exactly that — 29 % of its panel discarded, a plane, nothing
// behind — and it read as the shop having a pavement for a floor.
//
//   node scripts/check-seethrough.mjs            # every registered shopfront
//   node scripts/check-seethrough.mjs -v         # keep the frames in shots/
//   node scripts/check-seethrough.mjs --selftest # prove it still catches one
//
// HOW MUCH TO TRUST A GREEN RUN. --selftest hides every shopfront face AND
// every interior backing, and 3 of 16 frontages then flag — enough to prove
// the detector fires, not enough to claim it would catch any leak anywhere.
// It samples the glazed rectangle head-on from 4 m; a leak only visible from
// a steep angle or through a sliver at a corner will not show. Treat green as
// "the obvious version of this bug is not present", which is exactly the
// question that has been asked three times.
import { chromium } from 'playwright';
import { ensureAlive } from './shotguard.mjs';

const KEEP = process.argv.includes('-v');
// A detector nobody has watched fail is not a detector. --selftest punches a
// hole in one shopfront at runtime — no source change — and asserts the check
// goes red. Without it this file would be one silently-inert script criticising
// another, which is the failure mode it exists to avoid.
const SELFTEST = process.argv.includes('--selftest');
const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 420 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(800);

const tinted = await page.evaluate(() => {
  let n = 0;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.computeBoundingBox?.();
    const bb = o.geometry?.boundingBox;
    if (!bb) return;
    const wp = new (o.position.constructor)();
    o.getWorldPosition(wp);
    // horizontal, at ground level, outdoors
    if ((bb.max.y - bb.min.y) > 0.35 || wp.y > 0.5 || Math.abs(wp.x) > 100) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m?.color) continue;
      m.map = null; m.color.setHex(0xff00ff); m.needsUpdate = true; n++;
    }
  });
  return n;
});

if (SELFTEST) {
  // make the widest main-block shopfront see-through: cull its front face and
  // the sidewalk running on under the building is straight through it
  // Hide the shopfront faces AND the interior backings. Hiding only the faces
  // is not a see-through condition — and finding that out was worth the
  // detour, because it is the backing proving its own worth: with the front of
  // every shop removed and the backings left in, this check stayed green.
  const hit = await page.evaluate(() => {
    let faces = 0, rooms = 0;
    window.__ct.scene().traverse((o) => {
      if (!o.isMesh) return;
      const par = o.geometry?.parameters; if (!par) return;
      const isBox = o.geometry.type === 'BoxGeometry';
      const isPlane = o.geometry.type === 'PlaneGeometry';
      if (Math.abs((par.height ?? 0) - 4.2) > 0.01) return;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (!m?.map || m.map.image?.height !== 67) continue;
        if (isBox) { m.visible = false; m.needsUpdate = true; faces++; }
        else if (isPlane) { m.visible = false; m.needsUpdate = true; rooms++; }
      }
    });
    return `${faces} faces, ${rooms} backings`;
  });
  console.log(`selftest: hid ${hit} — the check MUST now go red`);
}

const fronts = await page.evaluate(() => (globalThis.__frontages ?? []).map((f) => ({
  axis: f.axis, door: f.doorWorld, face: f.facePos, out: f.outward,
  lo: f.loWorld, hi: f.hiWorld,
  gLo: f.glazingLoWorld, gHi: f.glazingHiWorld,
  gBot: f.glazingBottomM, gTop: f.glazingTopM,
})));

if (!fronts.length) {
  console.error('no frontages registered — is the world built? (globalThis.__frontages)');
  await browser.close();
  process.exit(2);
}

const bad = [];
for (let i = 0; i < fronts.length; i++) {
  const f = fronts[i];
  // stand at the door, 4 m out, looking back at the wall
  const along = f.door, off = f.face + f.out * 4.0;
  const [x, z] = f.axis === 'z' ? [off, along] : [along, off];
  // Face the WALL. Getting this backwards points the camera down the open
  // street and the "glazing box" then samples pavement — which is what flagged
  // all eight side-street frontages and none of the main-block ones on the
  // first run. fwd = (sin yaw, 0, -cos yaw): outdoors at +z means the camera
  // stands at +z and must look toward -z, which is yaw 0.
  const yaw = f.axis === 'z' ? (f.out > 0 ? -Math.PI / 2 : Math.PI / 2)
                             : (f.out > 0 ? 0 : Math.PI);
  await page.evaluate((a) => window.__ct.warp(...a), [x, z, yaw, 0.14, 0.02]);
  if (!await ensureAlive(page)) { console.error('canvas not drawing — aborting'); process.exit(2); }
  await page.waitForTimeout(180);
  // Sample ONLY inside the glazing. A first pass took the upper 62 % of the
  // frame and flagged 10 of 16, every one of them the pavement legitimately
  // in shot at the foot of the wall — a check that cries wolf gets deleted
  // rather than fixed. The glazed rectangle is known in world units, the
  // camera is a fixed distance out on a known axis, and the FOV is 88°
  // vertical, so its screen box is arithmetic — no camera object needed.
  const n = await page.evaluate(({ f, dist, camY }) => {
    const cv = document.querySelector('canvas');
    const g = cv.getContext('webgl2') || cv.getContext('webgl');
    const w = cv.width, h = cv.height, aspect = w / h;
    const t = Math.tan((88 * Math.PI / 180) / 2) * dist;          // half-height in metres
    // world → frame, inset a little so a one-texel edge is not counted
    const yTo = (wy) => Math.round(h / 2 * (1 - (wy - camY) / t));
    const along = (wp) => {
      const d = f.axis === 'z' ? (wp - f.door) : (wp - f.door);
      const sgn = (f.axis === 'z' ? (f.out > 0 ? -1 : 1) : (f.out > 0 ? 1 : -1));
      return Math.round(w / 2 * (1 + sgn * d / (t * aspect)));
    };
    let x0 = along(f.gLo), x1 = along(f.gHi); if (x0 > x1) [x0, x1] = [x1, x0];
    let y0 = yTo(f.gTop), y1 = yTo(f.gBot);                       // y grows downward
    const pad = 6;
    x0 = Math.max(0, x0 + pad); x1 = Math.min(w - 1, x1 - pad);
    y0 = Math.max(0, y0 + pad); y1 = Math.min(h - 1, y1 - pad);
    if (x1 - x0 < 8 || y1 - y0 < 8) return -1;                    // not enough glass in shot
    const bw = x1 - x0, bh = y1 - y0;
    const px = new Uint8Array(bw * bh * 4);
    g.readPixels(x0, h - y1, bw, bh, g.RGBA, g.UNSIGNED_BYTE, px);
    let n = 0;
    for (let i = 0; i < px.length; i += 4)
      if (px[i] > 150 && px[i + 1] < 90 && px[i + 2] > 150) n++;
    return n;
  }, { f, dist: 4.0, camY: 1.62 });
  if (n < 0) continue;
  if (KEEP) await page.screenshot({ path: `shots/seethru-${i}.png` });
  if (n > 12) bad.push({ i, f, n });
}
// ── the bodega canted bay ──────────────────────────────────────────────────
//
// Checked separately, and it is the one that matters: it is the only shopfront
// face in the world that is a REAL cut-out, and it is hand-built in
// ct/street.ts rather than going through shopfrontRelief — so it never enters
// the register and the loop above walks straight past it. That gap is not
// hypothetical: with the bay's backing deliberately removed, the loop above
// still reported the whole street clean.
//
// It sits on a 45° chamfer, so the axis-aligned projection does not describe
// it. Fixed camera, central box, which is enough for a surface that either
// shows pavement or does not.
await page.evaluate(() => window.__ct.warp(6.2, -98.2, 2.42, 0.14, -0.06));
if (!await ensureAlive(page)) { console.error('canvas not drawing'); process.exit(2); }
await page.waitForTimeout(220);
if (KEEP) await page.screenshot({ path: 'shots/seethru-bay.png' });
const bayN = await page.evaluate(() => {
  const cv = document.querySelector('canvas');
  const g = cv.getContext('webgl2') || cv.getContext('webgl');
  const w = cv.width, h = cv.height;
  // Tight on the doorway and its transom. A wider box catches the sidewalk
  // beside the bay at the bottom corners — 91 px of it, which read as a leak
  // until the pixels' bounding box turned out to be hard against the box's own
  // left edge rather than anywhere in the glass.
  const x0 = Math.round(w * 0.42), x1 = Math.round(w * 0.60);
  const y0 = Math.round(h * 0.28), y1 = Math.round(h * 0.62);
  const bw = x1 - x0, bh = y1 - y0;
  const px = new Uint8Array(bw * bh * 4);
  g.readPixels(x0, h - y1, bw, bh, g.RGBA, g.UNSIGNED_BYTE, px);
  let n = 0;
  for (let i = 0; i < px.length; i += 4)
    if (px[i] > 150 && px[i + 1] < 90 && px[i + 2] > 150) n++;
  return n;
});
if (bayN > 12) bad.push({ i: 'bay', f: { axis: 'chamfer', lo: NaN, hi: NaN, door: NaN }, n: bayN });

await browser.close();

console.log(`see-through: ${fronts.length} shopfronts + the bodega bay checked, ${tinted} ground surfaces tinted`);
if (SELFTEST) {
  if (bad.length) { console.log(`  SELFTEST PASSED — the hidden face was caught (${bad.length} flagged)`); process.exit(0); }
  console.error('  SELFTEST FAILED — a shopfront was made see-through and this did not notice.');
  console.error('  Do not trust a green run from this script until that is fixed.');
  process.exit(2);
}
if (errs.length) console.error('PAGE ERRORS:\n  ' + errs.join('\n  '));
if (!bad.length) {
  console.log('  no pavement visible through any shopfront');
  process.exit(errs.length ? 1 : 0);
}
console.log(`  ${bad.length} SHOWING GROUND THROUGH THE FACADE:`);
for (const { i, f, n } of bad) {
  const where = f.axis === 'chamfer' ? 'the bodega canted bay'
    : `${f.axis}-frontage ${f.lo.toFixed(1)}..${f.hi.toFixed(1)} door ${f.door.toFixed(1)}`;
  console.log(`   #${i} ${where} — ${n} magenta px INSIDE THE GLASS`);
}
console.log(`
A cut-out with nothing behind it is a window onto the sidewalk, which runs on
under the buildings. The fix is a BACKING, not closing the hole: an opaque
interior plane set back behind the glass — see shopInteriorTex() in
ct/tex-world.ts, which shopfrontRelief() already puts behind every shopfront.
Re-run with -v to keep the frames in shots/.`);
process.exit(1);
