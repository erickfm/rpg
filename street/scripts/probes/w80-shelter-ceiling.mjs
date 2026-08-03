// Item 171. The user, on the park shelter: *"shelter roof is still bugged in
// terms of graphics."* Standing underneath in the rain, looking up: the
// underside reads as a dense high-frequency stripe grid that shimmers.
//
// This locates the ceiling plane, reports its REAL density against the rest of
// the shelter's timber and against the world's WALL_PPM, and takes the shot from
// his vantage — standing under it, looking up.
//
//   SHOT_URL=http://localhost:4360/ node scripts/probes/w80-shelter-ceiling.mjs [tag]
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';
import { readFileSync } from 'node:fs';

const TAG = process.argv[2] ?? 'now';
const URL = aim('http://localhost:4360/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(500);

// EVERY TEXTURED MESH IN THE SHELTER, with the px/m it actually draws at.
// px/m is canvas pixels per world metre along each axis: (canvas * repeat) / face.
const shelter = await p.evaluate(() => {
  // FIND THE SHELTER BY ITS CEILING, not by a box of coordinates I typed. The
  // first cut of this probe guessed x -50…-30, z -100…-60 and picked up a 30 x 13
  // backdrop plane instead — the check reporting confidently about the wrong
  // object, which is GOTCHAS 48 wearing an indoor hat. The ceiling is the only
  // 4.2 x 4.2 m PlaneGeometry in the world, and 4.2 is derived: E * 2, with
  // E = SH_H + SH_OVER (ct/park.ts:1848).
  let hub = null;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || o.geometry?.type !== 'PlaneGeometry') return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    if (Math.abs((bb.max.x - bb.min.x) - 4.2) > 0.2 || Math.abs((bb.max.y - bb.min.y) - 4.2) > 0.2) return;
    hub = o.getWorldPosition(new o.position.constructor());
  });
  if (!hub) return [];
  const near = (w) => Math.abs(w.x - hub.x) < 4 && Math.abs(w.z - hub.z) < 4 && w.y < hub.y + 2;
  const sz = (m) => {
    const g = m.geometry;
    g.computeBoundingBox();
    const bb = g.boundingBox;
    const s = m.getWorldScale(new m.position.constructor());
    return [(bb.max.x - bb.min.x) * s.x, (bb.max.y - bb.min.y) * s.y, (bb.max.z - bb.min.z) * s.z];
  };
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const w = o.getWorldPosition(new o.position.constructor());
    // the shelter sits at the park's west end; take a generous box around it
    if (!near(w)) return;
    const t = o.material?.map;
    const [dx, dy, dz] = sz(o);
    // the two biggest dimensions are the face a texture is spread over
    const dims = [dx, dy, dz].sort((a, c) => c - a);
    out.push({
      type: o.geometry.type,
      pos: [+w.x.toFixed(2), +w.y.toFixed(2), +w.z.toFixed(2)],
      size: [+dx.toFixed(3), +dy.toFixed(3), +dz.toFixed(3)],
      canvas: t?.image ? [t.image.width, t.image.height] : null,
      repeat: t ? [+t.repeat.x.toFixed(3), +t.repeat.y.toFixed(3)] : null,
      minFilter: t?.minFilter ?? null, magFilter: t?.magFilter ?? null,
      generateMipmaps: t?.generateMipmaps ?? null,
      mips: t?.mipmaps?.length ?? null,
      ppm: t?.image ? [+((t.image.width * t.repeat.x) / dims[0]).toFixed(2),
                       +((t.image.height * t.repeat.y) / dims[1]).toFixed(2)] : null,
      face: [+dims[0].toFixed(3), +dims[1].toFixed(3)],
    });
  });
  return out;
});

console.log(`\n${shelter.length} textured meshes around the shelter\n`);
console.log('geometry            world pos                size                   canvas   repeat        px/m');
for (const m of shelter) {
  console.log(`${m.type.padEnd(18)} (${m.pos.join(', ').padEnd(22)}) `
    + `${m.size.join(' × ').padEnd(22)} ${String(m.canvas ?? '-').padEnd(8)} `
    + `${String(m.repeat ?? '-').padEnd(13)} ${m.ppm ? m.ppm.join(' × ') : '-'}`);
}

// the ceiling: the big downward plane
const ceil = shelter.find((m) => m.type === 'PlaneGeometry' && Math.abs(m.face[0] - 4.2) < 0.2);
if (ceil) {
  console.log(`\nTHE CEILING: ${ceil.face[0]} × ${ceil.face[1]} m, canvas ${ceil.canvas.join('×')},`
    + ` repeat ${ceil.repeat.join('×')} -> ${ceil.ppm.join(' × ')} px/m`);
  console.log(`  minFilter ${ceil.minFilter} magFilter ${ceil.magFilter}`
    + ` generateMipmaps ${ceil.generateMipmaps} mipmaps ${ceil.mips}`);
  const posts = shelter.filter((m) => m.type === 'BoxGeometry' && m.ppm);
  if (posts.length) {
    const vals = posts.map((m) => Math.max(...m.ppm));
    console.log(`  the shelter's BOX timber draws at ${[...new Set(vals.map((v) => v.toFixed(2)))].join(', ')} px/m`);
  }
}

// ── HIS VANTAGE: standing under it, looking up ──────────────────────────────
//
// CLOCK AFTER THE WARP, not before. Worker seventyeight's first capture of this
// same shelter came back solid black because `warp` put the hour back; the frame
// was worthless and it nearly got filed. (notes/w78-litter-self-push.md.)
const stand = await p.evaluate(() => {
  let c = null;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || o.geometry?.type !== 'PlaneGeometry') return;
    const w = o.getWorldPosition(new o.position.constructor());
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    if (Math.abs((bb.max.x - bb.min.x) - 4.2) > 0.2 || Math.abs((bb.max.y - bb.min.y) - 4.2) > 0.2) return;
    c = [w.x, w.y, w.z];
  });
  return c;
});
if (!stand) { console.error('no ceiling plane found — nothing to shoot'); await b.close(); process.exit(3); }
console.log(`\nceiling plane at (${stand.map((v) => v.toFixed(2)).join(', ')})`);

const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [stand[0], stand[2]]);
// under the middle of it, pitched up. pitch is the 5th arg; +1.35 rad ≈ 77° up.
await p.evaluate(([x, z, gy]) => window.__ct.warp(x, z, 0, gy, 1.35), [stand[0], stand[2], gy]);
await p.waitForTimeout(200);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
await waitPainted(p);
// SAY WHAT HOUR THE PICTURE IS OF. The HUD stamp in the corner is not the world
// clock and reading it as one would put a night shot in a note as a day shot.
const now = await p.evaluate(() => window.__ct.clockNow());
console.log(`world clock at the shutter: ${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`);
const shot = `shots/w80-shelter-ceiling-${TAG}.png`;
const buf = await p.screenshot({ path: shot });
console.log(`shot ${shot} — standing under the shelter at ground ${gy.toFixed(2)}, pitched 1.35 rad up`);
console.log(`  black fraction ${(await blackFraction(p, buf) * 100).toFixed(1)}%  (a black frame proves nothing — GOTCHAS 78/80)`);
// ── AND THE OBLIQUE VIEW, WHICH IS WHERE MOIRE ACTUALLY LIVES ──────────────
//
// Straight up is the MAGNIFIED case and it cannot show aliasing. A repeating
// stripe pattern shimmers when it is MINIFIED — seen down the length of the
// ceiling from the far edge, where many texels fall into one screen pixel. So
// the second shot stands at the shelter's south-east post and looks up along
// the diagonal, which is the longest run of boards in the world.
await p.evaluate(([x, z, gy]) => window.__ct.warp(x + 1.9, z + 1.9, -Math.PI / 4, gy, 0.55),
  [stand[0], stand[2], gy]);
await p.waitForTimeout(200);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(700);
await waitPainted(p);
const shot2 = `shots/w80-shelter-ceiling-oblique-${TAG}.png`;
const buf2 = await p.screenshot({ path: shot2 });
console.log(`shot ${shot2} — from the SE post, looking up the diagonal (the minified case)`);
console.log(`  black fraction ${(await blackFraction(p, buf2) * 100).toFixed(1)}%`);
void readFileSync;
await b.close();
