// Item 260 part 3 — "a 0.27 m box inside apartment 301 is in `staticColliders()`
// and MOVES between readings". Find what registers it.
//
// WHY IT MATTERS (GOTCHAS 73's class). `__ct.staticColliders()` is defined as
// `colliders()` minus `actorColliders()`, so anything that moves but never
// joined the actor set is published to every check as furniture. It nearly cost
// a builder a false finding: raw collider counts read 257/258/259 across a
// round trip and it almost filed "ghosts.mjs is culled", before noticing the
// counts were MONOTONIC — actors spawning, not culling.
//
// ⚠ THE PLAYER SPAWNS INSIDE APARTMENT 301 AT x = 198, which for once is where
// this probe wants him: the box is in that flat. Nothing here filters on
// `visible` (GOTCHAS 79/79b) — membership of the static list is an authoring
// fact and does not stop being true when a mesh is culled.
//
// IDENTITY DOES NOT SURVIVE page.evaluate, so the matching is done IN THE PAGE
// against the live array, and only the report crosses the boundary.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const WAITS = Number(process.env.WAITS ?? 8);
const GAP = Number(process.env.GAP_MS ?? 700);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForFunction(() => (window.__ct.painted?.()?.triangles ?? 0) > 0, { timeout: 20000 });

// Snapshot the STATIC list repeatedly, keeping each box's identity by its slot
// in the live array — the array is returned by reference and its order is
// stable for anything that is not being spliced.
await p.evaluate(() => {
  window.__SNAP = [];
  window.__grab = () => {
    const actors = new Set(window.__ct.actorColliders());
    return window.__ct.colliders().map((c, i) => ({
      i, actor: actors.has(c),
      minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ,
      minY: c.minY ?? null, maxY: c.maxY ?? null, tag: c.tag ?? null,
    }));
  };
});
// ⚠ SNAPSHOT ACROSS GAME HOURS, NOT ACROSS SECONDS — and I only got this right
// on the second attempt. The first cut took 8 readings 700 ms apart and found
// **zero** movers, which reads exactly like "already fixed". It is not: a game
// day is **24 REAL MINUTES**, and the sibling finding this came in with names
// the mechanism outright — *"a 0.52 m box is known to move from x 202.52 to
// 201.95 over HOURS 17–23"*. Anything driven by the schedule is motionless
// across any window a probe is willing to sit through in real time. So the
// clock is driven instead, which is what `__ct.clock(h, m)` is for.
//
// CLOCK=0 falls back to the wall-clock sampling, so the negative case (a box
// that moves on its own, per frame) is still reachable from the same probe.
// DAYS=n sweeps whole GAME DAYS instead of hours, because a second family of
// boxes only moves on the daily roll: every package cap's side flips with
// `pkgRoll(num, day, 7)` (ct/apartment.ts:2350), so a 24-hour sweep inside ONE
// day cannot see them move at all. Forcing packages on first makes the
// population deterministic instead of waiting on a 1-in-n spawn chance.
const BY_CLOCK = process.env.CLOCK !== '0';
const DAYS = Number(process.env.DAYS ?? 0);
const snaps = [];
const labels = [];
if (DAYS) {
  await p.evaluate(() => window.__ct.forcePackages?.(true));
  for (let d = 0; d < DAYS; d++) {
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await p.waitForTimeout(120);
    snaps.push(await p.evaluate(() => window.__grab()));
    labels.push(`day${d}`);
    await p.evaluate(() => window.__ct.advanceClock(1440));
  }
} else if (BY_CLOCK) {
  for (let h = 0; h < 24; h++) {
    await p.evaluate((hh) => window.__ct.clock(hh, 0), h);
    // a frame has to run for the schedule to move anything
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await p.waitForTimeout(120);
    snaps.push(await p.evaluate(() => window.__grab()));
    labels.push(`${String(h).padStart(2, '0')}:00`);
  }
} else {
  for (let k = 0; k < WAITS; k++) {
    snaps.push(await p.evaluate(() => window.__grab()));
    labels.push(`+${k * GAP}ms`);
    await p.waitForTimeout(GAP);
  }
}

console.log(`\n${snaps.length} snapshots — ${DAYS ? 'one per GAME DAY, packages forced on' : BY_CLOCK ? 'one per GAME HOUR, 00:00…23:00' : `${GAP} ms apart`}.`);
console.log(`collider count over time: ${snaps.map((s) => s.length).join(' -> ')}`);
console.log(`actors over time:         ${snaps.map((s) => s.filter((c) => c.actor).length).join(' -> ')}`);
console.log(`statics over time:        ${snaps.map((s) => s.filter((c) => !c.actor).length).join(' -> ')}`);

// A box that is NOT an actor and whose extents change between snapshots.
const n = Math.min(...snaps.map((s) => s.length));
const movers = [];
for (let i = 0; i < n; i++) {
  const series = snaps.map((s) => s[i]);
  if (series.some((c) => c.actor)) continue;             // declared moving; fine
  const dx = Math.max(...series.map((c) => c.minX)) - Math.min(...series.map((c) => c.minX));
  const dz = Math.max(...series.map((c) => c.minZ)) - Math.min(...series.map((c) => c.minZ));
  if (dx < 1e-6 && dz < 1e-6) continue;
  const c0 = series[0];
  movers.push({
    i, dx, dz,
    w: c0.maxX - c0.minX, d: c0.maxZ - c0.minZ,
    tag: c0.tag,
    from: `(${c0.minX.toFixed(2)}, ${c0.minZ.toFixed(2)})`,
    to: `(${series[series.length - 1].minX.toFixed(2)}, ${series[series.length - 1].minZ.toFixed(2)})`,
    track: series.map((c, k) => `${labels[k]}=${c.minX.toFixed(2)}/${c.minZ.toFixed(2)}`).join('  '),
  });
}

console.log(`\nboxes in staticColliders() that MOVED across the ${snaps.length} readings: ${movers.length}\n`);
if (!movers.length) {
  console.log('  none — every non-actor box held still. Either it is fixed, or this run');
  console.log('  did not catch it moving; re-run with a longer GAP_MS before believing it.');
}
for (const m of movers) {
  console.log(`  slot ${String(m.i).padStart(3)}  ${m.w.toFixed(3)} × ${m.d.toFixed(3)} m`
    + `  tag ${m.tag ?? '(none)'}`);
  console.log(`      moved dx ${m.dx.toFixed(3)} dz ${m.dz.toFixed(3)}   ${m.from} -> ${m.to}`);
  console.log(`      track ${m.track}`);
}

// And the 0.27 m box specifically, whether or not it moved this run — knowing
// where it is is what makes it greppable.
const small = await p.evaluate(() => {
  const actors = new Set(window.__ct.actorColliders());
  return window.__ct.colliders()
    .map((c) => ({ w: c.maxX - c.minX, d: c.maxZ - c.minZ, minX: c.minX, minZ: c.minZ,
                   minY: c.minY ?? null, maxY: c.maxY ?? null, tag: c.tag ?? null, actor: actors.has(c) }))
    .filter((c) => c.w < 0.4 && c.d < 0.4 && c.minX > 100)
    .map((c) => ({ ...c, w: +c.w.toFixed(3), d: +c.d.toFixed(3),
                   minX: +c.minX.toFixed(2), minZ: +c.minZ.toFixed(2) }));
});
console.log(`\nsub-0.4 m boxes in the interior belt (x > 100): ${small.length}`);
for (const s of small) {
  console.log(`  ${s.w} × ${s.d} m at (${s.minX}, ${s.minZ})  y ${s.minY}…${s.maxY}`
    + `  tag ${s.tag ?? '(none)'}  ${s.actor ? 'ACTOR' : 'STATIC'}`);
}
await b.close();
