// EVERY GLAZED SHOPFRONT HAS AN OPAQUE ROOM BEHIND IT.
//
// An ASSERTION, and it exits non-zero.
//
// The user, twice: "this is a part of the bodega corner that needs to be fixed
// i flagged this to you a while ago but its still here". The sidewalk is ONE
// plane running from the kerb straight on under the buildings, which was
// invisible while shopfront glass was an opaque dark rectangle. Once the glass
// got depth and translucency the walk showed through it — the slab scoring ran
// into the doorway and carried on inside the shop, so the bodega had a
// pavement for a floor.
//
// The fix is a backing, not a transparency change, and it has to be on EVERY
// front rather than on the one the chamfer made easy to see. This is that
// claim, checked over the whole registered set instead of the ones somebody
// remembered to walk — the bodega's own misalignment went unnoticed for a long
// time for exactly that reason.
//
// The backing is `shopfrontRelief`'s room plane: a `shopInteriorTex`-mapped
// PlaneGeometry the width of the frontage, set back behind the glass, with no
// transparency of any kind. So the test is per-frontage: is there such a plane
// within the frontage's span, behind its face, opaque, and wide enough to
// cover the glazing?
//
// NOT REGISTERED in checks.mjs and no selftest committed yet.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4188/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);

const rows = await p.evaluate(() => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const planes = [];
  scene.traverse((n) => {
    if (!n.isMesh || Array.isArray(n.material)) return;
    const gm = n.geometry;
    if (!gm || gm.type !== 'PlaneGeometry') return;
    const m = n.material;
    if (!m.map || !m.map.image) return;
    const e = n.matrixWorld.elements;
    planes.push({
      x: e[12], y: e[13], z: e[14],
      w: gm.parameters.width, h: gm.parameters.height,
      transparent: !!m.transparent, alphaTest: m.alphaTest || 0,
      surface: m.map.userData?.surface ?? null,
    });
  });
  return (globalThis.__frontages || []).map((f) => {
    const lo = Math.min(f.loWorld, f.hiWorld), hi = Math.max(f.loWorld, f.hiWorld);
    const glazW = Math.abs(f.glazingHiWorld - f.glazingLoWorld);
    // a backing is BEHIND the facade plane (on the far side from the street)
    const hits = planes.filter((q) => {
      const along = f.axis === 'z' ? q.z : q.x;
      const across = f.axis === 'z' ? q.x : q.z;
      if (along < lo - 0.5 || along > hi + 0.5) return false;
      const depth = (across - f.facePos) * f.outward;      // negative = set back
      if (depth > -0.05 || depth < -1.2) return false;
      if (q.y < 0.5 || q.y > 4.5) return false;
      return true;
    });
    const opaque = hits.filter((q) => !q.transparent && !(q.alphaTest > 0));
    const covering = opaque.filter((q) => q.w >= glazW - 0.05 && q.h >= 2.0);
    return {
      name: f.name, glazW: +glazW.toFixed(2),
      hits: hits.length, opaque: opaque.length, covering: covering.length,
      widest: opaque.length ? +Math.max(...opaque.map((q) => q.w)).toFixed(2) : 0,
    };
  });
});
await b.close();

// GOTCHAS 34: assert the population before the absence — "all backed" is free
// over an empty frontage list, and this is exactly the predicate that rots.
if (rows.length < 10) {
  console.error(`ABORT: only ${rows.length} frontages registered — nothing to check.`);
  process.exit(3);
}

console.log(`\n  ${rows.length} registered frontages\n`);
const bad = rows.filter((r) => r.covering === 0);
for (const r of rows) {
  const ok = r.covering > 0;
  console.log(`  ${ok ? 'OK  ' : 'MISS'} ${r.name.padEnd(14)} glazing ${String(r.glazW).padStart(6)} m   `
    + `backing planes ${r.hits} (opaque ${r.opaque}, widest ${r.widest} m)`);
}
console.log('');
if (bad.length) {
  console.error(`FAIL: ${bad.length} shopfront(s) with no opaque plane behind the glass — `
    + `${bad.map((r) => r.name).join(', ')}. The pavement runs on under the building, `
    + 'so the glass shows a floor made of sidewalk.');
  process.exit(1);
}
console.log('OK  every registered shopfront has an opaque room behind its glass.');

// ── AND THE ONE THE FRONTAGE LIST CANNOT SEE ───────────────────────────────
//
// The pass above proves nothing about the corner the user actually pointed at.
// The BODEGA's shopfront is a CANTED BAY, and ct/tex-world.ts says in as many
// words that the bay's door "is deliberately never handed to the painter" — so
// it is absent from `__frontages`, and the BODEGA row above is the flat
// side-street elevation, not the chamfer. An audit that reads the frontage
// list and reports "every shopfront is backed" is telling you about every
// shopfront except the one that was reported.
//
// So check the INVARIANT rather than the roster: the bay front is a plane with
// `alphaTest`, which DISCARDS texels — 861 of its 3015, measured — and any
// face that punches real holes must have something opaque behind it or you see
// the pavement running on under the building. That rule catches the bay
// without needing to know it exists.
const bay = await (async () => {
  const b2 = await chromium.launch();
  const p2 = await b2.newPage();
  await p2.goto(URL, { waitUntil: 'networkidle' });
  await p2.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
  const out = await p2.evaluate(() => {
    const scene = window.__ct.scene();
    scene.updateMatrixWorld(true);
    const all = [];
    scene.traverse((n) => {
      if (!n.isMesh || Array.isArray(n.material)) return;
      if (!n.geometry || n.geometry.type !== 'PlaneGeometry') return;
      const e = n.matrixWorld.elements;
      // world normal = third basis column of the world matrix
      all.push({
        x: e[12], y: e[13], z: e[14],
        nx: e[8], ny: e[9], nz: e[10],
        w: n.geometry.parameters.width, h: n.geometry.parameters.height,
        cut: (n.material.alphaTest || 0) > 0,
        transparent: !!n.material.transparent,
        mapped: !!n.material.map,
      });
    });
    // Cut-out faces at shop-band scale, ON THE SHOPFRONT RUN.
    //
    // The scope matters more than the predicate. "Any cut-out plane 1.5 m wide
    // at street height" also catches nine faces thirty metres west of the block
    // that carry no `mod` and no `surface` stamp and are not shopfronts at all;
    // five of them have nothing behind them, quite possibly correctly. Filing
    // those as shopfront faults is GOTCHAS 22's warning exactly — thirteen
    // findings filed twice against a module that held none of them, and a
    // finding routed to the wrong owner is a finding that dies.
    //
    // So: near a REGISTERED frontage's face plane and within its span, with
    // enough tolerance to include the bodega's chamfer, which sits just off the
    // end of the flat elevation it turns the corner from.
    const fr = globalThis.__frontages || [];
    const onRun = (q) => fr.some((f) => {
      const along = f.axis === 'z' ? q.z : q.x;
      const across = f.axis === 'z' ? q.x : q.z;
      const lo = Math.min(f.loWorld, f.hiWorld), hi = Math.max(f.loWorld, f.hiWorld);
      return Math.abs(across - f.facePos) <= 3 && along >= lo - 3 && along <= hi + 3;
    });
    const cut = all.filter((q) => q.cut && q.mapped && q.w >= 1.5 && q.h >= 2.5
      && q.y > 0.5 && q.y < 4.5 && onRun(q));
    return cut.map((c) => {
      const behind = all.filter((q) => {
        if (q === c || q.transparent || q.cut || !q.mapped) return false;
        const dx = q.x - c.x, dy = q.y - c.y, dz = q.z - c.z;
        const along = dx * c.nx + dy * c.ny + dz * c.nz;      // -ve = behind
        if (along > -0.02 || along < -1.5) return false;
        const lat = Math.hypot(dx - along * c.nx, dz - along * c.nz);
        return lat < c.w && q.w >= c.w - 0.2 && q.h >= 2.0;
      });
      return { at: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)], w: +c.w.toFixed(2), backed: behind.length };
    });
  });
  await b2.close();
  return out;
})();

console.log(`\n  cut-out (alphaTest) shopfront faces, which the frontage list cannot see: ${bay.length}`);
for (const c of bay) {
  console.log(`  ${c.backed ? 'OK  ' : 'MISS'} plane ${c.w} m at (${c.at})  opaque planes behind: ${c.backed}`);
}
if (!bay.length) {
  console.error('\nABORT: no cut-out shopfront face found — the bodega bay is one, so this '
    + 'predicate has stopped matching and the verdict above is free.');
  process.exit(3);
}
const unbacked = bay.filter((c) => !c.backed);
if (unbacked.length) {
  console.error(`\nFAIL: ${unbacked.length} cut-out shopfront face(s) with nothing opaque behind them.`);
  process.exit(1);
}
console.log('\nOK  every cut-out shopfront face has an opaque plane behind it too.');
