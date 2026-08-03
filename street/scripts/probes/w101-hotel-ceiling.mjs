// ITEM 254 — IS THE HOTEL CEILING A SURFACE, OR A HOLE?
//
// The row says the one real defect in the lobby is the dark ceiling, and that
// it "only reads badly in frames looking ACROSS the 11 x 26 m room". That is a
// claim about PIXELS, so this measures pixels rather than reading a hex out of
// the palette — `int-hotel.ts:168` says `ceil: 0x2e1c1e` and that number tells
// you nothing about how much of a frame it fills or whether anything in it
// varies.
//
// Three numbers per vantage, all off the same screenshot:
//
//   cover    fraction of the frame whose pixel is within CEIL_TOL of the
//            declared ceiling colour. "How much of the view is ceiling."
//   uniq     distinct RGB values inside that region. A textured surface in this
//            world is DITHERED, so it has tens of them; a bare
//            MeshBasicMaterial has ONE. This is the number that separates
//            "a dark ceiling" from "a hole where the ceiling should be".
//   lum      mean 0-255 luminance of the region, and the wall's, for the ratio
//            the file's own rationale rests on ("the ceiling is darker than
//            the wall so the room feels tall").
//
// The clock is PINNED (`__ct.clock(13, 0)`): a game day is 24 real minutes, so
// two runs eight minutes apart are two different times of day and the sky
// through the lobby glazing moves with it. Same hour, always.
//
// Usage: SHOT_URL=http://localhost:4191/ node scripts/probes/w101-hotel-ceiling.mjs <tag>
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4191/');
const TAG = process.argv[2] ?? 'now';
const HOUR = 13;
mkdirSync('shots', { recursive: true });

// Vantages, in the room's LOCAL frame (x across, z along, +z = away from the
// door). Yaw 0 is -z in this world (crosstown.ts:544), so PI is "back at the
// door" and +/-PI/2 are the two ACROSS-the-room looks the row is about.
// Pitch is up where a ceiling complaint needs it: the user's own frame
// (shots/user-hotelspace.png) is a standing eye looking very slightly up.
const VIEWS = [
  ['across-e', 0.0, 2.0, Math.PI / 2, 0.10],   // mid-room, looking east across
  ['across-w', 0.0, 2.0, -Math.PI / 2, 0.10],  // mid-room, looking west across
  ['along', 0.0, 9.0, Math.PI, 0.06],          // deep in, looking back down the length
  ['entry', 0.0, -10.0, 0.0, 0.06],            // at the door, looking in
];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 60000 });
await waitPainted(p, { quiet: true });

const room = await p.evaluate(() => window.__ct.roomDims().find((r) => /hotel/i.test(r.id)));
if (!room) { console.log('ABORT no hotel room — hook missing, NOT a world fault'); await b.close(); process.exit(3); }
console.log(`hotel  cx ${room.cx}  cz ${room.cz}  w ${room.w}  d ${room.d}  h ${room.h ?? '?'}`);

// The two colours are READ OFF THE LIVE MATERIALS, never retyped from the
// palette literal — that is the whole of BUILDER-BRIEF §8, and it is also the
// only way this probe keeps working after somebody changes the palette.
// ⚠ SELF-CAUGHT, AND THE REASON THIS IS SPELLED OUT. The first version took
// "the room-sized plane up high" and read `material.color` off it. The moment a
// second, MAPPED ceiling plane was laid under the kit's, it matched the same
// filter, and `material.color` on a mapped MeshBasicMaterial is the white tint
// multiplier — so the reference colour became #ffffff and the probe reported
// `cover 0.0%, lum 252.7` for a room that had got DARKER in no place at all.
// A probe that changes its own reference between the before and the after run
// is not measuring a change, and this one would have printed a triumphant
// number either way.
//
// So: the reference tone comes off the plane with NO MAP — the kit's own, which
// this file never touches and which therefore still carries the declared
// palette. The mapped one is reported separately, as a fact about the world.
const cols = await p.evaluate(([cx, cz, w, d]) => {
  const out = { declared: null, mapped: 0, unmapped: 0 };
  const x0 = cx - w / 2 - 1, x1 = cx + w / 2 + 1, z0 = cz - d / 2 - 1, z1 = cz + d / 2 + 1;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.material || !o.geometry) return;
    // no THREE on window in the built bundle — borrow the Vector3 constructor
    // off the object's own position rather than importing anything.
    const q = o.getWorldPosition(new o.position.constructor());
    if (q.x < x0 || q.x > x1 || q.z < z0 || q.z > z1) return;
    const g = o.geometry.parameters ?? {};
    if (o.geometry.type !== 'PlaneGeometry' || q.y < 1.5) return;
    if (Math.abs((g.width ?? 0) - w) > 0.01 || Math.abs((g.height ?? 0) - d) > 0.01) return;
    if (o.material.map) out.mapped++;
    else { out.unmapped++; out.declared = '#' + o.material.color.getHexString(); }
  });
  return out;
}, [room.cx, room.cz, room.w, room.d]);
console.log(`ceiling planes: ${cols.unmapped} unmapped (declared tone ${cols.declared})`
  + `, ${cols.mapped} mapped`);
if (!cols.declared) { console.log('ABORT no unmapped ceiling plane — cannot fix a reference tone'); await b.close(); process.exit(3); }

const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const CEIL = hex2rgb(cols.declared);

for (const [name, lx, lz, yaw, pitch] of VIEWS) {
  await p.evaluate(([x, z, y, pi, h]) => {
    window.__ct.clock(h, 0);
    window.__ct.warp(x, z, y, undefined, pi);
  }, [room.cx + lx, room.cz + lz, yaw, pitch, HOUR]);
  await waitPainted(p, { quiet: true });
  const path = `shots/w101-hotel-${name}-${TAG}.png`;
  const buf = await p.screenshot({ path });
  const black = await blackFraction(p, buf);

  // decoded IN THE PAGE, the same way lib/painted.mjs's blackFraction does it —
  // this repo has no pngjs and adding a dependency for one histogram is not
  // worth it.
  const m = await p.evaluate(async ([b64, ceil]) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    // TWO tolerances on purpose, because the whole change under test is that
    // the ceiling stops being ONE colour. A tight band measures the flat
    // version honestly and undercounts a textured one; a wide band counts the
    // textured field but must not reach the wall.
    //
    //   TIGHT 26  the original band. Comparable across the change only as a
    //             LOWER bound on the after run.
    //   WIDE  38  the region either version occupies. The ox-blood wall is at
    //             distance 64 from the ceiling tone and its own darkest dither
    //             at 46, so 38 leaves 8 levels of margin and no wall leaks in —
    //             which `wallLum` staying put across the runs is the check on.
    const TIGHT = 26, WIDE = 38;
    const lum = (r, gg, b) => 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    let n = 0, wide = 0, sum = 0, wallN = 0, wallSum = 0;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      const dist = Math.hypot(r - ceil[0], gg - ceil[1], b - ceil[2]);
      if (dist <= TIGHT) n++;
      if (dist <= WIDE) { wide++; sum += lum(r, gg, b); seen.add((r << 16) | (gg << 8) | b); }
      else if (r > 70 && r < 150 && gg < 70 && b < 80) { wallN++; wallSum += lum(r, gg, b); }
    }
    const px = d.length / 4;
    return { cover: 100 * n / px, wide: 100 * wide / px, uniq: seen.size,
      lum: wide ? sum / wide : 0, wallLum: wallN ? wallSum / wallN : 0 };
  }, [buf.toString('base64'), CEIL]);
  console.log(
    `${name.padEnd(9)} cover ${m.cover.toFixed(1).padStart(5)}%`
    + `  wide ${m.wide.toFixed(1).padStart(5)}%`
    + `  uniq ${String(m.uniq).padStart(5)}`
    + `  lum ${m.lum.toFixed(1).padStart(5)}`
    + `  wall-lum ${m.wallLum.toFixed(1).padStart(5)}`
    + `  black ${black}`
    + (black > 0.98 ? '   <-- YOU PHOTOGRAPHED THE VOID' : ''));
}
if (errs.length) console.log(`\nPAGE ERRORS (${errs.length}):\n  ` + errs.join('\n  '));
else console.log('\nno page errors');
await b.close();
