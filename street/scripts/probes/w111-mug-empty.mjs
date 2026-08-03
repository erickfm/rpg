// ITEM 274 — "mug should be empty." MEASURED IN HIS PIXELS, FROM HIS SPOT.
//
// Item 167 fixed the handle by measuring the rendered pixels instead of arguing
// about what the handle would be seen against, and found the handle differed
// from its background by (1, 1, 2) out of 255. This probe holds the mug's
// INTERIOR to the same standard, and it is the same measurement: the world is
// unlit MeshBasicMaterial with no map on any mug part, so material colour IS
// rendered colour and an exact-match pixel histogram is a legitimate reading.
//
// WHERE IT STANDS. The item quotes the user's frame as showing
// `[E] sleep until morning`, so the station must be inside the bed spot
// (ct/apartment.ts:2284, local (-2.6, 4.2) r 0.75) AND looking down at the sill
// at ~22 deg. Both are DERIVED here, never typed: the bed spot is read out of
// `__ct.spots()` by label, the mug out of the scene by geometry signature, and
// the station is placed on the mug->spot bearing at the horizontal range that
// makes the pitch come out at 22 deg for THIS world's eye height. The probe
// then asserts the HUD really does read `[E] sleep until morning` from there —
// if it does not, this is not his vantage and the frame is not evidence.
//
// WHAT IT ASSERTS, and why each one can go red:
//
//   1. INTERIOR vs RIM contrast >= a floor. Too low and the top is a disc of
//      body colour: "the whole thing reads as a peg", the older complaint the
//      item warns about reopening.
//   2. INTERIOR vs SILL contrast >= a floor. Too low and it vanishes into its
//      background, which is exactly how the handle failed twice.
//   3. THE INTERIOR IS NOT COFFEE. Warm and dark (R noticeably above B, low
//      value) is what "full" looks like; that is the thing being removed.
//   4. POPULATION FLOOR, DERIVED, NOT PREDICTED. The disc's own 12-gon is
//      projected through the real camera and its screen area computed; the
//      interior must actually cover a fraction of that. Without this the three
//      colour tests pass happily on a mug that is off-screen, occluded, or
//      not drawn at all -- every one of them is vacuously true over 0 pixels.
//
// SELF-TEST, BOTH SIGNS (--selftest). Mutates the disc's material at runtime:
//   * to the sill colour   -> assertion 2 MUST go red
//   * to the old coffee    -> assertion 3 MUST go red
//   * to the body colour   -> assertion 1 MUST go red
//   * hidden entirely      -> assertion 4 MUST go red
// A case that does not redden its assertion is deleted, not kept.
//
// Usage:
//   SHOT_URL=http://localhost:<port>/ node scripts/probes/w111-mug-empty.mjs <label>
//   SHOT_URL=... node scripts/probes/w111-mug-empty.mjs --selftest
// (Pixels are read IN THE PAGE, off the live canvas, because this repo has no
// PNG decoder in its dependencies -- `pngjs`/`sharp`/`jimp` are all absent. The
// same drawImage(canvas) route is what w60-mug-shot.mjs already uses for its
// blackness gate, so it is a road with tyre tracks on it.)
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const args = process.argv.slice(2);
const SELFTEST = args.includes('--selftest');
const label = args.find((a) => !a.startsWith('--')) ?? 'now';
const URL = aim('http://localhost:4672/');

// The two colours the interior has to separate from. BOTH ARE DERIVED FROM THE
// RENDERED PIXELS below -- these are only used to LABEL what the histogram
// finds, never as the measurement itself. (BUILDER-BRIEF s8: the authoring
// values live in ct/apartment.ts:2060 and :2124.)
const NAMES = {
  a8a091: 'sill', d8d2c4: 'mug body', d0c9ba: 'handle', '4a3524': 'old coffee',
};
const hex = (r, g, b) => ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
const csum = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
const rgb = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 740 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 30));
await waitPainted(p, { quiet: true });

// ── the mug, and the disc in it, BY GEOMETRY SIGNATURE ───────────────────────
// Never by a coordinate I remember. Item 108's probe learned this the hard way:
// same-sized geometry elsewhere in the city matched and it reported the mug as
// "864 x 1565 pixels".
const found = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let body = null, disc = null;
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    const t = n.geometry.type, gp = n.geometry.parameters || {};
    const e = n.matrixWorld.elements, at = { x: e[12], y: e[13], z: e[14] };
    if (t === 'CylinderGeometry' && Math.abs(gp.radiusTop - 0.038) < 1e-4
      && Math.abs(gp.height - 0.095) < 1e-4) body = { ...at, r: gp.radiusTop, h: gp.height };
    // the interior disc: a 12-segment circle of radius MUG_R - 0.006 = 0.032
    if (t === 'CircleGeometry' && Math.abs(gp.radius - 0.032) < 1e-4)
      disc = { ...at, r: gp.radius, seg: gp.segments,
        color: '#' + n.material.color.getHexString(), name: n.name || '(unnamed)' };
  });
  return { body, disc };
});
if (!found.body) { console.error('MISS: the mug body is not in this world'); process.exit(3); }
if (!found.disc) { console.error('MISS: the interior disc is not in this world'); process.exit(3); }
const { body: mug, disc } = found;
console.log(`mug  x ${mug.x.toFixed(3)} y ${mug.y.toFixed(3)} z ${mug.z.toFixed(3)}`);
console.log(`disc x ${disc.x.toFixed(3)} y ${disc.y.toFixed(3)} z ${disc.z.toFixed(3)}`
  + `  r ${disc.r}  material ${disc.color}`);

// ── HIS SPOT: inside the bed prompt, looking down at 22 deg ──────────────────
const bed = await p.evaluate(() => (window.__ct.spots() || [])
  .find((s) => /sleep until morning/.test(s.label || '')) || null);
if (!bed) { console.error('MISS: no "sleep until morning" spot published'); process.exit(3); }
console.log(`bed spot at (${bed.x.toFixed(2)}, ${bed.z.toFixed(2)}) r ${bed.r}`);

// storey: flat 301's floor. Read it off the world rather than typed -- the mug
// sits on the sill of that flat, so the storey is the one the mug is on.
const GY = await p.evaluate(([mx, mz]) => {
  // step the ground-y candidates the apartment publishes until the mug's own
  // height sits sensibly above the floor
  const g = window.__ct.groundAt(mx, mz);
  return typeof g === 'number' ? g : 0;
}, [mug.x, mug.z]);

const bearing = Math.atan2(bed.x - mug.x, bed.z - mug.z);   // mug -> bed, in world
// eye height at that storey, read rather than assumed
await p.evaluate(([x, z, gy]) => window.__ct.warp(x, z, 0, gy, 0), [bed.x, bed.z, GY]);
await waitPainted(p, { quiet: true });
const eyeY = await p.evaluate(() => window.__ct.camY());
// the range that makes the pitch 22 deg for THIS eye height and THIS mug top
const mugTopY = mug.y + mug.h / 2;
const WANT_DEG = 22;
const range = (eyeY - mugTopY) / Math.tan((WANT_DEG * Math.PI) / 180);
const sx = mug.x + Math.sin(bearing) * range, sz = mug.z + Math.cos(bearing) * range;
const inSpot = Math.hypot(sx - bed.x, sz - bed.z) <= bed.r;
console.log(`eye ${eyeY.toFixed(3)}  mug top ${mugTopY.toFixed(3)}  drop ${(eyeY - mugTopY).toFixed(3)}`);
console.log(`22 deg wants ${range.toFixed(2)} m of range -> stand (${sx.toFixed(2)}, ${sz.toFixed(2)})`
  + `  ${inSpot ? 'INSIDE the bed spot' : '*** OUTSIDE the bed spot ***'}`);
if (!inSpot) process.exitCode = 4;

const yaw = Math.atan2(mug.x - sx, -(mug.z - sz));
const pitch = -Math.atan2(eyeY - mugTopY, range);
await p.evaluate(([x, z, y, gy, pi]) => window.__ct.warp(x, z, y, gy, pi), [sx, sz, yaw, GY, pitch]);
await waitPainted(p, { quiet: true });
await p.waitForTimeout(400);

const promptText = await p.evaluate(() =>
  (document.getElementById('ct-prompt')?.textContent || '').trim());
console.log(`HUD prompt reads: "${promptText}"`);
const HIS_VANTAGE = /sleep until morning/.test(promptText);
if (!HIS_VANTAGE) { console.log('  *** not his vantage: the bed prompt is not up ***'); process.exitCode = 4; }

// ── the crop: the pixels the mug actually occupies ───────────────────────────
const box = await p.evaluate((m) => {
  const cam = window.__ct.camera(), s = window.__ct.scene();
  s.updateMatrixWorld(true); cam.updateMatrixWorld(true);
  const V = cam.position.constructor;
  let mn = null, mx = null;
  const add = (v) => {
    const X = (v.x * 0.5 + 0.5) * window.innerWidth, Y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    if (!mn) { mn = { x: X, y: Y }; mx = { x: X, y: Y }; }
    mn.x = Math.min(mn.x, X); mn.y = Math.min(mn.y, Y);
    mx.x = Math.max(mx.x, X); mx.y = Math.max(mx.y, Y);
  };
  for (const dx of [-m.r, m.r]) for (const dz of [-m.r, m.r]) for (const dy of [-m.h / 2, m.h / 2])
    add(new V(m.x + dx, m.y + dy, m.z + dz).project(cam));
  return { x0: mn.x, y0: mn.y, w: mx.x - mn.x, h: mx.y - mn.y };
}, mug);

// THE DERIVED POPULATION FLOOR. Project the disc's own 12-gon and take its
// screen-space polygon area. This is the number of pixels the interior would
// cover if nothing occluded it -- derived from the geometry in front of the
// real camera, not a figure anyone predicted.
const discArea = await p.evaluate((d) => {
  const cam = window.__ct.camera(); cam.updateMatrixWorld(true);
  const V = cam.position.constructor;
  const pts = [];
  for (let i = 0; i < d.seg; i++) {
    const a = (i / d.seg) * Math.PI * 2;
    const v = new V(d.x + Math.cos(a) * d.r, d.y, d.z + Math.sin(a) * d.r).project(cam);
    pts.push([(v.x * 0.5 + 0.5) * window.innerWidth, (-v.y * 0.5 + 0.5) * window.innerHeight]);
  }
  let A = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    A += x1 * y2 - x2 * y1;
  }
  return Math.abs(A) / 2;
}, disc);

const pad = Math.max(20, box.w * 0.8);
const clip = {
  x: Math.max(0, Math.round(box.x0 - pad)), y: Math.max(0, Math.round(box.y0 - pad)),
  width: Math.round(box.w + pad * 2), height: Math.round(box.h + pad * 2),
};

async function measure(tag, { shoot = true } = {}) {
  await waitPainted(p, { quiet: true });
  if (shoot) {
    await p.screenshot({ path: `shots/w111-mug-${label}-${tag}.png` });
    await p.screenshot({ path: `shots/w111-mug-${label}-${tag}-crop.png`, clip });
    // AND THE SAME PIXELS, MAGNIFIED 8x NEAREST-NEIGHBOUR. Not a closer camera
    // -- a closer camera is a different question and would flatter the object.
    // These are byte-for-byte the pixels he is shown, blown up so a human can
    // see what a 13 px disc is actually doing. Judging a 13 px object from a
    // 91 px crop is judging it from a thumbnail of itself.
    await p.evaluate(([cl, Z]) => {
      const src = document.querySelector('canvas');
      const sx = src.width / src.clientWidth, sy = src.height / src.clientHeight;
      let g = document.getElementById('w111-zoom');
      if (!g) {
        g = document.createElement('canvas'); g.id = 'w111-zoom';
        g.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;image-rendering:pixelated';
        document.body.appendChild(g);
      }
      g.width = cl.width * Z; g.height = cl.height * Z;
      const cx = g.getContext('2d');
      cx.imageSmoothingEnabled = false;
      cx.drawImage(src, cl.x * sx, cl.y * sy, cl.width * sx, cl.height * sy,
        0, 0, cl.width * Z, cl.height * Z);
    }, [clip, 8]);
    const z = await p.$('#w111-zoom');
    await z.screenshot({ path: `shots/w111-mug-${label}-${tag}-zoom8.png` });
    await p.evaluate(() => document.getElementById('w111-zoom')?.remove());
  }
  const raw = await p.evaluate(([cl, d]) => {
    const src = document.querySelector('canvas');
    // the canvas backing store may not be 1:1 with CSS pixels
    const sx = src.width / src.clientWidth, sy = src.height / src.clientHeight;
    const g = document.createElement('canvas');
    g.width = cl.width; g.height = cl.height;
    const cx = g.getContext('2d', { willReadFrequently: true });
    cx.drawImage(src, cl.x * sx, cl.y * sy, cl.width * sx, cl.height * sy,
      0, 0, cl.width, cl.height);
    const px = cx.getImageData(0, 0, cl.width, cl.height).data;

    // WHICH pixels are the interior? The ones inside the projected disc polygon.
    // Read the modal colour THERE rather than assuming the material value made
    // it to the screen -- that assumption is the one this project keeps paying
    // for (fragment shaders are invisible to material.color; measure pixels).
    const cam = window.__ct.camera(); cam.updateMatrixWorld(true);
    const V = cam.position.constructor; const poly = [];
    for (let i = 0; i < d.seg; i++) {
      const a = (i / d.seg) * Math.PI * 2;
      const v = new V(d.x + Math.cos(a) * d.r, d.y, d.z + Math.sin(a) * d.r).project(cam);
      poly.push([(v.x * 0.5 + 0.5) * window.innerWidth, (-v.y * 0.5 + 0.5) * window.innerHeight]);
    }
    const hit = (X, Y) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > Y) !== (yj > Y) && X < ((xj - xi) * (Y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const H = {}, I = {};
    const key = (i) => ((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]).toString(16).padStart(6, '0');
    for (let y = 0; y < cl.height; y++) for (let x = 0; x < cl.width; x++) {
      const i = (y * cl.width + x) * 4, k = key(i);
      H[k] = (H[k] || 0) + 1;
      if (hit(cl.x + x + 0.5, cl.y + y + 0.5)) I[k] = (I[k] || 0) + 1;
    }
    return { H, I, area: cl.width * cl.height, black: px.length };
  }, [clip, disc]);
  const hist = new Map(Object.entries(raw.H)), inside = new Map(Object.entries(raw.I));
  const top = [...hist].sort((a, c) => c[1] - a[1]).slice(0, 8);
  const insideTop = [...inside].sort((a, c) => c[1] - a[1]).slice(0, 4);
  return { hist, inside, top, insideTop, area: raw.area };
}

function verdict(m) {
  const interior = m.insideTop[0] ?? ['000000', 0];
  const [ihex, icount] = interior;
  const I = rgb(parseInt(ihex, 16));
  // rim and sill read out of the SAME frame, by count, not typed in
  const rim = [...m.hist].filter(([k]) => NAMES[k] === 'mug body').sort((a, c) => c[1] - a[1])[0];
  const sill = [...m.hist].filter(([k]) => NAMES[k] === 'sill').sort((a, c) => c[1] - a[1])[0];
  const R = rim ? rgb(parseInt(rim[0], 16)) : null;
  const S = sill ? rgb(parseInt(sill[0], 16)) : null;
  const vRim = R ? csum(I, R) : null, vSill = S ? csum(I, S) : null;
  const warmth = I[0] - I[2];                       // +ve = warm (coffee), -ve = cool
  const value = (I[0] + I[1] + I[2]) / 3;
  const fill = icount / discArea;

  // FLOORS. The rim/sill floors are the standard item 167 was held to and are
  // cited, not invented: it accepted 122 for handle-vs-sill and recorded the
  // cup's own 149. 90 is below both, so a value that clears it is genuinely
  // separated without demanding more than the cup itself manages.
  const FLOOR_RIM = 90, FLOOR_SILL = 90;
  // COFFEE TEST: the removed brew was warmth +38 at value 54. An empty ceramic
  // interior is a COOL shadow, so warmth must not be positive-and-dark.
  const coffee = warmth > 8 && value < 110;
  // POPULATION: derived above from the disc's own projected polygon.
  const FILL_MIN = 0.4;

  const checks = [
    ['interior vs RIM', vRim, FLOOR_RIM, icount > 0 && vRim !== null && vRim >= FLOOR_RIM],
    ['interior vs SILL', vSill, FLOOR_SILL, vSill !== null && vSill >= FLOOR_SILL],
    ['not coffee (warmth/value)', `${warmth >= 0 ? '+' : ''}${warmth} @ ${value.toFixed(0)}`, 'warm&dark', !coffee],
    ['fill of projected disc', fill.toFixed(3), FILL_MIN, fill >= FILL_MIN],
  ];
  return { ok: checks.every((c) => c[3]), checks, ihex, icount, R, S, vRim, vSill, warmth, value, fill };
}

function report(m, v) {
  console.log(`  crop ${clip.width}x${clip.height} at (${clip.x},${clip.y}); `
    + `projected disc area ${discArea.toFixed(0)} px`);
  console.log('  most common colours in the crop:');
  for (const [k, n] of m.top) console.log(`    #${k}  ${String(n).padStart(6)} px  ${NAMES[k] ?? ''}`);
  console.log('  inside the projected disc:');
  for (const [k, n] of m.insideTop) console.log(`    #${k}  ${String(n).padStart(6)} px  ${NAMES[k] ?? ''}`);
  if (!v.checks) { console.log(`  ${v.why}`); return; }
  for (const [name, got, floor, ok] of v.checks)
    console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(28)} ${String(got).padStart(8)}  (floor ${floor})`);
}

const m0 = await measure('main');
const v0 = verdict(m0);
console.log(`\n=== ${label} — from his spot, ${WANT_DEG} deg down, prompt "${promptText}" ===`);
report(m0, v0);
console.log(`  VERDICT: ${v0.ok ? 'the mug reads as an empty vessel' : 'FAILS'}`);
if (!v0.ok) process.exitCode = 1;

if (SELFTEST) {
  console.log('\n=== self-test: does each assertion actually go red? ===');
  // WHICH CHECK CATCHES WHICH MUTATION IS ITSELF A MEASURED FACT, NOT A GUESS.
  // The first version of this list expected HIDING the disc to redden the FILL
  // check. It did not, and the "*** SLEPT ***" was correct: hide the disc and
  // the cup's own SOLID TOP CAP shows through, which is uniform, so the disc's
  // footprint is still 98.7% one colour. What actually catches a missing disc
  // is `interior vs RIM` collapsing to 0 — the mouth becomes body colour, which
  // is precisely the "reads as a peg" complaint the item warns about reopening.
  // So the case is re-aimed at its real catcher rather than deleted, and FILL
  // gets the negative it was always for: an instrument aimed at nothing.
  const cases = [
    ['paint the interior the SILL colour', 0xa8a091, 'interior vs SILL'],
    ['paint the interior the OLD COFFEE', 0x4a3524, 'not coffee (warmth/value)'],
    ['paint the interior the BODY colour', 0xd8d2c4, 'interior vs RIM'],
    ['HIDE the interior (the cap shows: a peg)', null, 'interior vs RIM'],
  ];
  let bad = 0;
  for (const [what, colour, mustFail] of cases) {
    const changed = await p.evaluate(([c]) => {
      const s = window.__ct.scene(); let n = 0;
      s.traverse((o) => {
        if (!o.isMesh || o.geometry?.type !== 'CircleGeometry') return;
        if (Math.abs((o.geometry.parameters || {}).radius - 0.032) > 1e-4) return;
        if (c === null) o.visible = false; else { o.material.color.setHex(c); o.material.needsUpdate = true; }
        n++;
      });
      return n;
    }, [colour]);
    const mm = await measure('selftest', { shoot: false });
    const vv = verdict(mm);
    const row = vv.checks ? vv.checks.find((c) => c[0] === mustFail) : null;
    const reddened = vv.checks ? row && !row[3] : true;   // no pixels at all reddens fill
    console.log(`  ${reddened ? 'CAUGHT' : '*** SLEPT ***'}  ${what}`
      + `  (${changed} mesh) -> ${mustFail} = ${row ? row[1] : 'n/a'}`);
    if (!reddened) { bad++; process.exitCode = 2; }
    // restore
    await p.evaluate(([c]) => {
      const s = window.__ct.scene();
      s.traverse((o) => {
        if (!o.isMesh || o.geometry?.type !== 'CircleGeometry') return;
        if (Math.abs((o.geometry.parameters || {}).radius - 0.032) > 1e-4) return;
        o.visible = true; o.material.color.set(c); o.material.needsUpdate = true;
      });
    }, [disc.color]);
  }
  // THE POPULATION FLOOR'S OWN NEGATIVE: point the instrument somewhere else.
  // This is the failure the floor exists for -- three colour assertions over
  // zero pixels are all vacuously true, and that is how a check passes a world
  // where the thing it tests does nothing.
  await p.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y + Math.PI, gy, 0),
    [sx, sz, yaw, GY]);
  const away = verdict(await measure('away', { shoot: false }));
  const fillRow = away.checks.find((c) => c[0] === 'fill of projected disc');
  console.log(`  ${!fillRow[3] ? 'CAUGHT' : '*** SLEPT ***'}  turn 180 deg away from the mug`
    + `  -> fill of projected disc = ${fillRow[1]}`);
  if (fillRow[3]) { bad++; process.exitCode = 2; }

  await p.evaluate(([x, z, y, gy, pi]) => window.__ct.warp(x, z, y, gy, pi), [sx, sz, yaw, GY, pitch]);
  await p.waitForTimeout(400);
  const after = verdict(await measure('restored', { shoot: false }));
  console.log(`  restore check: ${after.ok ? 'PASS (positive sign still passes)' : '*** the restore did not restore ***'}`);
  if (!after.ok) for (const [n, got, fl, ok] of after.checks)
    console.log(`      ${ok ? 'pass' : 'FAIL'}  ${n.padEnd(28)} ${String(got).padStart(8)} (floor ${fl})`);
  if (!after.ok) process.exitCode = 2;
  console.log(`  ${bad} of ${cases.length + 1} cases slept`);
}

if (errs.length) console.log(`\nconsole errors: ${errs.length}\n  ${errs.slice(0, 5).join('\n  ')}`);
await b.close();
