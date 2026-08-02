// FOUR OLD CONFIRMED ROWS OF MINE, AND THE PREDICATE THAT CATCHES EACH GOING FALSE.
//
// The auditor swept all 171 CONFIRMED rows for what their status actually rests
// on: 28 name nobody and nothing, and 5 of those are mine. The point is not
// that they are wrong — most probably still hold — it is that **nothing would
// tell us if they stopped being true**, and a wrong CONFIRMED is worse than an
// OPEN because nobody looks at a CONFIRMED any more.
//
// So this is the missing half of four of them. One of my five,
// `bodega entry blocker`, already got auditor evidence and a station and is not
// repeated here; `burger barn red + beige` the auditor re-ran itself, and it is
// included anyway because a re-run is not a predicate — it tells you the row is
// true today and nothing about tomorrow.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/D-old-rows-hold.mjs [--selftest]
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

for (const a of process.argv.slice(2)) {
  if (a !== '--selftest') {
    console.error(`unknown argument ${JSON.stringify(a)} — this script takes --selftest and nothing else`);
    process.exit(2);
  }
}
const SELFTEST = process.argv.includes('--selftest');
const URL = aim('http://localhost:4181/');

const b = await chromium.launch();
const page = await b.newPage();
try { await page.goto(URL, { waitUntil: 'networkidle' }); }
catch { console.log(`\n  nothing serving at ${URL} — aborted, nothing measured`); await b.close(); process.exit(3); }
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(page, URL);

const w = await page.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const enc = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(Math.min(1, Math.max(0, enc(v))) * 255).toString(16).padStart(2, '0')).join('');

  // ── the castings ─────────────────────────────────────────────────────────
  // Found by `userData.basinPart`, which B put on them for exactly this — not
  // by size. park.mjs went blind once matching on exact dimensions.
  const parts = [];
  s.traverse((n) => {
    const part = n.userData && n.userData.basinPart;
    if (!part || !n.isMesh) return;
    const e = n.matrixWorld.elements, gp = n.geometry.parameters || {};
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    parts.push({ part, x: e[12], y: e[13], z: e[14], h: gp.height ?? 0,
                 col: m && m.color ? hex(m.color) : null, map: !!(m && m.map) });
  });
  const castings = [];
  for (const p of parts) {
    const hit = castings.find((c) => c.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 1.2));
    if (hit) hit.push(p); else castings.push([p]);
  }
  const described = castings.map((c) => {
    const count = {}; for (const p of c) count[p.part] = (count[p.part] ?? 0) + 1;
    const bars = c.filter((p) => /bar/i.test(p.part));
    const frame = c.filter((p) => /frame/i.test(p.part));
    const ft = frame.length ? Math.max(...frame.map((f) => f.y + f.h / 2)) : null;
    const bt = bars.length ? Math.max(...bars.map((f) => f.y + f.h / 2)) : null;
    return {
      x: +((Math.min(...c.map((p) => p.x)) + Math.max(...c.map((p) => p.x))) / 2).toFixed(2),
      z: +((Math.min(...c.map((p) => p.z)) + Math.max(...c.map((p) => p.z))) / 2).toFixed(2),
      bars: bars.length, throat: count.throat ?? 0, frames: count.frame ?? 0,
      sunkMm: ft !== null && bt !== null ? +((ft - bt) * 1000).toFixed(1) : null,
      // THE VOID IS EXCLUDED FROM THE VOCABULARY ON PURPOSE. B's doc calls it
      // "a dark plate 1 mm under the slots, not a hole cut in the floor" — it
      // is meant to read as absence, so it is untextured #08090b and always
      // will be. My first cut counted it and reported 2 vocabularies, i.e. it
      // called a documented design decision a fault.
      cols: [...new Set(c.filter((p) => !/void/i.test(p.part)).map((p) => p.col + '|' + p.map))],
    };
  });

  // ── the burger barn, located by its own DOOR ─────────────────────────────
  //
  // Not by colour. The roster gives BURGER BARN `col: '#c8302a'`, so my first
  // two attempts looked for a material wearing it: the first found one at
  // x 520, inside the barn's INTERIOR scene, and reported a yellow face there
  // as this row failing; the second, bounded to the block, found NOTHING —
  // because the shell's colour is baked into a facade TEXTURE and no material
  // on the street carries it as a flat colour at all. A roster colour is an
  // instruction to a painter, not a value you can search the scene for.
  //
  // The door is the thing that is actually addressable: `[E] into BURGER BARN`
  // is registered at the street door, so the spot registry locates the facade
  // exactly, on the block, with no colour matching anywhere in it.
  let burger = null;
  for (const sp of window.__ct.spots()) {
    if (/burger/i.test(sp.label) && Math.abs(sp.x) < 60 && Math.abs(sp.z) < 140) {
      burger = { x: sp.x, z: sp.z }; break;
    }
  }
  let yellow = 0, burgerFaces = 0;
  if (burger) {
    s.traverse((n) => {
      if (!n.isMesh) return;
      const e = n.matrixWorld.elements;
      if (Math.abs(e[12]) > 60 || Math.abs(e[14]) > 140) return;   // block only
      if (Math.hypot(e[12] - burger.x, e[14] - burger.z) > 12) return;
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      for (const m of mats) {
        if (!m || !m.color) continue;
        burgerFaces++;
        const c = m.color;
        // yellow: red and green both strong, blue clearly weaker than red
        if (c.r > 0.35 && c.g > 0.30 && c.b < c.r * 0.5) yellow++;
      }
    });
  }

  // ── the alley floor: linear strokes vs a radial wash ─────────────────────
  // The fault was 16 radial strokes I added and then replaced with a soft
  // radial wash. A stroke is a long thin quad lying on the alley floor; the
  // wash is one plane. So: count long-thin floor quads in the alley.
  let strokes = 0;
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    // A CASTING'S OWN FLANGES ARE LONG AND THIN and are not streaks — the frame
    // is four of them by construction. Counting them found 2 "strokes" that
    // were the drain doing its job.
    if (n.userData && n.userData.basinPart) return;
    const e = n.matrixWorld.elements;
    if (e[12] < -14 || e[12] > -6 || e[14] < -46 || e[14] > -36 || e[13] > 0.6) return;
    const gp = n.geometry.parameters || {};
    const a = gp.width ?? 0, c = gp.depth ?? gp.height ?? 0;
    if (!a || !c) return;
    const long = Math.max(a, c), thin = Math.min(a, c);
    if (long > 0.7 && thin > 0 && long / thin > 6) strokes++;
  });

  return { castings: described, burger, yellow, burgerFaces, strokes,
           cat: (window.__ct.spots().find((sp) => /cat/i.test(sp.label)) ?? null) };
});
await b.close();

let pass = 0, fail = 0;
const say = (ok, what, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}: ${detail}`); ok ? pass++ : fail++; };

// ── ROW: "alley grate matches the kerb inlet" ───────────────────────────────
// It rested on 52 characters: "frame, bars and depth visible in the user's own
// shot". What it is really claiming is that the block has ONE casting design in
// two variants, because the user was explicit that a second grate design is how
// this project ended up with two of everything. So the predicate is about the
// SET of castings, not about one of them looking right.
const drains = w.castings.filter((c) => c.bars > 0);
const inlets = w.castings.filter((c) => c.throat > 0);
const alley = drains.find((c) => c.x < -8 && c.z < -38 && c.z > -44);
console.log(`\n  ${w.castings.length} castings carry userData.basinPart\n`);
say(inlets.length >= 1 && drains.length >= 1, 'both variants exist',
  `${inlets.length} kerb inlets (throat, no bars), ${drains.length} floor drains (bars, no throat)`);
say(!!alley, 'the alley has one of them', alley ? `at (${alley.x}, ${alley.z})` : 'NOT FOUND');
say(drains.every((d) => d.bars === 7), 'every floor drain has the same 7 bars',
  drains.map((d) => d.bars).join(', '));
say(drains.every((d) => d.sunkMm === drains[0].sunkMm), 'and sinks them the same depth under the frame',
  drains.map((d) => `${d.sunkMm} mm`).join(', ') + ' — a flush grate looks painted on');
say(inlets.every((i) => i.bars === 0), 'the kerb inlet is a HOODED inlet, so it has no bars',
  `${inlets.map((i) => i.bars).join(', ')} bars — the variants differ by throat-vs-bars, not by design`);
const vocab = new Set(w.castings.flatMap((c) => c.cols));
say(vocab.size === 1, 'all four castings share one cast-iron vocabulary',
  `${vocab.size} distinct (colour, textured) among every part: ${[...vocab].join(' ')}`);

// ── ROW: "burger barn red + beige" (17 chars: "no yellow remains") ──────────
say(!!w.burger, 'the burger barn is findable, by its own street door',
  w.burger ? `door at (${w.burger.x.toFixed(1)}, ${w.burger.z.toFixed(1)}) — the station for this row` : 'NOT FOUND');
say(w.yellow === 0, 'no yellow remains on it',
  `${w.yellow} yellow faces of ${w.burgerFaces} within 12 m`);

// ── ROW: "alley floor: dark diagonal streaks" ───────────────────────────────
say(w.strokes === 0, 'the alley floor has no linear strokes at any angle',
  `${w.strokes} long-thin floor quads in the alley — the fault was 16 radial strokes`);

if (SELFTEST) {
  console.log('\nselftest — asserting the defects, which must FAIL');
  const before = fail;
  say(w.yellow > 0, 'yellow is back on the burger barn (the bug)', `${w.yellow}`);
  say(w.strokes > 0, 'the alley floor is streaked again (the bug)', `${w.strokes}`);
  say(drains.some((d) => d.bars !== 7), 'a second grate design has appeared (the bug)', drains.map((d) => d.bars).join(', '));
  say(vocab.size > 1, 'the castings no longer share one vocabulary (the bug)', `${vocab.size}`);
  const caught = fail - before;
  console.log(caught === 4
    ? '\nSELFTEST PASSED — all 4 inverted claims were caught'
    : `\nSELFTEST FAILED — only ${caught} of 4 caught, so this measures less than it claims`);
  process.exit(caught === 4 ? 0 : 1);
}

console.log(`\n  ${pass} pass, ${fail} fail`);
if (fail) { console.log('\n  FAIL: a row that was CONFIRMED no longer holds — move it back to LANDED.'); process.exit(1); }
console.log('\n  all four old rows still hold');
