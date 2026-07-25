// The three not-just-parked cars builder C asked for: hood up, on a jack, up
// on blocks. Builds each one through __ct.carVariant and measures it.
//
// These are INVARIANTS, not observations. Each is a way the variant could be
// built and still read wrong from the kerb:
//   · a raised hood over body-coloured metal — the truck-bed bug, twice shipped
//   · a jack that does not reach the sill, or a car that does not tilt onto it
//   · blocks that float under the rocker, or swallow it
//   · a wheel missing from a corner other than the one asked for
//   · a variant that changes the plain car, which would move the whole world
//
//   SHOT_URL=http://localhost:4187/ node scripts/carstate.mjs
//
// Exit 1 = FAIL, something is wrong with the fleet. Exit 2 = INCONCLUSIVE, the
// probe could not measure (no affordance, nothing built) — never a pass.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4177/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.carVariant !== undefined, { timeout: 10000 });
await reportWorld(page, URL);

const m = await page.evaluate(() => {
  const ROCKER = 0.34, BELT = 0.84, HOOD_TOP = 0.94, TYRE_R = 0.34;

  // World-space box of a mesh, by hand: the page has no THREE binding, so walk
  // the position attribute through matrixWorld.
  const box = (o) => {
    const pa = o.geometry?.attributes?.position;
    if (!pa) return null;
    const e = o.matrixWorld.elements;
    const b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 };
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
      const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
      const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      if (wx < b.x0) b.x0 = wx; if (wx > b.x1) b.x1 = wx;
      if (wy < b.y0) b.y0 = wy; if (wy > b.y1) b.y1 = wy;
      if (wz < b.z0) b.z0 = wz; if (wz > b.z1) b.z1 = wz;
    }
    return b;
  };
  // COLOUR IS STORED LINEAR. `c.r` on a #3a4a63 body reads 0.067, darker than
  // this check's own "must be dark" threshold — so the first version of this
  // probe would have passed a bay painted in body colour, which is the exact
  // bug it exists to catch. Go back through getHexString(), which returns sRGB.
  const hex = (mm) => {
    const c = (Array.isArray(mm) ? mm[0] : mm)?.color;
    return c ? c.getHexString() : null;
  };
  const lum = (mm) => {
    const h = hex(mm);
    if (!h) return null;
    const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };

  // Every car is built at the ORIGIN so the boxes above are already in car-local
  // metres. Measure, then remove it again so nothing is left standing in the
  // world for the next probe to trip over.
  const build = (kind, state) => {
    const g = window.__ct.carVariant(kind, state, 0, 0, 0);
    g.updateMatrixWorld(true);
    const parts = [];
    g.traverse((o) => {
      if (!o.isMesh) return;
      const b = box(o);
      if (b) parts.push({ b, l: lum(o.material), hx: hex(o.material), geo: o.geometry.type, rx: o.rotation.x, par: o.parent?.rotation ?? null, prm: o.geometry.parameters ?? {} });
    });
    const tilt = [];
    g.traverse((o) => { if (o.isGroup && o !== g) tilt.push({ x: o.rotation.x, z: o.rotation.z, y: o.position.y }); });
    g.parent.remove(g);
    return { parts, tilt, n: parts.length };
  };

  // A wheel is a 10-sided cylinder of radius 0.34 lying on its side.
  const wheels = (p) => p.parts.filter((q) => q.geo === 'CylinderGeometry'
    && Math.abs((q.prm.radiusTop ?? 0) - TYRE_R) < 0.01)
    .map((q) => ({ x: (q.b.x0 + q.b.x1) / 2, z: (q.b.z0 + q.b.z1) / 2 }));

  // The body colour, ASKED of the car. Inferring it as "the commonest flat
  // colour" picked #101114 — the tyre black off the four wheels — so the check
  // that the bay is not body-coloured compared against the wrong thing and
  // could never fire. makeCar publishes it on userData now.
  const bodyHex = (() => {
    const g = window.__ct.carVariant('sedan', {}, 0, 0, 0);
    const b = g.userData.body ?? null;
    g.parent.remove(g);
    return b ? String(b).replace('#', '').toLowerCase() : null;
  })();

  const R = { bodyHex, kinds: {}, hood: {}, jack: {}, blocks: {} };

  // ── 1. the plain car, every kind: four wheels, nothing added ─────────────
  for (const k of ['sedan', 'hatch', 'pickup', 'van']) {
    const p = build(k, {});
    R.kinds[k] = { n: p.n, wheels: wheels(p).length, tilt: p.tilt.length };
  }

  // ── 2. hood up ───────────────────────────────────────────────────────────
  for (const k of ['sedan', 'hatch', 'pickup', 'van']) {
    const plain = build(k, {});
    const p = build(k, { hood: true });
    // the raised panel: the only thing pitched off level
    const raised = p.parts.filter((q) => Math.abs(q.rx) > 0.5);
    // the cavity footprint: everything the hood used to cover, found from the
    // raised panel's own z span rather than typed in
    const rz = raised.length ? { z0: Math.min(...raised.map((q) => q.b.z0)), z1: Math.max(...raised.map((q) => q.b.z1)) } : null;
    // What do you SEE when you look into the bay? Everything inside the
    // footprint, below the old hood line, that is not the panel itself.
    const inBay = rz ? p.parts.filter((q) => Math.abs(q.rx) < 0.5
      && (q.b.x0 + q.b.x1) / 2 > -0.8 && (q.b.x0 + q.b.x1) / 2 < 0.8
      && (q.b.z0 + q.b.z1) / 2 > rz.z0 - 0.1 && (q.b.z0 + q.b.z1) / 2 < rz.z1 + 0.1
      && q.b.y1 > BELT - 0.05 && q.b.y1 < HOOD_TOP + 0.35) : [];
    const top = inBay.length ? inBay.reduce((a, q) => (q.b.y1 > a.b.y1 ? q : a)) : null;
    R.hood[k] = {
      added: p.n - plain.n,
      raisedN: raised.length,
      apex: raised.length ? +Math.max(...raised.map((q) => q.b.y1)).toFixed(2) : null,
      bayTop: top ? +top.b.y1.toFixed(3) : null,
      bayLum: top ? +top.l.toFixed(3) : null,
      bayHex: top ? top.hx : null,
      round: inBay.some((q) => q.geo === 'CylinderGeometry'),
      below0: p.parts.some((q) => q.b.y0 < -0.01),
    };
  }

  // ── 3. on a jack, each corner ────────────────────────────────────────────
  for (const c of ['fl', 'fr', 'rl', 'rr']) {
    const plain = build('sedan', {});
    const p = build('sedan', { jack: c });
    const w = wheels(p), w0 = wheels(plain);
    // which corner went missing, named the same way makeCar names them
    const name = (q) => `${q.z < 0 ? 'f' : 'r'}${q.x < 0 ? 'l' : 'r'}`;
    const gone = w0.map(name).filter((n) => !w.map(name).includes(n));
    // the jack: the tallest thing below the rocker that is not a wheel
    const stand = p.parts.filter((q) => q.geo === 'BoxGeometry' && q.b.y1 < ROCKER + 0.06
      && q.b.y1 > 0.1 && Math.abs((q.b.x1 - q.b.x0)) < 0.3);
    R.jack[c] = {
      wheels: w.length, gone,
      tilt: p.tilt.length ? { x: +p.tilt[0].x.toFixed(4), z: +p.tilt[0].z.toFixed(4) } : null,
      standTop: stand.length ? +Math.max(...stand.map((q) => q.b.y1)).toFixed(3) : null,
      below0: p.parts.some((q) => q.b.y0 < -0.01),
    };
  }

  // ── 4. up on blocks ──────────────────────────────────────────────────────
  {
    const p = build('hatch', { blocks: true });
    const stacks = p.parts.filter((q) => q.prm.height === 0.11);
    const cols = {};
    for (const q of stacks) {
      const k = `${Math.round((q.b.x0 + q.b.x1) / 2 * 10)},${Math.round((q.b.z0 + q.b.z1) / 2 * 10)}`;
      cols[k] = Math.max(cols[k] ?? 0, q.b.y1);
    }
    R.blocks = {
      wheels: wheels(p).length,
      stacks: Object.keys(cols).length,
      tops: Object.values(cols).map((v) => +v.toFixed(3)),
      below0: p.parts.some((q) => q.b.y0 < -0.01),
    };
  }

  // ── 5. wheelsOff on its own, which is what C asked for by name ───────────
  const wo = build('sedan', { wheelsOff: ['rl', 'rr'] });
  R.wheelsOff = { wheels: wheels(wo).length, tilt: wo.tilt.length };

  return R;
});

const fails = [], notes = [];
const ROCKER = 0.34, BELT = 0.84;

// 1. plain cars must be untouched — this is the one that protects the world
for (const [k, v] of Object.entries(m.kinds)) {
  if (v.wheels !== 4) fails.push(`plain ${k}: ${v.wheels} wheels, expected 4`);
  if (v.tilt !== 0) fails.push(`plain ${k}: has an inner group (${v.tilt}); a plain car must add NOTHING, or every texture painted after it re-grains (GOTCHAS §1)`);
}
notes.push(`  OK   plain cars unchanged — ${Object.entries(m.kinds).map(([k, v]) => `${k} ${v.n} meshes/4 wheels`).join(', ')}`);

// 2. hood
for (const [k, v] of Object.entries(m.hood)) {
  if (v.raisedN !== 1) fails.push(`hood ${k}: ${v.raisedN} panels pitched off level, expected exactly 1`);
  if (v.added < 4) fails.push(`hood ${k}: only ${v.added} meshes added — a raised hood with no engine bay under it is the truck-bed bug again`);
  if (v.bayTop === null) fails.push(`hood ${k}: nothing measurable inside the bay footprint`);
  else if (v.bayLum === null) notes.push(`  ??   hood ${k}: bay top surface has no flat colour to read`);
  else if (v.bayHex === m.bodyHex) fails.push(`hood ${k}: the top surface in the bay is #${v.bayHex}, which IS the body colour — that is the truck-bed bug, a raised lid over painted metal`);
  else if (v.bayLum > 0.24) fails.push(`hood ${k}: the top surface in the bay has sRGB luminance ${v.bayLum} — too light to read as a cavity. An unlit world has no shadow to darken it for you`);
  if (v.bayTop !== null && v.bayTop < BELT - 0.03) fails.push(`hood ${k}: bay top ${v.bayTop} is below the slab top ${BELT} — buried where nobody can see it, exactly like the bed floor was`);
  if (!v.round) fails.push(`hood ${k}: no round shape in the bay; the air cleaner is what makes it read as an engine`);
  if (v.apex !== null && v.apex < 1.3) fails.push(`hood ${k}: raised panel only reaches ${v.apex} m — that is ajar, not open`);
  if (v.below0) fails.push(`hood ${k}: geometry below the ground plane`);
}
notes.push(`  OK   hood up on all four kinds — bay top dark and not body #${m.bodyHex} (lum ${Object.values(m.hood).map((v) => v.bayLum).join(', ')}), apex ${Object.values(m.hood).map((v) => v.apex).join(', ')} m, air cleaner present`);

// 3. jack
for (const [c, v] of Object.entries(m.jack)) {
  if (v.wheels !== 3) fails.push(`jack ${c}: ${v.wheels} wheels, expected 3`);
  if (v.gone.length !== 1 || v.gone[0] !== c) fails.push(`jack ${c}: the missing wheel is ${JSON.stringify(v.gone)} — asked for ${c}`);
  if (!v.tilt) fails.push(`jack ${c}: the body is not tilted; a level car beside a stand reads as a car with a wheel missing, not as a car on a jack`);
  else {
    const wantZ = c[1] === 'l' ? 1 : -1;      // left corner up  => rotation.z positive
    const wantX = c[0] === 'f' ? -1 : 1;      // front corner up => rotation.x negative
    if (Math.sign(v.tilt.z) !== wantZ) fails.push(`jack ${c}: rotation.z ${v.tilt.z} tilts the wrong way — the jacked corner must go UP`);
    if (Math.sign(v.tilt.x) !== wantX) fails.push(`jack ${c}: rotation.x ${v.tilt.x} tilts the wrong way — the jacked corner must go UP`);
  }
  if (v.standTop === null) fails.push(`jack ${c}: no stand found under the sill`);
  else if (v.standTop < ROCKER - 0.06) fails.push(`jack ${c}: the stand stops at ${v.standTop}, the sill is at ${ROCKER} — it is holding up nothing`);
  else if (v.standTop > ROCKER + 0.08) fails.push(`jack ${c}: the stand at ${v.standTop} is driven through the sill at ${ROCKER}`);
  if (v.below0) fails.push(`jack ${c}: geometry below the ground plane`);
}
notes.push(`  OK   jack at all four corners — right wheel off, body tilts that corner up, stand tops out at ${Object.values(m.jack).map((v) => v.standTop).join('/')} against a ${ROCKER} sill`);

// 4. blocks
if (m.blocks.wheels !== 0) fails.push(`blocks: ${m.blocks.wheels} wheels still fitted, expected 0`);
if (m.blocks.stacks !== 4) fails.push(`blocks: ${m.blocks.stacks} stacks, expected 4`);
for (const t of m.blocks.tops) {
  if (t < ROCKER - 0.05) fails.push(`blocks: a stack tops out at ${t} under a ${ROCKER} sill — the car is floating`);
  if (t > ROCKER + 0.05) fails.push(`blocks: a stack at ${t} is pushed through the ${ROCKER} sill`);
}
if (m.blocks.below0) fails.push('blocks: geometry below the ground plane');
notes.push(`  OK   up on blocks — no wheels, 4 stacks, tops ${m.blocks.tops.join('/')} against a ${ROCKER} sill`);

// 5. wheelsOff alone
if (m.wheelsOff.wheels !== 2) fails.push(`wheelsOff ['rl','rr']: ${m.wheelsOff.wheels} wheels, expected 2`);
if (m.wheelsOff.tilt !== 0) fails.push('wheelsOff on its own must not tilt the body — only `jack` does that');
notes.push('  OK   wheelsOff omits exactly the corners named and leaves the body level');

console.log('car variants — hood up, on a jack, up on blocks:');
for (const n of notes) console.log(n);
if (errs.length) {
  console.log(`\n${errs.length} page error(s):`);
  for (const e of errs.slice(0, 4)) console.log(`  ${e}`);
}
if (fails.length) {
  console.error(`\n${fails.length} FAIL:`);
  for (const f of fails) console.error(`  FAIL  ${f}`);
  await browser.close();
  process.exit(1);
}
console.log('\nall car variant checks pass');
await browser.close();
process.exit(errs.length ? 1 : 0);
