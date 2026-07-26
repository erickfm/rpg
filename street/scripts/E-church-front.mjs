// DO THE PILLARS BLOCK THE WINDOWS?
//
// The user, routed to me at FEATURE-REQUESTS.md:1085: *"pillars of the church
// seem not fully thought out. they block the windows i think?"* The diagnosis in
// `ct/civic.ts` is that the buttresses are REAL BOXES placed in metres and the
// lancets are PAINTED in texel space, and until the bay set-out landed nothing
// reconciled the two — so nothing made them miss, and they didn't, by 0.82 m of
// a 2 m window each side.
//
// The fix is in the source and reads convincingly. That is not the test. The
// desk's own words to me: *"code presence is NOT the test."* And there is no
// ledger row for this request at all, so nothing has ever been asked of the
// built world.
//
// WHAT THIS MEASURES, and why it is not just the source arithmetic again: the
// buttresses are read OUT OF THE SCENE as world boxes, and compared against the
// bay divisions the front is set out on. If a buttress has drifted off its bay
// — the exact failure the fix exists to prevent — these disagree. Re-deriving
// `BUT_X` from the same constants the builder used would prove nothing.
//
// It also SHOOTS the front, because the complaint is a visual one and the
// numbers cannot tell you whether it looks thought-out.
//
//   SHOT_URL=http://localhost:4182/ node scripts/E-church-front.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
const OUT = 'shots/E-church-front';
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1000, height: 700 } });
page.on('pageerror', (e) => console.error('PAGEERR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 20));

let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };

// ── the church front, read out of the scene ──────────────────────────────
//
// Everything narrow and tall standing in front of the nave face. Reported in
// full rather than filtered down to four, so that if the shape of the front
// changes this prints something a reader can argue with instead of quietly
// matching nothing (GOTCHAS 34).
const front = await page.evaluate(() => {
  const s = window.__ct.scene();
  s.updateMatrixWorld(true);
  const boxes = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const e = o.matrixWorld.elements;
    const cx = e[12], cy = e[13], cz = e[14];
    if (cx < 5 || cx > 22 || cz < -95 || cz > -68) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox; if (!bb) return;
    const w = (bb.max.x - bb.min.x) * o.scale.x;
    const h = (bb.max.y - bb.min.y) * o.scale.y;
    const d = (bb.max.z - bb.min.z) * o.scale.z;
    boxes.push({
      cx: +cx.toFixed(2), cy: +cy.toFixed(2), cz: +cz.toFixed(2),
      w: +w.toFixed(2), h: +h.toFixed(2), d: +d.toFixed(2),
      z0: +(cz - d / 2).toFixed(2), z1: +(cz + d / 2).toFixed(2),
    });
  });
  return boxes;
});

// A buttress on this front is TALL, NARROW ALONG THE FACADE, and SHALLOW —
// it is a pier standing proud of a wall. The nave and tower are the same
// height but many metres deep; the copings are wide and flat.
const buttresses = front
  .filter((x) => x.h >= 4 && x.h <= 16 && x.d >= 0.5 && x.d <= 1.6 && x.w <= 1.6)
  .sort((a, b) => a.cz - b.cz);
console.log(`meshes on the church block: ${front.length}; buttress-shaped: ${buttresses.length}`);
for (const x of buttresses) {
  console.log(`   pier at z ${x.cz.toFixed(2)} — ${x.d.toFixed(2)} m along the facade (z ${x.z0}…${x.z1}), ${x.h.toFixed(1)} m tall, standing ${x.w.toFixed(2)} m proud`);
}

// THE PREDICATE. The front is set out on bays: four piers, three bays, every
// opening centred in its bay. So the gaps BETWEEN consecutive piers are the
// bays, and a lancet 1.30 m wide centred in a side bay must clear the pier
// faces. Source says 1.76 m clear in the side bays and 0.23 m each side.
const LANCET_W = 1.30;
const gaps = [];
for (let i = 1; i < buttresses.length; i++) {
  const a = buttresses[i - 1], c = buttresses[i];
  gaps.push({ from: a.z1, to: c.z0, clear: +(c.z0 - a.z1).toFixed(2) });
}
console.log(`bays between consecutive piers: ${gaps.map((g) => g.clear.toFixed(2) + ' m').join(', ')}`);

report('the front has four piers, so it has three bays',
  buttresses.length === 4, `${buttresses.length} buttress-shaped piers found`);

if (gaps.length >= 3) {
  const side = [gaps[0], gaps[gaps.length - 1]];
  const worst = Math.min(...side.map((g) => (g.clear - LANCET_W) / 2));
  report('a 1.30 m lancet centred in each side bay clears the piers',
    worst > 0.05,
    `tightest side bay leaves ${worst.toFixed(2)} m each side (source predicts 0.23)`);
  report('…and the two side bays are the same width, so the front is symmetric',
    Math.abs(side[0].clear - side[1].clear) < 0.02,
    `${side[0].clear.toFixed(2)} m vs ${side[1].clear.toFixed(2)} m`);
}

// ── and LOOK at it, from the pavement, which is where the user was ───────
const shoot = async (k, x, z, yaw, pitch, what) => {
  await page.evaluate(([x, z, yaw, p]) => window.__ct.warp(x, z, yaw, 0.14, p), [x, z, yaw, pitch]);
  await page.waitForTimeout(800);
  const png = await page.screenshot();
  const tones = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const g = document.createElement('canvas'); g.width = 120; g.height = 76;
    const c = g.getContext('2d');
    c.drawImage(img, 0, 0, img.width, Math.floor(img.height * 0.82), 0, 0, 120, 76);
    const d = c.getImageData(0, 0, 120, 76).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4) seen.add(`${d[i] >> 3},${d[i + 1] >> 3},${d[i + 2] >> 3}`);
    return seen.size;
  }, png.toString('base64'));
  // a dead capture and a real frame are told apart before either is graded
  if (tones < 6) { console.log(`  ${k}: DEAD CAPTURE (${tones} tones) — not written`); return false; }
  writeFileSync(`${OUT}/${k}.png`, png);
  console.log(`  ${OUT}/${k}.png  (${tones} tones)  ${what}`);
  return true;
};

console.log('\nthe west front from the pavement:');
await shoot('front-far', 5.4, -79.5, Math.PI / 2, 0.30, 'the whole front — piers and lancets together');
await shoot('front-lancet-n', 5.4, -76.0, Math.PI / 2, 0.42, 'the north side bay and its lancet');
await shoot('front-lancet-s', 5.4, -83.0, Math.PI / 2, 0.42, 'the south side bay and its lancet');

console.log(fails ? `\n${fails} FAILED` : '\nthe piers stand on the bay divisions and the lancets clear them');
await b.close();
process.exit(fails ? 1 : 0);
