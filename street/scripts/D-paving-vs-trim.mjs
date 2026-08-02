// WHICH "GROUND-FACING" SURFACES ARE ACTUALLY PAVING? THE PREDICATE, PUBLISHED.
//
// The row read "the street's 27 untextured flat-colour ground surfaces, adopt
// slabTex". I closed it by measuring: of the street's 35 such surfaces, ZERO
// are paving. But the predicate that produced that lived only in what I ran,
// which makes the row an argument instead of a recount — so here it is, as a
// thing anyone can run.
//
// It matters because generic filters keep producing different sets:
//
//   A's  `A-flat-ground.mjs`  35 street surfaces — up-normal tested only for
//        PlaneGeometry, so every BoxGeometry under y 0.7 is swept in and
//        charged the area of its +y face
//   H's  filter                74 — "accepts any box under 0.4 m", which takes
//        bench slats and kerb pieces
//   mine, first cut            73 — "thin and near the ground", which took
//        shopfront stallriser ledges at y 0.32
//
// Three filters, three sets, none agreeing, and all three describe the same
// world correctly by their own lights. The disagreement is not about
// measurement, it is that "ground-facing" is not the question. The question is
// **is this a surface you walk on**, and that has an answer.
//
// ── THE PREDICATE ───────────────────────────────────────────────────────────
//
// A surface is PAVING when all of these hold. Each rejection names a real thing
// in this world that is not paving and would otherwise be counted as it:
//
//   1. it faces up, is untextured, is not a stain, and is on the block
//      — A's base filter, unchanged, so the populations stay comparable
//
//   2. BOTH spans >= 0.45 m                                        [not a STRIP]
//      A 0.11 m cill or a 0.09 m plinth is a moulding on a facade, seen
//      edge-on. So is a kerb piece and a bench slat. You cannot stand on any of
//      them, and slabTex's default 1.5 m joint is THIRTEEN TIMES a cill's depth
//      — the "joints give it scale" argument inverts into a pavement joint
//      painted on a stall riser. 0.45 m is under a 0.72 m stride and over every
//      moulding in the world, and the gap between the two populations is wide:
//      nothing in the street sits between 0.12 m and 1.05 m.
//
//   3. NOT a box taller than 0.5 m                                   [not a LID]
//      The +y face of a tall box is its top, not a floor. This is what catches
//      the open-site railing caps (h 0.62) and the dumpster's interior (h 1.1,
//      whose "ground-facing surface" is the open mouth at y 1.24). A lid is
//      reachable by a ray from above and by nothing else.
//
// Run it. It prints the recount, and it FAILS if the street ever grows a real
// paving surface — which is the state that would make the original row live
// again, and is worth knowing about.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/D-paving-vs-trim.mjs [--selftest]
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
try {
  await page.goto(URL, { waitUntil: 'networkidle' });
} catch {
  console.log(`\n  nothing serving at ${URL} — aborted, nothing measured`);
  await b.close(); process.exit(3);                 // GOTCHAS §32
}
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(page, URL);

const rows = await page.evaluate(() => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const out = [];
  const enc = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  const hex = (c) => '#' + [c.r, c.g, c.b]
    .map((v) => Math.round(Math.min(1, Math.max(0, enc(v))) * 255).toString(16).padStart(2, '0')).join('');
  scene.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    const mats = Array.isArray(n.material) ? n.material : [n.material];
    const gp = n.geometry.parameters || {};
    const e = n.matrixWorld.elements;
    // ── step 1: A's base filter, unchanged ──────────────────────────────────
    const up = [e[4], e[5], e[6]];
    const isFlatPlane = n.geometry.type === 'PlaneGeometry' && Math.abs(up[1]) < 0.35;
    const isBox = n.geometry.type === 'BoxGeometry';
    if (!isFlatPlane && !isBox) return;
    if (e[13] > 0.7) return;                        // paving, not a roof or a sill
    if (Math.abs(e[12]) > 140 || Math.abs(e[14]) > 140) return;   // the block, not a room
    for (const m of mats) {
      if (!m || m.map) continue;                    // textured is fine
      if (!m.color) continue;
      if (m.transparent && (m.opacity ?? 1) < 0.9) continue;      // a stain, not paving
      let w = 0, d = 0;
      if (isFlatPlane) { w = gp.width ?? 0; d = gp.height ?? 0; }
      else { w = gp.width ?? 0; d = gp.depth ?? 0; }
      if (!w || !d) continue;
      const area = Math.abs(w * d);
      if (area < 0.6) continue;
      // ── steps 2 and 3: what KIND of surface is it ─────────────────────────
      const h = isBox ? (gp.height ?? 0) : 0;
      const verdict = Math.min(Math.abs(w), Math.abs(d)) < 0.45 ? 'STRIP'
                    : (isBox && h > 0.5) ? 'LID'
                    : 'PAVING';
      out.push({ mod: n.userData.mod ?? '(unattributed)', verdict,
                 w: +w.toFixed(2), d: +d.toFixed(2), h: +h.toFixed(2),
                 area: +area.toFixed(1), col: hex(m.color),
                 at: [+e[12].toFixed(1), +e[13].toFixed(2), +e[14].toFixed(1)] });
      break;
    }
  });
  return out;
});
await b.close();

const sum = (rs) => rs.reduce((a, r) => a + r.area, 0);
const byVerdict = (v) => rows.filter((r) => r.verdict === v);
console.log(`\n  ${rows.length} up-facing untextured surfaces on the block, ${sum(rows).toFixed(0)} m² — sorted:\n`);
for (const v of ['PAVING', 'STRIP', 'LID']) {
  const rs = byVerdict(v);
  const why = v === 'PAVING' ? 'you can stand on it'
            : v === 'STRIP' ? 'a span under 0.45 m — a moulding, kerb or slat seen edge-on'
            : 'the top of a box over 0.5 m tall — a lid, not a floor';
  console.log(`  ${v.padEnd(7)} ${String(rs.length).padStart(3)} surfaces  ${sum(rs).toFixed(0).padStart(4)} m²   ${why}`);
}

const street = rows.filter((r) => r.mod === 'street');
console.log(`\n  the street's ${street.length} surfaces, which is what the row was about:\n`);
console.log('   verdict   area      w   x   d    boxH  tone      at x,z');
for (const r of street.slice().sort((a, z) => z.area - a.area)) {
  console.log(`   ${r.verdict.padEnd(7)} ${String(r.area).padStart(5)}  ${String(r.w).padStart(6)}x${String(r.d).padStart(6)}  ${String(r.h).padStart(5)}  ${r.col}  ${r.at[0]},${r.at[2]}`);
}
const streetPaving = street.filter((r) => r.verdict === 'PAVING');
console.log(`\n  real paving by module: ${[...new Set(byVerdict('PAVING').map((r) => r.mod))].join(', ') || '(none)'}`);
console.log(`  the street's paving: ${streetPaving.length} surfaces, ${sum(streetPaving).toFixed(0)} m²`);

if (SELFTEST) {
  // Invert the claim against the same data: assert the street DOES have paving,
  // and assert the trim classes are empty. All three must be caught, or this
  // script is not measuring what it says (GOTCHAS §27).
  console.log('\nselftest — asserting the defects, which must FAIL');
  let caught = 0;
  const say = (bad, what, detail) => {
    if (!bad) { caught++; console.log(`  FAIL  ${what}: ${detail}`); }
    else console.log(`  PASS  ${what}: ${detail} — NOT caught`);
  };
  say(streetPaving.length > 0, 'the street has real paving in it (the inverted claim)', `${streetPaving.length} surfaces`);
  say(byVerdict('STRIP').length === 0, 'nothing is rejected as a strip (the inverted claim)', `${byVerdict('STRIP').length} strips`);
  say(byVerdict('LID').length === 0, 'nothing is rejected as a lid (the inverted claim)', `${byVerdict('LID').length} lids`);
  console.log(caught === 3
    ? '\nSELFTEST PASSED — all 3 inverted claims were caught'
    : `\nSELFTEST FAILED — only ${caught} of 3 caught, so this measures less than it claims`);
  process.exit(caught === 3 ? 0 : 1);
}

if (streetPaving.length) {
  console.log('\n  FAIL: the street has grown a real paving surface — the slabTex row is live again.');
  process.exit(1);
}
console.log("\n  none of the street's surfaces is paving; they are mouldings, rail caps and a dumpster floor");
