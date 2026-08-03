// ITEM 272 — *"people sitting still looks bad because they have no legs??"*
//
// This is an APPEARANCE complaint, so the instrument is a set of frames from
// where a player actually stands, not a measurement saying the legs exist. The
// row already establishes that they exist in the atlas.
//
// It shoots the occupied booth from four normal vantages and, alongside each,
// reports what is BETWEEN the eye and the sitter's shins — because if the
// answer is "a solid vinyl bench", the legs are drawn and occluded and the fix
// is not in the art.
//
// Every position is read from the world: the room from `roomDims()`, the
// sitters from the scene (sprite planes carrying a citizen texture), the
// benches by shape. Nothing about the diner's layout is typed here.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const TAG = (process.argv.find((a) => a.startsWith('--tag=')) ?? '--tag=x').slice(6);
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate(() => window.__ct.clock(13, 0));

const room = (await p.evaluate(() => window.__ct.roomDims())).find((r) => r.id === 'diner');
if (!room) { console.error('no diner in roomDims()'); process.exit(3); }
console.log(`\ndiner  cx ${room.cx}  cz ${room.cz}  w ${room.w}  d ${room.d}`);

// Stand in the room first — the region cull hides every interior you are not
// inside (GOTCHAS 79b), so a census taken from spawn finds nothing at all.
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [room.cx, room.cz]);
// `waitPainted` (item 181) waits for the frame counter to advance WITH
// TRIANGLES IN IT. A fixed triangle threshold is the wrong instrument indoors:
// a small room facing a blank wall legitimately draws a few hundred, so a
// `> 3000` gate times out on a perfectly painted frame. GOTCHAS 80.
await waitPainted(p, { quiet: true });

// ── WHO IS SITTING, AND WHAT IS IN FRONT OF THEM ────────────────────────────
const world = await p.evaluate(([cx, cz, hw, hd]) => {
  const inRoom = (o) => Math.abs(o.x - cx) <= hw && Math.abs(o.z - cz) <= hd;
  const people = [], benches = [], backs = [];
  window.__ct.scene().traverse((o) => {
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements, at = { x: e[12], y: e[13], z: e[14] };
    const g = o.geometry;
    if (!g || !g.parameters) return;
    // a citizen is a textured PLANE standing on its own
    if (g.type === 'PlaneGeometry' && o.material?.map && inRoom(at)) {
      people.push({ ...at, w: g.parameters.width, h: g.parameters.height,
        ry: o.rotation?.y ?? 0, name: o.name || '' });
    }
    if (g.type === 'BoxGeometry' && inRoom(at)) {
      const { width, height, depth } = g.parameters;
      // the vinyl bench: 0.55 x 0.45 x 1.5 in the source, but matched on RATIO
      // rather than on those numbers, so a resize does not blind this probe
      if (height > 0.3 && height < 0.6 && depth > 1.0 && width > 0.35 && width < 0.8) {
        benches.push({ ...at, width, height, depth, top: at.y + height / 2 });
      }
      if (height > 0.5 && height < 0.8 && depth > 1.0 && width < 0.2) {
        backs.push({ ...at, width, height, depth, bottom: at.y - height / 2, top: at.y + height / 2 });
      }
    }
  });
  return { people, benches, backs };
}, [room.cx, room.cz, room.w / 2, room.d / 2]);

console.log(`\n  ${world.people.length} sprite plane(s) in the room`);
for (const q of world.people) {
  console.log(`    sprite at (${q.x.toFixed(2)}, ${q.y.toFixed(2)}, ${q.z.toFixed(2)})`
    + `  ${q.w.toFixed(2)} x ${q.h.toFixed(2)} m  -> spans y ${(q.y - q.h / 2).toFixed(3)}`
    + ` … ${(q.y + q.h / 2).toFixed(3)}   yaw ${q.ry.toFixed(2)}`);
}
console.log(`\n  ${world.benches.length} bench box(es); tops at `
  + `${[...new Set(world.benches.map((q) => q.top.toFixed(3)))].join(', ')}`);
console.log(`  ${world.backs.length} backrest(s); spanning y `
  + `${[...new Set(world.backs.map((q) => `${q.bottom.toFixed(2)}…${q.top.toFixed(2)}`))].join(', ')}`);

// the sitters: sprite planes near a bench top
const sitters = world.people.filter((q) =>
  world.benches.some((c) => Math.hypot(q.x - c.x, q.z - c.z) < 0.9));
console.log(`\n  ${sitters.length} sitter(s) identified by proximity to a bench`);

if (!sitters.length) { console.error('no sitters found — nothing to photograph'); await b.close(); process.exit(3); }
const s = sitters[0];

// ── THE FRAMES ──────────────────────────────────────────────────────────────
const EYE = 1.62;
const shoot = async (name, x, z, yaw, pitch = 0) => {
  await p.evaluate(([a, c, y, t]) => window.__ct.warp(a, c, y, 0, t), [x, z, yaw, pitch]);
  await waitPainted(p, { quiet: true }).catch(() => {});
  await p.waitForTimeout(600);
  const buf = await p.screenshot({ path: `shots/w108-272-${TAG}-${name}.png` });
  console.log(`  shots/w108-272-${TAG}-${name}.png  from (${x.toFixed(2)}, ${z.toFixed(2)})`
    + ` yaw ${yaw.toFixed(2)} pitch ${pitch}  ${buf.length} bytes`);
};
void EYE;

// A. down the aisle, the way you walk in — booths on one side, side-on
const aisleZ = s.z - 1.9;
await shoot('aisle-down', s.x - 3.2, aisleZ, Math.atan2(1, 0), -0.06);
// B. standing at the open (aisle) end of the sitter's own booth, looking at them
await shoot('booth-end', s.x, s.z - 2.0, 0, -0.10);
// C. across the table, where their companion sits
const other = sitters.find((q) => Math.abs(q.x - s.x) > 0.6) ?? s;
await shoot('across', (s.x + other.x) / 2 + (other.x - s.x), s.z, Math.atan2(s.x - other.x, 0), -0.12);
// D. close, square on, so the sprite is unambiguous
await shoot('close', s.x, s.z - 1.1, 0, -0.16);

console.log(`\n  sitter used: (${s.x.toFixed(2)}, ${s.y.toFixed(2)}, ${s.z.toFixed(2)})`);
await b.close();
