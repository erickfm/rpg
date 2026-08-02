// IS THE BODEGA STILL ENTERABLE with the chamfer as one turned collider?
//
// `scripts/interiors-walk.mjs` flags the turned box under "no static collider
// is parked on the [E] spot". That check does a padded AXIS-ALIGNED overlap on
// min/max and then excuses anything over 4 m on an axis as "structural" — the
// old staircase bands ran to x 18.4 and were excused; the turned box is 2.83 x
// 1.41 in ITS OWN frame and is not. So it is reading a turned box's local
// extents as world extents and calling a wall furniture. GOTCHAS §8 is what
// that check exists for and it is worth answering directly rather than
// arguing, so: walk to the spot and go in.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w24-bodega-door.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4210/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

let bad = 0;
const fail = (m) => { bad++; console.log(`FAIL  ${m}`); };
const ok = (m) => console.log(`ok    ${m}`);
const pos = () => p.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw, gy) => p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const prompt = () => p.evaluate(() => document.querySelector('#prompt')?.textContent ?? document.body.innerText.match(/\[E\][^\n]*/)?.[0] ?? null);

// The spot comes from the world's own registry, not from a number typed here.
const spot = await p.evaluate(() => {
  const s = window.__ct.spots?.() ?? [];
  return s.filter((k) => /BODEGA/i.test(k.label ?? k.name ?? ''))
    .map((k) => ({ x: k.x, z: k.z, r: k.r, label: k.label ?? k.name }));
});
console.log('bodega [E] spots from the world:', JSON.stringify(spot));
if (!spot.length) { console.log('FAIL: no BODEGA spot published'); await b.close(); process.exit(1); }
const S = spot[0];

// 1. can you STAND on it — i.e. is a collider parked there, really?
await warp(S.x, S.z, 0, 0.15);
await p.waitForTimeout(160);
const [px, , pz] = await pos();
const shoved = Math.hypot(px - S.x, pz - S.z);
console.log(`   warped to the spot (${S.x.toFixed(2)}, ${S.z.toFixed(2)}), settled ${shoved.toFixed(4)} m away`);
if (shoved < 0.01) ok('nothing is parked on the [E] spot — you stand on it undisturbed');
else fail(`pushed ${shoved.toFixed(3)} m off the [E] spot: something IS parked there`);

// 2. …and can you walk onto it from the pavement, facing the door?
// The door faces south-west out of the chamfer, so approach from the kerb.
await warp(S.x - 1.6, S.z - 1.6, Math.PI * 0.25 + Math.PI * 0.5, 0.15);
await p.waitForTimeout(200);
const before = await pos();
await p.keyboard.down('w'); await p.waitForTimeout(700); await p.keyboard.up('w');
await p.waitForTimeout(200);
const after = await pos();
console.log(`   walked from ${before.slice(0, 3).map((v) => v.toFixed(2))} to ${after.slice(0, 3).map((v) => v.toFixed(2))}`);
const reached = Math.hypot(after[0] - S.x, after[2] - S.z);
console.log(`   ended ${reached.toFixed(3)} m from the spot centre (its radius is ${S.r})`);
if (reached < S.r) ok('walked from the pavement onto the [E] spot');
else fail(`could not walk onto the spot — stopped ${reached.toFixed(2)} m away`);

// 3. is the prompt up, and does a HELD E actually put you inside?
await warp(S.x, S.z, Math.PI * 1.25, 0.15);   // face the door: into the chamfer
await p.waitForTimeout(250);
const pr = await prompt();
console.log(`   prompt: ${JSON.stringify(pr)}`);
if (pr && /BODEGA/i.test(pr)) ok('the [E] prompt is up standing on the spot'); else fail('no BODEGA prompt on the spot');
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
await p.waitForTimeout(700);
const inside = await pos();
console.log(`   after E: ${inside.slice(0, 3).map((v) => v.toFixed(2))}`);
// the interior belt starts at x = 400
if (inside[0] >= 400) ok('E put you inside the bodega'); else fail('E did not put you inside');

console.log('\nconsole errors:', errs.length ? errs : 'none');
console.log(bad === 0 ? 'ALL CHECKS PASS' : `${bad} CHECK(S) FAILED`);
await b.close();
process.exit(bad === 0 ? 0 : 1);
