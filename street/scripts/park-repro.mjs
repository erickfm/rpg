// Audit finding D, "parking varies but never re-rolls" — the second half.
//
// `scripts/parking.mjs` already guards the FIRST half: that the draw produces a
// varied row, that perfect parking still happens, that the guards bound it. It
// does not check the second, and the second is not cosmetic — it is the
// foundation the whole verification culture stands on:
//
//   The parked arrangement comes off the seeded `rnd()` stream, so it is the
//   SAME on every load. That is what makes `npm run fp before` and `fpdiff`
//   mean anything. If parking re-rolled per load, every fingerprint taken
//   downstream of the parking draw would differ for reasons that have nothing
//   to do with the change under test, and the project's main tool for proving
//   "this did not move the world" would quietly become noise.
//
// So "never re-rolls" is the feature, not the defect. This is the check that
// says so, and that would catch it being lost — which is the real risk, since
// it would be lost silently.
//
//   SHOT_URL=http://localhost:4187/ node scripts/park-repro.mjs
//
// Exit 1 = FAIL. Exit 2 = INCONCLUSIVE (nothing found to measure) — never a pass.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const browser = await chromium.launch();

// Every car in the world, identified by what it carries itself rather than by
// where it is — position is the thing under test, so it cannot also be the
// identity. Sampled twice, 1.3 s apart, so anything that MOVED can be dropped:
// the traffic pool is built from the same makeCar groups and idles at z 999
// until a pass starts.
const arrangement = async (page) => {
  await page.waitForFunction(() => window.__ct?.carVariant !== undefined, { timeout: 15000 });
  const shot = () => page.evaluate(() => {
    // Reach the scene the honest way: through an object the world hands back.
    const probe = window.__ct.carVariant('sedan', {}, 0, 0, 0);
    const scene = probe.parent;
    scene.remove(probe);
    const out = [];
    const walk = (o) => {
      if (o.userData?.body && o.userData?.wheelbase !== undefined && !o.userData.probe) {
        out.push({
          id: `${o.userData.body}|${(+o.userData.wheelbase).toFixed(3)}`,
          x: +o.position.x.toFixed(5),
          y: +o.position.y.toFixed(5),
          z: +o.position.z.toFixed(5),
          ry: +o.rotation.y.toFixed(5),
        });
      }
      (o.children || []).forEach(walk);
    };
    walk(scene);
    return out;
  });
  const a = await shot();
  await page.waitForTimeout(1300);
  const b = await shot();
  // stationary = same place 1.3 s later. Matched by index within an id group,
  // because several cars can share a colour and a wheelbase.
  const stat = [];
  for (const c of a) {
    if (Math.abs(c.z) > 900) continue;                       // stowed traffic
    const hit = b.find((d) => d.id === c.id && d.x === c.x && d.z === c.z && d.ry === c.ry);
    if (hit) stat.push(c);
  }
  return stat;
};

const line = (c) => `${c.id}|${c.x}|${c.y}|${c.z}|${c.ry}`;

const p1 = await browser.newPage({ viewport: { width: 900, height: 600 } });
await p1.goto(URL, { waitUntil: 'networkidle' });
await reportWorld(p1, URL);
const A = await arrangement(p1);
await p1.close();

// A GENUINELY SEPARATE LOAD — a fresh browser context, not a reload — so
// nothing survives in module scope that could make the second answer agree
// with the first for the wrong reason.
const ctx2 = await browser.newContext({ viewport: { width: 900, height: 600 } });
const p2 = await ctx2.newPage();
await p2.goto(URL, { waitUntil: 'networkidle' });
const B = await arrangement(p2);
await ctx2.close();

if (A.length < 3 || B.length < 3) {
  console.error(`INCONCLUSIVE — found ${A.length} and ${B.length} stationary cars across the two loads. ` +
    'Too few to compare, so this is not a pass. Is __ct.carVariant present and does makeCar still stamp userData.body?');
  await browser.close();
  process.exit(2);
}

console.log(`parking reproducibility — ${A.length} stationary cars, two independent loads:`);
const fails = [];

if (A.length !== B.length) {
  fails.push(`load 1 placed ${A.length} cars, load 2 placed ${B.length}`);
} else {
  const sa = A.map(line).sort(), sb = B.map(line).sort();
  const diff = sa.map((s, i) => [s, sb[i]]).filter(([s, t]) => s !== t);
  if (diff.length) {
    fails.push(`${diff.length} of ${A.length} cars are somewhere else on the second load — ` +
      'parking must be reproducible or every fingerprint in this project is measuring noise');
    for (const [s, t] of diff.slice(0, 5)) console.error(`       load 1  ${s}\n       load 2  ${t}`);
  } else {
    console.log(`  OK   byte-identical across two independent loads — all ${A.length} cars, to 5 decimals`);
  }
}

for (const c of A) if (Math.abs(c.y) > 0.001) fails.push(`a car sits off the ground at y ${c.y}`);
if (!fails.length) console.log('  OK   every car is on the ground');

if (fails.length) {
  console.error(`\n${fails.length} FAIL:`);
  for (const f of fails) console.error(`  FAIL  ${f}`);
  await browser.close();
  process.exit(1);
}
console.log('\nparking is reproducible — "never re-rolls" is the feature. See notes/H-parking-verdict.md');
await browser.close();
