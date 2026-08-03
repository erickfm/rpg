// w100 / item 96 — HOW MUCH OF THE FRAME IS ONE FLAT COLOUR?
//
// "A fragment shader is invisible to material.color from JS — measure PIXELS."
// The hotel's ceiling is the one thing in the row that survived w97's survey,
// and the complaint is not its hue, it is that it has no surface: 286 m2 of a
// single RGB triple with nothing for the eye to attach to. paint.ts:53 states
// the same rule in the world's own words — "an untextured quad has no grain for
// the eye to attach to and no joints to give it scale".
//
// So this counts pixels, not materials. For each station it reports, over the
// CEILING BAND of the frame (everything above the wall head, found by scanning
// down from the top for the first row that is not ceiling-ish):
//
//   ·  distinct  — how many distinct RGB triples appear in the band
//   ·  modal%    — what share of the band is its single commonest colour
//
// A textured surface has hundreds of triples and a modal share well under half.
// A flat quad has a handful (dither and the lamp pools) and a modal share near
// 100%. The number to move is `modal%`.
//
// SELF-TEST, BOTH SIGNS: run with --selftest and it also measures a synthetic
// flat field and a synthetic noisy one, so a reader can see the metric separate
// them rather than take it on trust.
//
// Usage: SHOT_URL=http://localhost:4562/ node scripts/probes/w100-ceiling-flatness.mjs [--selftest]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL || 'http://localhost:4177/';
const TAG = process.env.TAG || 'now';
const SELFTEST = process.argv.includes('--selftest');
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 30000 });
// A GAME DAY IS 24 REAL MINUTES — pin the hour or the second run photographs
// the night wash and the diff is the clock, not the change.
await p.evaluate(() => window.__ct.clock(13, 0));

const room = await p.evaluate(() => window.__ct.roomDims().find((r) => r.id === 'hotel'));
const CX = room.cx, CZ = room.cz;

// Room-local stations. `wide` is the angle the user's own screenshot was taken
// from — standing in the room looking ACROSS it, which is the frame w97 named as
// the strange one; `far` looks down the length, which w97 called handsome.
const STATIONS = [
  { id: 'wide', lx: -1.0, lz: -1.0, yaw: -Math.PI / 2 },
  { id: 'far', lx: 3.6, lz: -10.0, yaw: Math.PI },
  { id: 'entry', lx: 0.0, lz: 11.0, yaw: Math.PI },
];

/** distinct-colour and modal-share stats over a MASK of an RGBA buffer */
function statsMasked(px, W, H, mask) {
  const hist = new Map();
  let n = 0, lum = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!mask[y * W + x]) continue;
    const i = (y * W + x) * 4;
    const k = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
    hist.set(k, (hist.get(k) || 0) + 1); n++;
    lum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
  }
  let modal = 0, modalK = 0;
  for (const [k, c] of hist) if (c > modal) { modal = c; modalK = k; }
  return { distinct: hist.size, modalPct: n ? +(100 * modal / n).toFixed(1) : 0, n,
    meanLum: n ? +(lum / n).toFixed(1) : 0,
    modalHex: '#' + modalK.toString(16).padStart(6, '0') };
}

/** distinct-colour and modal-share stats over a rectangle of an RGBA buffer */
function stats(px, W, x0, y0, x1, y1) {
  const hist = new Map();
  let n = 0, lum = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      const k = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
      hist.set(k, (hist.get(k) || 0) + 1); n++;
      lum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    }
  }
  let modal = 0, modalK = 0;
  for (const [k, c] of hist) if (c > modal) { modal = c; modalK = k; }
  // Mean luminance is reported alongside, because the fix must NOT simply
  // brighten the ceiling: int-hotel.ts's own rule is "the ceiling is darker than
  // the wall so the room feels tall and the light hangs IN it", and the wall
  // (#6d2029) sits at LUM 49.1. A fix that raises the band past that has broken
  // the room's stated design to win the flatness number.
  return { distinct: hist.size, modalPct: +(100 * modal / n).toFixed(1), n,
    meanLum: +(lum / n).toFixed(1),
    modalHex: '#' + modalK.toString(16).padStart(6, '0') };
}

if (SELFTEST) {
  // NEGATIVE AND POSITIVE CASE, so the metric is shown to separate them.
  const W = 200, H = 100;
  const flat = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { flat[i * 4] = 46; flat[i * 4 + 1] = 28; flat[i * 4 + 2] = 30; }
  const noisy = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const v = 20 + ((i * 2654435761) % 60);
    noisy[i * 4] = v + 26; noisy[i * 4 + 1] = v; noisy[i * 4 + 2] = v + 4;
  }
  // through statsMasked — the function the run actually uses, not a sibling
  const all = new Uint8Array(W * H).fill(1);
  const f = statsMasked(flat, W, H, all), nz = statsMasked(noisy, W, H, all);
  console.log(`SELFTEST flat  field: distinct=${f.distinct} modal%=${f.modalPct}`);
  console.log(`SELFTEST noisy field: distinct=${nz.distinct} modal%=${nz.modalPct}`);
  if (!(f.distinct === 1 && f.modalPct === 100)) { console.log('SELFTEST FAILED (flat)'); process.exit(1); }
  if (!(nz.distinct > 20 && nz.modalPct < 20)) { console.log('SELFTEST FAILED (noisy)'); process.exit(1); }
  console.log('SELFTEST ok — the metric separates a flat field from a textured one.\n');
}

for (const s of STATIONS) {
  await p.evaluate(({ x, z, yaw }) => window.__ct.warp(x, z, yaw, 0, 0),
    { x: CX + s.lx, z: CZ + s.lz, yaw: s.yaw });
  await p.waitForTimeout(800);
  const path = `shots/w100-ceil-${s.id}-${TAG}.png`;
  const buf = await p.screenshot({ path });

  // Decode with the page's own canvas — no image library needed, and it reads
  // the very PNG that was written, not a second render.
  const px = await p.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height);
    return { w: img.width, h: img.height, data: Array.from(d.data) };
  }, buf.toString('base64'));

  const data = Uint8Array.from(px.data);

  // ── THE BAND IS GEOMETRY, AND IT HAS TO BE ────────────────────────────
  //
  // THIS PROBE LIED TO ME ONCE ALREADY AND IT IS WORTH THE PARAGRAPH. The first
  // version found the ceiling band by scanning the centre column for the first
  // sharp colour change — the wall head. That is correct only while the ceiling
  // is FLAT. The moment the fix landed, the scan stopped at the first coffer rib
  // instead: the band went from 213 px to 11 px and the "after" numbers were
  // measured over a strip one twentieth the size of the "before" one. The
  // metric was comparing two different regions and would have reported whatever
  // I wanted to see.
  //
  // A measurement whose extent depends on the thing being measured cannot be a
  // before/after. So the band is now computed from the CAMERA AND THE ROOM and
  // never looks at a pixel: unproject each pixel, and it is a ceiling pixel if
  // its ray rises (dir.y > 0) and meets the y = H plane inside the room's own
  // footprint. Adding texture cannot move that mask by one pixel.
  const mask = await p.evaluate(({ W, H, room }) => {
    const cam = window.__ct.camera();
    cam.updateMatrixWorld(true);
    const eye = cam.getWorldPosition(cam.position.clone());
    const hw = room.w / 2, hd = room.d / 2;
    // the ceiling's height: the room's own H is not published, so take it from
    // the kit ceiling plane the scene actually holds (see w100-ceilings.mjs).
    let ceilY = null;
    const scene = window.__ct.scene(); scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if (!o.isMesh || o.geometry?.type !== 'PlaneGeometry') return;
      const g = o.geometry.parameters || {};
      if (Math.abs((g.width ?? -1) - room.w) > 0.01 || Math.abs((g.height ?? -1) - room.d) > 0.01) return;
      const wp = o.getWorldPosition(o.position.clone());
      if (Math.abs(wp.x - room.cx) > 0.05 || Math.abs(wp.z - room.cz) > 0.05 || wp.y < 1.5) return;
      ceilY = Math.max(ceilY ?? 0, wp.y);
    });
    if (ceilY === null) return null;
    const out = new Uint8Array(W * H);
    const v = cam.position.clone();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = v.set(((x + 0.5) / W) * 2 - 1, -(((y + 0.5) / H) * 2 - 1), 0.5).unproject(cam);
        const dx = t.x - eye.x, dy = t.y - eye.y, dz = t.z - eye.z;
        if (dy <= 1e-6) continue;
        const k = (ceilY - eye.y) / dy;
        if (k <= 0) continue;
        const hx = eye.x + dx * k, hz = eye.z + dz * k;
        if (Math.abs(hx - room.cx) <= hw && Math.abs(hz - room.cz) <= hd) out[y * W + x] = 1;
      }
    }
    return Array.from(out);
  }, { W: px.w, H: px.h, room });

  if (!mask) { console.log(`${s.id}: could not build a ceiling mask — nothing measured`); continue; }
  const m = Uint8Array.from(mask);
  const st = statsMasked(data, px.w, px.h, m);
  const pct = (100 * st.n / (px.w * px.h)).toFixed(1);
  console.log(`${s.id.padEnd(6)} ceiling mask ${String(st.n).padStart(7)}px (${String(pct).padStart(4)}% of frame)  `
    + `distinct=${String(st.distinct).padStart(5)}  modal%=${String(st.modalPct).padStart(5)} `
    + `meanLUM=${String(st.meanLum).padStart(5)}  modal=${st.modalHex}  ->  ${path}`);
}

await b.close();
