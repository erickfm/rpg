// Item 197 — CAN A PROBE NOW LIST WHAT THE CROWD AVOIDS?
//
// That is the item's whole DONE WHEN, and the second half of it is the point:
// *"195 can assert that a named prop is in the list rather than watching for a
// clip."* So this does not just print the new accessor — it asks item 195's
// actual question and answers it by assertion.
//
// The two bugs underneath were previously indistinguishable from outside:
//
//   · the crate IS offered to the crowd and the steering is too weak   -> 173
//   · the crate was NEVER offered to the crowd at all                  -> 195
//
// A watcher sees one pedestrian walking through one crate and cannot tell
// which. `__ct.citAvoid()` can.
//
// Usage: SHOT_URL=http://localhost:4240/ node scripts/probes/w68-citavoid.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4240/');
const fails = [], notes = [];
const ok = (c, m) => { (c ? notes : fails).push(`${c ? 'PASS' : 'FAIL'}  ${m}`); return c; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await waitPainted(p);
await p.waitForTimeout(600);

// ── 1. it exists, it serialises, and it is not the live array ─────────────
const shape = await p.evaluate(() => {
  if (typeof window.__ct.citAvoid !== 'function') return { missing: true };
  const a = window.__ct.citAvoid();
  const first = a[0] ? Object.keys(a[0]).sort() : [];
  // MUTATION: push onto what we were handed, and onto one of its boxes, then
  // ask again. If either survives, the accessor handed out the world.
  a.push({ minX: -999, maxX: -998, minZ: -999, maxZ: -998 });
  if (a[0]) a[0].minX = -12345;
  const again = window.__ct.citAvoid();
  return {
    missing: false, n: again.length, keys: first,
    lengthLeaked: again.length !== a.length - 1,
    valueLeaked: again[0] ? again[0].minX === -12345 : false,
    actors: again.filter((c) => c.actor).length,
    statics: again.filter((c) => !c.actor).length,
  };
});
console.log('citAvoid():', JSON.stringify(shape));
if (!ok(!shape.missing, '__ct.citAvoid() exists')) {
  console.log('nothing else can be measured'); await b.close(); process.exit(1);
}
ok(shape.n > 0, `FLOOR: the crowd avoids a non-empty list (${shape.n} boxes) — an empty list would make every question below vacuous`);
ok(shape.keys.includes('minX') && shape.keys.includes('maxZ') && shape.keys.includes('actor'),
  `entries carry extents plus the actor flag (${shape.keys.join(',')})`);
ok(!shape.lengthLeaked, 'pushing onto the returned array does NOT reach the world');
ok(!shape.valueLeaked, 'mutating a returned box does NOT reach the world');
ok(shape.statics > 0 && shape.actors > 0,
  `the actor flag separates the two populations (${shape.statics} static, ${shape.actors} actors) — computed by identity inside the world, which is the only place it can be`);

// ── 2. ITEM 195'S QUESTION, asked by assertion ────────────────────────────
// The user: *"pedestrians sometimes clip into the fruit in the sidewalk
// outside the bodega."* The fruit is found by its OWN registration, never by a
// coordinate typed here — `staticColliders()` is the player's list, so anything
// in it that is NOT in citAvoid is a prop the crowd was never told about.
const gap = await p.evaluate(() => {
  const key = (c) => [c.minX, c.maxX, c.minZ, c.maxZ].map((v) => v.toFixed(3)).join('|');
  const avoid = new Set(window.__ct.citAvoid().filter((c) => !c.actor).map(key));
  const stat = window.__ct.staticColliders();
  const missing = stat.filter((c) => !avoid.has(key(c)));
  // the bodega's frontage is around x 5-9, z -94..-96 on the street
  const nearBodega = missing.filter((c) => c.maxX > 2 && c.minX < 12 && c.maxZ > -100 && c.minZ < -90);
  return {
    staticTotal: stat.length, avoidTotal: avoid.size, missing: missing.length,
    nearBodega: nearBodega.length,
    sample: nearBodega.slice(0, 8).map((c) => ({
      w: +(c.maxX - c.minX).toFixed(2), d: +(c.maxZ - c.minZ).toFixed(2),
      x: +((c.minX + c.maxX) / 2).toFixed(2), z: +((c.minZ + c.maxZ) / 2).toFixed(2),
    })),
  };
});
console.log('\n=== ITEM 195, ASKED RATHER THAN WATCHED');
console.log(`  static colliders the PLAYER is stopped by:      ${gap.staticTotal}`);
console.log(`  static boxes the CROWD is told to steer around: ${gap.avoidTotal}`);
console.log(`  in the player's list but NOT the crowd's:       ${gap.missing}`);
console.log(`  ...of those, on the bodega's stretch of street: ${gap.nearBodega}`);
for (const s of gap.sample) console.log(`      ${s.w} x ${s.d} at (${s.x}, ${s.z})`);

// This is a CAPABILITY check, not a verdict on 195. The question being
// answerable is what item 197 owes; whether the answer is 0 is item 195's to
// change. Asserting `missing === 0` here would make this probe fail on a bug
// it does not own and go green the moment somebody else fixes it.
ok(typeof gap.missing === 'number',
  `195 is now ASSERTABLE: the player-vs-crowd gap is a number (${gap.missing} boxes), not a thing you watch for`);
if (gap.missing > 0) {
  console.log(`\n  >> ${gap.missing} props stop the player and are invisible to pedestrians.`);
  console.log('     That is item 195, now measured rather than witnessed. Not this item\'s to fix.');
}

console.log('');
for (const n of notes) console.log('  ', n);
for (const f of fails) console.log('  ', f);
console.log(`\nconsole errors: ${errs.length}`);
console.log(fails.length === 0 ? `CITAVOID OK — ${notes.length} assertions` : `CITAVOID BAD — ${fails.length} failed`);
await b.close();
process.exit(fails.length === 0 ? 0 : 1);
