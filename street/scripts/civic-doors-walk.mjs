// Climb both civic flights and try the doors.
//
// The user: *"Do NOT leave a flight of steps that leads to nothing."* Both
// flights climb; neither had anything at the top. `ct/int-civic.ts` gives each
// a locked-door response.
//
// A registry read would prove nothing here — the whole failure being fixed is
// a prompt that exists in an array and never reaches a player. So this WALKS,
// per CLAUDE.md: anything involving movement must be verified by actually
// walking it. Four assertions per flight:
//
//   1. from the PAVEMENT at the foot of the steps, the prompt is SILENT.
//      A locked-door message that reads through the building from the street
//      is the diner-prompt-on-the-bank defect wearing a different hat.
//   2. walking up, the prompt APPEARS.
//   3. pressing E changes what it says — the door answers.
//   4. the answer LAPSES, so the prompt is not stuck on the response forever.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

// Foot-of-the-steps and top-of-the-flight for each civic building, taken from
// scripts/steps-walk.mjs, which is the script that owns these two flights.
// Deliberately NOT the door coordinates: those are derived in int-civic.ts and
// a test that recomputed them the same way would agree with a bug.
const FLIGHTS = [
  { nm: 'library', z: -13.5, fromX: -6.0, toX: -11.5, yaw: -Math.PI / 2, want: /LIBRARY/i },
  { nm: 'church', z: -79.5, fromX: 5.0, toX: 9.3, yaw: Math.PI / 2, want: /church/i },
];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4185/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4185/');   // GOTCHAS 26
await p.waitForTimeout(400);

const prompt = () => p.evaluate(() => {
  // the same visibility walk doorsweep.mjs does — the element STAYS in the DOM
  // and is hidden by CSS, so reading textContent alone returns the last prompt
  // that fired and every later sample inherits it. AUDIT-INSTRUMENTS.md:
  // "the instrument that has never been wrong is never wrong for a reason."
  const el = document.getElementById('ct-prompt');
  if (!el) return null;
  for (let n = el; n; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (s.display === 'none' || s.visibility === 'hidden') return null;
  }
  return (el.textContent ?? '').trim() || null;
});

const warp = (x, z, yaw) => p.evaluate(([x, z, yaw]) =>
  window.__ct.warp(x, z, yaw, window.__ct.groundAt(x, z) ?? 0.14, 0), [x, z, yaw]);

const fails = [];
for (const f of FLIGHTS) {
  // 1. silent from the pavement at the foot of the flight
  await warp(f.fromX, f.z, f.yaw);
  await p.waitForTimeout(250);
  const below = await prompt();
  if (below && f.want.test(below)) {
    fails.push(`${f.nm}: the door prompt reads from the PAVEMENT at the foot of the steps — "${below}"`);
  }

  // 2. walk up and it appears. Hold forward rather than teleporting: the point
  //    is that a player who climbs arrives inside the radius.
  await p.keyboard.down('KeyW');
  await p.waitForTimeout(3200);
  await p.keyboard.up('KeyW');
  await p.waitForTimeout(250);
  const top = await prompt();
  const gy = await p.evaluate(() => window.__ct.pos()[3]);
  if (!top || !f.want.test(top)) {
    fails.push(`${f.nm}: climbed to gy ${gy.toFixed(2)} and there is NOTHING at the top — prompt ${JSON.stringify(top)}`);
    continue;
  }
  console.log(`  ${f.nm}: climbed to gy ${gy.toFixed(2)}, prompt "${top}"`);

  // 3. the door answers
  // HOLD it. `[E]` is edge-triggered off a key set sampled once per frame, so
  // a down+up inside one frame is never seen — keyboard.press() passed at the
  // church and failed at the library on nothing but timing luck.
  await p.keyboard.down('KeyE');
  await p.waitForTimeout(140);
  await p.keyboard.up('KeyE');
  await p.waitForTimeout(200);
  const tried = await prompt();
  if (tried === top) {
    fails.push(`${f.nm}: pressing E changed nothing — still "${tried}"`);
  } else {
    console.log(`  ${f.nm}: pressed E -> "${tried}"`);
  }

  // 4. and the answer lapses
  await p.waitForTimeout(2800);
  const after = await prompt();
  if (after !== top) {
    fails.push(`${f.nm}: the response never lapsed — "${after}" (expected back to "${top}")`);
  }
}

console.log(fails.length ? '\nFAILURES:' : '\nboth civic flights lead somewhere: the doors answer');
for (const f of fails) console.log('  FAIL  ' + f);
if (errs.length) console.log('page errors:\n  ' + errs.slice(0, 4).join('\n  '));
await b.close();
process.exit(fails.length || errs.length ? 1 : 0);
