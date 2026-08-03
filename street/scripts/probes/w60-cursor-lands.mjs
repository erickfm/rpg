// ITEM 133 — does a click land where the cursor POINTS?
//
// The art/hotspot half is settled in `w60-cursor-hotspot.mjs`. This is the
// other half, and it is the one the item makes the DONE WHEN: stand at the
// ATM, get to the PIN pad, and find — by moving the real mouse one client
// pixel at a time — the exact screen column where the machine starts calling
// itself pressable. Then compare that column with where the key's edge
// actually projects to.
//
// THE OBSERVABLE IS THE CURSOR ITSELF. `hotAt` is what swaps the arrow for the
// hand, and the swap writes `document.body.style.cursor`. So reading that back
// after each 1 px move measures the hit-test through exactly the path the
// player's hand goes through — no internals, no reimplementation of the ray.
//
// A CSS cursor is drawn by the compositor and does NOT appear in a page
// screenshot, so photographing the pointer is not available. This is the
// strongest proof there is: the art is checked in the raster, the position is
// checked here, and between them they cover the whole claim.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4184/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 0));

// the stop-and-use position from scripts/probes/atmwalk.mjs
await p.evaluate(() => window.__ct.warp(-6.15, 7.29, -Math.PI / 2, 0.14, -0.14));
await p.waitForTimeout(1200);

// HELD keypress — BUILDER-BRIEF §5: a tap can begin and end inside one frame
// and the [E] edge is read once per rendered frame, so press() is never seen.
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
await p.waitForTimeout(900);

const opened = await p.evaluate(() => !!document.querySelector('canvas'));
if (!opened) { console.error('MISS: no canvas'); process.exit(3); }

// to the PIN pad: '1' on the idle screen is INSERT CARD
await p.keyboard.down('1'); await p.waitForTimeout(120); await p.keyboard.up('1');
await p.waitForTimeout(700);

// Find the ATM screen mesh by its own canvas texture. It is 300 x 205 — the
// panel's declared w/h — NOT 600 x 410: `scale: 2` is the panel's drawing
// scale and does not appear in the texture's backing size. Guessing 600 x 410
// made the first run of this probe report "the ATM screen mesh is not in this
// world" while it was standing in front of it with the panel open.
// There are TWO of these on the block, so take the one we are standing at.
const geo = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let hit = null, best = Infinity;
  s.traverse((n) => {
    if (!n.isMesh || !n.material) return;
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    const img = m && m.map && m.map.image;
    if (!img || img.width !== 300 || img.height !== 205) return;
    const e = n.matrixWorld.elements;
    const d = Math.hypot(e[12] + 6.15, e[14] - 7.29);
    if (d > best) return;
    best = d;
    // THE MESH'S ROTATION IS BAKED INTO ITS VERTICES. `matrixWorld` is a pure
    // translation and `geometry.parameters` still reports the size the plane
    // had before it was rotated — so "local +x is the u direction" is false
    // here, and assuming it made this probe project both edges of a key onto
    // the same screen column, two points that differed only in DEPTH.
    // So read the mapping off the geometry itself: find the corners by their
    // uv, and any (u, v) is then P00 + u*(P10-P00) + v*(P01-P00).
    const g = n.geometry, pos = g.attributes.position, uv = g.attributes.uv;
    if (!uv) return;
    const corner = (wu, wv) => {
      for (let k = 0; k < uv.count; k++)
        if (Math.abs(uv.getX(k) - wu) < 1e-6 && Math.abs(uv.getY(k) - wv) < 1e-6)
          return [pos.getX(k), pos.getY(k), pos.getZ(k)];
      return null;
    };
    hit = { p00: corner(0, 0), p10: corner(1, 0), p01: corner(0, 1),
      el: [...n.matrixWorld.elements] };
  });
  return hit;
});
if (!geo || !geo.p00 || !geo.p10 || !geo.p01) {
  console.error('MISS: the ATM screen mesh (a 300x205 canvas texture with uvs) is not in this world');
  process.exit(3);
}
console.log(`ATM screen corners, in the mesh's own space: uv(0,0)=${geo.p00.map((v) => v.toFixed(3))}`
  + ` uv(1,0)=${geo.p10.map((v) => v.toFixed(3))} uv(0,1)=${geo.p01.map((v) => v.toFixed(3))}`);

// canvas px -> client px, using the SAME uv convention hud.ts's surfaceHit uses
// (x = u*w, y = (1-v)*h), inverted, then projected through the real camera
const toClient = async (cx, cy) => p.evaluate(([cxx, cyy, g]) => {
  const cam = window.__ct.camera(); cam.updateMatrixWorld(true);
  const V = cam.position.constructor;
  const u = cxx / 300, v = 1 - cyy / 205;
  const A = new V(...g.p00), B = new V(...g.p10), C = new V(...g.p01);
  const local = A.clone()
    .add(B.clone().sub(A).multiplyScalar(u))
    .add(C.clone().sub(A).multiplyScalar(v));
  const M = new (cam.matrixWorld.constructor)();
  M.fromArray(g.el);
  const world = local.applyMatrix4(M);
  const nd = world.clone().project(cam);
  return { x: (nd.x * 0.5 + 0.5) * window.innerWidth, y: (-nd.y * 0.5 + 0.5) * window.innerHeight,
    world: { x: world.x, y: world.y, z: world.z }, ndc: { x: nd.x, y: nd.y },
    cam: { x: cam.position.x, y: cam.position.y, z: cam.position.z, fov: cam.fov } };
}, [cx, cy, geo]);

const isHand = async () => p.evaluate(() => /url\(/.test(document.body.style.cursor)
  && document.body.style.cursor.includes('pointer'));

// key '5' is index 4 — the middle of the pad, furthest from any edge effect
const CRT = { x: 32, y: 9 }, PAD = { w: 40, h: 24, gx: 5, gy: 5, x: 52, y: 72 };
const i = 4;
const cell = {
  x: CRT.x + PAD.x + (i % 3) * (PAD.w + PAD.gx),
  y: CRT.y + PAD.y + Math.floor(i / 3) * (PAD.h + PAD.gy),
  w: PAD.w, h: PAD.h,
};
console.log(`key '5' occupies canvas px x ${cell.x}…${cell.x + cell.w}, y ${cell.y}…${cell.y + cell.h}`);

const midY = cell.y + cell.h / 2;
const edgeIn = await toClient(cell.x, midY);          // its left edge
const edgeOut = await toClient(cell.x + cell.w, midY); // its right edge
const w3 = (o) => `(${o.world.x.toFixed(3)}, ${o.world.y.toFixed(3)}, ${o.world.z.toFixed(3)})`;
console.log(`  camera at (${edgeIn.cam.x.toFixed(2)}, ${edgeIn.cam.y.toFixed(2)}, ${edgeIn.cam.z.toFixed(2)}) fov ${edgeIn.cam.fov}`);
console.log(`  left edge  world ${w3(edgeIn)}  ndc ${edgeIn.ndc.x.toFixed(4)}`);
console.log(`  right edge world ${w3(edgeOut)}  ndc ${edgeOut.ndc.x.toFixed(4)}`);
console.log(`  left edge projects to client x ${edgeIn.x.toFixed(2)}, right edge to ${edgeOut.x.toFixed(2)}`);
console.log(`  so the key is ${(edgeOut.x - edgeIn.x).toFixed(1)} client px wide — ${((edgeOut.x - edgeIn.x) / cell.w).toFixed(2)} px per texel`);

// sweep the real mouse across the left edge and find where the hand appears
const y = Math.round((await toClient(cell.x + cell.w / 2, midY)).y);
let flip = null, prev = null;
for (let x = Math.round(edgeIn.x) - 8; x <= Math.round(edgeIn.x) + 8; x++) {
  await p.mouse.move(x, y);
  await p.waitForTimeout(45);
  const hand = await isHand();
  if (prev !== null && hand !== prev) flip = { at: x, to: hand };
  prev = hand;
}
if (!flip) {
  console.log('  *** the cursor never changed across the edge — hotAt is not firing here ***');
  process.exitCode = 4;
} else {
  const err = flip.at - edgeIn.x;
  console.log(`  the cursor becomes a HAND at client x ${flip.at}`);
  console.log(`  the key's drawn edge is at client x ${edgeIn.x.toFixed(2)}`);
  console.log(`  MISALIGNMENT: ${err.toFixed(2)} client px `
    + `(${(err / ((edgeOut.x - edgeIn.x) / cell.w)).toFixed(2)} texels)`);
  console.log(`  ${Math.abs(err) <= 1.5 ? 'the pressable region lines up with the drawn key'
    : '*** THE PRESSABLE REGION IS OFFSET FROM THE DRAWN KEY ***'}`);
}

// THE SAME IN Y. An offset is just as likely up-down as left-right, and
// measuring only x would have proved half of it while sounding like all of it.
const midX = cell.x + cell.w / 2;
const topEdge = await toClient(midX, cell.y);
const botEdge = await toClient(midX, cell.y + cell.h);
const xCol = Math.round((await toClient(midX, midY)).x);
console.log(`  top edge projects to client y ${topEdge.y.toFixed(2)}, bottom to ${botEdge.y.toFixed(2)}`);
let flipY = null, prevY = null;
for (let yy = Math.round(topEdge.y) - 8; yy <= Math.round(topEdge.y) + 8; yy++) {
  await p.mouse.move(xCol, yy);
  await p.waitForTimeout(45);
  const hand = await isHand();
  if (prevY !== null && hand !== prevY) flipY = { at: yy, to: hand };
  prevY = hand;
}
if (!flipY) {
  console.log('  *** the cursor never changed across the TOP edge ***');
  process.exitCode = 4;
} else {
  const errY = flipY.at - topEdge.y;
  const pxPerTexelY = (botEdge.y - topEdge.y) / cell.h;
  console.log(`  the cursor becomes a HAND at client y ${flipY.at}, drawn edge at ${topEdge.y.toFixed(2)}`);
  console.log(`  MISALIGNMENT IN Y: ${errY.toFixed(2)} client px (${(errY / pxPerTexelY).toFixed(2)} texels)`);
  console.log(`  ${Math.abs(errY) <= 1.5 ? 'the pressable region lines up with the drawn key vertically'
    : '*** THE PRESSABLE REGION IS OFFSET VERTICALLY ***'}`);
}

// and does a click at 1 px inside that edge actually enter a digit?
await p.mouse.move(Math.round(edgeIn.x) + 2, y); await p.waitForTimeout(60);
await p.mouse.down(); await p.waitForTimeout(60); await p.mouse.up();
await p.waitForTimeout(400);
await p.screenshot({ path: 'shots/w60-cursor-atm-edge.png' });
console.log('shots/w60-cursor-atm-edge.png — after one click 2 px inside the left edge of key 5');
await b.close();
