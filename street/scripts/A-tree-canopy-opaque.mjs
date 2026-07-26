// A TREE CANOPY MAY BE RAGGED AT THE EDGE AND MUST BE SOLID IN THE MIDDLE.
//
// The user: "tree looks transparent in parts that probably shouldn't be
// transparent?" — brick and a whole window readable through the middle of a
// crown. `treeSprite` bites notches out with `destination-out` to keep the
// silhouette from being a smooth ellipse, which is right; the bug was that the
// notch CENTRES were allowed inside the shape, so they punched alpha-0 holes
// clean through it.
//
// It was fixed once, on the crown, by moving the centres out to the rim. The
// LOWER TUFTS kept the old radius and kept the bug — a tuft is small, so a
// notch centred at 0.92 of its radius reaches well inside it. Same bug, one
// object smaller, which is how it survived a fix aimed straight at it.
//
// Twice is enough to be worth a check. "Ragged" and "holed" are not a matter
// of degree here, they are a matter of TOPOLOGY: a bite out of the outline is
// connected to the outside, and a hole is not. So flood the transparent region
// inward from the border — every alpha-0 texel it cannot reach is a hole,
// however the notches were drawn.
//
// NOT REGISTERED in checks.mjs yet and no selftest committed; see the mutation
// note at the bottom, which I did run.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4188/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);

const r = await p.evaluate(() => {
  const scene = window.__ct.scene();
  const seen = new Set();
  const sprites = [];
  scene.traverse((n) => {
    if (!n.isMesh) return;
    const mats = Array.isArray(n.material) ? n.material : [n.material];
    for (const m of mats) {
      // a tree sprite is the alphaTest cut-out board treeSprite() paints
      if (!m || !m.map || !m.map.image || !(m.alphaTest > 0)) continue;
      // ASK WHAT IT IS, don't infer it from its size. My first predicate was
      // "alphaTest and at least 96 tall", which swept in 22 sprites that are
      // not trees at all — every one of them reported 144-252 "holes", and a
      // grille or a pennant string is SUPPOSED to have gaps. `treeSprite`
      // stamps `declareSurface(..., 'foliage')` and is TREE_W = 60 wide;
      // GOTCHAS 25 is precisely about reading the wrong stamp.
      if (m.map.userData?.surface !== 'foliage') continue;
      const img = m.map.image;
      if (img.width !== 60) continue;
      if (seen.has(img)) continue;
      seen.add(img);
      sprites.push(img);
    }
  });
  const out = [];
  for (const img of sprites) {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, c.width, c.height).data;
    const W = c.width, H = c.height;
    const A = (i) => d[i * 4 + 3];
    // flood the OUTSIDE: alpha-0 texels reachable from the border
    const outside = new Uint8Array(W * H);
    const st = [];
    for (let x = 0; x < W; x++) { st.push(x, x + (H - 1) * W); }
    for (let y = 0; y < H; y++) { st.push(y * W, W - 1 + y * W); }
    while (st.length) {
      const i = st.pop();
      if (outside[i] || A(i) !== 0) continue;
      outside[i] = 1;
      const x = i % W, y = (i / W) | 0;
      if (x > 0) st.push(i - 1);
      if (x < W - 1) st.push(i + 1);
      if (y > 0) st.push(i - W);
      if (y < H - 1) st.push(i + W);
    }
    let opaque = 0, holes = 0;
    for (let i = 0; i < W * H; i++) {
      if (A(i) !== 0) { opaque++; continue; }
      if (!outside[i]) holes++;
    }
    out.push({ w: W, h: H, opaque, holes });
  }
  return out;
});
await b.close();

// GOTCHAS 34: assert the population before the absence. "no holes" is free on
// zero sprites, and this predicate is exactly the kind that stops matching.
if (r.length < 3) {
  console.error(`ABORT: found only ${r.length} tree sprites — the predicate is not seeing them.`);
  process.exit(3);
}
const totalHoles = r.reduce((a, s) => a + s.holes, 0);
const totalOpaque = r.reduce((a, s) => a + s.opaque, 0);
console.log(`\n  ${r.length} tree sprites, ${totalOpaque} opaque texels`);
for (const s of r) {
  if (s.holes) console.log(`    ${s.w}x${s.h}  ${s.holes} enclosed transparent texels  ** HOLES **`);
}
console.log(`  enclosed transparent texels (holes right through the canopy): ${totalHoles}\n`);

if (totalHoles > 0) {
  console.error('FAIL: a canopy has transparent texels the outside cannot reach — you can see '
    + 'the wall through the middle of the tree. Notch CENTRES must sit at or beyond the radius.');
  process.exit(1);
}
console.log('OK  every canopy is ragged at the rim and solid through the middle.');
