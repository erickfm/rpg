// ITEM 36's ACCEPTANCE TEST — the bodega's 45-degree chamfer as ONE collider.
//
// *"whats going on with the collision geometry here? we should fix this so its
//  not just a bunch of separate rectangles and its just made properly."*
//
// Four measurements, none of them a screenshot:
//
//   1. HOW MANY BOXES the corner is made of.
//   2. THE FACE PROFILE — walk straight INTO the cut face at stations along it
//      and record where you stop. This traces the collision surface the player
//      actually feels. One flat wall gives a CONSTANT stop distance; a
//      staircase of axis-aligned bands gives a saw, because each band's padded
//      west face sits at its own distance from the true 45-degree cut.
//   3. RED IN THE V OVERLAY — `ct/gap.ts`'s own `trapAgainst`, the same
//      function `ct/debug-collision.ts` colours boxes with, run over the same
//      live collider array. Not a re-implementation of the rule.
//   4. WALKING THE DIAGONAL — cut the corner south-east past the bay, and hug
//      the face aimed into it, and report any frame that made no progress.
//
// Everything geometric comes from ct/bodega-corner.ts's own published `BAY`,
// pulled out of the live dev module graph rather than hand-typed — BUILDER-
// BRIEF §8, and `BAY`'s own comment exists because that copy has been made
// wrong before.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w24-chamfer-walk.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

// AIMED, NOT GUESSED. This carried a bare `?? 'http://localhost:4210/'` — the
// GOTCHAS 48 trap that had 648 other instruments swept on 2026-08-02. Run it
// without SHOT_URL and it opened 4210, measured whoever was serving it, and
// printed a confident chamfer verdict about somebody else's tree with nothing
// in the output admitting the port was a default nobody chose. `aim()` hands
// SHOT_URL straight back when it is set, and otherwise says so on stderr.
const URL = aim('http://localhost:4210/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

// CPU_THROTTLE=8 is this file's own regression test. §4a used to walk a fixed
// 2600 ms and so measured frames-under-load rather than the chamfer: on
// identical world bytes it cleared 2.58 / 3.48 / 4.63 / 8.32 / 8.41 m across
// five runs, straddling the 2.83 m face width the verdict compares against.
// Applied AFTER load so the world still boots in reasonable time.
const THROTTLE = Number(process.env.CPU_THROTTLE ?? 1);
if (THROTTLE > 1) {
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  console.log(`CPU throttled x${THROTTLE}`);
}

// THE CUT COMES OUT OF THE BUILT WORLD, not out of a number typed here and not
// out of the module graph either. `ct/bodega-corner.ts` exports its `BAY`, and
// reading that export is the obvious move — but a dynamic `import()` of the
// bare path returns a SECOND, freshly-evaluated copy of the module once vite
// has served the file under a versioned `?t=` URL (which it does the moment you
// edit it), and in that copy `BAY` is still `null` because nothing built the
// corner. An instrument that silently reads a different instance of the thing
// it is measuring is exactly GOTCHAS §48's failure, so it is not used.
//
// The canted bay's own THREE.Group IS the cut face: it stands at the face's
// midpoint, turned onto it, and its wall planes are the face's width. Anything
// that re-cuts the corner moves this group, so this cannot drift.
const bay = await p.evaluate(() => {
  const found = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isGroup || Math.abs(o.rotation.y + Math.PI * 0.75) > 1e-6) return;
    const w = o.children
      .filter((k) => k.geometry?.type === 'PlaneGeometry')
      .map((k) => k.geometry.parameters.width);
    if (w.length >= 2) found.push({ x: o.position.x, z: o.position.z, w: Math.max(...w) });
  });
  return found;
});
if (bay.length !== 1) {
  console.log(`FAIL: expected exactly one canted bay group in the scene, found ${bay.length}`);
  await b.close(); process.exit(1);
}
const C = bay[0], FW = C.w;
// The centre lies ON the cut, and the cut runs at 45 degrees, so a is the
// north-west end and b the south-east one.
const CUT = C.x + C.z;
const A = { x: C.x - FW / 2 / Math.SQRT2, z: C.z + FW / 2 / Math.SQRT2 };
const B = { x: C.x + FW / 2 / Math.SQRT2, z: C.z - FW / 2 / Math.SQRT2 };
console.log(`BAY (from the scene)  centre (${C.x}, ${C.z})  a (${A.x}, ${A.z})  b (${B.x}, ${B.z})`);
console.log(`                      cut x+z = ${CUT}  faceWidth ${FW.toFixed(3)}`);

const S2 = Math.SQRT2;
// The void the corner is cut into is x + z <= CUT, so a player on the pavement
// in front of the bay reads POSITIVE `perp`. `along` runs a -> b.
const perp = (x, z) => (CUT - x - z) / S2;
const along = (x, z) => ((x - A.x) - (z - A.z)) / S2;
const at = (a, s) => ({                       // a point on the face's frame
  x: A.x + a / S2 - s / S2,
  z: A.z - a / S2 - s / S2,
});
const pos = () => p.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw) => p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0), [x, z, yaw]);

let bad = 0;
const fail = (m) => { bad++; console.log(`FAIL  ${m}`); };
const pass = (m) => console.log(`ok    ${m}`);

// ── 1. how many boxes is the corner made of ───────────────────────────────
const near = await p.evaluate(([ax, az, bx, bz]) => {
  const lo = { x: Math.min(ax, bx) - 0.6, z: Math.min(az, bz) - 0.6 };
  const hi = { x: Math.max(ax, bx) + 0.6, z: Math.max(az, bz) + 0.6 };
  // a rotated box's own min/max are in ITS frame, so compare on its centre
  return window.__ct.colliders().filter((c) => {
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
    const rx = (c.maxX - c.minX) / 2 + (c.maxZ - c.minZ) / 2;
    return cx + rx > lo.x && cx - rx < hi.x && cz + rx > lo.z && cz - rx < hi.z;
  });
}, [A.x, A.z, B.x, B.z]);
console.log(`\n── 1. boxes overlapping the corner: ${near.length} ──`);
for (const c of near) {
  console.log('   ', ['minX', 'maxX', 'minZ', 'maxZ'].map((k) => `${k} ${c[k].toFixed(3)}`).join('  '),
    c.rot !== undefined ? `ROT ${c.rot.toFixed(4)}` : '');
}
const rotated = near.filter((c) => c.rot !== undefined && Math.abs(c.rot) > 1e-9);
if (rotated.length === 1) pass(`the chamfer is ONE rotated collider (rot ${rotated[0].rot.toFixed(4)})`);
else fail(`expected exactly 1 rotated collider at the corner, found ${rotated.length}`);

// ── 2. the face profile ────────────────────────────────────────────────────
//
// TWO INSTRUMENTS, because walking alone cannot resolve this. A walk stops on a
// frame boundary: at 3.2 m/s and the ~24 fps a headless browser runs at, one
// step is 130 mm of travel and 92 mm of it perpendicular, so a walk-only
// profile reports 70-90 mm of scatter off a PERFECTLY FLAT wall and could never
// tell that from the 83 mm staircase it is supposed to detect. The first draft
// of this probe did exactly that and would have failed a correct fix.
//
// So: 2a traces the collision surface itself, to the millimetre, and 2b walks
// into it the way a player does.

// 2a. THE BOUNDARY TRACE. Warp to a candidate point and see whether the rig
// throws it back out — `unstick()` moves you if and only if `blocked()` says
// you are inside something, so "did the position change" IS fp.ts's own
// collision predicate, not a re-implementation of it. Bisect on that.
console.log('\n── 2a. boundary trace: the collision surface, to the millimetre ──');
async function shoved(x, z) {
  await warp(x, z, 0);
  await p.waitForTimeout(130);           // several frames: enough to be pushed,
  const [nx, , nz] = await pos();        // far short of unstick's 0.45 s jump
  return Math.hypot(nx - x, nz - z) > 1e-3;
}
// A "clear" verdict is CONFIRMED TWICE, an "inside" verdict taken first time.
// The asymmetry is deliberate and it is not a loosening: `unstick` needs a
// rendered frame to push you, so a frame that has not run yet looks exactly
// like open ground — and a browser that has just loaded skips one. Measured:
// on the built bundle the very first station of the trace, and only ever the
// first, reported the surface 229 mm inside the wall where every other station
// on the identical collider array reported 0.359. Re-asking cannot turn a solid
// wall into a hole, but it does stop a dropped frame reporting one.
async function illegal(x, z) {
  if (await shoved(x, z)) return true;
  return await shoved(x, z);
}
await shoved(A.x - 2, A.z - 2);          // warm up: get a frame on the board
const surface = [];
for (let a = 0.2; a <= FW - 0.15; a += 0.12) {
  let lo = 0.02, hi = 0.9;               // lo assumed inside, hi assumed clear
  const q = at(a, hi);
  if (await illegal(q.x, q.z)) { surface.push({ a, s: NaN }); continue; }
  for (let i = 0; i < 12; i++) {         // 0.88 m / 2^12 = 0.2 mm
    const mid = (lo + hi) / 2;
    const m = at(a, mid);
    if (await illegal(m.x, m.z)) lo = mid; else hi = mid;
  }
  surface.push({ a, s: hi });
}
for (const r of surface) console.log(`   along ${r.a.toFixed(2)}   surface at perp ${r.s.toFixed(4)}`);
const uv = surface.map((r) => r.s).filter((v) => !Number.isNaN(v));
const usaw = Math.max(...uv) - Math.min(...uv);
console.log(`   surface  min ${Math.min(...uv).toFixed(4)}  max ${Math.max(...uv).toFixed(4)}  SAW ${(usaw * 1000).toFixed(1)} mm`);
// One flat wall padded by the player's own RADIUS is a straight line: the saw
// is zero but for the 0.2 mm the bisection itself leaves. The staircase's step
// is BAND / sqrt2 = 177 mm. 5 mm sits three orders of magnitude below the
// defect and an order above the instrument.
if (usaw < 0.005) pass(`the collision surface is FLAT to ${(usaw * 1000).toFixed(1)} mm`);
else fail(`the collision surface still steps: ${(usaw * 1000).toFixed(1)} mm`);

// 2b. …and the same thing WALKED, which is what the player feels.
console.log('\n── 2b. the same profile, walked into ──');
const IN_YAW = (3 * Math.PI) / 4;   // fwd = (+1,+1)/sqrt2, the inward normal
const stops = [];
for (let a = 0.25; a <= FW - 0.2; a += 0.15) {
  const from = at(a, 1.25);
  await warp(from.x, from.z, IN_YAW);
  await p.waitForTimeout(120);
  await p.keyboard.down('w');
  await p.waitForTimeout(700);          // 3.2 m/s x 0.7 s = 2.2 m, ample for 1.25 m
  await p.keyboard.up('w');
  await p.waitForTimeout(120);
  const [x, , z] = await pos();
  stops.push({ a, s: perp(x, z), x, z });
}
for (const r of stops) console.log(`   along ${r.a.toFixed(2)}   stopped at perp ${r.s.toFixed(3)}`);
const sv = stops.map((r) => r.s);
console.log(`   walked stop  min ${Math.min(...sv).toFixed(3)}  max ${Math.max(...sv).toFixed(3)}` +
  `  spread ${((Math.max(...sv) - Math.min(...sv)) * 1000).toFixed(0)} mm (frame quantisation lives here)`);
// A walk can only ever stop SHORT of the surface, never inside it.
const through = stops.filter((r) => r.s < Math.min(...uv) - 0.005);
if (through.length === 0) pass('no walk ended up inside the wall');
else fail(`${through.length} walk(s) ended INSIDE the collision surface`);

// ── 3. red in the V overlay ────────────────────────────────────────────────
console.log('\n── 3. trapAgainst (what the V overlay paints red) ──');
// gap.ts is reached through the dev server's source graph, which a BUILT bundle
// does not serve. Checks 3 and 3b then say SKIPPED and say so out loud — a
// check that quietly turns into a pass when its subject is unreachable is worse
// than one that is wrong (BUILDER-BRIEF §7). Everything else in this file works
// against either.
const red = await p.evaluate(async ([ax, az, bx, bz]) => {
  let trapAgainst;
  try { ({ trapAgainst } = await import('/src/proto/ct/gap.ts')); } catch { return null; }
  const cols = window.__ct.colliders();
  const lo = { x: Math.min(ax, bx) - 0.6, z: Math.min(az, bz) - 0.6 };
  const hi = { x: Math.max(ax, bx) + 0.6, z: Math.max(az, bz) + 0.6 };
  const out = [];
  for (const c of cols) {
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
    const rx = (c.maxX - c.minX) / 2 + (c.maxZ - c.minZ) / 2;
    if (!(cx + rx > lo.x && cx - rx < hi.x && cz + rx > lo.z && cz - rx < hi.z)) continue;
    const w = trapAgainst(c, cols);
    if (w !== null) out.push({ c, w });
  }
  return { atCorner: out, worldRed: cols.filter((c) => trapAgainst(c, cols) !== null).length, total: cols.length };
}, [A.x, A.z, B.x, B.z]);
const SRC = red !== null;
if (!SRC) console.log('   SKIPPED — this is a BUILT bundle; gap.ts is not served as source here.');
if (SRC) {
console.log(`   red near the corner: ${red.atCorner.length}   red world-wide: ${red.worldRed} of ${red.total}`);
for (const r of red.atCorner) console.log(`      ${JSON.stringify(r.c)}  gap ${r.w.toFixed(3)}`);
// THE CHAMFER ITSELF is what the item is about: the turned box and the pier
// that closes it. The window above also catches the corner block, which is a
// 11.7 x 8 m slab spanning the whole frontage and reads red against props
// metres away up the street — pre-existing, unrelated, and reported below
// rather than quietly folded into a pass or a fail.
// The chamfer's two boxes, named PRECISELY. An earlier draft said "turned, or
// far east and deep in z", which also matched the traffic pool: idle vehicles
// are parked at x = 999 (ct/traffic.ts), so two of them sitting on top of each
// other read as a corridor and this check failed on a taxi that was not out.
// The pier is identified by the corner it closes on — B, from the bay itself.
const isChamfer = (c) => c.rot !== undefined
  || (Math.abs(c.minX - B.x) < 1e-9 && Math.abs(c.minZ - B.z) < 1e-9);
const otherRed = red.atCorner.filter((r) => !isChamfer(r.c));
// SAMPLED, NOT SNAPSHOTTED. `crosstown.ts` spreads the moving `vehicleBoxes`
// into `colliders` and citizens carry boxes too, so a car or a pedestrian
// passing forms a transient corridor against whatever it is beside — for one
// frame, anywhere in the world. Measured on the CONTROL, the corner block north
// of the cut, which this item does not touch: it reads red in 16 of 60 samples
// against a 0.5 m box walking down the pavement 0.45 m off its face. A single
// instant therefore cannot answer "is the chamfer red"; ten over two seconds
// can. (scripts/probes/w24-chamfer-red-repeat.mjs is the long-run version.)
// …AND IT IS ASKED OF THE STATIC WORLD. Citizens and vehicles carry collider
// boxes in the SAME array, so "is this box red" has a moving answer: a walker
// passing 0.45 m off a facade forms a textbook trap corridor against it for as
// long as it takes to walk by. That is not a verdict on how the wall is built,
// which is what item 36 is about. A collider counts here only if its footprint
// is identical in two samples a second apart.
const key = (c) => `${c.minX} ${c.maxX} ${c.minZ} ${c.maxZ} ${c.rot ?? 0}`;
const snapA = await p.evaluate((k) => window.__ct.colliders().map(eval(`(${k})`)), key.toString());
await p.waitForTimeout(1000);
const snapB = await p.evaluate((k) => window.__ct.colliders().map(eval(`(${k})`)), key.toString());
const stillKeys = snapA.filter((k) => snapB.includes(k));
const ownRed = await p.evaluate(async ([keep, bx, bz, ks]) => {
  const { trapAgainst } = await import('/src/proto/ct/gap.ts');
  const kf = eval(`(${ks})`);
  const set = new Set(keep);
  const cols = window.__ct.colliders().filter((c) => set.has(kf(c)));
  return cols.filter((c) => (c.rot !== undefined
      || (Math.abs(c.minX - bx) < 1e-9 && Math.abs(c.minZ - bz) < 1e-9))
    && trapAgainst(c, cols) !== null)
    .map((c) => `${c.minX.toFixed(2)}..${c.maxX.toFixed(2)} x ${c.minZ.toFixed(2)}..${c.maxZ.toFixed(2)} rot=${c.rot ?? 0}`);
}, [stillKeys, B.x, B.z, key.toString()]);
console.log(`   static colliders: ${stillKeys.length} of ${snapA.length}`);
if (ownRed.length === 0) pass('no red on the chamfer or the pier that closes it');
else fail(`${ownRed.length} red box(es) ON the chamfer: ${ownRed.join(' | ')}`);
if (otherRed.length) console.log(`   NOTE ${otherRed.length} red box(es) near, but not part of, the corner — see the handoff note`);
}

// ── 3b. does gap.ts see the box's WORLD footprint, or its local extents? ───
// The turned box's local maxX is 9.914 while its real east corner reaches
// x = 10.0 — a 86 mm lie, and the difference between a 0.486 m corridor
// (inside the trap band) and a 0.400 m one (outside it). Nothing in the world
// currently sits in that 86 mm, so no red moves either way; this asks gap.ts
// the question directly instead, by walking a probe box east past the corner
// and finding where `corridor()` says the chamfer ends. Its own function, on
// the live collider — not a re-implementation.
console.log('\n── 3b. the east corner gap.ts measures the chamfer to ──');
const edge = !SRC ? null : await p.evaluate(async () => {
  const { corridor } = await import('/src/proto/ct/gap.ts');
  const c = window.__ct.colliders().find((k) => k.rot);
  if (!c) return null;
  // a tall thin probe spanning the chamfer's whole z range, slid east until it
  // stops overlapping; the last overlapping x IS the box's east extent.
  const zLo = -200, zHi = 200;
  let lo = 5, hi = 15;                       // lo overlaps, hi does not
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const probe = { minX: mid, maxX: mid + 20, minZ: zLo, maxZ: zHi };
    if (corridor(c, probe) === null) lo = mid; else hi = mid;
  }
  return { edge: hi, localMaxX: c.maxX };
});
if (!edge) console.log('   SKIPPED — built bundle, gap.ts not served as source.');
if (edge) {
console.log(`   gap.ts measures the chamfer's east corner at x ${edge.edge.toFixed(4)}`);
console.log(`   its LOCAL maxX is                            x ${edge.localMaxX.toFixed(4)}`);
// The true corner: the turned box's centre plus its own half-extents rotated.
const trueEdge = await p.evaluate(() => {
  const c = window.__ct.colliders().find((k) => k.rot);
  const cx = (c.minX + c.maxX) / 2, hx = (c.maxX - c.minX) / 2, hz = (c.maxZ - c.minZ) / 2;
  return cx + Math.abs(hx * Math.cos(c.rot)) + Math.abs(hz * Math.sin(c.rot));
});
console.log(`   its four corners actually reach              x ${trueEdge.toFixed(4)}`);
if (Math.abs(edge.edge - trueEdge) < 0.01) pass('gap.ts measures the turned box by its real world footprint');
else fail(`gap.ts measures the turned box to x ${edge.edge.toFixed(3)}, but it reaches x ${trueEdge.toFixed(3)}`);
}

// ── the walker: IT ENDS ON WORLD STATE, NEVER ON A CLOCK ───────────────────
//
// This used to hold `w` for a fixed 2600 ms and sample every 65 ms, and that
// was the flakiest thing in this file. `dt` is CLAMPED at 0.05 s
// (src/main.ts:107), so a loaded browser advances the simulation by at most
// 50 ms however long the frame really took: the wall-clock window closes while
// the player is still mid-corner, and what gets reported is how many frames the
// machine managed, not how far the chamfer let anybody go. Measured on
// bit-identical world bytes, §4a's "cleared" distance over five runs:
//
//     fixed 2600 ms   2.58 / 3.48 / 4.63 / 8.32 / 8.41 m     (the face is 2.83 m)
//
// The same world therefore passed three times and failed twice, and re-tuning
// the threshold could only have chosen which half it lied about. Every
// clock-free verdict in this file — 1, 2a, 3, 3b — was identical on all five.
//
// So a leg now ends when the WORLD says it is over: either you came out the far
// end of the face, or you stopped moving for STALL_FRAMES consecutive rendered
// frames. Both are statements about world state, so neither can be truncated by
// load, and a wedged player still ends the leg promptly instead of burning the
// budget. Sampling is per rendered frame, in-page, so no sample can straddle a
// frame the way a 65 ms poll did.
const STALL_EPS = 0.002;        // metres travelled in one frame that counts as none
const STALL_FRAMES = 30;
// FRAMES, not ms — the whole point. A budget generous in wall clock is
// unbounded exactly when frames are slow, which is when this check matters;
// jump-walk.mjs sat on one at x40 for twenty minutes. The longest leg is ~1.1 m
// of approach plus the 2.83 m face plus clearance, about 5 m at 3.2 m/s. At a
// 1/60 s step that is ~95 frames, and the dt clamp means a SLOWER frame covers
// more ground rather than less, so ~95 is the worst case. 600 is a 6x margin
// and still terminates under any load.
const WALK_FRAME_BUDGET = 600;

/** Hold `keys` and sample every RENDERED frame in-page until the world ends the
 *  leg: `target` metres along the face reached, or no travel for STALL_FRAMES
 *  frames. Returns `{ track, why, frames }`. */
async function walk(keys, target) {
  for (const k of keys) await p.keyboard.down(k);
  const r = await p.evaluate(([ax, az, cut, target, eps, stallFrames, budget]) => new Promise((resolve) => {
    const S2 = Math.SQRT2;
    const out = [];
    let n = 0, still = 0, moved = false, lx = null, lz = null;
    const tick = () => {
      const [x, , z] = window.__ct.pos();
      // This copy of the projection exists only to GATE THE LOOP — an in-page
      // callback cannot close over the node-side `along`/`perp`. Every number
      // this file reports or judges is recomputed from x/z by those originals
      // once the track comes back, so there is exactly one definition of the
      // face frame in play and this copy cannot drift into a verdict.
      const a = ((x - ax) - (z - az)) / S2;
      out.push({ x, z });
      if (lx !== null) {
        const d = Math.hypot(x - lx, z - lz);
        if (d > eps) moved = true;
        // Stillness only counts once the leg has actually STARTED. The first
        // frames after a warp routinely show no travel because the keydown has
        // not been read yet, and calling that "wedged" would end the leg at
        // zero and paint a perfectly good world red.
        still = (moved && d <= eps) ? still + 1 : 0;
      }
      lx = x; lz = z;
      if (a > target) return resolve({ track: out, why: 'cleared', frames: n });
      if (still >= stallFrames) return resolve({ track: out, why: 'stalled', frames: n });
      if (++n > budget) return resolve({ track: out, why: 'budget', frames: n });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), [A.x, A.z, CUT, target, STALL_EPS, STALL_FRAMES, WALK_FRAME_BUDGET]);
  for (const k of keys) await p.keyboard.up(k);
  // The single definition of the face frame, applied to the raw track.
  return { ...r, track: r.track.map(({ x, z }) => ({ x, z, a: along(x, z), s: perp(x, z) })) };
}
// ── A LEG A PASSER-BY BLOCKED IS NOT A VERDICT ABOUT THE WALL ─────────────
//
// THE RESIDUAL FLAKE IN THIS FILE, FOUND AND NAMED 2026-08-02 (w38, item 78).
// 4a failed 3 times in 34 runs on a clean tree with no throttle, and the cause
// is not the chamfer and not the frame rate — which is why the throttle
// experiment came back negative and should not be run again.
//
// The heading here is yaw pi/4, EXACTLY parallel to the 45-degree cut:
// fwd = (+1,-1)/sqrt2, so d(x+z) = 0 and a healthy leg holds `perp` dead flat
// at 0.800 the whole way along the face. On a failing leg it does not — it
// collapses 0.800 -> 0.596 -> 0.387 and the player wedges. `perp` can only fall
// if the -z step is refused while the +x step is allowed (fp.ts tests the axes
// separately), which drives x+z up toward the wall.
//
// So the question was never "is the chamfer built wrong" — 2a measures the
// surface flat to 0.0 mm on the very same runs — but WHAT REFUSED THE -Z STEP,
// given nothing static sits south of the player there. Measured, by dumping
// every collider within 1.2 m of the stall and re-reading them a second later:
//
//     x 8.018..8.518  z -97.250..-96.750  rot 0  MOVING (an actor)
//
// A 0.5 x 0.5 m box due south of the player: a CITIZEN. crosstown.ts spreads
// citizen and vehicle boxes into the same `colliders()` array the wall lives in,
// so a pedestrian crossing the corner refuses the -z step exactly like masonry,
// and this leg then reports "the chamfer did not let me past". You cannot walk
// through people; that is the world working. The instrument was blaming the wall
// for it.
//
// THIS DISCRIMINATES, IT DOES NOT LOOSEN — the distinction BUILDER-BRIEF §7
// turns on. A stall is still a failure. It is only set aside when the thing
// beside the player is demonstrably an ACTOR, proved by its footprint changing
// over the following second, and a stall against anything static fails exactly
// as before. Proved both ways: with a static blocker planted in the walk line
// this still goes red, and it does not retry its way out of it.
const NEAR_R = 0.75;
const colliderKey = (c) => `${c.minX} ${c.maxX} ${c.minZ} ${c.maxZ} ${c.rot ?? 0}`;
const nearBoxes = (x, z) => p.evaluate(([px, pz, R, ks]) => {
  const kf = eval(`(${ks})`);
  return window.__ct.colliders().filter((c) => {
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
    const rx = (c.maxX - c.minX) / 2 + (c.maxZ - c.minZ) / 2 + R;
    return Math.abs(cx - px) < rx && Math.abs(cz - pz) < rx;
  }).map((c) => ({ k: kf(c), minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ }));
}, [x, z, NEAR_R, colliderKey.toString()]);

/** Colliders beside (x,z) whose footprint does NOT survive the next second —
 *  i.e. the moving ones. A wall cannot pass this test; a citizen or a vehicle
 *  does. */
async function actorsBeside(x, z) {
  const before = await nearBoxes(x, z);
  await p.waitForTimeout(1000);
  const after = new Set((await nearBoxes(x, z)).map((c) => c.k));
  return before.filter((c) => !after.has(c.k));
}

/** Run one leg, and re-run it if a passer-by ended it. Returns the last run,
 *  plus how many attempts an actor cost. */
async function legFrom(from, yaw, keys, target, label, tries = 3) {
  let run, voided = 0;
  for (let t = 1; t <= tries; t++) {
    await warp(from.x, from.z, yaw);
    await p.waitForTimeout(300);
    run = await walk(keys, target);
    if (run.why !== 'stalled') return { run, voided };
    const e = run.track[run.track.length - 1];
    const movers = await actorsBeside(e.x, e.z);
    if (!movers.length) return { run, voided };      // static wedge — a real fail
    voided++;
    console.log(`   ${label}: leg VOID — stalled at along ${along(e.x, e.z).toFixed(2)} beside ` +
      `${movers.length} MOVING collider(s), an actor and not the wall:`);
    for (const m of movers) {
      console.log(`      x ${m.minX.toFixed(3)}..${m.maxX.toFixed(3)}  z ${m.minZ.toFixed(3)}..${m.maxZ.toFixed(3)}` +
        `  (${(m.maxX - m.minX).toFixed(2)} x ${(m.maxZ - m.minZ).toFixed(2)} m)`);
    }
    console.log(`   retrying (attempt ${t + 1} of ${tries})`);
  }
  return { run, voided };
}

// Walk until half a metre PAST the far end, so "cleared" is unambiguous and the
// verdict below still has headroom rather than tripping on the exact sample
// that crossed the line.
const walkTarget = () => FW + 0.5;
// Print a thinned track: per-frame sampling yields hundreds of rows and the
// shape is what a reader needs, not every frame.
const thin = (tr) => tr.filter((_, i) => i % 5 === 0 || i === tr.length - 1);
const stalls = (tr) => {
  let n = 0;
  for (let i = 1; i < tr.length; i++) if (Math.hypot(tr[i].x - tr[i - 1].x, tr[i].z - tr[i - 1].z) < 0.01) n++;
  return n;
};

// ── 4a. cut the corner ─────────────────────────────────────────────────────
console.log('\n── 4a. walk the diagonal: cut the corner south-east past the bay ──');
const YAW = Math.PI / 4;    // fwd = (+1, -1)/sqrt2, the a -> b tangent
const leg1r = await legFrom({ x: A.x - 1.1, z: A.z + 1.3 }, YAW, ['w'], walkTarget(), '4a');
const run1 = leg1r.run;
const leg1 = run1.track;
const e1 = leg1[leg1.length - 1];
for (const r of thin(leg1)) console.log(`      x ${r.x.toFixed(3)}  z ${r.z.toFixed(3)}  along ${r.a.toFixed(3)}  perp ${r.s.toFixed(3)}`);
console.log(`   leg ended: ${run1.why} after ${run1.frames} rendered frames (budget ${WALK_FRAME_BUDGET})`);
console.log(`   ended x ${e1.x.toFixed(2)} z ${e1.z.toFixed(2)}, along ${e1.a.toFixed(2)} of ${FW.toFixed(2)} m`);
// CLEARING IS THE VERDICT; the stall count is an observation beside it.
// Being caught on the corner means you are still on it — so "did you come out
// the far end" is the question, and it is the one the user's complaint is
// about. The per-sample stall count cannot be the verdict because it also
// counts the browser: one run of this same bundle logged 13 stalled frames of
// 39 and STILL ended 3.95 m along, which is a page hitch (GC, texture upload)
// freezing every sample together, not a player wedged on a box. A wedged
// player does not resume, and does not clear.
console.log(`   frames that moved under 10 mm: ${stalls(leg1)} of ${leg1.length - 1}` +
  ` — observation only; a page hitch freezes these too`);
if (e1.a > FW) pass(`cleared the corner (${e1.a.toFixed(2)} m along a ${FW.toFixed(2)} m face)`);
else fail(`did NOT clear the corner — stopped ${e1.a.toFixed(2)} m along a ${FW.toFixed(2)} m face`);

// ── 4b. hug the face ───────────────────────────────────────────────────────
// Aimed 20 degrees INTO the wall: a flat wall converts that into a steady slide
// at a constant offset, a staircase cannot. NOT W+D — at this yaw `fwd` and
// `right` sum to due EAST, so W+D is a push into the wall, not a hug, and the
// first draft of this probe measured a stall that was entirely its own doing.
console.log('\n── 4b. walk the diagonal: hug the face, aimed 20 degrees into it ──');
// Same world-state ending as 4a, and for the same reason: this leg's own
// verdict below is "did hugging the face still carry you off the end", which a
// fixed 2600 ms window answers with the frame rate rather than with the wall.
// Same actor discrimination too — a citizen blocks this leg just as readily.
const leg2r = await legFrom({ x: A.x - 0.75, z: A.z - 0.75 }, YAW + 0.35, ['w'], walkTarget(), '4b');
const run2 = leg2r.run;
const leg2 = run2.track;
console.log(`   leg ended: ${run2.why} after ${run2.frames} rendered frames (budget ${WALK_FRAME_BUDGET})`);
const on = leg2.filter((r) => r.a > 0.2 && r.a < FW - 0.2 && r.s < 0.75);
console.log(`   ${on.length} samples alongside the face`);
for (const r of thin(on)) console.log(`      along ${r.a.toFixed(3)}  perp ${r.s.toFixed(3)}`);
console.log(`   frames that moved under 10 mm: ${stalls(leg2)} of ${leg2.length - 1}`);
// THE OUTWARD KICK IS REPORTED, NOT JUDGED, and the reason is worth writing
// down because it looked like the perfect metric and is not one.
//
// Riding a wall aimed into it, `perp` should fall and then hold. A staircase
// shoves you back out at every band. So "largest outward step between
// consecutive samples" ought to separate the two — and off the 8-band
// staircase it does read 98 mm. But it reads 5 mm on the dev server and 87 mm
// on the BUILT BUNDLE with a bit-identical collider array, so it is not
// measuring the wall at all.
//
// What it is measuring is `fp.ts`'s axis-separated movement, which does this
// against ANY diagonal wall: the two axes are tested independently
// (`blocked(nx, z)` then `blocked(x, nz)`), so when the x step is refused by a
// 45-degree face the z step is still allowed — and on this wall moving -z
// alone INCREASES the distance from it. You drift off, come back, drift off:
// a limit cycle whose amplitude is set by the frame step, which is why a
// slower browser reads a bigger number. Nothing to do with how many boxes the
// wall is made of.
//
// The check that DOES separate them is 2a, which measures the surface itself
// rather than a walk over it: 152 mm on the staircase, 0.0 mm on one turned
// box. So this stays visible and stays out of the verdict.
if (on.length >= 3) {
  let kick = 0, at = 0;
  for (let i = 1; i < on.length; i++) if (on[i].s - on[i - 1].s > kick) { kick = on[i].s - on[i - 1].s; at = on[i].a; }
  console.log(`   perpendicular offset while hugging  min ${Math.min(...on.map((r) => r.s)).toFixed(3)}  max ${Math.max(...on.map((r) => r.s)).toFixed(3)}`);
  console.log(`   largest outward step: ${(kick * 1000).toFixed(0)} mm at along ${at.toFixed(2)} — REPORTED, not judged (see above)`);
}
// What IS judged: riding the wall must never put you inside it.
const inWall = on.filter((r) => r.s < Math.min(...uv) - 0.02);
if (inWall.length === 0) pass('riding the face never puts you inside it');
else fail(`${inWall.length} sample(s) ended up inside the wall while hugging it`);
// Same reasoning as 4a: the verdict is that hugging the wall still gets you
// along it, not that no frame was slow.
if (Math.max(...leg2.map((r) => r.a)) > FW) pass('hugging the face still carries you along it and off the end');
else fail(`hugging the face stopped you at ${Math.max(...leg2.map((r) => r.a)).toFixed(2)} m of ${FW.toFixed(2)} m`);

console.log('\nconsole errors:', errs.length ? errs : 'none');
console.log(bad === 0 ? '\nALL CHECKS PASS' : `\n${bad} CHECK(S) FAILED`);
await b.close();
process.exit(bad === 0 ? 0 : 1);
