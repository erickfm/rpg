// THE FOUR THINGS THE USER RULED ON ARE STILL TRUE.
//
// Named for the claim it makes, not for its subject (GOTCHAS §24) — "crates",
// "atm" and "cat" are all subjects with several scripts each already.
//
// ── why a check, rather than a note ──
//
// Every value below is a RULING: the user looked, said what was wrong, and in
// two cases said it more than once. A ruling that silently reverts is not a
// hypothetical here — I shipped the ATM fascia bottom at 0.68 against a stated
// 0.75, on my own reading that the *target* in the same sentence ("0.9–1.0 m of
// fascia") was what the number was reaching for. It took the user restating
// 0.75 a third time to settle it. Nothing in the suite would have noticed.
//
// So this is deliberately a check on VALUES rather than on shapes. If a future
// note legitimately changes one, this goes red and somebody updates it on
// purpose — which is the point. A ruling should not be able to move quietly.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/D-rulings-hold.mjs [--selftest]
//
// Run it against the world the user actually plays, which is not your preview:
//
//   SHOT_URL=http://localhost:5177/ SHOT_WORLD=integration node scripts/D-rulings-hold.mjs
//
// That opt-in is B's find (notes/B-routed-to-others.md), and it matters: I had
// verified all four in my own tree and none of them at 5177, which is the only
// world the user's screenshots come from.
//
// AND AGAINST THE ARTIFACT, which is a third world again — the bundle plus an
// inliner, opened from `file://`, and the thing the user actually publishes:
//
//   SHOT_URL=file://$PWD/dist/artifact.html node scripts/D-rulings-hold.mjs
//
// No special mode: `page.goto` takes a file URL and `reportWorld` reads the same
// build stamp out of the HUD, so it prints `build 3238fe7a8` and verifies it
// like any server. Worth running after anything that moves modules around —
// GOTCHAS §28 is the entry, and the fault it describes is REAL IN THE BUNDLE and
// absent in dev, which is the worst way round because the bundle is what ships
// to the artifact and to Pages. I split `ct/street.ts` into four modules this
// session; all four rulings hold in the packed artifact, checked.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld, integrationNoise } from './lib/which-world.mjs';

for (const a of process.argv.slice(2)) {
  if (a !== '--selftest') {
    console.error(`unknown argument ${JSON.stringify(a)} — this script takes --selftest and nothing else`);
    process.exit(2);
  }
}
const SELFTEST = process.argv.includes('--selftest');
const URL = aim('http://localhost:4181/');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => { if (!integrationNoise(e.message)) errs.push(String(e.message)); });
// A SERVER THAT IS NOT THERE IS NOT A BROKEN RULING. Left to itself, the throw
// from `goto` reaches node as an uncaught exception and exits 1 — the same code
// as "the rulings are broken", which is the ambiguity GOTCHAS §32 exists to
// close. 3 is "aborted, nothing measured", and that is what this is.
try {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
} catch (e) {
  console.error(`\nABORTED — could not reach a world at ${URL}`);
  console.error(`  ${String(e.message).split('\n')[0]}`);
  console.error('  Nothing was measured, so nothing follows about the rulings (GOTCHAS §32).');
  await browser.close();
  process.exit(3);
}
await reportWorld(page, URL);        // GOTCHAS §26, and exit 3 if it is not this build

const w = await page.evaluate(() => {
  const sc = window.__ct.scene();
  const out = { crates: [], awn: null, cat: null, atm: [], litter: [] };
  sc.traverse((o) => {
    // THE TAG IS ON THE GROUP, not on its meshes. ct/props.ts builds each piece
    // with drop() as a Group and sets `userData.litter` on that group, so the
    // piece is ONE object with several children. Reading it at mesh level and
    // de-duplicating by position gave 15 "pieces" for 7, because the children
    // sit at their own offsets. Read it where it is published.
    const lit = o.userData.litter;
    if (lit) {
      o.updateWorldMatrix(true, false);
      const g = o.position.clone().setFromMatrixPosition(o.matrixWorld);
      if (g.x > -13.6 && g.x < -7 && g.z > -43.5 && g.z < -37) {
        out.litter.push({ name: String(lit), x: +g.x.toFixed(3), z: +g.z.toFixed(3) });
      }
    }
    if (!o.isMesh) return;
    o.updateWorldMatrix(true, false);
    const q = o.position.clone().setFromMatrixPosition(o.matrixWorld);
    const P = o.geometry.parameters ?? {};
    if (P.width === 0.62 && P.height === 0.4 && P.depth === 0.55) {
      out.crates.push({ x: +q.x.toFixed(3), z: +q.z.toFixed(3) });
    }
    if (P.height === 0.1 && P.depth === 0.9 && Math.abs(o.rotation.x) > 0.01) {
      out.awn = { rotX: +o.rotation.x.toFixed(3) };
    }
    if (P.width && Math.abs(P.width - 20 / 34) < 1e-6 && Math.abs(P.height - 28 / 34) < 1e-6) {
      out.cat = { x: +q.x.toFixed(3), z: +q.z.toFixed(3) };
    }
    if (q.x < -6.8 && q.x > -7.4 && q.z > 6.5 && q.z < 8.1) {
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox.clone(); bb.applyMatrix4(o.matrixWorld);
      out.atm.push({ y0: +bb.min.y.toFixed(3), y1: +bb.max.y.toFixed(3) });
    }
  });
  return out;
});

let fails = 0;
const say = (ok, what, detail) => {
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `: ${detail}` : ''}`);
};

// ── POPULATION FIRST (GOTCHAS §34) ────────────────────────────────────────
//
// Every verdict below is about the VALUE of something, so every one of them is
// free if the thing is not found. The floors are measured, not remembered:
// two crates, one awning, one cat, and the ATM's three machine panels inside a
// niche of five pieces. `footprint.mjs` failed its own unmutated street once
// because its author wrote a floor from memory.
const KERB = 0.14;
const machine = w.atm.filter((a) => a.y0 > 0.8 && a.y1 < 1.79);
console.log('\npopulation — every verdict below passes for free at zero');
say(w.crates.length === 2, 'both produce crates are in the world', `${w.crates.length}`);
say(w.awn !== null, 'the bodega awning is in the world');
say(w.cat !== null, 'the alley cat is in the world');
say(machine.length >= 3, "the ATM's machine panels are in the world", `${machine.length} of the ${w.atm.length} parts at the niche`);
// The litter the cat is placed RELATIVE TO. Read from the world, never quoted:
// this check used to hard-code (-10.60, -41.45) and (-9.40, -42.40), which are
// `ct/props.ts`'s numbers — B's file. A hard-coded quotation of somebody else's
// source is the one thing a refactor breaks silently and a bug never does, and I
// had already written two guards against that class before committing this
// instance. MEASURED floor: FIVE pieces lie in the alley — two milk crates, two
// flattened cardboards and a folded newspaper, which is exactly the five drop()
// calls ct/props.ts makes there. Not the 7 I first wrote from memory, and not
// the 21 that counting meshes gave, and not the 15 that de-duplicating meshes
// by position gave. Three wrong counts for one population, each of which would
// have set a floor that could never bite. Superseded note: 6 flat decals once the cat's own
// contact shadow is excluded — see the collection above for why that stopped
// mattering once the published name replaced the shape heuristic.
say(w.litter.length >= 4, 'the alley litter is in the world', `${w.litter.length} pieces: ${[...new Set(w.litter.map((L) => L.name))].join(', ')}`);

if (fails) {
  console.log(`\n${fails} of the four objects this check exists for are MISSING.`);
  console.log('Nothing below was measured. See GOTCHAS §32: exit 3 is "no measurement",');
  console.log('which is not the same as the rulings having been broken.');
  await browser.close();
  process.exit(3);
}

console.log('\nthe rulings');
// 1. "align these crates so they fit better against this wall"
const cz = [...new Set(w.crates.map((c) => c.z))];
const stagger = Math.max(...cz) - Math.min(...cz);
say(stagger === 0, 'the two crates stand on ONE z — no stagger', `${stagger.toFixed(3)} m`);
// backs 15 mm clear of the wing's proud face at -96.12; more is a gap, less is inside it
const back = Math.min(...cz) + 0.275;
say(back < -96.12 && back > -96.16, 'their backs are flush to the wing plinth, not inside it',
  `back ${back.toFixed(3)} against the proud face -96.12`);

// 2. "bodega sign is tilted up ... should be tilted a bit down"
say(w.awn.rotX > 0, 'the awning slopes DOWN and away from the face', `rotation.x ${w.awn.rotX}`);

// 3. "put the cat on the right side of the paper trash" — the SIXTH note on it.
//
// Guarded as a POSITION rather than as an inequality on one axis, and that is
// the correction the sixth note forced. The old assertion was `cat.z < -41.725`
// — "right of the paper" expressed along the mouth view's axis. It PASSED on the
// position the user then rejected, because right-of-in-one-frame is not
// right-of-in-another, and an inequality on a single axis cannot tell them
// apart. A check that agrees with a rejected position is measuring the author's
// reasoning, not the world (GOTCHAS §27).
//
// So: the cat must sit in the open floor BETWEEN the two paper decals — right of
// the printed one at (-10.60, -41.45) and clear of the cardboard at
// (-9.40, -42.40) — which is a claim about where it is, not about a sign.
//
// AND "RIGHT OF" IS EXPRESSED IN THE FRAME IT WAS ASKED IN. The sixth note came
// because I had taken "right" from the alley mouth's axis: an offset is only
// right in the frame it was computed for, and nothing in a coordinate records
// which frame that was. So the frame is recorded here — the viewpoint of
// `shots/user-catsix.png`, which `shots/D-catsix-after.png` reproduces — and the
// right-axis is derived from it rather than assumed.
const VIEW = { x: -8.5, z: -39.5, yaw: -0.785 };          // the user's own frame
const fwd = { x: Math.sin(VIEW.yaw), z: -Math.cos(VIEW.yaw) };
const rightOf = (o) => (o.x - VIEW.x) * -fwd.z + (o.z - VIEW.z) * fwd.x;   // cross(fwd, up)
const catR = rightOf(w.cat);
const nearest = w.litter
  .map((L) => ({ L, d: Math.hypot(L.x - w.cat.x, L.z - w.cat.z), r: rightOf(L) }))
  .sort((a, b) => a.d - b.d);
const toTheLeft = nearest.filter((n) => n.r < catR);
say(nearest[0].d > 0.5, 'the cat is not standing on any piece of litter',
  `nearest is the ${nearest[0].L.name} at ${nearest[0].d.toFixed(2)} m`);
say(toTheLeft.length > 0, 'there IS paper to the cat\'s left in the user\'s frame — it is on the right of it',
  `${toTheLeft.length} of ${w.litter.length} decals sit left of the cat`);
const dPaper = nearest[0].d;
say(w.cat.z > -43.1, 'and not pushed back into the south wall', `${(w.cat.z + 43.5).toFixed(2)} m of floor behind it`);

// 4. "extend the fascia DOWNWARD to 0.75m" — said three times
const lo = Math.min(...machine.map((a) => a.y0)) - KERB;
const hi = Math.max(...machine.map((a) => a.y1)) - KERB;
say(Math.abs(lo - 0.75) < 0.005, 'the ATM fascia bottom is at 0.75 above the pavement', `${lo.toFixed(3)} m`);
say(Math.abs(hi - 1.58) < 0.005, 'and the screen top has NOT moved with it', `${hi.toFixed(3)} m`);

say(errs.length === 0, 'no page errors', errs.join(' · ') || 'none');

if (SELFTEST) {
  // Invert one verdict per ruling, so a change to any single one is caught.
  // Not all eight: the point is that each RULING is watched, and inverting the
  // population floors as well would test a different claim (GOTCHAS §34's
  // "shape two"), which the block above already exits 3 for.
  console.log('\nselftest — asserting the defects, which must FAIL');
  const before = fails;
  say(stagger !== 0, 'the crates are staggered again (the bug)', `${stagger.toFixed(3)} m`);
  say(w.awn.rotX < 0, 'the awning is tilted UP at the sky again (the bug)', `${w.awn.rotX}`);
  say(dPaper <= 0.5, 'the cat is back on a piece of litter (the bug)', `${dPaper.toFixed(2)} m`);
  say(Math.abs(lo - 0.75) > 0.005, 'the fascia bottom has drifted off 0.75 (the bug)', `${lo.toFixed(3)}`);
  const caught = fails - before;
  console.log(caught === 4
    ? '\nSELFTEST PASSED — all four inverted rulings were caught'
    : `\nSELFTEST FAILED — only ${caught} of 4 caught, so this measures less than it claims`);
  await browser.close();
  process.exit(caught === 4 ? 0 : 1);
}

await browser.close();
console.log(fails ? `\n${fails} FAILURES` : "\nall four of the user's rulings still hold");
process.exit(fails ? 1 : 0);
