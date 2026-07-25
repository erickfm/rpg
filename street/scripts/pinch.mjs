// WHAT forms each tight stretch? For every pinch lane3.mjs reports, name the two
// bodies that bound it. The question is whether the tight spots are independent
// mistakes or one placement constant applied many times — those need different fixes.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26: prove it, do not just name it
await p.waitForTimeout(600);

// [label, walk axis, fixed coord, sample coord] from lane3's output
const SPOTS = [
  ['west  -92.9', 'z', -92.9], ['west  -71.4', 'z', -71.4], ['west  -36.8', 'z', -36.8],
  ['west  -64.8', 'z', -64.8], ['west  -43.5', 'z', -43.5],
  ['east  -22.8', 'z', -22.8], ['east  -50.8', 'z', -50.8], ['east  -92.9', 'z', -92.9],
  ['east  -29.4', 'z', -29.4], ['east  -57.4', 'z', -57.4], ['east  -34.1', 'z', -34.1],
  ['east   -5.9', 'z',  -5.9],
];
const out = await p.evaluate((SPOTS) => {
  const cols = window.__ct.colliders().filter(c => c && isFinite(c.minX) && Math.abs(c.minX) < 500);
  const post = c => (c.maxX - c.minX) < 0.8 && (c.maxZ - c.minZ) < 0.8;
  const res = [];
  for (const [label, , fixed] of SPOTS) {
    const west = label.startsWith('west');
    const x0 = west ? -7.0 : 5.5, x1 = west ? -5.5 : 7.0;
    const near = cols.filter(c => c.maxX > x0 - 1 && c.minX < x1 + 1 &&
      c.maxZ > fixed - 0.6 && c.minZ < fixed + 0.6);
    res.push({ label, n: near.length,
      posts: near.filter(post).map(c => [+((c.minX+c.maxX)/2).toFixed(2), +((c.minZ+c.maxZ)/2).toFixed(2),
        +(c.maxX-c.minX).toFixed(2), +(c.maxZ-c.minZ).toFixed(2)]),
      slabs: near.filter(c => !post(c)).map(c => [+c.minX.toFixed(2), +c.maxX.toFixed(2)]) });
  }
  return res;
}, SPOTS);
for (const r of out)
  console.log(`${r.label}  posts:${r.posts.length ? r.posts.map(q=>`${q[2]}×${q[3]} @(${q[0]},${q[1]})`).join(' ') : ' none'}   slabs x:${r.slabs.map(s=>s.join('..')).join(' ')}`);
await b.close();
