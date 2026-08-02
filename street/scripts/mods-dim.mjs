// Does everything in MY modules actually get darker when the sun goes down?
//
// `midnight.mjs` asks a different question and asks it well: *is anything
// bright at 23:00 with no record of why*, scoped to `mod=street`, threshold on
// absolute brightness. This asks whether a thing MOVED, per material, against
// its own daylight value — and that is the question the bunting failed.
//
// The bunting sat at full daylight brightness in a black yard for weeks. It
// passed every check anyone ran, including my own sweep of the lot at 23:00
// two rounds ago, because:
//
//   · it is not bright in ABSOLUTE terms in a way that stood out from neon
//   · props.ts stamped it `selfLit`, which every sweep including mine reads as
//     "deliberate, skip it" — and it WAS deliberate, just wrong
//   · every screenshot of it ever taken was in daylight
//
// A delta test has none of those blind spots. It does not care how bright a
// thing is, only whether the world's night affected it, and it compares each
// material against ITSELF — which is the only comparison that survives
// `MeshBasicMaterial.color` being a tint (GOTCHAS: a colour is not appearance;
// a delta of a colour against its own earlier value is sound).
//
// ── why `selfLit` cannot be trusted to excuse things here ──
//
// props.ts decides self-lit for itself, from the TEXTURE, with a heuristic that
// is right about neon and was wrong about plastic flags. So this reports the
// stamped ones separately rather than skipping them: a `selfLit` sheet that
// does not dim is expected, and a `selfLit` sheet is also exactly what a
// mis-classified prop looks like. The list is short enough to read.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/mods-dim.mjs [mod...]
//        --selftest   force a material to hold its daylight value
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { installMats } from './lib/materials.mjs';
import { flags } from './lib/args.mjs';

const { selftest: SELFTEST, rest } = flags(['--selftest']);
// Both of my modules by default; the walk-up contributes only its OUTDOOR
// faces, since everything inside it is excluded above.
const MODS = rest.length ? rest : ['lot', 'walkup'];
const URL = aim('http://localhost:4177/');
// The bar is deliberately low. Anything the night touches at all falls by tens
// of per cent; the bunting fell 1.3%. 20% separates "graded" from "not graded"
// with a wide margin either side, and does not pretend to judge how much a
// thing should dim, which depends on its elevation and is props.ts's business.
const MOVED = 0.20;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
await installMats(page);

// STEP through the evening rather than jumping to it: the wall-splash sheets
// only light if the clock passes 20:00, and a jumped clock is a world that has
// never had weather. A dry hour, so the wet tint is not doing the work.
const hours = await page.evaluate(() => {
  const rainAt = window.__ct.scene().userData.rainAt;
  for (let h = 48; h < 24 * 6000; h++)
    if (h % 24 === 21 && !rainAt(h) && !rainAt(h - 1) && !rainAt(h - 2)) return { night: h, day: h - 8 };
  return null;
});
if (!hours) { console.error('\nNO DRY EVENING FOUND — cannot separate night from rain.'); process.exit(3); }

const read = async (h, steps) => await page.evaluate(async ([hh, st, mods]) => {
  for (const s of st) { window.__ct.clock(s, 0); await new Promise((r) => setTimeout(r, 1100)); }
  window.__ct.clock(hh, 30);
  window.__ct.warp(16, 2.6, Math.PI / 2, 0.14, 0);
  await new Promise((r) => setTimeout(r, 4000));
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = [];
  s.traverse((o) => {
    if (!o.isMesh) return;
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    if (!mods.includes(mod)) return;
    const e = o.matrixWorld.elements;
    // INTERIORS KEEP THEIR OWN LIGHT, and that is the rule rather than an
    // exception: props.ts's dimWorld opens with `if (Math.abs(o.position.x) >
    // 100) return; // interiors keep their own light`, and interiors-walk
    // asserts it from the other side — "0/155 interior materials dimmed by the
    // night sweep". A room lit by its own ceiling lamp should not follow the
    // sun.
    //
    // My first run reported 675 failures in the walk-up for exactly this,
    // which is the check being wrong about scope rather than the world being
    // wrong. Using props.ts's own boundary means the two cannot disagree.
    if (Math.abs(e[12]) > 100) return;
    const g = o.geometry?.parameters;
    for (const m of window.__mats(o)) {
      if (!m?.color) continue;
      out.push({ uuid: m.uuid, mod,
        v: (m.color.r + m.color.g + m.color.b) / 3,
        selfLit: !!m.userData.selfLit, cLight: !!m.userData.cLight, wet: !!m.userData.wet,
        known: m.userData.cKnownUngraded ?? null,
        at: `${e[12].toFixed(1)},${e[13].toFixed(1)},${e[14].toFixed(1)}`,
        size: g ? `${(g.width ?? 0).toFixed(2)}x${(g.height ?? 0).toFixed(2)}` : '?' });
    }
  });
  return out;
}, [h, steps, MODS]);

const day = await read(hours.day, []);
if (SELFTEST) {
  await page.evaluate(([mods]) => {
    const s = window.__ct.scene();
    s.traverse((o) => {
      if (!o.isMesh || o.userData.__pinned) return;
      let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
      if (!mods.includes(mod)) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      // Pin by disabling the MUTATORS. Replacing the property with a getter
      // returning a clone does not work: dimWorld writes through
      // `color.copy(...)`, which mutates the object the getter hands back, so
      // the "pinned" material dimmed anyway and the selftest reported that it
      // had not been caught. It had not been pinned.
      for (const m of ms) if (m?.color) {
        const c = m.color;
        c.copy = () => c; c.set = () => c; c.setRGB = () => c;
        c.multiplyScalar = () => c; c.lerp = () => c; c.setHex = () => c;
        o.userData.__pinned = 1; return;
      }
    });
  }, [MODS]);
  console.log('selftest: pinned a material to its daylight colour — this MUST go red');
}
const night = await read(hours.night, [hours.night - 6, hours.night - 4, hours.night - 2, hours.night - 1]);

await browser.close();
const dm = new Map(day.map((d) => [d.uuid, d]));
const rows = [];
for (const n of night) {
  const d = dm.get(n.uuid);
  if (!d || d.v < 0.02) continue;                 // already black by day: nothing to move
  rows.push({ ...n, day: d.v, drop: (d.v - n.v) / d.v });
}
if (!rows.length) {
  console.error(`\nNO MATERIALS FOUND IN ${MODS.join(', ')} — nothing was compared, so this is not a pass.`);
  process.exit(3);
}

// THE EXCUSE IS `cLight`, NOT `selfLit`. props.ts sets selfLit from a texture
// heuristic, so a mis-classified prop is stamped selfLit — which means
// excusing selfLit makes this blind to the exact bug it was written for. Run
// against the pre-fix bunting it reported "0 hold and do not" while 76 flags
// sat at full daylight. `cLight` is set by hand, in my module, on the two
// materials that really are lights.
// ── POSITIVE CONTROL: did the night actually happen? ──────────────────────
//
// 27b18b6ea found a night sweep whose 500 ms sleep meant that under load the
// "night" sample WAS the noon sample — and because "nothing dimmed" was that
// check's expected answer, it reported success having never turned the lights
// off. GOTCHAS 30, failing in the direction that hides the bug.
//
// This one fails the other way: if the clock never advanced, every material
// looks stuck and it goes RED. Loud, but for the wrong reason — a reader would
// be handed hundreds of false findings and no clue that the instrument, not the
// world, was broken.
//
// So prove the night happened before judging anything by it. The deck is
// wet-registered ground and falls ~95% between noon and a dry 21:30; if the
// biggest drop anywhere is under 50%, no grading occurred and the honest answer
// is exit 3, the check never ran, rather than a page of accusations.
const best = rows.reduce((a, r) => Math.max(a, r.drop), 0);
if (best < 0.50) {
  console.error(`\nTHE NIGHT NEVER HAPPENED — the largest drop anywhere is ${(best * 100).toFixed(1)}%.`);
  console.error(`  Something in the lot should fall ~95% between ${hours.day % 24}:30 and ${hours.night % 24}:30.`);
  console.error(`  The clock did not advance, or the grade had not applied when this read.`);
  console.error(`  Nothing follows about whether anything dims. GOTCHAS 32.\n`);
  process.exit(3);
}
// WATCHED FIRING, because bd85cd1f3's first positive control was wrong and
// only caught itself: it compared a MEDIAN over all sheets against a threshold
// calibrated from one specific PAIR. Two different quantities, and the error
// was committed inside the control written to catch a different error.
//
// Mine is the same shape as their corrected one — best-darkening thing must
// drop at least half — so it needed the same proof rather than the same
// assumption. Mutated the night read to happen at the DAY hour, so the clock
// never advances:
//
//   THE NIGHT NEVER HAPPENED — the largest drop anywhere is 0.0%     exit 3
//
// and on a good run 99.1% against the 50% floor, with the guarded finding
// unchanged at 56 either way, which says the control does not distort what it
// guards.
console.log(`  positive control: the largest drop is ${(best * 100).toFixed(1)}% — the night happened`);

const stuck = rows.filter((r) => r.drop < MOVED && !r.cLight && !r.known);
const litStuck = rows.filter((r) => r.drop < MOVED && r.cLight);
// KNOWN AND BLOCKED, carrying the name of what blocks them. Excusing these is
// what lets this check run at all: it was red on the banners alone, so it sat
// unregistered and guarded NOTHING — including the bunting-shaped regression it
// exists to catch. An exemption that names its blocker expires when the blocker
// does; one that does not becomes permanent by silence.
const known = rows.filter((r) => r.drop < MOVED && r.known);
console.log(`\n  ${rows.length} materials across ${MODS.join(', ')}, ${hours.day % 24}:30 dry -> ${hours.night % 24}:30 dry`);
console.log(`  ${rows.length - stuck.length - litStuck.length} dim, ${litStuck.length} hold and say so (selfLit), ${stuck.length} hold and do not`);
if (litStuck.length) {
  console.log(`\n  declared lights, holding their brightness on purpose:`);
  const by = {};
  for (const r of litStuck) { const k = `${r.mod} ${r.size}`; by[k] = (by[k] ?? 0) + 1; }
  for (const [k, n] of Object.entries(by).sort((a, c) => c[1] - a[1]).slice(0, 8)) console.log(`     ${String(n).padStart(3)} x  ${k}`);
}
if (stuck.length) {
  console.error(`\n${stuck.length} MATERIALS DO NOT DIM AND NOTHING SAYS WHY:`);
  for (const r of stuck.slice(0, 10))
    console.error(`   ${r.mod}  ${r.size}  at ${r.at}   ${r.day.toFixed(3)} -> ${(r.day * (1 - r.drop)).toFixed(3)}  (${(r.drop * 100).toFixed(1)}%)`);
  if (stuck.length > 10) console.error(`   ...and ${stuck.length - 10} more`);
  if (SELFTEST) { console.log('SELFTEST PASSED — the pinned material was caught'); process.exit(0); }
  process.exit(1);
}
if (SELFTEST) { console.error('\nSELFTEST FAILED — a material was pinned to daylight and this did not notice.'); process.exit(2); }
console.log('\neverything that should dim, dims.');
